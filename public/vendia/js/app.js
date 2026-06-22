async function chargerCategoriesVendia() {
  const response = await fetch('/api/vendia/categories');
  return response.json();
}

async function chargerProduitsVendia(search = '', category = '') {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (category) params.append('category', category);
  const response = await fetch(`/api/vendia/produits?${params}`);
  return response.json();
}

async function chargerBoutiquesVendia(search = '') {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  const response = await fetch(`/api/vendia/boutiques?${params}`);
  return response.json();
}

async function chargerPublicitesVendia() {
  const response = await fetch('/api/vendia/publicites');
  return response.json();
}

function renderVendiaCarousel(items) {
  const container = document.getElementById('vendia-carousel');
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="padding:20px; text-align:center; color:rgba(255,255,255,0.7);">Contenu prochainement disponible.</p>';
    return;
  }
  container.innerHTML = items.map(item => `
    <article class="market-banner-card">
      <div class="market-banner-media">${item.type}</div>
      <div class="market-banner-body">
        <h3>${item.title}</h3>
        <p>${item.subtitle}</p>
      </div>
    </article>
  `).join('');
}

async function renderVendiaProduits() {
  const query = document.getElementById('vendia-search').value.trim().toLowerCase();
  const categorie = document.getElementById('vendia-category').value;
  const venteParticuliere = document.getElementById('particular-sale-input').value.trim().toLowerCase();

  const produits = await chargerProduitsVendia(query, categorie);

  const filtered = produits.filter(product => {
    const matchQuery = !query || `${product.name} ${product.vendor}`.toLowerCase().includes(query);
    const matchCategory = !categorie || categorie === 'Autre' || product.category === categorie;
    const matchParticuliere = !venteParticuliere || `${product.name} ${product.category}`.toLowerCase().includes(venteParticuliere);
    return matchQuery && matchCategory && matchParticuliere;
  });

  const container = document.getElementById('vendia-products');
  if (!filtered || filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">Contenu prochainement disponible.</p>`;
    return;
  }
  container.innerHTML = filtered.map(product => `
    <article class="card market-product-card">
      <div class="module-thumb">${product.category}</div>
      <div class="card-info">
        <h3>${product.name}</h3>
        <p>${product.vendor}</p>
        <p class="price" style="color:#FF8200; font-weight:900;">${product.price}</p>
        <button type="button">Voir le produit</button>
      </div>
    </article>
  `).join('');
}

async function renderVendiaVendeurs() {
  const query = document.getElementById('vendia-search').value.trim().toLowerCase();
  const vendeurs = await chargerBoutiquesVendia(query);
  
  const sorted = vendeurs.sort((a, b) => (a.distance || 9999) - (b.distance || 9999));
  
  const container = document.getElementById('vendia-nearby');
  if (!sorted || sorted.length === 0) {
    container.innerHTML = '<p style="padding:20px; text-align:center; color:rgba(255,255,255,0.7);">Contenu prochainement disponible.</p>';
    return;
  }
  container.innerHTML = sorted.map(vendor => `
    <article class="market-list-card">
      <div>
        <strong>${vendor.name}</strong>
        <p>${vendor.speciality} · ${vendor.city}</p>
      </div>
      <span>${vendor.distance !== null ? vendor.distance + ' m' : 'Distance inconnue'}</span>
    </article>
  `).join('');
}

function mettreAJourModeVendeur() {
  const badge = document.getElementById('vendia-role-badge');
  const toggle = document.getElementById('become-seller');
  badge.textContent = toggle.checked ? 'Mode vendeur activé' : 'Inscription client par défaut';
}

function gererVenteParticuliere() {
  const categorie = document.getElementById('vendia-category').value;
  const bloc = document.getElementById('particular-sale-input');
  bloc.style.display = categorie === 'Autre' ? 'block' : 'none';
  if (categorie !== 'Autre') bloc.value = '';
}

async function initVendia() {
  try {
    const categories = await chargerCategoriesVendia();
    const select = document.getElementById('vendia-category');

    if (!categories || categories.length === 0) {
      select.innerHTML = '<option value="">Contenu prochainement disponible</option>';
    } else {
      select.innerHTML = `<option value="">Toutes les catégories</option>` + categories.map(category => `
        <option value="${category}">${category}</option>
      `).join('');
    }

    const [pubs, produits, vendeurs] = await Promise.all([
      chargerPublicitesVendia(),
      chargerProduitsVendia(),
      chargerBoutiquesVendia()
    ]);

    renderVendiaCarousel(pubs);
    
    const containerProduits = document.getElementById('vendia-products');
    if (!produits || produits.length === 0) {
      containerProduits.innerHTML = '<p style="padding:20px; text-align:center; color:rgba(255,255,255,0.7);">Contenu prochainement disponible.</p>';
    } else {
      await renderVendiaProduits();
    }
    
    renderVendiaVendeurs(vendeurs);
    mettreAJourModeVendeur();
    gererVenteParticuliere();

    document.getElementById('vendia-search').addEventListener('input', renderVendiaProduits);
    document.getElementById('vendia-search-btn').addEventListener('click', renderVendiaProduits);
    document.getElementById('particular-sale-input').addEventListener('input', renderVendiaProduits);
    select.addEventListener('change', () => {
      gererVenteParticuliere();
      renderVendiaProduits();
    });
    document.getElementById('become-seller').addEventListener('change', mettreAJourModeVendeur);
  } catch (error) {
    console.error('Erreur initialisation Vendia:', error);
    document.getElementById('vendia-products').innerHTML = '<p style="padding:20px; text-align:center; color:rgba(255,255,255,0.7);">Contenu prochainement disponible.</p>';
    document.getElementById('vendia-nearby').innerHTML = '<p style="padding:20px; text-align:center; color:rgba(255,255,255,0.7);">Contenu prochainement disponible.</p>';
  }
}

initVendia();
