// VORTEX - Animation Cosmique et Connexion Base de Données

// Animation des étoiles (fond cosmique)
class StarsAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initStars() {
        this.stars = [];
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 3000);
        
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2 + 0.5,
                opacity: Math.random() * 0.5 + 0.3,
                speed: Math.random() * 0.02 + 0.01
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.stars.forEach(star => {
            star.opacity += (Math.random() - 0.5) * 0.02;
            star.opacity = Math.max(0.1, Math.min(0.8, star.opacity));
            
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            this.ctx.fill();
        });
        
        requestAnimationFrame(() => this.animate());
    }
}

// Animation du Vortex (trou noir cosmique)
class VortexAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.angle = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < 300; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * 250 + 50,
                speed: Math.random() * 0.03 + 0.01,
                size: Math.random() * 4 + 1,
                color: Math.random() > 0.5 ? '#FF8C00' : '#228B22',
                opacity: Math.random() * 0.6 + 0.4
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessiner le halo central
        this.drawHalo();
        
        // Dessiner les spirales du vortex
        this.drawSpirals();
        
        // Dessiner les particules
        this.drawParticles();
        
        this.angle += 0.008;
        requestAnimationFrame(() => this.animate());
    }

    drawHalo() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 300
        );
        
        gradient.addColorStop(0, 'rgba(255, 140, 0, 0.4)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.2)');
        gradient.addColorStop(0.6, 'rgba(34, 139, 34, 0.3)');
        gradient.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 300, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }

    drawSpirals() {
        for (let i = 0; i < 4; i++) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = i === 0 ? 'rgba(255, 140, 0, 0.6)' : 
                                  i === 1 ? 'rgba(255, 255, 255, 0.4)' : 
                                  i === 2 ? 'rgba(34, 139, 34, 0.6)' : 
                                  'rgba(255, 140, 0, 0.3)';
            this.ctx.lineWidth = 3;
            this.ctx.lineCap = 'round';
            
            for (let j = 0; j < 720; j++) {
                const angle = (j * Math.PI / 180) + this.angle + (i * 0.4);
                const radius = j * 0.4 + (i * 30);
                const x = this.centerX + Math.cos(angle) * radius;
                const y = this.centerY + Math.sin(angle) * radius;
                
                if (j === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        }
    }

    drawParticles() {
        this.particles.forEach(particle => {
            particle.angle += particle.speed;
            particle.radius -= 0.1;
            
            if (particle.radius < 20) {
                particle.radius = Math.random() * 250 + 50;
            }
            
            const x = this.centerX + Math.cos(particle.angle + this.angle) * particle.radius;
            const y = this.centerY + Math.sin(particle.angle + this.angle) * particle.radius;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = particle.color;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
    }
}

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
        const container = document.getElementById('petitsdjobsContent');
        if (!container) return;

        const data = await this.dataService.getPetitsdJobs();
        
        if (data.length === 0) {
            container.innerHTML = '<p class="empty">Aucune annonce disponible.</p>';
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');
        container.innerHTML = `<p>${data.length} annonces disponibles</p>`;
    }

    // Afficher Vendia
    async displayVendia() {
        const container = document.getElementById('vendiaContent');
        if (!container) return;

        const data = await this.dataService.getVendiaProducts();
        
        if (data.length === 0) {
            container.innerHTML = '<p class="empty">Aucun produit disponible.</p>';
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');
        container.innerHTML = `<p>${data.length} produits disponibles</p>`;
    }

    // Afficher Profilio
    async displayProfilio() {
        const container = document.getElementById('profilioContent');
        if (!container) return;

        const data = await this.dataService.getProfilioProfiles();
        
        if (data.length === 0) {
            container.innerHTML = '<p class="empty">Aucun profil disponible.</p>';
            container.classList.add('empty');
            return;
        }

        container.classList.remove('empty');
        container.innerHTML = `<p>${data.length} profils disponibles</p>`;
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
            
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                navLinks.classList.remove('active');
            }
        });
    });
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Initialiser les animations
    const starsCanvas = document.getElementById('starsCanvas');
    if (starsCanvas) {
        new StarsAnimation(starsCanvas);
    }
    
    const vortexCanvas = document.getElementById('vortexCanvas');
    if (vortexCanvas) {
        new VortexAnimation(vortexCanvas);
    }
    
    // Initialiser les services de données
    const dataService = new DataService();
    const displayService = new DisplayService(dataService);
    
    // Charger les données depuis la base de données
    displayService.displayPetitsdJobs();
    displayService.displayVendia();
    displayService.displayProfilio();
    
    // Initialiser les fonctionnalités UI
    handleNavbarScroll();
    handleMobileMenu();
    handleSmoothScroll();
});
