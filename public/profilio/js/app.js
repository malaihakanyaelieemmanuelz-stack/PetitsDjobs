const profilioAds = [
  { title: 'Ingénierie terrain', type: 'Vidéo', subtitle: 'Professionnels en situation réelle' },
  { title: 'Bureau & assistance', type: 'Photo', subtitle: 'Services administratifs actifs' },
  { title: 'Métiers techniques', type: 'Vidéo', subtitle: 'Talents opérationnels à proximité' }
];

const profilioProfils = [
  { name: 'Clarisse M.', service: 'Ingénieur projet', distance: 180, city: 'Centre', availability: 'Disponible aujourd’hui' },
  { name: 'Jean P.', service: 'Secrétaire bilingue', distance: 430, city: 'Nord', availability: 'Disponible ce soir' },
  { name: 'Doris K.', service: 'Plombier certifié', distance: 920, city: 'Sud', availability: 'Intervention rapide' },
  { name: 'Alain T.', service: 'Développeur web', distance: 1600, city: 'Est', availability: 'Mission freelance' }
];

async function chargerMetiersProfilio() {
  const response = await fetch('/profilio/data/metiers.json');
  return response.json();
}

function renderProfilioAds(items) {
  const container = document.getElementById('profilio-ads');
  container.innerHTML = items.map(item => `
    <article class="profilio-banner-card">
      <div class="profilio-banner-media">${item.type}</div>
      <div class="profilio-banner-body">
        <h3>${item.title}</h3>
        <p>${item.subtitle}</p>
      </div>
    </article>
  `).join('');
}

function renderMetiers(metiers) {
  const container = document.getElementById('profilio-jobs');
  container.innerHTML = metiers.map(job => `
    <article class="card job-card">
      <div class="module-thumb">${job}</div>
      <div class="card-info">
        <h3>${job}</h3>
        <p>Recherche ciblée dans votre réseau local.</p>
        <button type="button" data-job="${job}">Voir les profils</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('button[data-job]').forEach(button => {
    button.addEventListener('click', () => {
      document.getElementById('profilio-search').value = button.dataset.job;
      renderProfils(profilioProfils);
    });
  });
}

function renderProfils(items) {
  const query = document.getElementById('profilio-search').value.trim().toLowerCase();
  const mode = document.getElementById('profilio-filter').value;
  const filtered = items
    .filter(item => {
      if (!query) return true;
      const base = mode === 'profil'
        ? `${item.name} ${item.city}`.toLowerCase()
        : `${item.service} ${item.name} ${item.city}`.toLowerCase();
      return base.includes(query);
    })
    .sort((a, b) => a.distance - b.distance);

  const container = document.getElementById('profilio-nearby');
  container.innerHTML = filtered.length
    ? filtered.map(item => `
        <article class="profile-mini-card">
          <div>
            <strong>${item.service}</strong>
            <p>${item.name} · ${item.city}</p>
            <small>${item.availability}</small>
          </div>
          <span>${item.distance} m</span>
        </article>
      `).join('')
    : `<p class="empty-state">Aucun profil ne correspond à cette recherche.</p>`;
}

async function initProfilio() {
  const metiers = await chargerMetiersProfilio();
  renderProfilioAds(profilioAds);
  renderMetiers(metiers);
  renderProfils(profilioProfils);

  document.getElementById('profilio-search').addEventListener('input', () => renderProfils(profilioProfils));
  document.getElementById('profilio-search-btn').addEventListener('click', () => renderProfils(profilioProfils));
  document.getElementById('profilio-filter').addEventListener('change', () => renderProfils(profilioProfils));
}

initProfilio().catch(error => {
  console.error('Erreur initialisation Profilio', error);
});
