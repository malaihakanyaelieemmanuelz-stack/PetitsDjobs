// VORTEX - JavaScript Principal - Connexion Base de Données

// Service de données (à connecter avec Supabase)
class DataService {
    constructor() {
        // Remplacer avec vos clés Supabase réelles
        this.supabaseUrl = 'VOTRE_SUPABASE_URL';
        this.supabaseKey = 'VOTRE_SUPABASE_ANON_KEY';
    }

    // Récupérer les derniers PetitsdJobs
    async getPetitsdJobs() {
        try {
            // À implémenter avec Supabase:
            // const { data, error } = await supabase
            //     .from('petitsdjobs_services')
            //     .select('*')
            //     .order('created_at', { ascending: false })
            //     .limit(10);
            
            // Pour l'instant, retourne empty array
            return [];
        } catch (error) {
            console.error('Erreur PetitsdJobs:', error);
            return [];
        }
    }

    // Récupérer les derniers produits Vendia
    async getVendiaProducts() {
        try {
            // À implémenter avec Supabase:
            // const { data, error } = await supabase
            //     .from('vendia_articles')
            //     .select('*')
            //     .order('created_at', { ascending: false })
            //     .limit(10);
            
            return [];
        } catch (error) {
            console.error('Erreur Vendia:', error);
            return [];
        }
    }

    // Récupérer les vendeurs les plus réputés
    async getTopSellers() {
        try {
            // À implémenter avec Supabase:
            // const { data, error } = await supabase
            //     .from('profiles')
            //     .select('*')
            //     .order('rating', { ascending: false })
            //     .limit(4);
            
            return [];
        } catch (error) {
            console.error('Erreur vendeurs:', error);
            return [];
        }
    }

    // Récupérer les derniers profils Profilio
    async getProfilioProfiles() {
        try {
            // À implémenter avec Supabase:
            // const { data, error } = await supabase
            //     .from('profilio_profils')
            //     .select('*')
            //     .order('created_at', { ascending: false })
            //     .limit(10);
            
            return [];
        } catch (error) {
            console.error('Erreur Profilio:', error);
            return [];
        }
    }
}

// Affichage des données
class DisplayService {
    constructor(dataService) {
        this.dataService = dataService;
    }

    // Afficher PetitsdJobs
    async displayPetitsdJobs() {
        const container = document.getElementById('petitsdjobsCarousel');
        if (!container) return;

        const data = await this.dataService.getPetitsdJobs();
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun petit job disponible pour le moment. Soyez le premier à publier une annonce.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'carousel-card fade-in';
            card.innerHTML = `
                <div class="carousel-card-icon">${this.getIcon(item.categorie)}</div>
                <h3 class="carousel-card-title">${item.titre}</h3>
                <p class="carousel-card-description">${item.description}</p>
            `;
            container.appendChild(card);
        });
    }

    // Afficher Vendia
    async displayVendia() {
        const container = document.getElementById('vendiaCarousel');
        if (!container) return;

        const data = await this.dataService.getVendiaProducts();
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun article disponible pour le moment.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'carousel-card fade-in';
            card.innerHTML = `
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.titre}" class="carousel-card-image">` : ''}
                <div class="carousel-card-icon">${this.getIcon(item.categorie)}</div>
                <h3 class="carousel-card-title">${item.titre}</h3>
                <p class="carousel-card-price">${item.prix} €</p>
            `;
            container.appendChild(card);
        });
    }

    // Afficher les vendeurs
    async displaySellers() {
        const container = document.getElementById('sellersGrid');
        if (!container) return;

        const data = await this.dataService.getTopSellers();
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun vendeur disponible pour le moment.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        data.forEach(seller => {
            const card = document.createElement('div');
            card.className = 'seller-card fade-in';
            card.innerHTML = `
                <div class="seller-avatar">${seller.nom.charAt(0)}</div>
                <h4 class="seller-name">${seller.nom} ${seller.prenom}</h4>
                <div class="seller-rating">
                    <span>★</span>
                    <span>${seller.rating || 'N/A'}</span>
                </div>
                <span class="seller-badge">Vendeur vérifié</span>
            `;
            container.appendChild(card);
        });
    }

    // Afficher Profilio
    async displayProfilio() {
        const container = document.getElementById('profilioCarousel');
        if (!container) return;

        const data = await this.dataService.getProfilioProfiles();
        
        if (data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Aucun profil professionnel disponible pour le moment.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'carousel-card fade-in';
            card.innerHTML = `
                <div class="carousel-card-icon">👤</div>
                <h3 class="carousel-card-title">${item.titre}</h3>
                <p class="carousel-card-description">${item.experience}</p>
            `;
            container.appendChild(card);
        });
    }

    // Helper pour les icônes
    getIcon(category) {
        const icons = {
            'électricien': '⚡',
            'plombier': '🔧',
            'développeur': '💻',
            'graphiste': '🎨',
            'default': '🔷'
        };
        return icons[category?.toLowerCase()] || icons['default'];
    }
}

// Navigation scroll effect
function handleNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

// Mobile menu toggle
function handleMobileMenu() {
    const menuBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');
    
    if (!menuBtn || !navLinks) return;
    
    menuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });
}

// Scroll animations
function handleScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
}

// Smooth scroll pour les liens de navigation
function handleSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
            
            // Fermer le menu mobile si ouvert
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.classList.remove('active');
            }
        });
    });
}

// Auto-scroll des carousels
function autoScrollCarousels() {
    const carousels = document.querySelectorAll('.carousel');
    
    carousels.forEach(carousel => {
        let scrollAmount = 0;
        const scrollSpeed = 1;
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        
        function scroll() {
            scrollAmount += scrollSpeed;
            if (scrollAmount >= maxScroll) {
                scrollAmount = 0;
            }
            carousel.scrollLeft = scrollAmount;
            requestAnimationFrame(scroll);
        }
        
        scroll();
    });
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser les services
    const dataService = new DataService();
    const displayService = new DisplayService(dataService);
    
    // Charger les données depuis la base de données
    displayService.displayPetitsdJobs();
    displayService.displayVendia();
    displayService.displaySellers();
    displayService.displayProfilio();
    
    // Initialiser les fonctionnalités UI
    handleNavbarScroll();
    handleMobileMenu();
    handleScrollAnimations();
    handleSmoothScroll();
    autoScrollCarousels();
});
