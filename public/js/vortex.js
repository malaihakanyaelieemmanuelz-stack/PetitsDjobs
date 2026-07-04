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

// Animation du Vortex (galaxie/portail cosmique cinématographique)
class VortexAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.trails = [];
        this.angle = 0;
        this.time = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars();
        this.initTrails();
        this.animate();
    }

    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 800; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 250 + 40;
            this.stars.push({
                angle: angle,
                distance: distance,
                speed: (0.001 + Math.random() * 0.002) * (300 / distance),
                size: Math.random() * 2 + 0.5,
                color: this.getRandomColor(),
                opacity: Math.random() * 0.6 + 0.4,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * 0.05 + 0.02
            });
        }
    }

    initTrails() {
        this.trails = [];
        for (let i = 0; i < 12; i++) {
            this.trails.push({
                baseAngle: (i / 12) * Math.PI * 2,
                radius: 60 + i * 15,
                speed: 0.002 + i * 0.0003,
                color: this.getRandomColor(),
                width: 2 + Math.random() * 3,
                length: 0.3 + Math.random() * 0.4
            });
        }
    }

    getRandomColor() {
        const colors = ['#FF8C00', '#FFB347', '#FFFFFF', '#22C55E', '#7CFF7C'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.time += 0.016;
        
        // Dessiner le trou noir central
        this.drawBlackHole();
        
        // Dessiner les halos de lumière
        this.drawLightHalos();
        
        // Dessiner les traînées lumineuses
        this.drawTrails();
        
        // Dessiner les étoiles de la galaxie
        this.drawGalaxyStars();
        
        // Dessiner les particules de poussière cosmique
        this.drawCosmicDust();
        
        this.angle += 0.003;
        requestAnimationFrame(() => this.animate());
    }

    drawBlackHole() {
        // Centre très sombre - trou noir
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 35
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.8, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 35, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Horizon des événements (bordure lumineuse pulsante)
        const pulseIntensity = 0.6 + Math.sin(this.time * 2) * 0.2;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 33, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255, 140, 0, ${pulseIntensity})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowBlur = 40;
        this.ctx.shadowColor = '#FF8C00';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    drawLightHalos() {
        // Halo orange externe (plus subtil)
        const halo1 = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 35,
            this.centerX, this.centerY, 250
        );
        halo1.addColorStop(0, 'rgba(255, 140, 0, 0.25)');
        halo1.addColorStop(0.3, 'rgba(255, 179, 71, 0.12)');
        halo1.addColorStop(0.6, 'rgba(34, 197, 94, 0.08)');
        halo1.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 250, 0, Math.PI * 2);
        this.ctx.fillStyle = halo1;
        this.ctx.fill();
        
        // Halo blanc central (lueur douce)
        const halo2 = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 35,
            this.centerX, this.centerY, 90
        );
        halo2.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        halo2.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
        halo2.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 90, 0, Math.PI * 2);
        this.ctx.fillStyle = halo2;
        this.ctx.fill();
    }

    drawTrails() {
        this.trails.forEach((trail, index) => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = trail.color;
            this.ctx.lineWidth = trail.width;
            this.ctx.lineCap = 'round';
            this.ctx.globalAlpha = 0.4;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = trail.color;
            
            const startAngle = this.angle + trail.baseAngle;
            const endAngle = startAngle + trail.length * Math.PI * 2;
            
            for (let j = 0; j <= 100; j++) {
                const t = j / 100;
                const angle = startAngle + t * (endAngle - startAngle);
                const radius = trail.radius + Math.sin(angle * 3 + this.time) * 8;
                const x = this.centerX + Math.cos(angle) * radius;
                const y = this.centerY + Math.sin(angle) * radius;
                
                if (j === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
    }

    drawGalaxyStars() {
        this.stars.forEach(star => {
            star.angle += star.speed;
            star.twinkle += star.twinkleSpeed;
            
            const twinkleOpacity = star.opacity * (0.7 + Math.sin(star.twinkle) * 0.3);
            const x = this.centerX + Math.cos(star.angle + this.angle) * star.distance;
            const y = this.centerY + Math.sin(star.angle + this.angle) * star.distance;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = twinkleOpacity;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = star.color;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
    }

    drawCosmicDust() {
        // Poussière cosmique qui flotte autour
        for (let i = 0; i < 100; i++) {
            const angle = (i / 100) * Math.PI * 2 + this.angle * 0.3;
            const distance = 120 + Math.sin(this.time * 0.5 + i * 0.1) * 40;
            const x = this.centerX + Math.cos(angle) * distance;
            const y = this.centerY + Math.sin(angle) * distance;
            const size = 0.8 + Math.sin(this.time * 2 + i) * 0.4;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.3;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = '#FFFFFF';
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        }
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
