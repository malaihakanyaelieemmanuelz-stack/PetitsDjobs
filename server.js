require('dotenv').config(); // Charge le fichier .env en local
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const geolib = require('geolib');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const sharp = require('sharp');

// --- DÉTECTION D'ERREURS GLOBALES (Pour voir pourquoi Render échoue) ---
console.log('📋 [SYSTEM] --- VÉRIFICATION STARTUP ---');
const requiredVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'RESEND_API_KEY'];
requiredVars.forEach(v => {
    if (!process.env[v]) {
        console.error(`❌❌❌ [CONFIG MANQUANTE] Variable absente : ${v} ❌❌❌\nCOPIEZ CECI ET VÉRIFIEZ L'ONGLET ENVIRONMENT SUR RENDER.`);
    } else {
        console.log(`✅ [OK] Variable détectée : ${v}`);
    }
});

const app = express();

// --- CONFIGURATION DES SESSIONS (Rétablie et Sécurisée) ---
app.use(session({
    secret: 'pdjobs-secure-key-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: 'pdjobs.sid',
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 semaine
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

// AJOUT : Indispensable pour que Render accepte les cookies de session
app.set('trust proxy', 1);

// Sécurité : s'assurer que le dossier uploads existe
if (!fs.existsSync('public/uploads/')) {
    fs.mkdirSync('public/uploads/', { recursive: true });
}

const upload = multer({ 
    dest: 'public/uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50 Mo (photos + vidéos showcase)
});

const port = process.env.PORT || 5500; // Utilise le port de Render si disponible

// --- Initialisation de Supabase ---
let supabase;
try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        throw new Error("Variables Supabase absentes.");
    }
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log("✅ [DB] Client Supabase initialisé.");
} catch (err) {
    console.error("❌❌❌ [ERREUR FATALE DB] Échec Supabase ❌❌❌\nMessage :", err.message, "\n📋 COPIEZ CECI POUR LE SUPPORT.");
    // On ne coupe pas le processus ici pour laisser le temps aux logs de s'afficher sur Render
}

// --- Initialisation de Resend (Remplacement de Nodemailer pour éviter les blocages SMTP) ---
if (!process.env.RESEND_API_KEY) {
    console.error("❌ [ERREUR] RESEND_API_KEY manquante. Les mails ne partiront pas.");
}
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
console.log("📨 [MAIL] Système Resend prêt.");

// Helper pour envoyer des emails sans faire crasher l'application
async function safeSendEmail(payload) {
    if (!resend) {
        console.warn("⚠️ [MAIL SKIP] Envoi annulé : RESEND_API_KEY non configuré dans Render.");
        return null;
    }
    try {
        const result = await resend.emails.send(payload); // Envoi direct au destinataire réel
        if (result.error) console.error("❌ [RESEND ERROR] :", result.error);
        return result;
    } catch (e) {
        console.error("❌ [MAIL CRITICAL ERROR] :", e.message);
        return null;
    }
}

// --- Test de connexion pour les logs Render ---
if (supabase) {
    supabase.from('utilisateurs').select('id').limit(1)
    .then(({ error }) => {
        if (error) {
            console.error('❌❌❌ [TEST DB ÉCHOUÉ] Impossible de lire la table utilisateurs ❌❌❌\nErreur :', error.message);
        } else {
            console.log('✅ [DB OK] Connexion à la base de données réussie.');
        }
    })
    .catch(err => console.error('❌ [ERREUR FATALE DB] :', err));
}

const PRIX_PAR_KM = 200;
const BATCH_PRESTATAIRES = 50;
const RAYON_MAX_METRES = 50000; // Limite standard à 50km
const BUCKET_NAME = 'prestataires';
const COMMISSION_PCT = 0.05; // 5 % prélevés sur le paiement client
const offresDiscuter = [];
const missionMeta = new Map(); // id mission -> { delaiMinutes, prestaFin, clientFin, refuseNotified }

function normaliserId(id) {
    return id == null ? null : String(id);
}

function libelleDateOffre(datePrevue) {
    return datePrevue === 'today' ? 'Maintenant' : datePrevue;
}

/** Dernière pub (photo/vidéo) par prestataire pour l'accueil */
async function enrichirAvecShowcase(prestataires) {
    if (!prestataires?.length || !supabase) return prestataires || [];
    const ids = prestataires.map(p => p.id).filter(id => id != null);
    if (!ids.length) return prestataires;

    const { data: rows, error } = await supabase
        .from('showcase')
        .select('user_id, url, media_type, created_at')
        .in('user_id', ids)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('[SHOWCASE] enrichissement ignoré:', error.message);
        return prestataires;
    }

    const map = {};
    (rows || []).forEach(r => {
        const k = String(r.user_id);
        if (!map[k]) map[k] = r;
    });

    return prestataires.map(p => ({
        ...p,
        showcaseUrl: map[String(p.id)]?.url || null,
        showcaseType: map[String(p.id)]?.media_type || null
    }));
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Middleware de journalisation des requêtes (Visible dans les logs Render)
app.use((req, res, next) => {
    // On ne log que les routes API pour éviter de polluer les logs avec le CSS/Images
    console.log(`🌐 [API] ${req.method} ${req.url} (User: ${req.session.user?.id || 'Invité'})`);
    next();
});

// ... (Le reste de ton code original reste identique ici) ...

function serviceMatch(prestataire, serviceDemande) {
    if (!serviceDemande) return true;
    const svc = serviceDemande.trim().toLowerCase();
    // On transforme la chaîne "Cuisine, Lavage" en tableau pour comparer
    const servicesStr = prestataire.services || '';
    const liste = servicesStr.split(',').map(s => s.trim().toLowerCase());
    if (liste.includes('tout')) return true;
    return liste.includes(svc);
}

function distanceMetres(p, lat, lon) {
    const clientLat = parseFloat(lat);
    const clientLon = parseFloat(lon);
    const prestaLat = parseFloat(p.lat);
    const prestaLon = parseFloat(p.lon);

    if (isNaN(clientLat) || isNaN(clientLon) || isNaN(prestaLat) || isNaN(prestaLon)) {
        return Infinity;
    }

    const dist = geolib.getDistance(
        { latitude: clientLat, longitude: clientLon },
        { latitude: prestaLat, longitude: prestaLon }
    );
    // Log supprimé ici pour éviter de polluer, on le gérera dans la boucle de recherche
    return dist;
}

/**
 * Récupère la distance réelle à pied via OSRM
 */
async function distanceMarcheReelle(lat1, lon1, lat2, lon2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=false`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            return data.routes[0].distance; // Distance en mètres
        }
    } catch (e) { console.error("Erreur OSRM:", e); }
    return null; // Retourne null en cas d'échec pour repli sur Haversine
}

/**
 * Formate la date de dernière connexion de façon humaine
 */
function formaterDernierAcces(dateIso, enLigne) {
    if (enLigne) return "En ligne";
    if (!dateIso) return "Hors ligne - Jamais connecté";
    
    const date = new Date(dateIso);
    const maintenant = new Date();
    
    // Comparaison des jours calendaires (minuit à minuit)
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const d2 = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    const diffJours = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    
    const heures = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const heureFormatee = `${heures}:${minutes}`;

    let info = "";
    if (diffJours === 0) {
        info = `aujourd'hui à ${heureFormatee}`;
    } else if (diffJours === 1) {
        info = `hier à ${heureFormatee}`;
    } else if (diffJours === 2) {
        info = `avant-hier à ${heureFormatee}`;
    } else {
        info = `le ${date.toLocaleDateString('fr-FR')} à ${heureFormatee}`;
    }
    return `Hors ligne - ${info}`;
}

async function chercherParRayonCroissant(lat, lon, query_text, offset, limit, excludeUserId, type = 'service') {
    try {
        const timestamp = new Date().toLocaleTimeString();
        
        // Nettoyage pour les logs Render
        const dLat = (lat && lat !== 'undefined') ? lat : '?';
        const dLon = (lon && lon !== 'undefined') ? lon : '?';
        console.log(`[DEBUG SEARCH ${timestamp}] Type=${type}, Query=${query_text || 'Tous (Accueil)'}, GPS=${dLat},${dLon}`);

        // 1. On récupère un pool plus large de prestataires pour garantir des résultats
        let query = supabase.from('infos_prestataires').select('*');
        
        // On récupère les 200 meilleurs profils sans filtre géographique initial
        query = query.order('etoiles', { ascending: false }).limit(200);

        const { data: prestataires, error: pError } = await query;
        
        if (pError) {
            console.error("[DEBUG SEARCH] Erreur Supabase:", pError.message);
            return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };
        }

        const nbInscritsTotalBase = prestataires?.length || 0;
        console.log(`[DEBUG SEARCH] --- DÉBUT FILTRAGE --- Total en base: ${nbInscritsTotalBase}`);

        // 2. On récupère les infos utilisateurs
        // Sécurité : Conversion en Number pour la requête .in() si IDs numériques
        const userIds = (prestataires || []).map(p => Number(p.user_id)).filter(id => !isNaN(id));
        console.log(`[DEBUG SEARCH] IDs à chercher dans 'utilisateurs': ${JSON.stringify(userIds)}`);
        
        if (userIds.length === 0) {
            console.log("[DEBUG SEARCH] Aucun ID valide trouvé dans infos_prestataires.");
            return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };
        }

        const { data: users, error: uError } = await supabase
            .from('utilisateurs')
            .select('*') 
            .in('id', userIds);

        if (uError) {
            console.error("❌ [DEBUG SEARCH] Erreur récupération utilisateurs:", uError.message);
        }
        console.log(`[DEBUG SEARCH] ${users?.length || 0} comptes utilisateurs trouvés correspondant aux prestataires.`);

        // On crée une map avec conversion forcée en String pour la clé
        const userMap = Object.fromEntries((users || []).map(u => [String(u.id), u]));

        const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;

        let eligibles = (prestataires || [])
            .filter(p => {
                const pIdStr = String(p.user_id);
                if (!pIdStr || pIdStr === 'undefined') return false;
                const exIdStr = excludeUserId ? String(excludeUserId) : null;

                // Filtrer l'utilisateur lui-même s'il est connecté
                if (exIdStr && pIdStr === exIdStr) {
                    console.log(`   -> [REJETÉ] Prestataire ${pIdStr} est l'utilisateur connecté.`);
                    return false;
                }

                const user = userMap[pIdStr];
                if (!user) {
                    console.log(`   -> ⚠️ [REJETÉ] Prestataire ID ${pIdStr} n'a pas de compte correspondant dans la table 'utilisateurs' !`);
                    return false;
                }

                // REGLE PRIORITAIRE : Si moins de 20 inscrits total, on ne filtre PAS par service sur l'accueil
                if (nbInscritsTotalBase <= 20 && !query_text) {
                    console.log(`   -> [VALIDÉ] Prestataire ${pIdStr} (${user.prenom}) gardé via la règle des < 20.`);
                    return true;
                }

                if (type === 'nom' && query_text) {
                    const q = query_text.trim().toLowerCase();
                    const nomComplet = `${user.prenom || ''} ${user.nom || ''}`.toLowerCase();
                    return nomComplet.includes(q);
                }

                // Par défaut : Recherche par service
                if (!query_text) return true;
                return serviceMatch(p, query_text);
            })
            .map(p => {
                const dist = distanceMetres(p, lat, lon);
                const user = userMap[String(p.user_id)];
                const dernierAccesTs = user?.dernier_acces ? new Date(user.dernier_acces).getTime() : 0;
                const enLigne = (Date.now() - dernierAccesTs) < SEUIL_EN_LIGNE_MS;

                // LOGIQUE DEMANDÉE : Photo Carte de Visite (prestataire) > Photo Inscription (utilisateur) > Défaut
                const photoFinale = p.photo_profil_url || user?.photo_url || user?.photo || 'default-profile.png';

                return { 
                    ...p, 
                    id: p.user_id,
                    nom: user?.nom || 'Inconnu', 
                    prenom: user?.prenom || '', 
                    enLigne: enLigne,
                    dernier_acces: user?.dernier_acces,
                    distanceM: dist,
                    photo: photoFinale
                };
            });

        const nbTotalInscrits = eligibles.length;
        console.log(`[DEBUG SEARCH] ${nbTotalInscrits} prestataires validés après vérification des comptes.`);

        // 3. Logique de tri "Proche en proche" (Algorithme spécifique)
        const onlineList = eligibles.filter(p => p.enLigne);
        const offlineList = eligibles.filter(p => !p.enLigne);

        // Fonction de tri commune (Distance > Étoiles > ID d'inscription)
        const genericSort = (a, b) => {
            if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
            if (a.etoiles !== b.etoiles) return (b.etoiles || 0) - (a.etoiles || 0);
            return a.id - b.id; // Plus petit ID = inscrit en premier
        };

        let results = [];

        if (onlineList.length < 20) {
            // SCÉNARIO A : Pas assez de monde en ligne
            // On affiche tous ceux en ligne d'abord, puis on complète avec les hors ligne par distance
            onlineList.sort(genericSort);
            offlineList.sort(genericSort);
            results = [...onlineList, ...offlineList];
        } else {
            // SCÉNARIO B : Beaucoup de monde en ligne
            // On utilise les tranches de 10m pour comparer en ligne et hors ligne
            eligibles.sort((a, b) => {
                // Tranches de 10 mètres
                const bucketA = Math.floor(a.distanceM / 10);
                const bucketB = Math.floor(b.distanceM / 10);
                
                if (bucketA !== bucketB) {
                    // Si un hors ligne est vraiment plus proche (tranche différente), il passe devant
                    return bucketA - bucketB;
                }
                // Dans la même tranche de 10m, priorité au statut En Ligne
                if (a.enLigne !== b.enLigne) return a.enLigne ? -1 : 1;
                // Puis étoiles et ID
                if (a.etoiles !== b.etoiles) return (b.etoiles || 0) - (a.etoiles || 0);
                return a.id - b.id;
            });
            results = eligibles;
        }

        // Règle d'affichage : Si moins de 20 prestataires AU TOTAL, on ignore la distance et on affiche tout
        let finalSelection = results;
        if (nbInscritsTotalBase > 20 && type === 'service' && query_text) {
            // On ne limite par rayon que si on a bcp de monde, sinon on montre tout par ordre
            finalSelection = results.filter(p => p.distanceM <= RAYON_MAX_METRES);
        }

        console.log(`[DEBUG SEARCH] Résultat final : Envoi de ${finalSelection.length} prestataires.`);

        const limitFixe = limit || 20;
        const page = finalSelection.slice(offset, offset + limitFixe);

        return {
            prestataires: page.map(p => ({
                id: p.user_id,
                nom: p.nom,
                prenom: p.prenom,
                profession: p.profession,
                bio: p.bio,
                photo: p.photo, // UTILISATION DU FALLBACK CALCULÉ
                ville: p.ville,
                services: p.services,
                etoiles: p.etoiles,
                nbAvis: (p.commentaires || []).length,
                distanceM: Math.round(p.distanceM),
                distanceKm: (p.distanceM / 1000).toFixed(2),
                disponible: p.enLigne,
                dernierAcces: formaterDernierAcces(p.dernier_acces, p.enLigne),
                telephone: p.autorise_numero_deconnexion ? p.telephone : null
            })),
            rayonMetres: page.length ? Math.max(...page.map(p => p.distanceM)) : 0,
            hasMore: results.length > offset + limitFixe,
            total: nbTotalInscrits
        };
    } catch (err) {
        console.error("SEARCH ERROR:", err);
        return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };
    }
}

function prixDistanceFcfa(distanceMetres) {
    const km = distanceMetres / 1000;
    return Math.round(km * PRIX_PAR_KM);
}

// --- FIX : estConnecte ultra-sécurisé contre les "TypeError" ---
function estConnecte(req) {
    if (!req || !req.session || !req.session.user) return false;
    return !!(req.session.user.email);
}

function requireAuth(req, res, next) {
    if (req && req.session && estConnecte(req)) return next();
    return res.redirect('/connexion');
}

function redirectSiConnecte(req, res, next) {
    if (req && req.session && estConnecte(req)) return res.redirect('/index.html');
    next();
}

const publicDir = path.join(__dirname, 'public');

// --- Routes ---
function pageConnexion(req, res) { res.sendFile(path.join(publicDir, 'connexion.html')); }
function pageInscription(req, res) { res.sendFile(path.join(publicDir, 'inscription.html')); }
function pageAccueil(req, res) { res.sendFile(path.join(publicDir, 'index.html')); }

app.get('/connexion', redirectSiConnecte, pageConnexion);
app.get('/connexion.html', redirectSiConnecte, pageConnexion);
app.get('/inscription', redirectSiConnecte, pageInscription);
app.get('/inscription.html', redirectSiConnecte, pageInscription);
app.get('/politique', (req, res) => res.sendFile(path.join(publicDir, 'pollitique.html')));

app.get('/', pageAccueil);
app.get('/index.html', pageAccueil);
app.get('/profil', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'profil.html')));
app.get('/prestataire', requireAuth, (req, res) => {
    if (req.session.user.isPrestataire && req.query.modifier !== '1') {
        return res.redirect('/prestataire-info');
    }
    res.sendFile(path.join(publicDir, 'prestataire.html'));
});
app.get('/prestataire-info', requireAuth, (req, res) => {
    if (!req.session.user.isPrestataire) return res.redirect('/prestataire');
    res.sendFile(path.join(publicDir, 'prestataire-info.html'));
});
app.get('/choisir-prestataire', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'choisir-prestataire.html')));
app.get('/commande', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'commande.html')));
app.get('/discuter', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'discuter.html')));
app.get('/voir-prestataire', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'voir-prestataire.html')));

app.get('/suivi', requireAuth, async (req, res) => {
    try {
        // On récupère l'ID de la mission depuis l'URL ou la session
        const missionId = req.query.missionId || req.session.commande?.missionId;
        
        if (missionId) {
            if (!req.session.commande) req.session.commande = {};
            req.session.commande.missionId = missionId;

            const { data: mission } = await supabase.from('missions').select('prestataire_id, client_id').eq('id', missionId).maybeSingle();
            if (mission) {
                // Si l'utilisateur connecté est le prestataire de CETTE mission
                if (String(req.session.user.id) === String(mission.prestataire_id)) {
                    return res.sendFile(path.join(publicDir, 'suivi-prestataire.html'));
                } 
                // Sinon, s'il est le client de CETTE mission
                return res.sendFile(path.join(publicDir, 'suivi-client.html'));
            }
        }
        // Fallback par défaut si aucune mission n'est spécifiée
        res.sendFile(req.session.user.isPrestataire ? path.join(publicDir, 'suivi-prestataire.html') : path.join(publicDir, 'suivi-client.html'));
    } catch (e) {
        res.redirect('/index.html');
    }
});

app.get('/attente-prestataire', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'attente-prestataire.html')));
app.get('/reinitialiser-mdp', (req, res) => res.sendFile(path.join(publicDir, 'reinitialiser-mdp.html')));
app.get('/recuperation-mdp', (req, res) => res.sendFile(path.join(publicDir, 'recuperation-mdp.html')));
app.get('/mes-commandes', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'mes-commandes.html')));
app.get('/appele', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'appele.html')));

app.post('/deconnexion', async (req, res) => {
    if (req.session.user) {
        // On force le statut hors ligne en réglant le dernier accès à 10 minutes dans le passé
        const horsLigneDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        await supabase.from('utilisateurs').update({ dernier_acces: horsLigneDate }).eq('id', req.session.user.id);
    }
    req.session.destroy(() => res.redirect('/index.html'));
});

// --- API ---
app.get('/get-user-data', async (req, res) => {
    console.log(`🌐 [API] /get-user-data - User: ${req.session.user?.id || 'Invité'}, Photo: ${req.session.user?.photo ? 'OK' : 'Manquante'}`);
    if (!req.session.user) return res.json({});
    const user = { ...req.session.user };
    if (user.isPrestataire && supabase) {
        const { data: profil } = await supabase.from('infos_prestataires')
            .select('commentaires, etoiles')
            .eq('user_id', user.id)
            .maybeSingle();
        if (profil) {
            user.commentaires = profil.commentaires || [];
            user.etoiles = profil.etoiles ?? user.etoiles;
        }
    }
    res.json(user);
});

app.get('/get-session-commande', async (req, res) => {
    const cmd = req.session.commande;
    console.log(`🌐 [API] /get-session-commande - MissionId: ${cmd?.missionId || 'Aucun'}`);
    if (cmd && cmd.prestataireId) {
        // Rafraîchir dynamiquement le statut de disponibilité du prestataire choisi
        const { data: user } = await supabase.from('utilisateurs')
            .select('dernier_acces')
            .eq('id', cmd.prestataireId)
            .maybeSingle();
        if (user) {
            const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;
            const enLigne = (Date.now() - new Date(user.dernier_acces).getTime()) < SEUIL_EN_LIGNE_MS;
            req.session.commande.disponible = enLigne;
        }
    }
    res.json(req.session.commande || {});
});

// Route pour obtenir le nombre total de prestataires inscrits
app.get('/api/total-prestataires', async (req, res) => {
    const { count } = await supabase.from('infos_prestataires').select('*', { count: 'exact', head: true });
    res.json({ total: count || 0 });
});

app.get('/get-all-prestataires', async (req, res) => {
    const { data: prestataires } = await supabase.from('infos_prestataires').select('*');
    if (!prestataires) return res.json([]);
    console.log(`[DEBUG API] get-all-prestataires appelé. Nombre total: ${prestataires.length}`);
    const userIds = prestataires.map(p => p.user_id);
    const { data: users } = await supabase.from('utilisateurs').select('id, nom, prenom').in('id', userIds);
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    res.json(prestataires
        .filter(p => userMap[p.user_id] && p.user_id !== req.session.user?.id)
        .map(p => ({
            ...p,
            nom: userMap[p.user_id].nom,
            prenom: userMap[p.user_id].prenom
        }))
    );
});

app.get('/prestataires-autour', requireAuth, async (req, res) => {
    const lat = parseFloat(req.query.lat) || req.session.latClient;
    const lon = parseFloat(req.query.lon) || req.session.lonClient;
    const service = req.query.service || '';
    if (lat == null || lon == null) {
        return res.json({ prestataires: [], message: 'Activez le GPS pour voir qui est près de vous.' });
    }
    const result = await chercherParRayonCroissant(lat, lon, service || null, 0, 6, req.session.user?.id);
    res.json({ prestataires: result.prestataires, total: result.total });
});

app.get('/get-top-prestataires', async (req, res) => {
    try {
        // On ignore les valeurs 'undefined' envoyées comme du texte par le navigateur
        let lat = req.query.lat === 'undefined' ? null : req.query.lat;
        let lon = req.query.lon === 'undefined' ? null : req.query.lon;

        lat = lat || req.session?.latClient;
        lon = lon || req.session?.lonClient;

        const userId = req.session?.user?.id;
        const result = await chercherParRayonCroissant(lat, lon, null, 0, BATCH_PRESTATAIRES, userId);
        
        // On garde tous les prestataires, même s'ils sont inactifs depuis longtemps
        const filtered = await enrichirAvecShowcase(result.prestataires);

        console.log(`[DEBUG TOP] ${filtered.length} prestataires proches envoyés.`);
        res.json(filtered);
    } catch (err) {
        console.error("DEBUG RENDER: Erreur /get-top-prestataires", err);
        res.json([]);
    }
});

app.get('/session-status', (req, res) => {
    res.json({
        loggedIn: estConnecte(req),
        remember: !!req.session.remember,
        localisationAutorisee: !!req.session.localisationAutorisee
    });
});

app.post('/preparer-commande', (req, res) => {
    const { service, prix, prixLibre, missionId, offreParticulierId } = req.body;
    // FIX: Fusionner avec la session existante pour ne pas perdre le prestataireId
    req.session.commande = req.session.commande || {};
    if (service) req.session.commande.service = service;
    if (prix !== undefined) req.session.commande.prixBase = parseInt(prixLibre || prix, 10) || 0;
    if (prixLibre !== undefined) req.session.commande.prixLibre = !!prixLibre;
    if (missionId) req.session.commande.missionId = missionId;
    if (offreParticulierId) req.session.commande.offreParticulierId = parseInt(offreParticulierId, 10);

    req.session.save((err) => {
        if (err) console.error("Erreur sauvegarde session preparer-commande:", err);
        res.json({ ok: true });
    });
});

// Route pour simuler la réussite d'un paiement (Mode Test)
app.post('/api/simuler-paiement', requireAuth, async (req, res) => {
    const { datePrevue, delaiReponse } = req.body;
    const delaiMinutes = Math.min(5, Math.max(1, parseInt(delaiReponse, 10) || 1));
    const cmd = req.session.commande;
    const lat = req.session.latClient || req.session.user?.lat;
    const lon = req.session.lonClient || req.session.user?.lon;
    
    const isToday = datePrevue === 'today';

    console.log("[DEBUG SIMU PAY] Vérification session avant insertion...");
    console.log(`[DEBUG SIMU PAY] GPS récupéré: ${lat}, ${lon}`);
    console.log(`[DEBUG SIMU PAY] IDs: Client=${req.session.user?.id}, Presta=${cmd?.prestataireId}`);

    if (!cmd || !cmd.prestataireId || !lat || !lon) {
        console.error("[SIMU PAY ERROR] Données manquantes:", { hasCmd: !!cmd, prestaId: cmd?.prestataireId, lat, lon });
        return res.status(400).json({ ok: false, error: "Localisation introuvable. Activez votre GPS et rafraîchissez la page." });
    }

    const prixClient = parseInt(cmd.total || cmd.prixBase || 0, 10);
    const commission = Math.round(prixClient * COMMISSION_PCT);
    const netPresta = prixClient - commission;

    const payload = {
        client_id: parseInt(req.session.user.id, 10),
        prestataire_id: parseInt(cmd.prestataireId, 10),
        backup_ids: (cmd.backups && cmd.backups.length > 0) ? cmd.backups.map(b => b.id) : null,
        service: cmd.service,
        prix: prixClient,
        statut: isToday ? 'en_attente_prestataire' : 'programmation_en_cours',
        lat_client: parseFloat(lat),
        lon_client: parseFloat(lon),
        date_prevue: datePrevue
    };

    console.log("[DEBUG SIMU PAY] Payload envoyé à Supabase:", JSON.stringify(payload));

    try {
        const { data, error } = await supabase.from('missions').insert(payload).select().single();
        if (error) {
            console.error("❌❌❌ [ERREUR SUPABASE MISSION] ❌❌❌\nCOPIEZ CECI :\n", error);
            throw error;
        }

        console.log("❌ [NOTIF-DEBUG] MISSION CRÉÉE EN BASE. ID:", data.id, "pour Presta:", payload.prestataire_id);
        console.log("✅ MISSION CRÉÉE AVEC SUCCÈS. ID:", data.id);
        missionMeta.set(data.id, {
            delaiMinutes: isToday ? delaiMinutes : 60,
            prestaFin: false,
            clientFin: false,
            refuseNotified: false,
            commission,
            netPresta
        });
        req.session.commande.missionId = data.id;
        req.session.commande.paye = true;
        req.session.commande.statut = payload.statut;
        req.session.commande.delaiReponse = delaiMinutes;
        if (req.session.commande.offreParticulierId) {
            const offre = offresDiscuter.find(o => o.id === req.session.commande.offreParticulierId);
            if (offre) offre.paye = true;
        }

        // --- NOTIFICATIONS DIFFÉRENCIÉES PAR EMAIL ---
        const msgDate = datePrevue === 'today' ? "immédiate" : `prévue pour le **${datePrevue}**`;
        const consigneAcceptation = "<p style='color: #b71c1c; font-weight: bold;'>⚠️ IMPORTANT : N'appuyez sur 'ACCEPTER' que lorsque vous êtes réellement prêt à partir pour la mission. L'acceptation déclenche immédiatement le suivi GPS.</p>";

        // 1. Notification du Prestataire Principal
        const { data: pUser } = await supabase.from('utilisateurs').select('email, prenom').eq('id', cmd.prestataireId).single();
        console.log("❌ [NOTIF-DEBUG] Tentative envoi email au principal:", pUser?.email);
        if (pUser && pUser.email && resend) {
            safeSendEmail({
                from: 'PetitsDjobs <notifications@mail.petitsdjobs.com>',
                to: pUser.email,
                subject: `⭐ Vous êtes le prestataire principal - Mission ${msgDate}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #FF6600;">Bonjour ${pUser.prenom}, vous êtes en 1ère position !</h2>
                        <p>Un client vous a choisi comme <strong>prestataire principal</strong> pour : <strong>${cmd.service}</strong>.</p>
                        <p>📅 Date : ${msgDate}</p>
                        <p>⏰ Vous avez <strong>${delaiMinutes} minute(s)</strong> pour accepter cette mission, sinon elle sera refusée automatiquement.</p>
                        <p>💰 Commission plateforme : ${commission} FCFA (5 %). Vous recevrez ${netPresta} FCFA après validation client + prestataire.</p>
                        ${consigneAcceptation}
                        <a href="https://petitsdjobs.com/prestataire-info" style="display: inline-block; padding: 12px 25px; background: #FF6600; color: white; text-decoration: none; border-radius: 8px; margin-top: 10px; font-weight: bold;">Accéder à mon espace</a>
                    </div>
                `
            });
        }

        // 2. Notification des Prestataires de Secours
        if (cmd.backups && cmd.backups.length > 0 && resend) {
            for (const backup of cmd.backups) {
                const { data: bUser } = await supabase.from('utilisateurs').select('email, prenom').eq('id', backup.id).single();
                if (bUser && bUser.email) {
                    safeSendEmail({
                        from: 'PetitsDjobs <notifications@mail.petitsdjobs.com>',
                        to: bUser.email,
                        subject: `🛡️ Mission de secours - Mission ${msgDate}`,
                        html: `
                            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                                <h2 style="color: #2e7d32;">Bonjour ${bUser.prenom}, vous êtes en secours.</h2>
                                <p>Vous avez été sélectionné comme <strong>prestataire de secours</strong> pour : <strong>${cmd.service}</strong>.</p>
                                <p>📅 Date : ${msgDate}</p>
                                <p>Si le prestataire principal se désiste ou ne répond pas, cette mission vous sera automatiquement attribuée.</p>
                                ${consigneAcceptation}
                                <a href="https://petitsdjobs.com/prestataire-info" style="display: inline-block; padding: 12px 25px; background: #2e7d32; color: white; text-decoration: none; border-radius: 8px; margin-top: 10px; font-weight: bold;">Voir les détails</a>
                            </div>
                        `
                    });
                }
            }
        }

        res.json({ ok: true, message: "Paiement simulé. En attente du prestataire." });
    } catch (err) {
        console.error("❌ ERREUR CRITIQUE simuler-paiement:", err);
        if (err.code === 'PGRST204') {
            console.error("👉 ANALYSE : La colonne 'date_prevue' est manquante dans votre table 'missions'. Exécutez l'ALTER TABLE dans Supabase.");
        }
        if (err.code === '22P02') {
            console.error("👉 ANALYSE : Erreur de type UUID. Allez sur votre tableau de bord Supabase, table 'missions', et changez le type des colonnes 'client_id' et 'prestataire_id' de 'UUID' vers 'BIGINT' ou 'INT8'.");
        }
        res.status(500).json({ error: "Erreur technique" });
    }
});

// --- LOGIQUE DE BASCULEMENT AUTOMATIQUE (GOUVERNANCE DES MISSIONS) ---
setInterval(async () => {
    const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;

    const { data: missionsEnAttente } = await supabase
        .from('missions')
        .select('*')
        .eq('statut', 'en_attente_prestataire');

    if (!missionsEnAttente || missionsEnAttente.length === 0) return;

    const missionsExpirees = missionsEnAttente.filter(m => {
        const meta = missionMeta.get(m.id) || { delaiMinutes: 1 };
        const delaiMs = (meta.delaiMinutes || 1) * 60 * 1000;
        return (Date.now() - new Date(m.created_at).getTime()) >= delaiMs;
    });

    if (missionsExpirees.length === 0) return;

    for (const mission of missionsExpirees) {
        const { data: user } = await supabase.from('utilisateurs').select('dernier_acces, email, prenom').eq('id', mission.prestataire_id).maybeSingle();
        const dernierAccesTs = user?.dernier_acces ? new Date(user.dernier_acces).getTime() : 0;
        const estEnLigne = (Date.now() - dernierAccesTs) < SEUIL_EN_LIGNE_MS;

        if (!estEnLigne) continue;

        const backups = mission.backup_ids || [];
        
        if (backups.length > 0) {
            // PRENDRE LE PROCHAIN PRESTATAIRE DE SECOURS
            const nouveauPrestaId = backups[0];
            const resteBackups = backups.slice(1);

            console.log(`[AUTO-BASCULE] Mission ${mission.id} : Délai dépassé. Passage au secours ${nouveauPrestaId}`);

            // Mise à jour de la mission
            const { error: updateError } = await supabase
                .from('missions')
                .update({
                    prestataire_id: nouveauPrestaId,
                    backup_ids: resteBackups,
                    created_at: new Date().toISOString(), // On reset le timer pour le nouveau
                    statut: 'en_attente_prestataire'
                })
                .eq('id', mission.id);

            if (!updateError) {
                missionMeta.set(mission.id, { ...(missionMeta.get(mission.id) || {}), delaiMinutes: missionMeta.get(mission.id)?.delaiMinutes || 1 });
                const { data: anciens } = await supabase.from('utilisateurs').select('email, prenom').eq('id', mission.prestataire_id).single();
                const { data: nouveaux } = await supabase.from('utilisateurs').select('email, prenom').eq('id', nouveauPrestaId).single();

                if (anciens?.email) {
                    safeSendEmail({
                        from: 'PetitsDjobs <alerte@mail.petitsdjobs.com>',
                        to: anciens.email,
                        subject: '⏰ Temps de réponse expiré',
                        html: `<p>Bonjour ${anciens.prenom}, vous n'avez pas répondu à temps pour la mission de <strong>${mission.service}</strong>. Elle a été attribuée à un autre prestataire.</p>`
                    });
                }

                if (nouveaux?.email) {
                    safeSendEmail({
                        from: 'PetitsDjobs <alerte@mail.petitsdjobs.com>',
                        to: nouveaux.email,
                        subject: '🚨 Mission de secours disponible !',
                        html: `<p>Bonjour ${nouveaux.prenom}, le premier prestataire n'étant pas disponible, cette mission de <strong>${mission.service}</strong> vous est maintenant proposée ! Connectez-vous vite.</p>`
                    });
                }
            }
        } else {
            console.log(`[AUTO-ANNULATION] Mission ${mission.id} : Délai dépassé, refus automatique.`);
            await supabase.from('missions').update({
                statut: 'refuse',
                raison_refus: 'Refus automatique : délai de réponse dépassé'
            }).eq('id', mission.id);

            const meta = missionMeta.get(mission.id) || {};
            if (!meta.refuseNotified && user?.email) {
                meta.refuseNotified = true;
                missionMeta.set(mission.id, meta);
                safeSendEmail({
                    from: 'PetitsDjobs <alerte@mail.petitsdjobs.com>',
                    to: user.email,
                    subject: '⏰ Offre refusée automatiquement',
                    html: `<p>Bonjour ${user.prenom || ''}, vous n'avez pas répondu à temps à la mission <strong>${mission.service}</strong>. Elle est considérée comme <strong>refusée</strong>. Vous ne pouvez plus l'accepter.</p>`
                });
            }

            const { data: client } = await supabase.from('utilisateurs').select('email').eq('id', mission.client_id).single();
            if (client?.email) {
                safeSendEmail({
                    from: 'PetitsDjobs <support@mail.petitsdjobs.com>',
                    to: client.email,
                    subject: '😔 Désolé, aucun prestataire disponible',
                    html: `<p>Nous avons sollicité tous les prestataires choisis pour votre service de <strong>${mission.service}</strong>, mais aucun n'a pu répondre à temps. Vous allez être remboursé.</p>`
                });
            }
        }
    }
}, 15000); // Vérification toutes les 15 secondes


app.post('/sauvegarder-position', async (req, res) => {
    const { lat, lon } = req.body;
    console.log(`[DEBUG GPS] Reception position: Lat=${lat}, Lon=${lon} (User: ${req.session.user?.id || 'Invité'})`);
    if (lat != null && lon != null) {
        req.session.latClient = parseFloat(lat);
        req.session.lonClient = parseFloat(lon);
        if (req.session.user) {
            req.session.user.lat = parseFloat(lat);
            req.session.user.lon = parseFloat(lon);

            // Mise à jour de l'activité
            await supabase.from('utilisateurs')
                .update({ dernier_acces: new Date().toISOString() })
                .eq('id', req.session.user.id);

            if (req.session.user.isPrestataire) {
                await supabase.from('infos_prestataires')
                    .update({ lat: parseFloat(lat), lon: parseFloat(lon) })
                    .eq('user_id', req.session.user.id);
                
                console.log(`[GPS UPDATE] Prestataire ${req.session.user.id} : Lat=${lat}, Lon=${lon}`);
                const missionId = req.session.commande?.missionId;
                const updatePresta = { lat_prestataire: lat, lon_prestataire: lon };
                if (missionId) {
                    await supabase.from('missions').update(updatePresta).eq('id', missionId);
                } else {
                    const { error: mErr } = await supabase.from('missions').update(updatePresta)
                        .eq('prestataire_id', req.session.user.id)
                        .in('statut', ['en_route', 'travail_en_cours', 'attente_securite']);
                    if (mErr) console.error(`[GPS UPDATE ERR] Echec mise à jour mission prestataire:`, mErr.message);
                }
            } else {
                console.log(`[GPS UPDATE] Client ${req.session.user.id} : Lat=${lat}, Lon=${lon}`);
                const missionId = req.session.commande?.missionId;
                const updateClient = { lat_client: lat, lon_client: lon };
                if (missionId) {
                    await supabase.from('missions').update(updateClient).eq('id', missionId);
                } else {
                    const { error: cErr } = await supabase.from('missions').update(updateClient)
                        .eq('client_id', req.session.user.id)
                        .in('statut', ['en_route', 'travail_en_cours']);
                    if (cErr) console.error(`[GPS UPDATE ERR] Echec mise à jour mission client:`, cErr.message);
                }
            }
        }
    }
    res.json({ ok: true, lat: req.session.latClient, lon: req.session.lonClient });
});

app.post('/chercher-prestataires', async (req, res) => {
    const { lat, lon, service, offset, type } = req.body;
    const latC = lat ?? req.session.latClient;
    const lonC = lon ?? req.session.lonClient;
    const svc = service || req.session.commande?.service;

    if (type !== 'nom' && (latC == null || lonC == null)) {
        return res.status(400).json({ error: 'Position GPS requise' });
    }

    req.session.latClient = parseFloat(latC);
    req.session.lonClient = parseFloat(lonC);

    const result = await chercherParRayonCroissant(latC, lonC, svc, parseInt(offset, 10) || 0, BATCH_PRESTATAIRES, req.session.user?.id, type);
    res.json(result);
});

app.post('/selectionner-prestataire', async (req, res) => {
    const { prestataireId, serviceChoisi, isBackup } = req.body;
    console.log(`[DEBUG SELECT] Click sur prestataire: ${prestataireId} pour service: ${serviceChoisi}`);

    const { data: p } = await supabase
        .from('infos_prestataires')
        .select('*')
        .eq('user_id', prestataireId)
        .maybeSingle();

    if (!p) return res.status(400).json({ error: 'Prestataire introuvable' });
    
    const { data: user } = await supabase.from('utilisateurs').select('nom, prenom, dernier_acces').eq('id', p.user_id).maybeSingle();
    
    // Calcul de l'état en ligne (moins de 5 minutes)
    const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;
    const dernierAccesTs = user?.dernier_acces ? new Date(user.dernier_acces).getTime() : 0;
    const enLigne = (Date.now() - dernierAccesTs) < SEUIL_EN_LIGNE_MS;

    const latC = req.session.latClient || 0;
    const lonC = req.session.lonClient || 0;
    
    // CALCUL DE LA DISTANCE À PIED (Plus précis pour le paiement)
    let distM = await distanceMarcheReelle(latC, lonC, p.lat, p.lon);
    
    // Repli sur vol d'oiseau si OSRM échoue
    if (distM === null) distM = distanceMetres(p, latC, lonC);
    
    const frais = prixDistanceFcfa(distM);

    console.log(`[DEBUG SELECT] Distance calculée: ${distM}m`);

    req.session.commande = req.session.commande || {};

    if (isBackup) {
        req.session.commande.backups = req.session.commande.backups || [];
        // Vérifier si déjà présent
        if (!req.session.commande.backups.find(b => b.id === p.user_id) && req.session.commande.prestataireId !== p.user_id) {
            req.session.commande.backups.push({
                id: p.user_id,
                nom: user?.nom,
                prenom: user?.prenom,
                photo: p.photo_profil_url
            });
        }
    } else {
        req.session.commande.prestataireId = p.user_id;
        req.session.commande.service = serviceChoisi || "Service";
        req.session.commande.prestataireNom = user?.nom || 'Prestataire';
        req.session.commande.prestatairePrenom = user?.prenom || '';
        req.session.commande.prestatairePhoto = p.photo_profil_url || '';
        req.session.commande.disponible = enLigne;
        req.session.commande.telephone = p.autorise_numero_deconnexion ? p.telephone : null;
        // Sécurité contre Infinity qui devient null en JSON
        req.session.commande.distanceM = (distM === Infinity) ? 999999 : distM;
        req.session.commande.distanceKm = (distM / 1000).toFixed(2);
        req.session.commande.fraisDeplacement = frais;
        req.session.commande.total = (req.session.commande.prixBase || 0) + frais;
    }

    req.session.save((err) => {
        if (err) {
            console.error("[DEBUG SELECT] Erreur sauvegarde session:", err);
            return res.status(500).json({ error: "Erreur session" });
        }
        console.log("[DEBUG SELECT] Session sauvegardée avec succès pour mission.");
        res.json({ ok: true });
    });
});

// Route pour que le client récupère la position GPS du prestataire choisi
app.get('/api/suivi-prestataire-gps', requireAuth, async (req, res) => {
    try {
        const missionId = req.query.missionId || req.session.commande?.missionId;
        console.log(`[DEBUG GPS SUIVI] Requête reçue. Mission ID: ${missionId}`);

        if (!missionId) {
            console.warn(`[DEBUG GPS SUIVI] ATTENTION : missionId absent des paramètres et de la session.`);
            return res.json({});
        }

        const { data: mData, error } = await supabase.from('missions')
            .select('lat_prestataire, lon_prestataire, statut')
            .eq('id', missionId)
            .maybeSingle();

        if (error) {
            console.error(`[DEBUG GPS SUIVI] Erreur Supabase Mission ${missionId}:`, error.message);
            return res.json({});
        }

        if (mData && mData.lat_prestataire != null) {
            console.log(`[DEBUG GPS SUIVI] OK Mission ${missionId} (${mData.statut}) : ${mData.lat_prestataire}, ${mData.lon_prestataire}`);
            return res.json({ lat: mData.lat_prestataire, lon: mData.lon_prestataire });
        }
        
        console.log(`[DEBUG GPS SUIVI] INFO: Pas de coordonnées temps réel pour mission ${missionId}. Repli session.`);

        // Repli sur la position fixe si la mission n'a pas encore de coordonnées propres
        const cmd = req.session.commande;
        if (!cmd?.prestataireId) {
            console.warn(`[DEBUG GPS SUIVI] Aucun prestataire en session pour le suivi`);
            return res.json({});
        }
        const { data: pPos } = await supabase.from('infos_prestataires').select('lat, lon').eq('user_id', cmd.prestataireId).maybeSingle();
        console.log(`[DEBUG GPS SUIVI] Repli sur position fixe prestataire ${cmd.prestataireId}: ${pPos?.lat}, ${pPos?.lon}`);
        res.json(pPos || {});
    } catch (e) { 
        console.error(`[DEBUG GPS SUIVI] Erreur critique:`, e.message);
        res.json({}); 
    }
});

// Nouvelles routes pour la gestion des missions par le prestataire
app.get('/api/mes-missions-prestataire', requireAuth, async (req, res) => {
    const pId = req.session.user.id;
    console.log("❌ [NOTIF-DEBUG] Prestataire " + pId + " interroge le serveur pour ses missions.");
    
    // On récupère les missions seules d'abord pour éviter l'erreur de relation
    const { data: missions, error: mError } = await supabase.from('missions')
        .select('*')
        .eq('prestataire_id', pId)
        .eq('statut', 'en_attente_prestataire')
        .order('created_at', { ascending: false });

    if (mError) {
        console.error(`[DEBUG NOTIF ERR] Prestataire ${pId}:`, mError.message);
        return res.status(500).json({ error: mError.message });
    }

    if (!missions || missions.length === 0) {
        console.log("❌ [NOTIF-DEBUG] Aucune mission trouvée pour le presta " + pId);
        return res.json([]);
    }

    // On récupère les infos des clients manuellement
    const clientIds = missions.map(m => m.client_id);
    const { data: clients } = await supabase.from('utilisateurs').select('id, nom, prenom, photo_url').in('id', clientIds);
    const clientMap = Object.fromEntries((clients || []).map(c => [c.id, { nom: c.nom, prenom: c.prenom, photo: c.photo_url }]));

    const result = missions.map(m => {
        const meta = missionMeta.get(m.id) || { delaiMinutes: 1 };
        const delaiMs = (meta.delaiMinutes || 1) * 60 * 1000;
        const expireDans = Math.max(0, delaiMs - (Date.now() - new Date(m.created_at).getTime()));
        return {
            ...m,
            delaiMinutes: meta.delaiMinutes || 1,
            expireDansMs: expireDans,
            expire: expireDans <= 0,
            client: clientMap[m.client_id] || { nom: 'Client', prenom: 'Inconnu', photo: 'default-profile.png' }
        };
    }).filter(m => !m.expire);

    console.log("❌ [NOTIF-DEBUG] ENVOI DE " + result.length + " MISSIONS au navigateur du prestataire.");
    console.log(`[QUERY DB RESULT] ${result.length} missions envoyées.`);
    res.json(result);
});

// --- ROUTES DE MESSAGERIE (CHAT) ---

app.get('/api/get-messages/:missionId', requireAuth, async (req, res) => {
    const mId = req.params.missionId;
    if (!mId || mId === 'undefined' || mId === 'null') return res.json([]);

    console.log(`🌐 [CHAT] Chargement messages pour mission: ${mId}`);

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('mission_id', parseInt(mId))
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error("❌ [CHAT ERR] Récupération messages:", error.message);
        return res.status(500).json([]);
    }
    res.json(data);
});

app.get('/api/get-messages-ami/:amiId', requireAuth, async (req, res) => {
    const { amiId } = req.params;
    const myId = req.session.user.id;
    if (!amiId || amiId === 'undefined') return res.json([]);

    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${myId},ami_id.eq.${parseInt(amiId)}),and(sender_id.eq.${parseInt(amiId)},ami_id.eq.${myId})`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error("❌ [CHAT ERR] Messages Ami:", error.message);
        return res.status(500).json([]);
    }
     res.json(data);
});

app.post('/api/send-message', requireAuth, async (req, res) => {
    let { missionId, amiId, text, voiceUrl } = req.body;
    console.log(`🌐 [CHAT] Envoi message de ${req.session.user.id} (Mission: ${missionId})`);

    const mId = (missionId && missionId !== 'undefined' && missionId !== 'null') ? parseInt(missionId) : null;
    const messageText = voiceUrl
        ? `🎤 Message vocal : <audio controls src="${voiceUrl}" style="max-width:220px;"></audio>`
        : text;

    const payload = {
        sender_id: req.session.user.id,
        text: messageText,
        mission_id: mId,
        ami_id: (amiId && amiId !== 'undefined' && amiId !== 'null') ? parseInt(amiId) : null
    };

    const { data, error } = await supabase.from('messages').insert(payload).select().single();
    if (error) {
        console.error(`❌ [CHAT ERR] Envoi message:`, error.message);
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

// Route pour marquer les messages comme vus
app.post('/api/mark-messages-read', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    if (!missionId) return res.json({ ok: false });

    const { error } = await supabase.from('messages')
        .update({ lu: true })
        .eq('mission_id', parseInt(missionId))
        .neq('sender_id', req.session.user.id); // On marque comme lus les messages que JE n'ai pas envoyés
    
    res.json({ ok: !error });
});

// Nouvelle route pour obtenir les infos de n'importe quel partenaire (Client ou Pro)
app.get('/api/partner-info/:id', requireAuth, async (req, res) => {
    const pId = req.params.id;
    if (!pId || pId === 'undefined' || pId === 'null') return res.status(404).json({});

    console.log(`🌐 [API] partner-info pour ID: ${pId}`);

    // 1. On récupère l'utilisateur (on utilise '*' car photo_url semble absente dans ta DB)
    const { data: user, error } = await supabase.from('utilisateurs').select('*').eq('id', pId).maybeSingle();
    
    if (error || !user) {
        console.error(`❌ [API ERR] partner-info ${pId}:`, error?.message || 'Introuvable');
        return res.status(404).json({});
    }

    // 2. On cherche si c'est un prestataire pour avoir sa photo de "Carte de visite"
    const { data: pInfo } = await supabase.from('infos_prestataires').select('photo_profil_url').eq('user_id', pId).maybeSingle();

    // LOGIQUE PHOTO : Photo Carte de Visite (prestataire) > Photo Inscription (si elle existe) > Défaut
    const finalPhoto = pInfo?.photo_profil_url || user.photo_url || user.photo || 'default-profile.png';

    const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;
    const enLigne = user.dernier_acces ? (Date.now() - new Date(user.dernier_acces).getTime() < SEUIL_EN_LIGNE_MS) : false;

    console.log(`✅ [API] partner-info ${pId} chargé.`);
    res.json({
        nom: user.nom,
        prenom: user.prenom,
        photo: finalPhoto,
        enLigne: enLigne,
        isPrestataire: !!pInfo
    });
});

app.get('/api/mes-commandes-futures', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Récupérer les missions du client qui ne sont pas encore terminées ou annulées
        const { data: missions, error: mError } = await supabase
            .from('missions')
            .select('*')
            .eq('client_id', userId)
            .in('statut', ['en_attente_prestataire', 'en_route', 'travail_en_cours', 'attente_securite'])
            .order('created_at', { ascending: false });

        if (mError) throw mError;
        if (!missions || missions.length === 0) return res.json([]);

        // Récupérer les noms des prestataires manuellement pour éviter l'erreur de jointure
        const prestataireIds = missions.map(m => m.prestataire_id);
        const { data: users } = await supabase.from('utilisateurs').select('id, nom, prenom').in('id', prestataireIds);
        const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

        const result = missions.map(m => ({
            ...m,
            prestataire: userMap[m.prestataire_id] || { nom: 'Prestataire', prenom: '' }
        }));

        res.json(result);
    } catch (err) {
        console.error("[API MES COMMANDES] Erreur:", err.message);
        res.status(500).json({ error: "Erreur lors de la récupération des commandes." });
    }
});

app.post('/api/repondre-mission', requireAuth, async (req, res) => {
    const { missionId, action } = req.body;
    const mId = parseInt(missionId, 10);
    const { data: mission } = await supabase.from('missions').select('created_at, statut').eq('id', mId).eq('prestataire_id', req.session.user.id).maybeSingle();
    if (!mission || mission.statut !== 'en_attente_prestataire') {
        return res.status(400).json({ error: 'Mission introuvable ou déjà traitée.' });
    }
    const meta = missionMeta.get(mId) || { delaiMinutes: 1 };
    const delaiMs = (meta.delaiMinutes || 1) * 60 * 1000;
    if (Date.now() - new Date(mission.created_at).getTime() >= delaiMs) {
        await supabase.from('missions').update({ statut: 'refuse', raison_refus: 'Délai expiré' }).eq('id', mId);
        return res.status(400).json({ error: 'Délai expiré. Cette offre est refusée automatiquement.' });
    }
    const statut = action === 'accepter' ? 'en_route' : 'refuse';
    const { error } = await supabase.from('missions').update({ statut }).eq('id', mId).eq('prestataire_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.post('/api/marquer-arrivee', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    // On autorise le prestataire ET le client à marquer l'arrivée
    const { data: mission } = await supabase.from('missions').select('prestataire_id, client_id').eq('id', missionId).single();
    if (!mission) return res.status(404).json({ error: 'Mission introuvable' });
    
    if (req.session.user.id !== mission.prestataire_id && req.session.user.id !== mission.client_id) {
        return res.status(403).json({ error: 'Interdit' });
    }

    const { error } = await supabase.from('missions').update({ statut: 'travail_en_cours' }).eq('id', missionId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.post('/api/terminer-tache', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    const mId = parseInt(missionId, 10);
    const meta = missionMeta.get(mId) || { prestaFin: false, clientFin: false, commission: 0, netPresta: 0 };
    meta.prestaFin = true;
    missionMeta.set(mId, meta);

    const { data: mission } = await supabase.from('missions').select('client_id, service, prix').eq('id', mId).maybeSingle();
    const { error } = await supabase.from('missions').update({ statut: 'attente_confirmation_client' }).eq('id', mId).eq('prestataire_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });

    if (mission) {
        const { data: client } = await supabase.from('utilisateurs').select('email, prenom').eq('id', mission.client_id).maybeSingle();
        if (client?.email) {
            safeSendEmail({
                from: 'PetitsDjobs <notifications@mail.petitsdjobs.com>',
                to: client.email,
                subject: '✅ Confirmez la fin du travail',
                html: `<p>Bonjour ${client.prenom || ''}, le prestataire indique avoir terminé : <strong>${mission.service}</strong>.</p>
                <p>Confirmez la fin du service pour déclencher le paiement (${meta.netPresta || mission.prix} FCFA au prestataire, commission 5 %).</p>
                <a href="https://petitsdjobs.com/suivi?missionId=${mId}" style="display:inline-block;padding:12px 20px;background:#2e7d32;color:white;text-decoration:none;border-radius:8px;">CONFIRMER LA FIN</a>`
            });
        }
        await supabase.from('messages').insert({
            sender_id: req.session.user.id,
            mission_id: mId,
            text: '🟠 Le prestataire a terminé le travail. Client : veuillez confirmer la fin pour valider le paiement.'
        });
    }
    res.json({ ok: true, message: 'En attente de confirmation du client pour le paiement.' });
});

app.post('/api/confirmer-fin-travail', requireAuth, async (req, res) => {
    const mId = parseInt(req.body.missionId, 10);
    const { data: mission } = await supabase.from('missions').select('*').eq('id', mId).eq('client_id', req.session.user.id).maybeSingle();
    if (!mission) return res.status(404).json({ error: 'Mission introuvable' });

    const meta = missionMeta.get(mId) || { prestaFin: false, clientFin: false, netPresta: mission.prix };
    meta.clientFin = true;
    missionMeta.set(mId, meta);

    if (!meta.prestaFin) {
        return res.json({ ok: false, message: 'Le prestataire n\'a pas encore signalé la fin du travail.' });
    }

    const { error } = await supabase.from('missions').update({ statut: 'termine' }).eq('id', mId);
    if (error) return res.status(500).json({ error: error.message });

    const { data: presta } = await supabase.from('utilisateurs').select('email, prenom').eq('id', mission.prestataire_id).maybeSingle();
    if (presta?.email) {
        safeSendEmail({
            from: 'PetitsDjobs <notifications@mail.petitsdjobs.com>',
            to: presta.email,
            subject: '💰 Paiement validé',
            html: `<p>Bonjour ${presta.prenom || ''}, le client a confirmé la fin de <strong>${mission.service}</strong>. Paiement de <strong>${meta.netPresta || mission.prix} FCFA</strong> (après commission 5 %).</p>`
        });
    }
    res.json({ ok: true, paye: true, montantPresta: meta.netPresta || mission.prix });
});

app.post('/api/terminer-tache-client', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    const { error } = await supabase.from('missions').update({ statut: 'attente_securite' }).eq('id', missionId).eq('client_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.post('/api/noter-prestataire', requireAuth, async (req, res) => {
    const { missionId, prestataireId, note, commentaire } = req.body; // note de 1 à 10
    try {
        const { data: p } = await supabase.from('infos_prestataires').select('etoiles, commentaires').eq('user_id', prestataireId).single();
        
        // 10 petites étoiles (input) = 1 grande étoile (DB)
        const currentStars = parseFloat(p.etoiles || 0);
        const increment = parseFloat(note) / 10;
        const newStars = Math.round((currentStars + increment) * 100) / 100;
        
        const comms = p.commentaires || [];
        if (commentaire) comms.push({ texte: commentaire, date: new Date().toISOString() });

        await supabase.from('infos_prestataires').update({ 
            etoiles: newStars, 
            commentaires: comms 
        }).eq('user_id', prestataireId);

        // On passe la mission à terminé si ce n'est pas déjà fait
        await supabase.from('missions').update({ statut: 'termine' }).eq('id', missionId);

        res.json({ ok: true });
    } catch (err) {
        console.error("Erreur notation:", err);
        res.status(500).json({ error: "Impossible d'enregistrer la note" });
    }
});

app.post('/api/confirmer-depart', requireAuth, async (req, res) => {
    const { missionId } = req.body;
    // Le client valide le départ du prestataire pour terminer la mission
    const { error } = await supabase.from('missions').update({ statut: 'termine' }).eq('id', missionId).eq('client_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.post('/api/confirmer-securite', requireAuth, async (req, res) => {
    const { missionId, action } = req.body; // action: 'safe' ou 'danger'
    const statut = action === 'safe' ? 'termine' : 'alerte_police';
    const { error } = await supabase.from('missions').update({ statut }).eq('id', missionId).eq('prestataire_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, paye: action === 'safe' });
});

app.get('/api/suivi-client-gps', requireAuth, async (req, res) => {
    const { missionId } = req.query;
    console.log(`[DEBUG GPS CLIENT] Suivi client pour mission: ${missionId}`);
    
    if (!missionId) return res.json({});

    const { data, error } = await supabase.from('missions')
        .select('lat_client, lon_client, client_id, service, prix')
        .eq('id', missionId)
        .maybeSingle();
    if (error || !data) {
        console.error(`[DEBUG GPS CLIENT] Erreur ou données absentes:`, error?.message);
        return res.json({});
    }

    let client = null;
    if (data.client_id) {
        const { data: u } = await supabase.from('utilisateurs')
            .select('nom, prenom, photo_url')
            .eq('id', data.client_id)
            .maybeSingle();
        if (u) {
            client = {
                nom: u.nom,
                prenom: u.prenom,
                photo: u.photo_url
            };
        }
    }

    console.log(`[DEBUG GPS CLIENT] Position client renvoyée: ${data.lat_client}, ${data.lon_client}`);
    res.json({
        lat: data.lat_client,
        lon: data.lon_client,
        client,
        service: data.service,
        prix: data.prix
    });
});

app.get('/api/statut-mission', requireAuth, async (req, res) => {
    const missionId = req.query.missionId || req.session.commande?.missionId;
    console.log(`[DEBUG STATUT] Vérification mission ${missionId}`);
    if (!missionId) {
        console.warn(`[DEBUG STATUT] missionId est NULL ou UNDEFINED`);
        return res.json({ statut: 'aucune' });
    }
    const { data } = await supabase.from('missions').select('statut').eq('id', missionId).maybeSingle();
    console.log(`[DEBUG STATUT] Résultat pour ${missionId}: ${data?.statut || 'inconnu'}`);
    res.json(data || { statut: 'inconnu' });
});

app.get('/api/get-mission-partner/:missionId', requireAuth, async (req, res) => {
    const { missionId } = req.params;
    const { data: m } = await supabase.from('missions').select('client_id, prestataire_id').eq('id', missionId).maybeSingle();
    if (!m) return res.status(404).json({ error: "Mission introuvable" });
    const partnerId = (String(req.session.user.id) === String(m.client_id)) ? m.prestataire_id : m.client_id;
    res.json({ partnerId });
});

app.post('/api/update-profile-photo', requireAuth, upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
    try {
        const url = await uploadToSupabase(req.file, BUCKET_NAME);
        
        // Mettre à jour la table utilisateurs
        await supabase.from('utilisateurs').update({ photo_url: url }).eq('id', req.session.user.id);
        
        // Si c'est un prestataire, mettre aussi à jour sa fiche
        if (req.session.user.isPrestataire) {
            await supabase.from('infos_prestataires').update({ photo_profil_url: url }).eq('user_id', req.session.user.id);
        }

        req.session.user.photo = url;
        res.json({ url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/calculer-distance', async (req, res) => {
    const { latClient, lonClient, prestataireId } = req.body;
    
    const { data: p } = await supabase
        .from('infos_prestataires')
        .select('*')
        .eq('user_id', prestataireId)
        .single();

    if (!p) return res.status(404).json({ error: 'Prestataire introuvable' });
    const distM = distanceMetres(p, latClient, lonClient);
    const prixDistance = prixDistanceFcfa(distM);
    res.json({
        distanceM: distM,
        distanceKm: (distM / 1000).toFixed(2),
        prixDistance,
        total: (parseInt(req.body.prixBase, 10) || 0) + prixDistance
    });
});

app.post('/calculer-commande', async (req, res) => {
    const cmd = req.session.commande || {};
    const prixBase = parseInt(req.body.prixBase, 10) || cmd.prixBase || 0;
    const frais = cmd.fraisDeplacement ?? 0;
    res.json({ prixBase, fraisDeplacement: frais, total: prixBase + frais });
});

app.post('/connexion', async (req, res) => {
    const locOk = req.body.locAccepted === '1' || req.body.locAccepted === 'on' || req.body.loc === 'on';
    const polOk = req.body.polAccepted === '1' || req.body.polAccepted === 'on' || req.body.pol === 'on';

    if (!locOk || !polOk) {
        return res.redirect('/connexion.html?erreur=consentement');
    }

    if (req.session.remember && req.session.user && !req.body.email) {
        // Session persistante déjà active
    } else {
        try {
            const email = (req.body.email || '').toLowerCase().trim();
            console.log(`[AUTH] Tentative de connexion pour: ${email}`);
            // On cherche l'utilisateur seul d'abord pour plus de fiabilité
            const { data: compte, error: userError } = await supabase
                .from('utilisateurs')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (userError || !compte) {
                console.error(`[AUTH ERR] Utilisateur non trouvé ou erreur Supabase pour ${email}:`, userError);
                return res.redirect('/connexion.html?erreur=compte');
            }

            const mdpCorrect = await bcrypt.compare(req.body.password, compte.password);
            if (!mdpCorrect) {
                return res.redirect('/connexion.html?erreur=mdp');
            }
            
            // Mise à jour de l'activité
            await supabase.from('utilisateurs').update({ dernier_acces: new Date().toISOString() }).eq('id', compte.id);

            console.log("[DIAGNOSTIC] Mot de passe OK, création de session...");
            // On vérifie séparément s'il est prestataire
            const { data: profil } = await supabase.from('infos_prestataires').select('*').eq('user_id', compte.id).maybeSingle();
            
            // UNIFICATION PHOTO SESSION
            req.session.user = { ...compte, photo: compte.photo_url };

            if (profil) {
                req.session.user.isPrestataire = true;
                req.session.user.profession = profil.profession;
                req.session.user.bio = profil.bio;
                req.session.user.ville = profil.ville;
                req.session.user.services = profil.services;
                req.session.user.photo = profil.photo_profil_url || compte.photo_url;
                req.session.user.etoiles = profil.etoiles;
            } else {
                req.session.user.isPrestataire = false;
            }
            delete req.session.user.password;
        } catch (err) {
            console.error("[DIAGNOSTIC CRASH CONNEXION]", err.stack);
            return res.redirect('/connexion.html?erreur=serveur');
        }
    }
    req.session.remember = !!req.body.remember;
    req.session.localisationAutorisee = locOk;

    if (req.body.lat && !isNaN(parseFloat(req.body.lat))) {
        req.session.latClient = parseFloat(req.body.lat);
    }
    if (req.body.lon && !isNaN(parseFloat(req.body.lon))) {
        req.session.lonClient = parseFloat(req.body.lon);
    }
    if (req.session.user) {
        req.session.user.lat = req.session.latClient;
        req.session.user.lon = req.session.lonClient;
    }

    console.log("[DIAGNOSTIC] Sauvegarde session et redirection...");
    req.session.save(() => {
        res.redirect('/index.html');
    });
});

app.post('/inscription', upload.single('photo_profil'), async (req, res) => {
    console.log(`[DIAGNOSTIC INSCRIPTION] Début pour: ${req.body.email}`);
    if (estConnecte(req)) return res.redirect('/index.html');

    const locOk = req.body.locAccepted === '1' || req.body.locAccepted === 'on';
    const polOk = req.body.polAccepted === '1' || req.body.polAccepted === 'on';
    if (!locOk || !polOk) return res.redirect('/inscription?erreur=consentement');
    if (req.body.password !== req.body.password_confirm) {
        return res.redirect('/inscription?erreur=mdp');
    }
    const nom = (req.body.nom || '').trim();
    if (!nom) {
        return res.redirect('/inscription?erreur=nom_requis');
    }

    const email = (req.body.email || '').toLowerCase().trim();
    console.log(`[AUTH] Tentative d'inscription pour: ${email}`);
    const { data: existant, error: searchError } = await supabase.from('utilisateurs').select('id').eq('email', email).maybeSingle();
    
    if (existant) {
        console.log(`[AUTH] Email déjà existant dans la base: ${email}`);
        return res.redirect('/inscription?erreur=deja_inscrit');
    }

    try {
        if (!req.file) return res.redirect('/inscription?erreur=photo_requise');
        
        let photoUrl = await uploadToSupabase(req.file, BUCKET_NAME);

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const userData = {
            email,
            password: hashedPassword,
            nom: (req.body.nom || '').trim(),
            prenom: (req.body.prenom || '').trim(),
            age: parseInt(req.body.age, 10),
            telephone: (req.body.telephone || '').trim(),
            photo_url: photoUrl,
            autorise_contact_client: req.body.autorise_contact_client === 'on' || req.body.autorise_contact_client === '1'
        };
        
        const { data: newUser, error } = await supabase.from('utilisateurs').insert(userData).select().single();
        if (error) {
            console.error("[DIAGNOSTIC DB INSCRIPTION ERROR]", error.message);
            throw error;
        }

        console.log("[DIAGNOSTIC] Inscription DB réussie, initialisation session...");
        req.session.user = { ...newUser, photo: newUser.photo_url };
        req.session.user.isPrestataire = false;
        delete req.session.user.password;
        req.session.remember = !!req.body.remember;
        req.session.localisationAutorisee = locOk;
        req.session.save(() => {
            res.redirect('/index.html?connecte=1');
        });
    } catch (err) {
        console.error("Erreur d'inscription :", err);
        res.redirect('/inscription?erreur=serveur');
    }
});

// Helper pour envoyer un fichier vers Supabase Storage
async function uploadToSupabase(file, bucketName) {
    console.log(`[STORAGE] Début upload: ${file.originalname} (${file.size} octets)`);
    
    let buffer;
    let fileName = `${Date.now()}-${path.parse(file.originalname).name}`;
    let contentType = file.mimetype;

    if (file.mimetype.startsWith('image/')) {
        // Traitement Sharp uniquement pour les images
        buffer = await sharp(file.path)
            .resize({ width: 400, height: 300, fit: 'cover', withoutEnlargement: true })
            .webp({ quality: 20, effort: 6 })
            .toBuffer();
        fileName += '.webp';
        contentType = 'image/webp';
    } else if (file.mimetype.startsWith('audio/')) {
        buffer = fs.readFileSync(file.path);
        const ext = path.extname(file.originalname) || (file.mimetype.includes('mp4') ? '.m4a' : '.webm');
        fileName += ext;
    } else {
        buffer = fs.readFileSync(file.path);
        fileName += path.extname(file.originalname) || '.mp4';
    }

    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, buffer, { contentType: contentType });
    
    if (error) {
        console.error(`[STORAGE ERR] Echec pour ${file.originalname}:`, error.message);
        throw error;
    }
    console.log(`[STORAGE OK] Fichier envoyé: ${fileName}`);
    // On récupère l'URL publique pour l'afficher plus tard sur le site
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    console.log(`[STORAGE URL] URL publique générée : ${publicData.publicUrl}`);
    return publicData.publicUrl;
}

app.post('/devenir-prestataire', upload.fields([
    { name: 'photo_profil' }, { name: 'piece_recto' }, { name: 'piece_verso' }
]), async (req, res) => {
    try {
        const user = req.session.user;
        if (!user || !user.id) {
            console.error("[ERREUR PRESTATAIRE] Session invalide ou ID manquant:", user);
            return res.redirect('/connexion');
        }

        // Gestion des services
        const listeServices = Array.isArray(req.body.services) ? req.body.services : (req.body.services ? [req.body.services] : []);
        const servicesEnTexte = listeServices.join(', '); 

        const profileData = {
            user_id: user.id,
            profession: (req.body.profession || '').trim(),
            bio: (req.body.bio || '').trim(),
            ville: (req.body.ville || '').trim(),
            services: servicesEnTexte,
            telephone: (req.body.telephone || '').trim(),
            autorise_numero_deconnexion: req.body.autorise_numero === 'on',
            lat: parseFloat(req.body.lat) || null,
            lon: parseFloat(req.body.lon) || null
        };

        console.log(`[LOG] Début inscription prestataire pour ${user.email} (ID: ${user.id})`);

        // Envoi asynchrone des photos vers Supabase
        try {
            if (req.files?.photo_profil?.[0]) {
                profileData.photo_profil_url = await uploadToSupabase(req.files.photo_profil[0], BUCKET_NAME);
                // Suppression locale après upload pour libérer de l'espace
                fs.unlinkSync(req.files.photo_profil[0].path);
            }
            if (req.files?.piece_recto?.[0]) {
                profileData.photo_ci_recto_url = await uploadToSupabase(req.files.piece_recto[0], BUCKET_NAME);
                fs.unlinkSync(req.files.piece_recto[0].path);
            }
            if (req.files?.piece_verso?.[0]) {
                profileData.photo_ci_verso_url = await uploadToSupabase(req.files.piece_verso[0], BUCKET_NAME);
                fs.unlinkSync(req.files.piece_verso[0].path);
            }
        } catch (uploadError) {
            console.error("[ERREUR UPLOAD] Echec stockage Supabase:", uploadError.message);
            return res.redirect('/prestataire?erreur=serveur');
        }

        const { error } = await supabase.from('infos_prestataires').upsert(profileData, { onConflict: 'user_id' });
        
        if (error) {
            console.error(`[PRESTA DB ERR] Echec upsert prestataire pour ${user.id}:`, error.message);
            return res.redirect('/prestataire?erreur=db');
        }

        // Mettre à jour la session
        req.session.user.isPrestataire = true;
        if (profileData.photo_profil_url) req.session.user.photo = profileData.photo_profil_url;
        req.session.user.profession = profileData.profession;
        req.session.user.services = profileData.services;
        req.session.user.ville = profileData.ville;
        req.session.user.bio = profileData.bio;
        req.session.user.telephone = profileData.telephone;
        
        req.session.save((err) => {
            if (err) console.error(`[PRESTA SESSION ERR] Echec sauvegarde session:`, err);
            res.redirect('/prestataire-info?inscription=ok');
        });

    } catch (err) {
        console.error("[ERREUR CRITIQUE] devenir-prestataire:", err.message);
        res.redirect('/prestataire?erreur=serveur');
    }
});

app.get('/prestataire-public/:id', async (req, res) => {
    const { data: p } = await supabase.from('infos_prestataires').select('*').eq('user_id', req.params.id).maybeSingle();
    if (!p) return res.status(404).json({});
    const { data: user } = await supabase.from('utilisateurs').select('nom, prenom, dernier_acces').eq('id', p.user_id).maybeSingle();

    const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;
    const enLigne = user?.dernier_acces ? (Date.now() - new Date(user.dernier_acces).getTime() < SEUIL_EN_LIGNE_MS) : false;

    res.json({
        id: p.user_id,
        nom: user?.nom || 'Prestataire',
        prenom: user?.prenom || '',
        profession: p.profession,
        bio: p.bio,
        ville: p.ville,
        services: p.services,
        photo: p.photo_profil_url,
        etoiles: p.etoiles || 0,
        commentaires: p.commentaires || [],
        enLigne: enLigne
    });
});

// Nouvelle route pour la récupération sécurisée du contact
app.get('/get-prestataire-contact/:id', requireAuth, async (req, res) => {
    const { data: p } = await supabase.from('infos_prestataires')
        .select('telephone, autorise_numero_deconnexion')
        .eq('user_id', req.params.id)
        .maybeSingle();
    
    if (p && p.autorise_numero_deconnexion) {
        return res.json({ telephone: p.telephone });
    }
    res.status(403).json({ error: "Non autorisé" });
});

// On utilise multer pour la photo du job
app.post('/proposer-prix-discuter', requireAuth, upload.single('photo_job'), async (req, res) => {
    const { prix, lat, lon, description, datePrevue, delaiMinutes } = req.body;
    const prixNum = parseInt(prix, 10);
    if (!prixNum || lat == null || lon == null) {
        return res.status(400).json({ error: 'Prix et GPS requis' });
    }

    let photoUrl = null;
    if (req.file) {
        try {
            photoUrl = await uploadToSupabase(req.file, BUCKET_NAME);
        } catch (e) { console.error("Erreur upload photo job", e); }
    }

    req.session.latClient = parseFloat(lat);
    req.session.lonClient = parseFloat(lon);
    req.session.commande = { service: 'Service particulier', prixBase: prixNum, prixLibre: true };

    const offre = {
        id: Date.now(),
        clientNom: req.session.user?.nom || 'Client',
        clientId: req.session.user.id,
        emailClient: req.session.user?.email,
        prix: prixNum,
        description: description || 'Besoin d\'un service particulier',
        datePrevue: datePrevue || 'today',
        photo: photoUrl,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        acceptations: [],
        statut: 'en_attente',
        paye: false,
        timestamp: Date.now()
    };

    offresDiscuter.push(offre);
    
    // LOGIQUE 2 MINUTES : Relance par mail s'il n'y a pas d'acceptation
    setTimeout(() => {
        const o = offresDiscuter.find(item => item.id === offre.id);
        if (o && o.statut === 'en_attente' && o.acceptations.length === 0) {
            console.log(`[ALERTE MAIL] Envoi à ${o.emailClient} : Personne n'a accepté votre offre de ${o.prix} FCFA après 2min. Veuillez augmenter le prix.`);
            // Ici tu devrais appeler ton service de mail (Nodemailer, etc.)
        }
    }, 2 * 60 * 1000); 

    res.json({ offreId: offre.id, message: 'Offre publiée ! Elle est visible par les prestataires proches.' });
});

// Route pour afficher les offres sur l'accueil
app.get('/get-public-jobs', (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const viewerId = req.session?.user?.id;
    const RAYON_VISIBILITE_JOBS = 15000;

    let jobs = offresDiscuter.filter(o => o.statut === 'en_attente' && !o.paye);

    if (viewerId) {
        jobs = jobs.filter(o => {
            const estClient = normaliserId(o.clientId) === normaliserId(viewerId);
            if (estClient) return true;
            const dejaAccepte = (o.acceptations || []).some(a => normaliserId(a) === normaliserId(viewerId));
            return !dejaAccepte;
        });
    }

    if (!isNaN(lat) && !isNaN(lon)) {
        jobs = jobs.map(j => {
            const dist = geolib.getDistance(
                { latitude: lat, longitude: lon },
                { latitude: j.lat, longitude: j.lon }
            );
            return {
                ...j,
                distanceM: dist,
                dateLabel: libelleDateOffre(j.datePrevue)
            };
        })
        .filter(j => j.distanceM <= RAYON_VISIBILITE_JOBS)
        .sort((a, b) => a.distanceM - b.distanceM);
    } else {
        jobs = jobs.slice(-10).map(j => ({ ...j, dateLabel: libelleDateOffre(j.datePrevue) }));
    }

    res.json(jobs);
});

// Route pour savoir si des prestataires ont accepté des offres particulières du client
app.get('/api/notifs-offres-particulieres', requireAuth, (req, res) => {
    const myId = req.session.user.id;
    // On ne montre la notif que si le client n'a pas encore "vu" les nouvelles acceptations
    const mesOffres = offresDiscuter.filter(o => o.clientId === myId && o.acceptations.length > 0 && o.statut === 'en_attente' && !o.vuParClient);
    res.json(mesOffres);
});

// Route pour marquer l'offre comme consultée (efface la notif accueil)
app.post('/api/marquer-offre-vue/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const offre = offresDiscuter.find(o => o.id === id);
    if (offre && normaliserId(offre.clientId) === normaliserId(req.session.user.id)) {
        offre.vuParClient = true;
    }
    res.json({ ok: true });
});

// Route pour augmenter le prix d'une offre existante
app.post('/api/modifier-prix-offre/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nouveauPrix } = req.body;
    const offre = offresDiscuter.find(o => o.id === id);
    if (offre && normaliserId(offre.clientId) === normaliserId(req.session.user.id)) {
        offre.prix = parseInt(nouveauPrix, 10);
        offre.vuParClient = false; // On reset pour que les prestataires soient notifiés du changement si besoin
        return res.json({ ok: true, message: "Prix mis à jour !" });
    }
    res.status(404).json({ error: "Offre introuvable" });
});

// --- Récupération de mot de passe ---
app.post('/api/mot-de-passe-oublie', async (req, res) => {
    const { email } = req.body;
    const emailClean = (email || '').toLowerCase().trim();

    const { data: user } = await supabase.from('utilisateurs').select('id').eq('email', emailClean).maybeSingle();
    if (!user) {
        return res.status(404).json({ error: "Cet email n'existe pas dans notre base." });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const { error } = await supabase.from('utilisateurs')
        .update({ reset_code: code, reset_expires: new Date(Date.now() + 15*60000).toISOString() })
        .eq('email', emailClean);

    if (error) {
        console.error("Erreur Supabase (Colonnes reset_code manquantes ?):", error.message);
        return res.status(500).json({ error: "Erreur technique. Vérifiez les colonnes reset_code et reset_expires." });
    }
    
    // ENVOI RÉEL DU CODE PAR EMAIL
    const { data, error: mailError } = await resend.emails.send({
        from: 'PetitsDjobs <securite@mail.petitsdjobs.com>', 
        to: emailClean,
        subject: 'Votre code de récupération PetitsDjobs',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 20px auto; padding: 30px; border-radius: 15px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid #eee;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #FF6600; margin: 0; font-size: 24px; text-transform: uppercase;">PetitsDjobs</h1>
                    <p style="color: #888; font-size: 14px;">La confiance au service de votre quotidien</p>
                </div>
                <div style="border-top: 4px solid #FF6600; padding-top: 20px;">
                    <h2 style="color: #000000; font-size: 18px; text-align: center;">Récupération de compte</h2>
                    <p style="color: #555; line-height: 1.6;">Bonjour,</p>
                    <p style="color: #555; line-height: 1.6;">Vous avez demandé la réinitialisation de votre mot de passe. Voici votre code de sécurité unique :</p>
                    
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 10px; margin: 25px 0; border: 1px dashed #FF6600;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #FF6600;">${code}</span>
                    </div>

                    <p style="color: #e53935; font-size: 13px; text-align: center; font-weight: bold;">⚠️ Ce code expire dans 15 minutes.</p>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa;">
                    Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.<br>
                    © 2026 PetitsDjobs. Tous droits réservés.
                </div>
            </div>
        `
    });

    if (mailError) {
        console.error(`[RESEND ERROR] Échec pour ${emailClean}:`, mailError);
    } else {
        console.log("📧 MAIL ENVOYÉ via Resend à", emailClean, data?.id);
    }

    res.json({ ok: true, message: "Un code a été envoyé à votre adresse email." });
});

app.post('/api/reinitialiser-mdp', async (req, res) => {
    const { email, code, password } = req.body;
    
    const { data: user } = await supabase.from('utilisateurs')
        .select('reset_code, reset_expires')
        .eq('email', email.toLowerCase().trim())
        .single();

    if (!user || user.reset_code !== code || new Date() > new Date(user.reset_expires)) {
        return res.status(400).json({ error: "Code invalide ou expiré." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await supabase.from('utilisateurs')
        .update({ 
            password: hashedPassword, 
            reset_code: null, 
            reset_expires: null 
        })
        .eq('email', email.toLowerCase().trim());

    res.json({ ok: true, message: "Mot de passe modifié avec succès !" });
});


// Route pour valider la fin de tâche avec mot de passe
app.post('/valider-fin-tache', requireAuth, async (req, res) => {
    const { password } = req.body;
    const { data: user } = await supabase.from('utilisateurs').select('password').eq('id', req.session.user.id).single();
    
    const mdpCorrect = await bcrypt.compare(password, user.password);
    if (mdpCorrect) {
        // Logique de clôture de mission ici (ex: libérer le paiement)
        res.json({ ok: true, message: "Tâche terminée. Vous êtes marqué en sécurité." });
    } else {
        res.status(403).json({ error: "Mot de passe incorrect. Validation refusée." });
    }
});

// Route SOS
app.post('/alerte-sos', requireAuth, async (req, res) => {
    const user = req.session.user;
    const lat = req.body.lat || req.session.latClient || "Inconnue";
    const lon = req.body.lon || req.session.lonClient || "Inconnue";
    const mapsUrl = (lat !== "Inconnue") ? `https://www.google.com/maps?q=${lat},${lon}` : "Lien indisponible";

    // Récupération des détails complets du prestataire en base de données
    const { data: p } = await supabase.from('infos_prestataires').select('*').eq('user_id', user.id).maybeSingle();

    const alerteTexte = `
🚨 ALERTE DANGER IMMÉDIAT - PETITSDJOBS 🚨
--------------------------------------------------
IDENTITÉ DU PRESTATAIRE :
Nom complet : ${user.prenom} ${user.nom}
Email : ${user.email}
ID Utilisateur : ${user.id}
Âge : ${user.age || 'N/A'} ans
Téléphone : ${p?.telephone || 'Non renseigné'}

INFORMATIONS PROFESSIONNELLES :
Profession : ${p?.profession || 'N/A'}
Services : ${p?.services || 'N/A'}
Ville d'origine : ${p?.ville || 'N/A'}
Bio : ${p?.bio || 'N/A'}

LOCALISATION DE L'URGENCE :
Coordonnées : Latitude ${lat}, Longitude ${lon}
LIEN GOOGLE MAPS : ${mapsUrl}
--------------------------------------------------
Note : Cette alerte a été déclenchée manuellement par le prestataire depuis son interface de suivi.`;

    console.error(alerteTexte);

    // ENVOI D'UN EMAIL D'URGENCE À L'ADMINISTRATEUR
    safeSendEmail({
        from: 'SECURITE <urgence@mail.petitsdjobs.com>',
        to: process.env.ADMIN_EMAIL || 'votre-email-de-test@gmail.com',
        subject: `🚨 SOS URGENCE : ${user.prenom} ${user.nom}`,
        text: alerteTexte
    });

    res.json({ ok: true, message: "Alerte envoyée aux services de sécurité de PetitsDjobs." });
});

app.post('/accepter-job/:id', requireAuth, async (req, res) => {
    const offreId = parseInt(req.params.id, 10);
    const offre = offresDiscuter.find(o => o.id === offreId);
    if (!offre) return res.status(404).json({ error: 'Offre introuvable' });
    const prestataireId = req.session.user.id;
    const prestaNom = [req.session.user.prenom, req.session.user.nom].filter(Boolean).join(' ');

    if (!req.session.user.isPrestataire) return res.status(403).json({ error: 'Seuls les prestataires peuvent accepter.' });
    if (normaliserId(offre.clientId) === normaliserId(prestataireId)) {
        return res.status(403).json({ error: 'Vous ne pouvez pas accepter votre propre tâche.' });
    }

    const ids = (offre.acceptations || []).map(a => normaliserId(a));
    if (!ids.includes(normaliserId(prestataireId))) {
        offre.acceptations.push(prestataireId);

        // Notification par email au client
        if (offre.emailClient && resend) {
            safeSendEmail({
                from: 'PetitsDjobs <notifications@mail.petitsdjobs.com>',
                to: offre.emailClient,
                subject: '🎉 Un prestataire a accepté votre offre !',
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #FF6600;">Bonne nouvelle !</h2>
                        <p>Le prestataire <strong>${prestaNom}</strong> est intéressé par votre offre : <em>"${offre.description}"</em> pour <strong>${offre.prix} FCFA</strong>.</p>
                        <p>Connectez-vous dès maintenant pour finaliser votre choix et démarrer la mission.</p>
                        <a href="https://petitsdjobs.com/discuter?offreId=${offre.id}" style="display: inline-block; padding: 12px 25px; background: #FF6600; color: white; text-decoration: none; border-radius: 8px; margin-top: 10px; font-weight: bold;">Finaliser mon choix</a>
                    </div>
                `
            });
        }
    }
    res.json({ ok: true, message: 'Offre acceptée ! Attendez le choix du client.' });
});

app.post('/annuler-job/:id', requireAuth, async (req, res) => {
    const offreId = parseInt(req.params.id, 10);
    const index = offresDiscuter.findIndex(o => o.id === offreId);
    if (index === -1) return res.status(404).json({ error: 'Offre introuvable' });
    const offre = offresDiscuter[index];
    if (normaliserId(offre.clientId) !== normaliserId(req.session.user.id)) {
        return res.status(403).json({ error: 'Non autorisé' });
    }
    if (offre.paye) return res.status(400).json({ error: 'Impossible d\'annuler : le service est déjà payé.' });

    const clientNom = req.session.user.prenom || req.session.user.nom || 'Le client';
    for (const pid of offre.acceptations || []) {
        const { data: presta } = await supabase.from('utilisateurs').select('email, prenom').eq('id', pid).maybeSingle();
        if (presta?.email) {
            safeSendEmail({
                from: 'PetitsDjobs <notifications@mail.petitsdjobs.com>',
                to: presta.email,
                subject: '❌ Offre annulée par le client',
                html: `<p>Bonjour ${presta.prenom || ''}, ${clientNom} a <strong>annulé</strong> l'offre de service particulier (${offre.description}, ${offre.prix} FCFA) avant paiement.</p>`
            });
        }
    }
    offresDiscuter.splice(index, 1);
    res.json({ ok: true, message: 'Tâche annulée. Les prestataires intéressés ont été informés.' });
});

app.get('/statut-offre/:id', async (req, res) => {
    const offre = offresDiscuter.find(o => o.id === parseInt(req.params.id, 10));
    if (!offre) return res.status(404).json({ error: 'Offre introuvable' });

    if (offre.acceptations.length > 0) {
        // Récupérer les infos des prestataires qui ont accepté
        const { data: pInfos } = await supabase.from('infos_prestataires').select('user_id, photo_profil_url, etoiles, profession').in('user_id', offre.acceptations);
        const { data: uInfos } = await supabase.from('utilisateurs').select('id, nom, prenom').in('id', offre.acceptations);

        const detailAcceptations = (pInfos || []).map(p => {
            const u = uInfos.find(user => user.id === p.user_id);
            return {
                id: p.user_id,
                nom: u?.nom || 'Prestataire',
                prenom: u?.prenom || '',
                photo: p.photo_profil_url,
                etoiles: p.etoiles,
                profession: p.profession
            };
        });

        return res.json({ statut: 'accepte', list: detailAcceptations, prix: offre.prix });
    }
    res.json({ statut: 'en_attente', suggestion: 'Personne n\'a encore accepté.' });
});

app.get('/get-job-details/:id', requireAuth, (req, res) => {
    const offreId = parseInt(req.params.id, 10);
    const offre = offresDiscuter.find(o => o.id === offreId);
    if (!offre || normaliserId(offre.clientId) !== normaliserId(req.session.user.id)) {
        return res.status(404).json({ error: 'Offre introuvable ou non autorisée.' });
    }
    res.json(offre);
});

// Route pour supprimer uniquement le profil prestataire (redevenir simple utilisateur)
app.post('/supprimer-profil-prestataire', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { error } = await supabase.from('infos_prestataires').delete().eq('user_id', userId);
        
        if (error) throw error;

        // Mise à jour de la session pour refléter le changement de statut
        req.session.user.isPrestataire = false;
        req.session.save(() => {
            res.json({ ok: true, message: 'Votre profil prestataire a été supprimé.' });
        });
    } catch (err) {
        console.error("Erreur suppression profil prestataire:", err);
        res.status(500).json({ error: 'Impossible de supprimer le profil prestataire.' });
    }
});

// Route pour supprimer définitivement le compte utilisateur
app.post('/supprimer-compte', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // On supprime d'abord les infos prestataires puis l'utilisateur
        await supabase.from('infos_prestataires').delete().eq('user_id', userId);
        const { error } = await supabase.from('utilisateurs').delete().eq('id', userId);

        if (error) throw error;

        req.session.destroy(() => {
            res.json({ ok: true, message: 'Compte supprimé avec succès.' });
        });
    } catch (err) {
        console.error("Erreur suppression compte:", err);
        res.status(500).json({ error: 'Une erreur est survenue lors de la suppression.' });
    }
});

// --- ESPACE PUB / SHOWCASE ---
app.get('/api/get-showcase', async (req, res) => {
    try {
        const { data, error } = await supabase.from('showcase')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
        if (error) {
            console.warn('[SHOWCASE API]', error.message);
            return res.json([]);
        }
        res.json(data || []);
    } catch (e) {
        res.json([]);
    }
});

app.get('/api/get-user-showcase/:userId', async (req, res) => {
    const { data } = await supabase.from('showcase')
        .select('*')
        .eq('user_id', req.params.userId)
        .order('created_at', { ascending: false });
    res.json(data || []);
});

app.post('/api/upload-showcase', requireAuth, upload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
    try {
        const url = await uploadToSupabase(req.file, BUCKET_NAME);
        const { data, error } = await supabase.from('showcase').insert({
            user_id: req.session.user.id,
            url: url,
            media_type: req.file.mimetype
        }).select().single();
        if (error) throw error;
        res.json({ ok: true, item: data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/delete-showcase/:id', requireAuth, async (req, res) => {
    const itemId = req.params.id;
    const { data: item } = await supabase.from('showcase').select('user_id').eq('id', itemId).maybeSingle();
    if (!item || normaliserId(item.user_id) !== normaliserId(req.session.user.id)) {
        return res.status(403).json({ error: 'Non autorisé' });
    }
    const { error } = await supabase.from('showcase').delete().eq('id', itemId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.post('/api/upload-vocal', requireAuth, upload.single('audio'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier audio' });
    try {
        const url = await uploadToSupabase(req.file, BUCKET_NAME);
        res.json({ url });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- SYSTÈME D'AMIS ---
app.post('/api/inviter-ami', requireAuth, async (req, res) => {
    const senderId = req.session.user.id;
    const receiverId = req.body.targetId;
    if (senderId == receiverId) return res.status(400).json({ error: "Action impossible" });

    const { error } = await supabase.from('invitations').upsert({
        sender_id: senderId,
        receiver_id: receiverId,
        statut: 'en_attente'
    });
    res.json({ ok: !error, message: error ? "Déjà envoyé" : "Demande d'ami envoyée !" });
});

app.get('/api/mes-demandes-amis', requireAuth, async (req, res) => {
    const { data } = await supabase.from('invitations')
        .select('id, sender_id, utilisateurs!invitations_sender_id_fkey(prenom, nom)')
        .eq('receiver_id', req.session.user.id)
        .eq('statut', 'en_attente');
    res.json(data?.map(i => ({ id: i.id, user: i.utilisateurs })) || []);
});

app.post('/api/repondre-invitation', requireAuth, async (req, res) => {
    const { invitationId, action } = req.body;
    if (action === 'accepte') {
        const { data: invit } = await supabase.from('invitations').select('*').eq('id', invitationId).single();
        await supabase.from('amis').insert([
            { user_id1: invit.sender_id, user_id2: invit.receiver_id },
            { user_id1: invit.receiver_id, user_id2: invit.sender_id }
        ]);
        await supabase.from('invitations').delete().eq('id', invitationId);
        res.json({ ok: true });
    } else {
        await supabase.from('invitations').delete().eq('id', invitationId);
        res.json({ ok: true });
    }
});

app.get('/api/liste-amis', requireAuth, async (req, res) => {
    const { data } = await supabase.from('amis')
        .select('user_id2, utilisateurs!amis_user_id2_fkey(*)')
        .eq('user_id1', req.session.user.id);

    const { data: prestas } = await supabase.from('infos_prestataires').select('user_id, profession, photo_profil_url');
    const prestaMap = Object.fromEntries((prestas || []).map(p => [p.user_id, p]));

    res.json((data || []).map(d => ({
        ...d.utilisateurs,
        profession: prestaMap[d.user_id2]?.profession,
        photo: prestaMap[d.user_id2]?.photo_profil_url || d.utilisateurs.photo_url
    })));
});

// Configuration de la mise en cache pour les fichiers statiques
const optionsCache = {
    maxAge: '0',
    setHeaders: (res, filePath) => {
        if (filePath.match(/\.(webp|jpg|jpeg|png|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        }
        if (filePath.match(/\.(css|js)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }
};

app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), optionsCache));
app.use(express.static(publicDir, optionsCache));

app.listen(port, () => {
    console.log(`🚀 [SYSTEM] Serveur démarré sur le port ${port}`);
});