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

const app = express();
// Mise à jour structure table : synchronisation avec infos_prestataires

// AJOUT : Indispensable pour que Render accepte les cookies de session
app.set('trust proxy', 1);

const upload = multer({ dest: 'public/uploads/' });
const port = process.env.PORT || 5500; // Utilise le port de Render si disponible

// --- Initialisation de Supabase ---
const supabase = createClient(
  process.env.SUPABASE_URL, 
  process.env.SUPABASE_KEY
);

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
const BUCKET_NAME = 'prestataires-photos';
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

async function chercherParRayonCroissant(lat, lon, service, offset, limit) {
    try {
        const { data: prestataires } = await supabase.from('infos_prestataires').select('*');
        if (!prestataires) return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };

        const userIds = prestataires.map(p => p.user_id);
        const { data: users } = await supabase.from('utilisateurs').select('id, nom, prenom, dernier_acces').in('id', userIds);
        const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

        const SEUIL_EN_LIGNE_MS = 10 * 60 * 1000; // 10 minutes pour être considéré en ligne

        const eligibles = prestataires
            .filter(p => serviceMatch(p, service))
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
                // 1. D'abord ceux en ligne
                if (a.enLigne !== b.enLigne) return b.enLigne ? 1 : -1;
                
                // 2. Ensuite par étoiles (décroissant)
                const etoilesA = a.etoiles || 0;
                const etoilesB = b.etoiles || 0;
                if (etoilesA !== etoilesB) return etoilesB - etoilesA;

                // 3. Enfin par date d'inscription (plus ancien en premier)
                if (a.created_at && b.created_at) {
                    return new Date(a.created_at) - new Date(b.created_at);
                }

                return a.distanceM - b.distanceM;
            });

        const limitFixe = 20; // On veut toujours un pool de 20
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

app.post('/deconnexion', (req, res) => {
    req.session.destroy(() => res.redirect('/index.html'));
});

// --- API ---
app.get('/get-user-data', (req, res) => res.json(req.session.user || {}));
app.get('/get-session-commande', (req, res) => res.json(req.session.commande || {}));

app.get('/get-all-prestataires', async (req, res) => {
    const { data: prestataires } = await supabase.from('infos_prestataires').select('*');
    if (!prestataires) return res.json([]);
    const userIds = prestataires.map(p => p.user_id);
    const { data: users } = await supabase.from('utilisateurs').select('id, nom, prenom').in('id', userIds);
    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
    res.json(prestataires.map(p => ({
        ...p,
        nom: userMap[p.user_id]?.nom || 'Prestataire',
        prenom: userMap[p.user_id]?.prenom || ''
    })));
});

app.get('/prestataires-autour', requireAuth, async (req, res) => {
    const lat = parseFloat(req.query.lat) || req.session.latClient;
    const lon = parseFloat(req.query.lon) || req.session.lonClient;
    const service = req.query.service || '';
    if (lat == null || lon == null) {
        return res.json({ prestataires: [], message: 'Activez le GPS pour voir qui est près de vous.' });
    }
    const result = await chercherParRayonCroissant(lat, lon, service || null, 0, 6);
    res.json({ prestataires: result.prestataires, total: result.total });
});

app.get('/get-top-prestataires', async (req, res) => {
    try {
        const lat = req.session.latClient;
        const lon = req.session.lonClient;
        // Utilise toujours chercherParRayonCroissant pour un tri et un statut en ligne cohérents.
        // Si lat/lon sont nuls, la distance sera Infinity, les poussant à la fin du tri par distance.
        const result = await chercherParRayonCroissant(lat, lon, null, 0, 10); // Limite à 10 pour la section des meilleurs prestataires
        res.json(result.prestataires);
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

app.post('/sauvegarder-position', (req, res) => {
    const { lat, lon } = req.body;
    if (lat != null && lon != null) {
        req.session.latClient = parseFloat(lat);
        req.session.lonClient = parseFloat(lon);
        if (req.session.user) req.session.user.lat = parseFloat(lat);
        if (req.session.user) req.session.user.lon = parseFloat(lon);
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
        BATCH_PRESTATAIRES
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

    res.json({
        prestataireNom: p.nom,
        distanceKm: req.session.commande.distanceKm,
        fraisDeplacement: frais,
        prixBase: req.session.commande.prixBase,
        total: req.session.commande.total
    });
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
            // On cherche l'utilisateur seul d'abord pour plus de fiabilité
            const { data: compte, error: userError } = await supabase
                .from('utilisateurs')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (userError || !compte) return res.redirect('/connexion.html?erreur=compte');

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

    if (req.body.lat && req.body.lon) {
        req.session.latClient = parseFloat(req.body.lat);
        req.session.lonClient = parseFloat(req.body.lon);
        req.session.user.lat = req.session.latClient;
        req.session.user.lon = req.session.lonClient;
    }

    res.redirect('/index.html?connecte=1');
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
    const { data: existant } = await supabase.from('utilisateurs').select('id').eq('email', email).single();
    if (existant) {
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
        res.redirect('/index.html?connecte=1');
    } catch (err) {
        console.error("Erreur d'inscription :", err);
        res.redirect('/inscription?erreur=serveur');
    }
});

// Helper pour envoyer un fichier vers Supabase Storage
async function uploadToSupabase(file, bucketName) {
    const fileBuffer = fs.readFileSync(file.path);
    const fileName = `${Date.now()}-${file.originalname}`;
    const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileBuffer, { contentType: file.mimetype });
    
    if (error) throw error;
    // On récupère l'URL publique pour l'afficher plus tard sur le site
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    return publicData.publicUrl;
}

app.post('/devenir-prestataire', upload.fields([
    { name: 'photo_profil' }, { name: 'piece_recto' }, { name: 'piece_verso' }
]), async (req, res) => {
    // Correction : On vérifie l'ID de l'utilisateur en session plus précisément
    const userId = req.session.user?.id || req.session.user?.email; 
    if (!userId) {
        return res.redirect('/connexion');
    }

    // Gestion des services multiples venant du formulaire
    const listeServices = Array.isArray(req.body.services) ? req.body.services : (req.body.services ? [req.body.services] : []);
    const servicesEnTexte = listeServices.join(', '); 

    const profileData = {
        user_id: req.session.user.id,
        profession: (req.body.profession || '').trim(),
        bio: (req.body.bio || '').trim(),
        ville: (req.body.ville || '').trim(),
        services: servicesEnTexte,
        telephone: (req.body.telephone || '').trim(),
        autorise_numero_deconnexion: req.body.autorise_numero === 'on',
        lat: parseFloat(req.body.lat) || null,
        lon: parseFloat(req.body.lon) || null
    };

    try {
        if (req.files?.photo_profil?.[0]) {
            profileData.photo_profil_url = await uploadToSupabase(req.files.photo_profil[0], BUCKET_NAME);
        }
        if (req.files?.piece_recto?.[0]) {
            profileData.photo_ci_recto_url = await uploadToSupabase(req.files.piece_recto[0], BUCKET_NAME);
        }
        if (req.files?.piece_verso?.[0]) {
            profileData.photo_ci_verso_url = await uploadToSupabase(req.files.piece_verso[0], BUCKET_NAME);
        }
    } catch (uploadErr) {
        console.error("Erreur lors de l'upload Storage:", uploadErr);
        return res.redirect('/prestataire?erreur=serveur');
    }

    const { error } = await supabase.from('infos_prestataires').upsert(profileData, { onConflict: 'user_id' });
    if (error) {
        console.error(error);
        return res.redirect('/prestataire?erreur=serveur');
    }

    req.session.user.isPrestataire = true;
    // Mise à jour locale pour la session
    req.session.user.photo = profileData.photo_profil_url;
    req.session.user.profession = profileData.profession;
    req.session.user.bio = profileData.bio;
    req.session.user.ville = profileData.ville;
    req.session.user.services = profileData.services;

    res.redirect('/prestataire-info?inscription=ok');
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

app.post('/accepter-job/:id', requireAuth, async (req, res) => {
    const offreId = parseInt(req.params.id, 10);
    const offre = offresDiscuter.find(o => o.id === offreId);
    if (!offre) return res.status(404).json({ error: 'Offre introuvable' });
    if (!req.session.user.isPrestataire) return res.status(403).json({ error: 'Seuls les prestataires peuvent accepter.' });

    const prestataireId = req.session.user.id;
    if (!offre.acceptations.includes(prestataireId)) {
        offre.acceptations.push(prestataireId);
    }
    res.json({ ok: true, message: 'Offre acceptée ! Attendez le choix du client.' });
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

app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
app.use(express.static(publicDir, { index: false }));

app.listen(port, () => console.log('Cerveau opérationnel sur http://localhost:' + port));