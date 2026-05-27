const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const geolib = require('geolib');

const app = express();
const upload = multer({ dest: 'public/uploads/' });
const port = 5500;

const PRIX_PAR_KM = 200;
const BATCH_PRESTATAIRES = 20;
const RAYON_MAX_METRES = 50000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: 'petit-secret-job-2026',
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }
}));

let utilisateurs = [];
let prestataires = [];
let offresDiscuter = [];
let idPrestataireSeq = 1;

function serviceMatch(prestataire, serviceDemande) {
    if (!serviceDemande) return true;
    const svc = serviceDemande.trim();
    const liste = (prestataire.services || '').split(',').map(s => s.trim());
    const dispo = prestataire.disponibilites || {};
    if (liste.includes('Tout')) return !!dispo.Tout;
    if (!liste.some(s => s.toLowerCase() === svc.toLowerCase())) return false;
    return !!dispo[svc] || liste.filter(s => s.toLowerCase() === svc.toLowerCase()).some(s => dispo[s]);
}

function distanceMetres(p, lat, lon) {
    if (p.lat == null || p.lon == null) return Infinity;
    return geolib.getDistance(
        { latitude: parseFloat(lat), longitude: parseFloat(lon) },
        { latitude: parseFloat(p.lat), longitude: parseFloat(p.lon) }
    );
}

function prestatairesEligibles(service) {
    return prestataires.filter(p => p.isPrestataire && serviceMatch(p, service));
}

function chercherParRayonCroissant(lat, lon, service, offset, limit) {
    const eligibles = prestatairesEligibles(service)
        .map(p => ({ ...p, distanceM: distanceMetres(p, lat, lon) }))
        .filter(p => p.distanceM !== Infinity)
        .sort((a, b) => a.distanceM - b.distanceM);

    if (eligibles.length === 0) {
        return { prestataires: [], rayonMetres: 0, hasMore: false, total: 0 };
    }

    let rayon = 1;
    let dansRayon = [];
    while (rayon <= RAYON_MAX_METRES && dansRayon.length < offset + limit) {
        dansRayon = eligibles.filter(p => p.distanceM <= rayon);
        if (dansRayon.length >= offset + limit) break;
        if (dansRayon.length === eligibles.length) break;
        rayon += 1;
    }

    const page = dansRayon.slice(offset, offset + limit);
    const hasMore = dansRayon.length > offset + limit || eligibles.some(p => p.distanceM > rayon);

    return {
        prestataires: page.map(p => ({
            id: p.id,
            nom: p.nom,
            prenom: p.prenom || '',
            profession: p.profession,
            bio: p.bio || '',
            photo: p.photo,
            ville: p.ville,
            services: p.services,
            etoiles: p.etoiles || 0,
            nbAvis: (p.commentaires || []).length,
            distanceM: Math.round(p.distanceM),
            distanceKm: (p.distanceM / 1000).toFixed(2),
            disponible: true
        })),
        rayonMetres: rayon,
        hasMore,
        total: eligibles.length
    };
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

// ——— Pages publiques (routes + fichiers .html pour les liens de la page d'accueil) ———
function pageConnexion(req, res) {
    res.sendFile(path.join(publicDir, 'connexion.html'));
}
function pageInscription(req, res) {
    res.sendFile(path.join(publicDir, 'inscription.html'));
}
function pageAccueil(req, res) {
    res.sendFile(path.join(publicDir, 'index.html'));
}

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

// ——— API session / commande ———
app.get('/get-user-data', (req, res) => res.json(req.session.user || {}));
app.get('/get-session-commande', (req, res) => res.json(req.session.commande || {}));
app.get('/get-all-prestataires', (req, res) => res.json(prestataires));

app.get('/prestataires-autour', requireAuth, (req, res) => {
    const lat = parseFloat(req.query.lat) || req.session.latClient;
    const lon = parseFloat(req.query.lon) || req.session.lonClient;
    const service = req.query.service || '';
    if (lat == null || lon == null) {
        return res.json({ prestataires: [], message: 'Activez le GPS pour voir qui est près de vous.' });
    }
    const result = chercherParRayonCroissant(lat, lon, service || null, 0, 6);
    res.json({ prestataires: result.prestataires, total: result.total });
});

app.get('/get-top-prestataires', (req, res) => {
    const top = [...prestataires]
        .filter(p => p.isPrestataire)
        .sort((a, b) => (b.etoiles || 0) - (a.etoiles || 0))
        .slice(0, 10)
        .map(p => ({
            id: p.id,
            nom: p.nom,
            prenom: p.prenom,
            photo: p.photo,
            profession: p.profession,
            bio: p.bio,
            etoiles: p.etoiles || 0,
            ville: p.ville
        }));
    res.json(top);
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

app.post('/chercher-prestataires', (req, res) => {
    const { lat, lon, service, offset } = req.body;
    const latC = lat ?? req.session.latClient;
    const lonC = lon ?? req.session.lonClient;
    const svc = service || req.session.commande?.service;

    if (latC == null || lonC == null) {
        return res.status(400).json({ error: 'Position GPS requise' });
    }

    req.session.latClient = parseFloat(latC);
    req.session.lonClient = parseFloat(lonC);

    const result = chercherParRayonCroissant(
        latC, lonC, svc,
        parseInt(offset, 10) || 0,
        BATCH_PRESTATAIRES
    );
    res.json(result);
});

app.post('/selectionner-prestataire', (req, res) => {
    const { prestataireId } = req.body;
    const p = prestataires.find(x => x.id === parseInt(prestataireId, 10));
    if (!p || req.session.latClient == null) {
        return res.status(400).json({ error: 'Prestataire ou position introuvable' });
    }
    const distM = distanceMetres(p, req.session.latClient, req.session.lonClient);
    const frais = prixDistanceFcfa(distM);
    req.session.commande = req.session.commande || {};
    req.session.commande.prestataireId = p.id;
    req.session.commande.prestataireNom = p.nom;
    req.session.commande.prestatairePrenom = p.prenom || '';
    req.session.commande.prestatairePhoto = p.photo || '';
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

app.post('/calculer-distance', (req, res) => {
    const { latClient, lonClient, prestataireId } = req.body;
    const p = prestataires.find(x => x.id === parseInt(prestataireId, 10));
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

app.post('/calculer-commande', (req, res) => {
    const cmd = req.session.commande || {};
    const prixBase = parseInt(req.body.prixBase, 10) || cmd.prixBase || 0;
    const frais = cmd.fraisDeplacement ?? 0;
    res.json({ prixBase, fraisDeplacement: frais, total: prixBase + frais });
});

// ——— Connexion / inscription ———
app.post('/connexion', (req, res) => {
    const locOk = req.body.locAccepted === '1' || req.body.locAccepted === 'on';
    const polOk = req.body.polAccepted === '1' || req.body.polAccepted === 'on';

    if (!locOk || !polOk) {
        return res.redirect('/connexion.html?erreur=consentement');
    }

    if (req.session.remember && req.session.user && !req.body.email) {
        // Rester connecté : pas de ressaisie email/mot de passe
    } else {
        const compte = utilisateurs.find(u => u.email === req.body.email);
        if (!compte) return res.redirect('/connexion.html?erreur=compte');
        if (compte.password !== req.body.password) {
            return res.redirect('/connexion.html?erreur=mdp');
        }
        req.session.user = { ...compte };
        delete req.session.user.password;
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

app.post('/inscription', (req, res) => {
    if (estConnecte(req)) return res.redirect('/index.html');

    const locOk = req.body.locAccepted === '1' || req.body.locAccepted === 'on';
    const polOk = req.body.polAccepted === '1' || req.body.polAccepted === 'on';
    if (!locOk || !polOk) return res.redirect('/inscription?erreur=consentement');
    if (req.body.password !== req.body.password_confirm) {
        return res.redirect('/inscription?erreur=mdp');
    }
    if (utilisateurs.some(u => u.email === req.body.email)) {
        return res.redirect('/inscription?erreur=deja_inscrit');
    }

    const user = {
        email: req.body.email,
        password: req.body.password,
        nom: req.body.nom,
        prenom: req.body.prenom,
        date_naissance: req.body.date_naissance
    };
    utilisateurs.push(user);
    req.session.user = { ...user };
    delete req.session.user.password;
    req.session.remember = !!req.body.remember;
    req.session.localisationAutorisee = locOk;
    res.redirect('/index.html?connecte=1');
});

// ——— Prestataire ———
app.post('/devenir-prestataire', upload.fields([
    { name: 'photo_profil' }, { name: 'piece_recto' }, { name: 'piece_verso' }
]), (req, res) => {
    if (!req.session.user) return res.redirect('/connexion');

    const servicesList = Array.isArray(req.body.services) ? req.body.services : (req.body.services ? [req.body.services] : []);
    const disponibilites = {};
    servicesList.forEach(s => {
        const key = 'dispo_' + s;
        disponibilites[s] = req.body[key] === '1' || req.body[key] === 'on';
    });

    const entry = {
        id: idPrestataireSeq++,
        email: req.session.user.email,
        nom: req.body.nom,
        prenom: req.body.prenom,
        bio: (req.body.bio || '').trim().slice(0, 200),
        age: req.body.age,
        ville: req.body.ville,
        profession: req.body.profession,
        services: servicesList.join(', '),
        disponibilites,
        lat: parseFloat(req.body.lat),
        lon: parseFloat(req.body.lon),
        etoiles: 0,
        commentaires: [],
        isPrestataire: true
    };

    if (req.files?.photo_profil?.[0]) {
        entry.photo = '/uploads/' + req.files.photo_profil[0].filename;
    }
    if (req.files?.piece_recto?.[0]) {
        entry.pieceRecto = '/uploads/' + req.files.piece_recto[0].filename;
    }
    if (req.files?.piece_verso?.[0]) {
        entry.pieceVerso = '/uploads/' + req.files.piece_verso[0].filename;
    }

    Object.assign(req.session.user, entry);
    const idx = prestataires.findIndex(p => p.email === entry.email);
    if (idx >= 0) prestataires[idx] = { ...prestataires[idx], ...entry };
    else prestataires.push(entry);

    res.redirect('/prestataire-info?inscription=ok');
});

app.get('/prestataire-public/:id', (req, res) => {
    const p = prestataires.find(x => x.id === parseInt(req.params.id, 10));
    if (!p) return res.status(404).json({});
    res.json({
        id: p.id,
        nom: p.nom,
        prenom: p.prenom,
        photo: p.photo,
        ville: p.ville,
        profession: p.profession,
        bio: p.bio,
        services: p.services,
        etoiles: p.etoiles || 0,
        commentaires: p.commentaires || []
    });
});

// ——— Discuter (négociation prix) ———
app.post('/proposer-prix-discuter', (req, res) => {
    const { prix, lat, lon } = req.body;
    const prixNum = parseInt(prix, 10);
    if (!prixNum || lat == null || lon == null) {
        return res.status(400).json({ error: 'Prix et GPS requis' });
    }

    req.session.latClient = parseFloat(lat);
    req.session.lonClient = parseFloat(lon);
    req.session.commande = { service: 'Service particulier', prixBase: prixNum, prixLibre: true };

    const { prestataires: proches } = chercherParRayonCroissant(lat, lon, 'Particulier', 0, BATCH_PRESTATAIRES);
    const ids = proches.map(p => p.id);
    const offre = {
        id: Date.now(),
        emailClient: req.session.user?.email,
        prix: prixNum,
        prestatairesIds: ids,
        acceptations: [],
        statut: 'en_attente'
    };
    offresDiscuter.push(offre);

    res.json({ offreId: offre.id, envoyes: ids.length, message: ids.length ? 'Offre envoyée aux prestataires proches' : 'Aucun prestataire proche. Augmentez le rayon ou le prix.' });
});

app.get('/statut-offre/:id', (req, res) => {
    const offre = offresDiscuter.find(o => o.id === parseInt(req.params.id, 10));
    if (!offre) return res.status(404).json({ error: 'Offre introuvable' });
    if (offre.acceptations.length > 0) {
        req.session.commande = { service: 'Service particulier', prixBase: offre.prix, prixLibre: true };
        return res.json({ statut: 'accepte', prix: offre.prix });
    }
    res.json({ statut: 'en_attente', suggestion: 'Augmentez votre offre pour être accepté plus vite.' });
});

app.use('/uploads', express.static(path.join(publicDir, 'uploads')));
app.use(express.static(publicDir, { index: false }));

app.listen(port, () => console.log('Cerveau opérationnel sur http://localhost:' + port));
