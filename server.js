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
    limits: { fileSize: 5 * 1024 * 1024 } // Limite à 5Mo par fichier
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
        const result = await resend.emails.send(payload);
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
const offresDiscuter = [];

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Middleware de journalisation des requêtes (Visible dans les logs Render)
app.use((req, res, next) => {
    // On ne log que les routes API pour éviter de polluer les logs avec le CSS/Images
    if (req.url.startsWith('/api') || req.url.includes('jobs')) {
        console.log(`🌐 [API] ${req.method} ${req.url}`);
    }
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
        console.log(`[DEBUG SEARCH ${timestamp}] Type=${type}, Query=${query_text || 'Tous'}, GPS=${dLat},${dLon}`);

        // 1. On récupère un pool plus large de prestataires pour garantir des résultats
        let query = supabase.from('infos_prestataires').select('*');
        
        // On récupère les 200 meilleurs profils sans filtre géographique initial
        query = query.order('etoiles', { ascending: false }).limit(200);

        const { data: prestataires, error: pError } = await query;
        
        if (pError) {
            console.error("[DEBUG SEARCH] Erreur Supabase:", pError.message);
            return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };
        }

        // 2. On récupère les infos utilisateurs séparément pour éviter l'erreur de relationship
        const userIds = prestataires.map(p => p.user_id);
        const { data: users } = await supabase
            .from('utilisateurs')
            .select('id, nom, prenom, dernier_acces')
            .in('id', userIds);

        const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

        const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;

        let eligibles = (prestataires || [])
            .filter(p => String(p.user_id) !== String(excludeUserId))
            .filter(p => {
                const user = userMap[p.user_id];
                if (!user) return false;

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
                const user = userMap[p.user_id];
                const dernierAccesTs = user?.dernier_acces ? new Date(user.dernier_acces).getTime() : 0;
                const enLigne = (Date.now() - dernierAccesTs) < SEUIL_EN_LIGNE_MS;

                return { 
                    ...p, 
                    id_num: user.id,
                    nom: user?.nom || 'Prestataire', 
                    prenom: user?.prenom || '', 
                    enLigne: enLigne,
                    dernier_acces: user?.dernier_acces,
                    distanceM: dist,
                };
            });

        const nbTotalInscrits = eligibles.length;

        // 3. Logique de tri ultra-précise
        eligibles.sort((a, b) => {
            // Gestion des cas sans GPS (Distance = Infinity)
            if (a.distanceM === Infinity && b.distanceM !== Infinity) return 1;
            if (a.distanceM !== Infinity && b.distanceM === Infinity) return -1;

            if (a.distanceM !== Infinity && b.distanceM !== Infinity) {
                // Règle des buckets de 10 mètres pour l'expansion du rayon
                const bucketA = Math.floor(a.distanceM / 10);
                const bucketB = Math.floor(b.distanceM / 10);
                if (bucketA !== bucketB) return bucketA - bucketB;
            }

            // Dans le même bucket, "En ligne" d'abord
            if (a.enLigne !== b.enLigne) return a.enLigne ? -1 : 1;

            if (a.enLigne) {
                // En ligne -> priorité aux meilleures étoiles
                return (b.etoiles || 0) - (a.etoiles || 0);
            } else {
                // Hors ligne -> priorité au plus récemment connecté
                const timeA = new Date(a.dernier_acces || 0).getTime();
                const timeB = new Date(b.dernier_acces || 0).getTime();
                if (timeA !== timeB) return timeB - timeA;
                return a.distanceM - b.distanceM;
            }
        });

        // Règle : si plus de 50 inscrits au total, on applique la limite des 50km (Service uniquement)
        let results = eligibles;
        if (type === 'service' && nbTotalInscrits >= 50) {
            results = eligibles.filter(p => p.distanceM <= RAYON_MAX_METRES);
        }

        console.log(`[DEBUG SEARCH ${timestamp}] Résultats : ${eligibles.length} éligibles, dont ${eligibles.filter(e => e.enLigne).length} en ligne.`);

        const limitFixe = limit || 20;
        const page = results.slice(offset, offset + limitFixe);

        return {
            prestataires: page.map(p => ({
                id: p.user_id,
                nom: p.nom,
                prenom: p.prenom,
                profession: p.profession,
                bio: p.bio,
                photo: p.photo_profil_url,
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
app.get('/get-user-data', (req, res) => res.json(req.session.user || {}));

app.get('/get-session-commande', async (req, res) => {
    const cmd = req.session.commande;
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
        const filtered = result.prestataires;

        console.log(`[DEBUG TOP] ${filtered.length} prestataires proches envoyés (filtrés sur 7 jours).`);
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
    const { service, prix, prixLibre, missionId } = req.body;
    // FIX: Fusionner avec la session existante pour ne pas perdre le prestataireId
    req.session.commande = req.session.commande || {};
    if (service) req.session.commande.service = service;
    if (prix !== undefined) req.session.commande.prixBase = parseInt(prixLibre || prix, 10) || 0;
    if (prixLibre !== undefined) req.session.commande.prixLibre = !!prixLibre;
    if (missionId) req.session.commande.missionId = missionId;
    
    req.session.save((err) => {
        if (err) console.error("Erreur sauvegarde session preparer-commande:", err);
        res.json({ ok: true });
    });
});

// Route pour simuler la réussite d'un paiement (Mode Test)
app.post('/api/simuler-paiement', requireAuth, async (req, res) => {
    const { datePrevue } = req.body;
    const cmd = req.session.commande;
    const lat = req.session.latClient || req.session.user?.lat;
    const lon = req.session.lonClient || req.session.user?.lon;
    
    console.log("[DEBUG SIMU PAY] Vérification session avant insertion...");
    console.log(`[DEBUG SIMU PAY] GPS récupéré: ${lat}, ${lon}`);
    console.log(`[DEBUG SIMU PAY] IDs: Client=${req.session.user?.id}, Presta=${cmd?.prestataireId}`);

    if (!cmd || !cmd.prestataireId || !lat || !lon) {
        console.error("[SIMU PAY ERROR] Données manquantes:", { hasCmd: !!cmd, prestaId: cmd?.prestataireId, lat, lon });
        return res.status(400).json({ ok: false, error: "Localisation introuvable. Activez votre GPS et rafraîchissez la page." });
    }

    const payload = {
        client_id: parseInt(req.session.user.id, 10),
        prestataire_id: parseInt(cmd.prestataireId, 10),
        backup_ids: (cmd.backups && cmd.backups.length > 0) ? cmd.backups.map(b => b.id) : null,
        service: cmd.service,
        prix: parseInt(cmd.total || cmd.prixBase || 0, 10),
        statut: 'en_attente_prestataire',
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

        console.log("✅ MISSION CRÉÉE AVEC SUCCÈS. ID:", data.id);
        req.session.commande.missionId = data.id;
        req.session.commande.paye = true;
        req.session.commande.statut = payload.statut;

        // NOTIFICATION DU PRESTATAIRE PAR EMAIL
        const { data: pUser } = await supabase.from('utilisateurs').select('email, prenom').eq('id', cmd.prestataireId).single();
        if (pUser && pUser.email && resend) {
            const msgDate = datePrevue === 'today' ? "immédiate" : `prévue pour le **${datePrevue}**`;
            safeSendEmail({
                from: 'PetitsDjobs <onboarding@resend.dev>',
                to: pUser.email,
                subject: `🚨 Nouvelle mission ${msgDate} !`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #5D4037;">Bonjour ${pUser.prenom},</h2>
                        <p>Vous avez reçu une demande pour : <strong>${cmd.service}</strong> (${msgDate}).</p>
                        <p>${datePrevue === 'today' ? "Le client a été invité à vous appeler pour confirmer." : "Merci de vous connecter pour valider cette réservation à l'avance."}</p>
                        <a href="https://petitsdjobs.render.com/prestataire-info" style="display: inline-block; padding: 10px 20px; background: #5D4037; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Voir ma carte de visite</a>
                    </div>
                `
            });
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
// Cette fonction tourne en arrière-plan toutes les 15 secondes pour vérifier les délais
setInterval(async () => {
    const UNE_MINUTE_EN_MS = 60 * 1000;
    const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000;
    const seuilExpiration = new Date(Date.now() - UNE_MINUTE_EN_MS).toISOString();

    // 1. Trouver les missions qui n'ont pas été acceptées à temps
    const { data: missionsExpirees } = await supabase
        .from('missions')
        .select('*')
        .eq('statut', 'en_attente_prestataire')
        .lt('created_at', seuilExpiration);

    if (!missionsExpirees || missionsExpirees.length === 0) return;

    for (const mission of missionsExpirees) {
        // VÉRIFICATION : Le prestataire est-il en ligne ?
        const { data: user } = await supabase.from('utilisateurs').select('dernier_acces').eq('id', mission.prestataire_id).maybeSingle();
        const dernierAccesTs = user?.dernier_acces ? new Date(user.dernier_acces).getTime() : 0;
        const estEnLigne = (Date.now() - dernierAccesTs) < SEUIL_EN_LIGNE_MS;

        // RÈGLE : On n'expire automatiquement QUE si le prestataire est EN LIGNE
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
                // NOTIFIER LES DEUX PARTIES
                const { data: anciens } = await supabase.from('utilisateurs').select('email, prenom').eq('id', mission.prestataire_id).single();
                const { data: nouveaux } = await supabase.from('utilisateurs').select('email, prenom').eq('id', nouveauPrestaId).single();

                if (anciens?.email) {
                    safeSendEmail({
                        from: 'PetitsDjobs <alerte@resend.dev>',
                        to: anciens.email,
                        subject: '⏰ Temps de réponse expiré',
                        html: `<p>Bonjour ${anciens.prenom}, vous n'avez pas répondu à temps pour la mission de <strong>${mission.service}</strong>. Elle a été attribuée à un autre prestataire.</p>`
                    });
                }

                if (nouveaux?.email) {
                    safeSendEmail({
                        from: 'PetitsDjobs <alerte@resend.dev>',
                        to: nouveaux.email,
                        subject: '🚨 Mission de secours disponible !',
                        html: `<p>Bonjour ${nouveaux.prenom}, le premier prestataire n'étant pas disponible, cette mission de <strong>${mission.service}</strong> vous est maintenant proposée ! Connectez-vous vite.</p>`
                    });
                }
            }
        } else {
            // PLUS DE SECOURS : ANNULATION FINALE
            console.log(`[AUTO-ANNULATION] Mission ${mission.id} : Aucun prestataire disponible.`);
            await supabase.from('missions').update({ 
                statut: 'refuse', 
                raison_refus: "Temps de réponse expiré (Prestataire en ligne)" 
            }).eq('id', mission.id);
            
            const { data: client } = await supabase.from('utilisateurs').select('email').eq('id', mission.client_id).single();
            if (client?.email) {
                safeSendEmail({
                    from: 'PetitsDjobs <support@resend.dev>',
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
                const { error: mErr } = await supabase.from('missions').update({ lat_prestataire: lat, lon_prestataire: lon })
                    .eq('prestataire_id', req.session.user.id)
                    .in('statut', ['en_route', 'travail_en_cours', 'attente_securite']);
                if (mErr) console.error(`[GPS UPDATE ERR] Echec mise à jour mission prestataire:`, mErr.message);
            } else {
                console.log(`[GPS UPDATE] Client ${req.session.user.id} : Lat=${lat}, Lon=${lon}`);
                const { error: cErr } = await supabase.from('missions').update({ lat_client: lat, lon_client: lon })
                    .eq('client_id', req.session.user.id)
                    .in('statut', ['en_route', 'travail_en_cours']);
                if (cErr) console.error(`[GPS UPDATE ERR] Echec mise à jour mission client:`, cErr.message);
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

    if (!missions || missions.length === 0) return res.json([]);

    // On récupère les infos des clients manuellement
    const clientIds = missions.map(m => m.client_id);
    const { data: clients } = await supabase.from('utilisateurs').select('id, nom, prenom').in('id', clientIds);
    const clientMap = Object.fromEntries((clients || []).map(c => [c.id, c]));

    const result = missions.map(m => ({
        ...m,
        client: clientMap[m.client_id] || { nom: 'Client', prenom: 'Inconnu' }
    }));

    console.log(`[QUERY DB RESULT] ${result.length} missions envoyées.`);
    res.json(result);
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
    const statut = action === 'accepter' ? 'en_route' : 'refuse';
    
    // Récupération des infos de la mission avant mise à jour
    const { data: mission } = await supabase.from('missions').select('*').eq('id', missionId).single();
    
    const { error } = await supabase.from('missions').update({ statut }).eq('id', missionId).eq('prestataire_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });

    // Si un prestataire accepte, on prévient les autres qu'ils ne sont plus nécessaires
    if (action === 'accepter' && mission) {
        const tousLesAutresIds = [mission.prestataire_id, ...(mission.backup_ids || [])].filter(id => String(id) !== String(req.session.user.id));
        
        if (tousLesAutresIds.length > 0 && resend) {
            const { data: autresUsers } = await supabase.from('utilisateurs').select('email, prenom').in('id', tousLesAutresIds);
            
            if (autresUsers) {
                for (const u of autresUsers) {
                    safeSendEmail({
                        from: 'PetitsDjobs <info@resend.dev>',
                        to: u.email,
                        subject: '✅ Mission pourvue',
                        html: `
                            <div style="font-family: sans-serif; padding: 20px;">
                                <h3>Bonjour ${u.prenom},</h3>
                                <p>La mission de <strong>${mission.service}</strong> pour laquelle vous étiez sollicité a été acceptée par un autre prestataire.</p>
                                <p>Merci de votre disponibilité !</p>
                            </div>
                        `
                    });
                }
            }
        }
    }

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
    const { error } = await supabase.from('missions').update({ statut: 'attente_securite' }).eq('id', missionId).eq('prestataire_id', req.session.user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
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

    const { data, error } = await supabase.from('missions').select('lat_client, lon_client').eq('id', missionId).maybeSingle();
    if (error || !data) {
        console.error(`[DEBUG GPS CLIENT] Erreur ou données absentes:`, error?.message);
        return res.json({});
    }
    console.log(`[DEBUG GPS CLIENT] Position client renvoyée: ${data.lat_client}, ${data.lon_client}`);
    res.json({ lat: data.lat_client, lon: data.lon_client });
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
            req.session.user = { ...compte };
            if (profil) {
                req.session.user.isPrestataire = true;
                req.session.user.profession = profil.profession;
                req.session.user.bio = profil.bio;
                req.session.user.ville = profil.ville;
                req.session.user.services = profil.services;
                req.session.user.photo = profil.photo_profil_url;
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
        res.redirect('/index.html?connecte=1');
    });
});

app.post('/inscription', async (req, res) => {
    console.log(`[DIAGNOSTIC INSCRIPTION] Début pour: ${req.body.email}`);
    if (estConnecte(req)) return res.redirect('/index.html');

    const locOk = req.body.locAccepted === '1' || req.body.locAccepted === 'on';
    const polOk = req.body.polAccepted === '1' || req.body.polAccepted === 'on';
    if (!locOk || !polOk) return res.redirect('/inscription?erreur=consentement');
    if (req.body.password !== req.body.password_confirm) {
        return res.redirect('/inscription?erreur=mdp');
    }
    const email = (req.body.email || '').toLowerCase().trim();
    console.log(`[AUTH] Tentative d'inscription pour: ${email}`);
    const { data: existant, error: searchError } = await supabase.from('utilisateurs').select('id').eq('email', email).maybeSingle();
    
    if (existant) {
        console.log(`[AUTH] Email déjà existant dans la base: ${email}`);
        return res.redirect('/inscription?erreur=deja_inscrit');
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
        const userData = {
            email,
            password: hashedPassword,
            nom: (req.body.nom || '').trim(),
            prenom: (req.body.prenom || '').trim(),
            age: parseInt(req.body.age, 10),
            telephone: (req.body.telephone || '').trim(),
            autorise_contact_client: req.body.autorise_contact_client === 'on' || req.body.autorise_contact_client === '1'
        };
        
        const { data: newUser, error } = await supabase.from('utilisateurs').insert(userData).select().single();
        if (error) {
            console.error("[DIAGNOSTIC DB INSCRIPTION ERROR]", error.message);
            throw error;
        }

        console.log("[DIAGNOSTIC] Inscription DB réussie, initialisation session...");
        req.session.user = { ...newUser };
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
    
    // Compression automatique avec Sharp
    const compressedBuffer = await sharp(file.path)
        .resize({ width: 400, height: 300, fit: 'cover', withoutEnlargement: true }) // Taille réduite pour mobile
        .webp({ quality: 20, effort: 6 }) // Compression énorme (qualité 20%)
        .toBuffer();

    const fileName = `${Date.now()}-${path.parse(file.originalname).name}.webp`;
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, compressedBuffer, { contentType: 'image/webp' });
    
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
app.post('/proposer-prix-discuter', upload.single('photo_job'), async (req, res) => {
    const { prix, lat, lon, description } = req.body;
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
        clientId: req.session.user.id, // Ajout de l'ID du client qui a posté l'offre
        emailClient: req.session.user?.email,
        prix: prixNum,
        description: description || 'Besoin d\'un service particulier',
        photo: photoUrl,
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        acceptations: [],
        statut: 'en_attente',
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
    const RAYON_VISIBILITE_JOBS = 15000; // Rayon de 15 km pour ne pas surcharger

    let jobs = offresDiscuter.filter(o => o.statut === 'en_attente');

    if (!isNaN(lat) && !isNaN(lon)) {
        jobs = jobs.map(j => {
            const dist = geolib.getDistance(
                { latitude: lat, longitude: lon },
                { latitude: j.lat, longitude: j.lon }
            );
            return { ...j, distanceM: dist };
        })
        .filter(j => j.distanceM <= RAYON_VISIBILITE_JOBS) // Filtrage par rayon
        .sort((a, b) => a.distanceM - b.distanceM); // Les plus proches en premier
    } else {
        // Si pas de GPS, on limite quand même pour ne pas surcharger
        jobs = jobs.slice(-10);
    }

    res.json(jobs);
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
        from: 'PetitsDjobs <onboarding@resend.dev>', 
        to: emailClean,
        subject: 'Votre code de récupération PetitsDjobs',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 20px auto; padding: 30px; border-radius: 15px; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid #eee;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #5D4037; margin: 0; font-size: 24px; text-transform: uppercase;">PetitsDjobs</h1>
                    <p style="color: #888; font-size: 14px;">La confiance au service de votre quotidien</p>
                </div>
                <div style="border-top: 4px solid #5D4037; padding-top: 20px;">
                    <h2 style="color: #333; font-size: 18px; text-align: center;">Récupération de compte</h2>
                    <p style="color: #555; line-height: 1.6;">Bonjour,</p>
                    <p style="color: #555; line-height: 1.6;">Vous avez demandé la réinitialisation de votre mot de passe. Voici votre code de sécurité unique :</p>
                    
                    <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 10px; margin: 25px 0; border: 1px dashed #5D4037;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
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
        from: 'SECURITE <onboarding@resend.dev>',
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
    if (!req.session.user.isPrestataire) return res.status(403).json({ error: 'Seuls les prestataires peuvent accepter.' });
    if (offre.clientId === prestataireId) return res.status(403).json({ error: 'Vous ne pouvez pas accepter votre propre tâche.' });

    if (!offre.acceptations.includes(prestataireId)) {
        offre.acceptations.push(prestataireId);
    }
    res.json({ ok: true, message: 'Offre acceptée ! Attendez le choix du client.' });
});

app.post('/annuler-job/:id', requireAuth, (req, res) => {
    const offreId = parseInt(req.params.id, 10);
    const index = offresDiscuter.findIndex(o => o.id === offreId);
    if (index === -1) return res.status(404).json({ error: 'Offre introuvable' });
    const offre = offresDiscuter[index];
    if (offre.clientId !== req.session.user.id) return res.status(403).json({ error: 'Non autorisé' });
    if (offre.acceptations.length > 0) return res.status(400).json({ error: 'Un prestataire a déjà accepté.' });
    offresDiscuter.splice(index, 1);
    res.json({ ok: true, message: 'Tâche annulée.' });
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
    if (!offre || offre.clientId !== req.session.user.id) return res.status(404).json({ error: 'Offre introuvable ou non autorisée.' });
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

// --- DIAGNOSTIC GOOGLE : Autorisation et Logs de passage ---

// Configuration de la mise en cache pour les fichiers statiques
const optionsCache = {
    maxAge: '30d', // Indique au navigateur de garder les fichiers 30 jours
    setHeaders: (res, path) => {
        // On cible spécifiquement les images pour une mise en cache agressive
        if (path.match(/\.(webp|jpg|jpeg|png|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
        }
        // On peut aussi mettre en cache le CSS et le JS
        if (path.match(/\.(css|js)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 jours
        }
    }
};

app.use('/uploads', express.static(path.join(publicDir, 'uploads'), optionsCache));
app.use(express.static(publicDir, { ...optionsCache, index: false }));

// Middleware global de capture d'erreurs (Crucial pour le débogage sur Render)
app.use((err, req, res, next) => {
    console.error(`❌❌❌ [ERREUR CRITIQUE SERVEUR] ${req.method} ${req.url} ❌❌❌\nMessage: ${err.message}\n📋 COPIEZ CECI :\n${err.stack}\n❌❌❌ --- FIN --- ❌❌❌`);
    res.status(500).json({ error: "Une erreur interne est survenue sur le serveur." });
});

app.listen(port, '0.0.0.0', () => console.log(`🚀 Serveur démarré sur le port ${port} (Binding 0.0.0.0)`));