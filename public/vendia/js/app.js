const vendiaVideos = [
  { title: 'Épicerie en action', type: 'Vidéo', subtitle: 'Promotions locales du jour' },
  { title: 'Préparation de commandes', type: 'Photo', subtitle: 'Vendeurs en activité' },
  { title: 'Livraison express', type: 'Vidéo', subtitle: 'Produits prêts à partir' }
];

const vendiaProduits = [
  { name: 'Panier fruits frais', category: 'Alimentation', price: '4 500 FCFA', vendor: 'Marché Kivu' },
  { name: 'Pack boissons fraîches', category: 'Boissons', price: '3 200 FCFA', vendor: 'Green Shop' },
  { name: 'Kit entretien maison', category: 'Maison', price: '6 000 FCFA', vendor: 'Maison Plus' },
  { name: 'Lampe rechargeable', category: 'Électronique', price: '8 500 FCFA', vendor: 'Tech Corner' }
];

const vendiaVendeurs = [
  { name: 'Amina Market', distance: 320, city: 'Centre-ville', speciality: 'Produits frais' },
  { name: 'Chez Bako', distance: 780, city: 'Quartier Nord', speciality: 'Boissons et snacks' },
  { name: 'Maison Express', distance: 1450, city: 'Avenue Verte', speciality: 'Maison et entretien' },
  { name: 'Tech Mini Shop', distance: 2100, city: 'Boulevard Orange', speciality: 'Accessoires utiles' }
];

async function chargerCategoriesVendia() {
  const response = await fetch('/vendia/data/categories.json');
  return response.json();
}

function renderVendiaCarousel(items) {
  const container = document.getElementById('vendia-carousel');
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

function renderVendiaProduits(produits) {
  const query = document.getElementById('vendia-search').value.trim().toLowerCase();
  const categorie = document.getElementById('vendia-category').value;
  const venteParticuliere = document.getElementById('particular-sale-input').value.trim().toLowerCase();

  const filtered = produits.filter(product => {
    const matchQuery = !query || `${product.name} ${product.vendor}`.toLowerCase().includes(query);
    const matchCategory = !categorie || categorie === 'Autre' || product.category === categorie;
    const matchParticuliere = !venteParticuliere || `${product.name} ${product.category}`.toLowerCase().includes(venteParticuliere);
    return matchQuery && matchCategory && matchParticuliere;
  });

  const container = document.getElementById('vendia-products');
  container.innerHTML = filtered.length
    ? filtered.map(product => `
        <article class="card market-product-card">
          <div class="module-thumb">${product.category}</div>
          <div class="card-info">
            <h3>${product.name}</h3>
            <p>${product.vendor}</p>
            <p class="price" style="color:#FF8200; font-weight:900;">${product.price}</p>
            <button type="button">Voir le produit</button>
          </div>
        </article>
      `).join('')
    : `<p class="empty-state">Aucun produit pour cette recherche.</p>`;
}

function renderVendiaVendeurs(items) {
  const container = document.getElementById('vendia-nearby');
  const sorted = [...items].sort((a, b) => a.distance - b.distance);
  container.innerHTML = sorted.map(vendor => `
    <article class="market-list-card">
      <div>
        <strong>${vendor.name}</strong>
        <p>${vendor.speciality} · ${vendor.city}</p>
      </div>
      <span>${vendor.distance} m</span>
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
  const categories = await chargerCategoriesVendia();
  const select = document.getElementById('vendia-category');

  select.innerHTML = `<option value="">Toutes les catégories</option>` + categories.map(category => `
    <option value="${category}">${category}</option>
  `).join('');

  renderVendiaCarousel(vendiaVideos);
  renderVendiaProduits(vendiaProduits);
  renderVendiaVendeurs(vendiaVendeurs);
  mettreAJourModeVendeur();
  gererVenteParticuliere();

  document.getElementById('vendia-search').addEventListener('input', () => renderVendiaProduits(vendiaProduits));
  document.getElementById('vendia-search-btn').addEventListener('click', () => renderVendiaProduits(vendiaProduits));
  document.getElementById('particular-sale-input').addEventListener('input', () => renderVendiaProduits(vendiaProduits));
  select.addEventListener('change', () => {
    gererVenteParticuliere();
    renderVendiaProduits(vendiaProduits);
  });
  document.getElementById('become-seller').addEventListener('change', mettreAJourModeVendeur);
}

initVendia().catch(error => {
  console.error('Erreur initialisation Vendia', error);
});
