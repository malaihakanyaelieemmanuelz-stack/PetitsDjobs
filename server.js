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
const nodemailer = require('nodemailer');

const app = express();
// Mise à jour structure table : synchronisation avec infos_prestataires

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
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_KEY
);

// --- Configuration de l'envoi d'emails (GMAIL recommandé) ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Ton adresse Gmail
        pass: process.env.EMAIL_PASS  // Ton "Mot de passe d'application" Google
    }
});

// --- Test de connexion pour les logs Render ---
supabase.from('utilisateurs').select('id').limit(1)
    .then(({ error }) => {
        if (error) {
            console.error('❌ Erreur de connexion Supabase :', error.message);
        } else {
            console.log('✅ Connexion à Supabase réussie !');
        }
    })
    .catch(err => console.error('❌ Erreur fatale lors de l\'initialisation Supabase :', err));

const PRIX_PAR_KM = 200;
const BATCH_PRESTATAIRES = 20;
const RAYON_MAX_METRES = 50000;
const BUCKET_NAME = 'prestataires';
const offresDiscuter = [];

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'petit-secret-job-2026',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Nécessaire pour Render
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 30,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true en production (HTTPS), false en local
        sameSite: 'lax'
    }
}));

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
    if (p.lat == null || p.lon == null) return Infinity;
    return geolib.getDistance(
        { latitude: parseFloat(lat), longitude: parseFloat(lon) },
        { latitude: parseFloat(p.lat), longitude: parseFloat(p.lon) }
    );
}

async function chercherParRayonCroissant(lat, lon, service, offset, limit, excludeUserId) {
    try {
        console.log(`[LOG] Recherche: Svc=${service || 'Tous'}, Lat=${lat ?? 'N/A'}, Lon=${lon ?? 'N/A'}`);
        const { data: prestataires } = await supabase.from('infos_prestataires').select('*');
        if (!prestataires) return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };

        const userIds = prestataires.map(p => p.user_id);
        const { data: users } = await supabase.from('utilisateurs').select('id, nom, prenom, dernier_acces').in('id', userIds);
        const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

        const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000; // Réduit à 5 minutes pour plus de précision

        const eligibles = prestataires
            .filter(p => p.user_id !== excludeUserId) // INTERDICTION DE SE COMMANDER SOI-MÊME
            .filter(p => serviceMatch(p, service) && userMap[p.user_id])
            .map(p => {
                const dist = distanceMetres(p, lat, lon);
                const user = userMap[p.user_id];
                const dernierAccesTs = user?.dernier_acces ? new Date(user.dernier_acces).getTime() : 0;
                const enLigne = (Date.now() - dernierAccesTs) < SEUIL_EN_LIGNE_MS;

                return { 
                    ...p, 
                    nom: userMap[p.user_id]?.nom || 'Prestataire', 
                    prenom: userMap[p.user_id]?.prenom || '', 
                    enLigne: enLigne,
                    dernier_acces: user?.dernier_acces,
                    distanceM: dist,
                };
            })
            .filter(p => (lat == null || lon == null) ? true : p.distanceM <= RAYON_MAX_METRES)
            .sort((a, b) => {
                // 1. Priorité absolue : En ligne ET à moins de 10 mètres
                const aProcheEnLigne = a.enLigne && a.distanceM <= 10;
                const bProcheEnLigne = b.enLigne && b.distanceM <= 10;
                if (aProcheEnLigne !== bProcheEnLigne) return aProcheEnLigne ? -1 : 1;

                // 2. Si aucun des deux n'est "proche en ligne", on trie par statut En Ligne
                if (a.enLigne !== b.enLigne) return a.enLigne ? -1 : 1;
                
                // 3. Pour les hors-ligne, priorité au plus récemment connecté
                if (!a.enLigne && !b.enLigne) {
                    return new Date(b.dernier_acces) - new Date(a.dernier_acces);
                }

                // 4. Ensuite par étoiles
                const etoilesA = a.etoiles || 0;
                const etoilesB = b.etoiles || 0;
                if (etoilesA !== etoilesB) return etoilesB - etoilesA;

                // 3. Enfin par date d'inscription (plus ancien en premier)
                if (a.created_at && b.created_at) {
                    return new Date(a.created_at) - new Date(b.created_at);
                }

                return a.distanceM - b.distanceM;
            });

        const limitFixe = limit || 20;
        const page = eligibles.slice(offset, offset + limitFixe);

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
            dernierAcces: p.dernier_acces,
            telephone: p.autorise_numero_deconnexion ? p.telephone : null
            })),
            rayonMetres: page.length ? Math.max(...page.map(p => p.distanceM)) : 0,
            hasMore: eligibles.length > offset + limitFixe,
            total: eligibles.length
        };
    } catch (err) {
        return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };
    }
}

function prixDistanceFcfa(distanceMetres) {
    const km = distanceMetres / 1000;
    return Math.round(km * PRIX_PAR_KM);
}

function estConnecte(req) {
    return !!(req.session.user && req.session.user.email);
}

function requireAuth(req, res, next) {
    if (estConnecte(req)) return next();
    return res.redirect('/connexion');
}

function redirectSiConnecte(req, res, next) {
    if (estConnecte(req)) return res.redirect('/index.html');
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
app.get('/suivi', requireAuth, (req, res) => res.sendFile(path.join(publicDir, 'suivi.html')));
app.get('/reinitialiser-mdp', (req, res) => res.sendFile(path.join(publicDir, 'reinitialiser-mdp.html')));
app.get('/recuperation-mdp', (req, res) => res.sendFile(path.join(publicDir, 'recuperation-mdp.html')));

app.post('/deconnexion', (req, res) => {
    req.session.destroy(() => res.redirect('/index.html'));
});

// --- API ---
app.get('/get-user-data', (req, res) => res.json(req.session.user || {}));
app.get('/get-session-commande', (req, res) => res.json(req.session.commande || {}));

// Route pour obtenir le nombre total de prestataires inscrits
app.get('/api/total-prestataires', async (req, res) => {
    const { count } = await supabase.from('infos_prestataires').select('*', { count: 'exact', head: true });
    res.json({ total: count || 0 });
});

app.get('/get-all-prestataires', async (req, res) => {
    const { data: prestataires } = await supabase.from('infos_prestataires').select('*');
    if (!prestataires) return res.json([]);
    const userIds = prestataires.map(p => p.user_id);
    const { data: users } = await supabase.from('utilisateurs').select('id, nom, prenom').in('id', userIds);
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    res.json(prestataires
        .filter(p => userMap[p.user_id])
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
        const lat = req.session.latClient;
        const lon = req.session.lonClient;
        const result = await chercherParRayonCroissant(lat, lon, null, 0, 50, req.session.user?.id);
        // FILTRE : On ne garde que ceux qui sont EN LIGNE pour le défilement
        const enLigneUniquement = result.prestataires.filter(p => p.disponible);
        res.json(enLigneUniquement);
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
    const { service, prix, prixLibre } = req.body;
    req.session.commande = {
        service: service || 'Service',
        prixBase: parseInt(prixLibre || prix, 10) || 0,
        prixLibre: !!prixLibre
    };
    res.json({ ok: true });
});

// Route pour simuler la réussite d'un paiement (Mode Test)
app.post('/api/simuler-paiement', requireAuth, (req, res) => {
    if (!req.session.commande) {
        return res.status(400).json({ error: "Aucune commande en cours." });
    }
    // On marque la commande comme payée en session
    req.session.commande.paye = true;
    req.session.commande.statut = 'en_route';
    res.json({ ok: true, message: "Paiement simulé avec succès !" });
});

app.post('/sauvegarder-position', async (req, res) => {
    const { lat, lon } = req.body;
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

            // Si c'est un prestataire, on met aussi à jour sa position réelle pour le suivi client
            if (req.session.user.isPrestataire) {
                await supabase.from('infos_prestataires')
                    .update({ lat: parseFloat(lat), lon: parseFloat(lon) })
                    .eq('user_id', req.session.user.id);
            }
        }
    }
    res.json({ ok: true, lat: req.session.latClient, lon: req.session.lonClient });
});

app.post('/chercher-prestataires', async (req, res) => {
    const { lat, lon, service, offset } = req.body;
    const latC = lat ?? req.session.latClient;
    const lonC = lon ?? req.session.lonClient;
    const svc = service || req.session.commande?.service;

    if (latC == null || lonC == null) {
        return res.status(400).json({ error: 'Position GPS requise' });
    }

    req.session.latClient = parseFloat(latC);
    req.session.lonClient = parseFloat(lonC);

    const result = await chercherParRayonCroissant(
        latC, lonC, svc,
        parseInt(offset, 10) || 0,
        BATCH_PRESTATAIRES,
        req.session.user?.id // Exclure l'utilisateur actuel
    );
    res.json(result);
});

app.post('/selectionner-prestataire', async (req, res) => {
    const { prestataireId } = req.body;
    const { data: p } = await supabase
        .from('infos_prestataires')
        .select('*')
        .eq('user_id', prestataireId)
        .maybeSingle();
    if (!p || req.session.latClient == null) {
        return res.status(400).json({ error: 'Prestataire ou position introuvable' });
    }
    const { data: user } = await supabase.from('utilisateurs').select('nom, prenom').eq('id', p.user_id).maybeSingle();
    const distM = distanceMetres(p, req.session.latClient, req.session.lonClient);
    const frais = prixDistanceFcfa(distM);
    req.session.commande = req.session.commande || {};
    req.session.commande.prestataireId = p.user_id;
    req.session.commande.prestataireNom = user?.nom || 'Prestataire';
    req.session.commande.prestatairePrenom = user?.prenom || '';
    req.session.commande.prestatairePhoto = p.photo_profil_url || '';
    req.session.commande.distanceM = distM;
    req.session.commande.distanceKm = (distM / 1000).toFixed(2);
    req.session.commande.fraisDeplacement = frais;
    req.session.commande.total = (req.session.commande.prixBase || 0) + frais;

    // FIX: On force la sauvegarde de la session avant de répondre pour éviter le "double clic"
    req.session.save(() => {
        return res.json({
            prestataireNom: user?.nom || 'Prestataire',
            distanceKm: req.session.commande.distanceKm,
            fraisDeplacement: frais,
            prixBase: req.session.commande.prixBase,
            total: req.session.commande.total || 0
        });
    });
});

// Route pour que le client récupère la position GPS du prestataire choisi
app.get('/api/suivi-prestataire-gps', requireAuth, async (req, res) => {
    const cmd = req.session.commande;
    if (!cmd || !cmd.prestataireId) return res.json({});
    
    const { data } = await supabase.from('infos_prestataires').select('lat, lon').eq('user_id', cmd.prestataireId).maybeSingle();
    res.json(data || {});
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
            console.error("Erreur de connexion :", err);
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

    req.session.save(() => {
        res.redirect('/index.html?connecte=1');
    });
});

app.post('/inscription', async (req, res) => {
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
            age: parseInt(req.body.age, 10)
        };
        
        const { data: newUser, error } = await supabase.from('utilisateurs').insert(userData).select().single();
        if (error) throw error;

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
    const fileBuffer = fs.readFileSync(file.path);
    const fileName = `${Date.now()}-${file.originalname}`;
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileBuffer, { contentType: file.mimetype });
    
    if (error) {
        console.error(`[STORAGE ERR] Echec pour ${file.originalname}:`, error.message);
        throw error;
    }
    console.log(`[STORAGE OK] Fichier envoyé: ${fileName}`);
    // On récupère l'URL publique pour l'afficher plus tard sur le site
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
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
    const { data: user } = await supabase.from('utilisateurs').select('nom, prenom').eq('id', p.user_id).maybeSingle();
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
        commentaires: p.commentaires || []
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
    const mailOptions = {
        from: '"PetitsDjobs Support" <' + process.env.EMAIL_USER + '>',
        to: emailClean,
        subject: 'Votre code de récupération PetitsDjobs',
        text: `Votre code de récupération est : ${code}. Il expire dans 15 minutes.`
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Erreur mail récupération:", err));

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
    const mailOptions = {
        from: '"ALERTE SÉCURITÉ PetitsDjobs" <' + process.env.EMAIL_USER + '>',
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER, // Ton email perso
        subject: `🚨 SOS URGENCE : ${user.prenom} ${user.nom}`,
        text: alerteTexte
    };

    transporter.sendMail(mailOptions).catch(err => console.error("Erreur mail SOS:", err));

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

app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
app.use(express.static(publicDir, { index: false }));

app.listen(port, () => console.log('Cerveau opérationnel sur http://localhost:' + port));