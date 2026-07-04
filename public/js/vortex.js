// VORTEX - Animation Cosmique et Connexion Base de Données

// Animation cosmique unifiée (fond + vortex intégrés)
class CosmicAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.cosmicDust = [];
        this.darkNebula = [];
        this.ribbons = [];
        this.particles = [];
        this.angle = 0;
        this.time = 0;
        this.centerX = 0;
        this.centerY = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars();
        this.initCosmicDust();
        this.initDarkNebula();
        this.initRibbons();
        this.initParticles();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width * 0.75; // Vortex à droite
        this.centerY = this.canvas.height * 0.5;
    }

    initStars() {
        this.stars = [];
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 1200);
        
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 0.8 + 0.2,
                opacity: Math.random() * 0.25 + 0.1,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: Math.random() * 0.02 + 0.008
            });
        }
    }

    initCosmicDust() {
        this.cosmicDust = [];
        const dustCount = Math.floor((this.canvas.width * this.canvas.height) / 5000);
        
        for (let i = 0; i < dustCount; i++) {
            this.cosmicDust.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 1 + 0.3,
                opacity: Math.random() * 0.05 + 0.01,
                speedX: (Math.random() - 0.5) * 0.01,
                speedY: (Math.random() - 0.5) * 0.01
            });
        }
    }

    initDarkNebula() {
        this.darkNebula = [];
        const nebulaCount = 5;
        
        for (let i = 0; i < nebulaCount; i++) {
            this.darkNebula.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: 120 + Math.random() * 180,
                opacity: Math.random() * 0.03 + 0.01,
                speedX: (Math.random() - 0.5) * 0.005,
                speedY: (Math.random() - 0.5) * 0.005
            });
        }
    }

    initRibbons() {
        this.ribbons = [];
        for (let i = 0; i < 20; i++) {
            this.ribbons.push({
                baseAngle: (i / 20) * Math.PI * 2,
                radius: 45 + i * 9,
                speed: 0.0012 + i * 0.00012,
                color: this.getRandomColor(),
                width: 0.6 + Math.random() * 1.2,
                length: 0.35 + Math.random() * 0.45,
                amplitude: 10 + Math.random() * 18,
                frequency: 2.5 + Math.random() * 3,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < 250; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 180 + 50;
            this.particles.push({
                angle: angle,
                distance: distance,
                speed: (0.0018 + Math.random() * 0.0025) * (230 / distance),
                size: Math.random() * 2 + 0.6,
                color: this.getRandomColor(),
                opacity: Math.random() * 0.5 + 0.35,
                trail: []
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
        
        // Dessiner les nébula sombres (profondeur)
        this.drawDarkNebula();
        
        // Dessiner la poussière cosmique
        this.drawCosmicDust();
        
        // Dessiner les étoiles fines (toute la page)
        this.drawStars();
        
        // Dessiner le vortex intégré
        this.drawVortex();
        
        this.angle += 0.002;
        requestAnimationFrame(() => this.animate());
    }

    drawDarkNebula() {
        this.darkNebula.forEach(cloud => {
            cloud.x += cloud.speedX;
            cloud.y += cloud.speedY;
            
            if (cloud.x < -cloud.radius) cloud.x = this.canvas.width + cloud.radius;
            if (cloud.x > this.canvas.width + cloud.radius) cloud.x = -cloud.radius;
            if (cloud.y < -cloud.radius) cloud.y = this.canvas.height + cloud.radius;
            if (cloud.y > this.canvas.height + cloud.radius) cloud.y = -cloud.radius;
            
            const gradient = this.ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, cloud.radius
            );
            gradient.addColorStop(0, `rgba(0, 0, 0, ${cloud.opacity})`);
            gradient.addColorStop(0.5, `rgba(0, 0, 0, ${cloud.opacity * 0.5})`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(45px)';
            this.ctx.fill();
            this.ctx.filter = 'none';
        });
    }

    drawCosmicDust() {
        this.cosmicDust.forEach(dust => {
            dust.x += dust.speedX;
            dust.y += dust.speedY;
            
            if (dust.x < 0) dust.x = this.canvas.width;
            if (dust.x > this.canvas.width) dust.x = 0;
            if (dust.y < 0) dust.y = this.canvas.height;
            if (dust.y > this.canvas.height) dust.y = 0;
            
            this.ctx.beginPath();
            this.ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${dust.opacity})`;
            this.ctx.fill();
        });
    }

    drawStars() {
        this.stars.forEach(star => {
            star.twinkle += star.twinkleSpeed;
            const twinkleOpacity = star.opacity * (0.6 + Math.sin(star.twinkle) * 0.4);
            
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${twinkleOpacity})`;
            this.ctx.shadowBlur = 1.5;
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
    }

    drawVortex() {
        // Dessiner le trou noir central
        this.drawBlackHole();
        
        // Dessiner les halos de lumière (très subtils)
        this.drawLightHalos();
        
        // Dessiner les rubans lumineux
        this.drawRibbons();
        
        // Dessiner les étoiles de la galaxie
        this.drawGalaxyStars();
        
        // Dessiner les particules avec traînées
        this.drawParticles();
    }

    drawBlackHole() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 38
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.92, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.995)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 38, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        const pulseIntensity = 0.5 + Math.sin(this.time * 2.2) * 0.12;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 36, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255, 140, 0, ${pulseIntensity})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.shadowBlur = 25;
        this.ctx.shadowColor = '#FFA500';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    drawLightHalos() {
        const halo1 = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 38,
            this.centerX, this.centerY, 180
        );
        halo1.addColorStop(0, 'rgba(255, 140, 0, 0.1)');
        halo1.addColorStop(0.3, 'rgba(255, 165, 0, 0.05)');
        halo1.addColorStop(0.6, 'rgba(255, 179, 71, 0.025)');
        halo1.addColorStop(0.8, 'rgba(34, 197, 94, 0.015)');
        halo1.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 180, 0, Math.PI * 2);
        this.ctx.fillStyle = halo1;
        this.ctx.fill();
        
        const halo2 = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 38,
            this.centerX, this.centerY, 75
        );
        halo2.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        halo2.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
        halo2.addColorStop(0.7, 'rgba(255, 255, 255, 0.025)');
        halo2.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 75, 0, Math.PI * 2);
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
            this.ctx.globalAlpha = 0.18;
            this.ctx.shadowBlur = 6;
            this.ctx.shadowColor = ribbon.color;
            
            const startAngle = this.angle + ribbon.baseAngle;
            const endAngle = startAngle + ribbon.length * Math.PI * 2;
            
            for (let j = 0; j <= 120; j++) {
                const t = j / 120;
                const angle = startAngle + t * (endAngle - startAngle);
                const wobble = Math.sin(angle * ribbon.frequency + this.time * 2 + ribbon.phase) * ribbon.amplitude;
                const radius = ribbon.radius + wobble + Math.sin(this.time + index * 0.5) * 5;
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
        this.particles.forEach(particle => {
            particle.angle += particle.speed;
            particle.distance -= 0.15;
            
            if (particle.distance < 40) {
                particle.distance = Math.random() * 180 + 50;
            }
            
            const x = this.centerX + Math.cos(particle.angle + this.angle) * particle.distance;
            const y = this.centerY + Math.sin(particle.angle + this.angle) * particle.distance;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size * 0.7, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity * 0.5;
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = particle.color;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
    }

    drawParticles() {
        this.particles.forEach(particle => {
            particle.angle += particle.speed;
            particle.distance -= 0.15;
            
            if (particle.distance < 40) {
                particle.distance = Math.random() * 180 + 50;
            }
            
            const x = this.centerX + Math.cos(particle.angle + this.angle) * particle.distance;
            const y = this.centerY + Math.sin(particle.angle + this.angle) * particle.distance;
            
            particle.trail.push({ x, y });
            if (particle.trail.length > 12) {
                particle.trail.shift();
            }
            
            if (particle.trail.length > 2) {
                this.ctx.beginPath();
                this.ctx.moveTo(particle.trail[0].x, particle.trail[0].y);
                for (let i = 1; i < particle.trail.length; i++) {
                    this.ctx.lineTo(particle.trail[i].x, particle.trail[i].y);
                }
                this.ctx.strokeStyle = particle.color;
                this.ctx.lineWidth = particle.size * 0.4;
                this.ctx.lineCap = 'round';
                this.ctx.globalAlpha = particle.opacity * 0.12;
                this.ctx.stroke();
            }
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity * 0.7;
            this.ctx.shadowBlur = 6;
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
    // Initialiser l'animation cosmique unifiée
    const cosmicCanvas = document.getElementById('cosmicCanvas');
    if (cosmicCanvas) {
        new CosmicAnimation(cosmicCanvas);
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
