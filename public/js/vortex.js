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

// Animation du Vortex (trou noir cosmique organique)
class VortexAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.ribbons = [];
        this.angle = 0;
        this.time = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initParticles();
        this.initRibbons();
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
        for (let i = 0; i < 500; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * 300 + 30,
                speed: Math.random() * 0.02 + 0.005,
                size: Math.random() * 3 + 0.5,
                color: this.getRandomColor(),
                opacity: Math.random() * 0.7 + 0.3,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: Math.random() * 0.03 + 0.01
            });
        }
    }

    initRibbons() {
        this.ribbons = [];
        for (let i = 0; i < 8; i++) {
            this.ribbons.push({
                baseAngle: (i / 8) * Math.PI * 2,
                radius: 50 + i * 30,
                speed: 0.003 + i * 0.001,
                color: this.getRandomColor(),
                width: 15 + Math.random() * 20,
                amplitude: 20 + Math.random() * 30,
                frequency: 2 + Math.random() * 3
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
        
        // Dessiner les rubans lumineux
        this.drawRibbons();
        
        // Dessiner les particules
        this.drawParticles();
        
        // Dessiner les particules cosmiques
        this.drawCosmicParticles();
        
        this.angle += 0.005;
        requestAnimationFrame(() => this.animate());
    }

    drawBlackHole() {
        // Centre très sombre - trou noir
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 40
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.7, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 40, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Horizon des événements (bordure lumineuse)
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 38, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 140, 0, 0.8)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 30;
        this.ctx.shadowColor = '#FF8C00';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    drawLightHalos() {
        // Halo orange externe
        const halo1 = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 40,
            this.centerX, this.centerY, 200
        );
        halo1.addColorStop(0, 'rgba(255, 140, 0, 0.3)');
        halo1.addColorStop(0.4, 'rgba(255, 179, 71, 0.15)');
        halo1.addColorStop(0.7, 'rgba(34, 197, 94, 0.1)');
        halo1.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 200, 0, Math.PI * 2);
        this.ctx.fillStyle = halo1;
        this.ctx.fill();
        
        // Halo blanc central
        const halo2 = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 40,
            this.centerX, this.centerY, 100
        );
        halo2.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        halo2.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        halo2.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 100, 0, Math.PI * 2);
        this.ctx.fillStyle = halo2;
        this.ctx.fill();
    }

    drawRibbons() {
        this.ribbons.forEach((ribbon, index) => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = ribbon.color;
            this.ctx.lineWidth = ribbon.width;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.globalAlpha = 0.6;
            this.ctx.shadowBlur = 25;
            this.ctx.shadowColor = ribbon.color;
            
            for (let j = 0; j < 360; j++) {
                const angle = (j * Math.PI / 180) + this.angle + ribbon.baseAngle;
                const wobble = Math.sin(j * ribbon.frequency * Math.PI / 180 + this.time * 2) * ribbon.amplitude;
                const radius = ribbon.radius + wobble + Math.sin(this.time + index) * 10;
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

    drawParticles() {
        this.particles.forEach(particle => {
            particle.angle += particle.speed;
            particle.wobble += particle.wobbleSpeed;
            particle.radius -= 0.15;
            
            if (particle.radius < 25) {
                particle.radius = Math.random() * 300 + 30;
            }
            
            const wobbleX = Math.sin(particle.wobble) * 10;
            const wobbleY = Math.cos(particle.wobble) * 10;
            const x = this.centerX + Math.cos(particle.angle + this.angle) * particle.radius + wobbleX;
            const y = this.centerY + Math.sin(particle.angle + this.angle) * particle.radius + wobbleY;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = particle.color;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
    }

    drawCosmicParticles() {
        // Petites particules cosmiques qui flottent
        for (let i = 0; i < 50; i++) {
            const angle = (i / 50) * Math.PI * 2 + this.angle * 0.5;
            const radius = 150 + Math.sin(this.time + i) * 50;
            const x = this.centerX + Math.cos(angle) * radius;
            const y = this.centerY + Math.sin(angle) * radius;
            const size = 1 + Math.sin(this.time * 2 + i) * 0.5;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.globalAlpha = 0.4;
            this.ctx.shadowBlur = 10;
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
