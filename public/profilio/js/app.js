async function chargerMetiersProfilio() {
  const response = await fetch('/api/profilio/metiers');
  return response.json();
}

async function chargerProfilsProfilio(search = '', metier = '') {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (metier) params.append('metier', metier);
  const response = await fetch(`/api/profilio/profils?${params}`);
  return response.json();
}

async function chargerPublicitesProfilio() {
  const response = await fetch('/api/profilio/publicites');
  return response.json();
}

function renderProfilioAds(items) {
  const container = document.getElementById('profilio-ads');
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Contenu prochainement disponible.</p>';
    return;
  }
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
  if (!metiers || metiers.length === 0) {
    container.innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Contenu prochainement disponible.</p>';
    return;
  }
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
    button.addEventListener('click', async () => {
      document.getElementById('profilio-search').value = button.dataset.job;
      const profils = await chargerProfilsProfilio(button.dataset.job);
      renderProfils(profils);
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
    .sort((a, b) => (a.distance || 9999) - (b.distance || 9999));

  const container = document.getElementById('profilio-nearby');
  if (!filtered || filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Contenu prochainement disponible.</p>`;
    return;
  }
  container.innerHTML = filtered.map(item => `
    <article class="profile-mini-card">
      <div>
        <strong>${item.service}</strong>
        <p>${item.name} · ${item.city}</p>
        <small>${item.availability}</small>
      </div>
      <span>${item.distance !== null ? item.distance + ' m' : 'Distance inconnue'}</span>
    </article>
  `).join('');
}

async function initProfilio() {
  try {
    const [metiers, profils, pubs] = await Promise.all([
      chargerMetiersProfilio(),
      chargerProfilsProfilio(),
      chargerPublicitesProfilio()
    ]);
    
    renderProfilioAds(pubs);
    renderMetiers(metiers);
    renderProfils(profils);

    document.getElementById('profilio-search').addEventListener('input', async () => {
      const profils = await chargerProfilsProfilio(document.getElementById('profilio-search').value);
      renderProfils(profils);
    });
    
    document.getElementById('profilio-search-btn').addEventListener('click', async () => {
      const profils = await chargerProfilsProfilio(document.getElementById('profilio-search').value);
      renderProfils(profils);
    });
    
    document.getElementById('profilio-filter').addEventListener('change', async () => {
      const profils = await chargerProfilsProfilio(document.getElementById('profilio-search').value);
      renderProfils(profils);
    });
  } catch (error) {
    console.error('Erreur initialisation Profilio:', error);
    document.getElementById('profilio-jobs').innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Contenu prochainement disponible.</p>';
    document.getElementById('profilio-nearby').innerHTML = '<p style="padding:20px; text-align:center; color:#666;">Contenu prochainement disponible.</p>';
  }
}

initProfilio();
