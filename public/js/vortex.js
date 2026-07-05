// VORTEX - Univers Cosmique Immersif

// Animation cosmique unifiée (trou noir + galaxie + matière cosmique)
class CosmicUniverse {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.cosmicDust = [];
        this.nebulaClouds = [];
        this.accretionDisk = [];
        this.gravitationalFlux = [];
        this.spiralArms = [];
        this.angle = 0;
        this.time = 0;
        this.centerX = 0;
        this.centerY = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars();
        this.initCosmicDust();
        this.initNebulaClouds();
        this.initAccretionDisk();
        this.initGravitationalFlux();
        this.initSpiralArms();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width * 0.72;
        this.centerY = this.canvas.height * 0.5;
    }

    initStars() {
        this.stars = [];
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 800);
        
        for (let i = 0; i < starCount; i++) {
            const depth = Math.random();
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: (0.3 + Math.random() * 0.7) * (1 - depth * 0.5),
                opacity: (0.15 + Math.random() * 0.25) * (1 - depth * 0.3),
                depth: depth,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: (0.015 + Math.random() * 0.02) * (1 - depth * 0.5),
                color: this.getStarColor(depth)
            });
        }
    }

    getStarColor(depth) {
        const colors = [
            '#ffffff',
            '#e0e8ff',
            '#d4e1ff',
            '#c8d4ff',
            '#00d4ff',
            '#8b5cf6'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initCosmicDust() {
        this.cosmicDust = [];
        const dustCount = Math.floor((this.canvas.width * this.canvas.height) / 3000);
        
        for (let i = 0; i < dustCount; i++) {
            this.cosmicDust.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 0.8 + 0.2,
                opacity: Math.random() * 0.04 + 0.01,
                speedX: (Math.random() - 0.5) * 0.008,
                speedY: (Math.random() - 0.5) * 0.008
            });
        }
    }

    initNebulaClouds() {
        this.nebulaClouds = [];
        const cloudCount = 7;
        
        for (let i = 0; i < cloudCount; i++) {
            this.nebulaClouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: 100 + Math.random() * 200,
                color: this.getNebulaColor(),
                opacity: Math.random() * 0.025 + 0.008,
                speedX: (Math.random() - 0.5) * 0.004,
                speedY: (Math.random() - 0.5) * 0.004
            });
        }
    }

    getNebulaColor() {
        const colors = [
            'rgba(26, 10, 46, 0.3)',
            'rgba(139, 92, 246, 0.2)',
            'rgba(0, 212, 255, 0.15)',
            'rgba(255, 107, 157, 0.12)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initAccretionDisk() {
        this.accretionDisk = [];
        const diskCount = 300;
        
        for (let i = 0; i < diskCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 150;
            this.accretionDisk.push({
                angle: angle,
                distance: distance,
                speed: (0.003 + Math.random() * 0.004) * (200 / distance),
                size: Math.random() * 2.5 + 0.8,
                color: this.getDiskColor(distance),
                opacity: Math.random() * 0.6 + 0.4,
                wobble: Math.random() * Math.PI * 2
            });
        }
    }

    getDiskColor(distance) {
        if (distance < 80) return '#ff4500';
        if (distance < 120) return '#ff6b35';
        if (distance < 160) return '#ff8c42';
        return '#ffa050';
    }

    initGravitationalFlux() {
        this.gravitationalFlux = [];
        const fluxCount = 150;
        
        for (let i = 0; i < fluxCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 300;
            this.gravitationalFlux.push({
                angle: angle,
                distance: distance,
                speed: (0.002 + Math.random() * 0.003) * (400 / distance),
                size: Math.random() * 1.5 + 0.5,
                color: this.getFluxColor(),
                opacity: Math.random() * 0.4 + 0.2,
                trail: []
            });
        }
    }

    getFluxColor() {
        const colors = [
            '#00d4ff',
            '#00fff5',
            '#8b5cf6',
            '#ff6b9d'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initSpiralArms() {
        this.spiralArms = [];
        const armCount = 4;
        
        for (let i = 0; i < armCount; i++) {
            this.spiralArms.push({
                baseAngle: (i / armCount) * Math.PI * 2,
                twist: 0.8 + Math.random() * 0.4,
                width: 0.3 + Math.random() * 0.2,
                color: this.getArmColor()
            });
        }
    }

    getArmColor() {
        const colors = [
            'rgba(0, 212, 255, 0.15)',
            'rgba(139, 92, 246, 0.12)',
            'rgba(255, 107, 157, 0.1)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.time += 0.016;
        
        // Dessiner les nébula (fond)
        this.drawNebulaClouds();
        
        // Dessiner les étoiles (toute la scène)
        this.drawStars();
        
        // Dessiner la poussière cosmique
        this.drawCosmicDust();
        
        // Dessiner les bras spiraux de la galaxie
        this.drawSpiralArms();
        
        // Dessiner le flux gravitationnel
        this.drawGravitationalFlux();
        
        // Dessiner le disque d'accrétion
        this.drawAccretionDisk();
        
        // Dessiner le trou noir central
        this.drawBlackHole();
        
        this.angle += 0.0015;
        requestAnimationFrame(() => this.animate());
    }

    drawNebulaClouds() {
        this.nebulaClouds.forEach(cloud => {
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
            gradient.addColorStop(0, cloud.color.replace('0.3', cloud.opacity.toString()).replace('0.2', (cloud.opacity * 0.7).toString()).replace('0.15', (cloud.opacity * 0.5).toString()).replace('0.12', (cloud.opacity * 0.4).toString()));
            gradient.addColorStop(0.5, cloud.color.replace('0.3', (cloud.opacity * 0.5).toString()).replace('0.2', (cloud.opacity * 0.35).toString()).replace('0.15', (cloud.opacity * 0.25).toString()).replace('0.12', (cloud.opacity * 0.2).toString()));
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(50px)';
            this.ctx.fill();
            this.ctx.filter = 'none';
        });
    }

    drawStars() {
        this.stars.forEach(star => {
            star.twinkle += star.twinkleSpeed;
            const twinkleOpacity = star.opacity * (0.5 + Math.sin(star.twinkle) * 0.5);
            
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = twinkleOpacity;
            this.ctx.shadowBlur = 2 * (1 - star.depth);
            this.ctx.shadowColor = star.color;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
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

    drawSpiralArms() {
        this.spiralArms.forEach(arm => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = arm.color;
            this.ctx.lineWidth = arm.width;
            this.ctx.lineCap = 'round';
            
            for (let j = 0; j <= 200; j++) {
                const t = j / 200;
                const angle = arm.baseAngle + t * Math.PI * 2 * arm.twist + this.angle * 0.5;
                const radius = 60 + t * 350;
                const x = this.centerX + Math.cos(angle) * radius;
                const y = this.centerY + Math.sin(angle) * radius;
                
                if (j === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();
        });
    }

    drawGravitationalFlux() {
        this.gravitationalFlux.forEach(flux => {
            flux.angle += flux.speed;
            flux.distance -= 0.3;
            
            if (flux.distance < 45) {
                flux.distance = 100 + Math.random() * 300;
            }
            
            const x = this.centerX + Math.cos(flux.angle + this.angle) * flux.distance;
            const y = this.centerY + Math.sin(flux.angle + this.angle) * flux.distance;
            
            flux.trail.push({ x, y });
            if (flux.trail.length > 20) {
                flux.trail.shift();
            }
            
            if (flux.trail.length > 2) {
                this.ctx.beginPath();
                this.ctx.moveTo(flux.trail[0].x, flux.trail[0].y);
                for (let i = 1; i < flux.trail.length; i++) {
                    this.ctx.lineTo(flux.trail[i].x, flux.trail[i].y);
                }
                this.ctx.strokeStyle = flux.color;
                this.ctx.lineWidth = flux.size * 0.3;
                this.ctx.lineCap = 'round';
                this.ctx.globalAlpha = flux.opacity * 0.15;
                this.ctx.stroke();
            }
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, flux.size, 0, Math.PI * 2);
            this.ctx.fillStyle = flux.color;
            this.ctx.globalAlpha = flux.opacity * 0.6;
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = flux.color;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = 0;
        });
    }

    drawAccretionDisk() {
        this.accretionDisk.forEach(particle => {
            particle.angle += particle.speed;
            particle.wobble += 0.02;
            
            const wobbleOffset = Math.sin(particle.wobble) * 5;
            const x = this.centerX + Math.cos(particle.angle + this.angle) * (particle.distance + wobbleOffset);
            const y = this.centerY + Math.sin(particle.angle + this.angle) * (particle.distance + wobbleOffset);
            
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

    drawBlackHole() {
        // Gradient du trou noir
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 45
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.95, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.998)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 45, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Horizon des événements pulsant
        const pulseIntensity = 0.4 + Math.sin(this.time * 2.5) * 0.1;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 42, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255, 69, 0, ${pulseIntensity})`;
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#ff4500';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        
        // Halo de distorsion gravitationnelle
        const distortionHalo = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 45,
            this.centerX, this.centerY, 70
        );
        distortionHalo.addColorStop(0, 'rgba(255, 69, 0, 0.08)');
        distortionHalo.addColorStop(0.5, 'rgba(255, 107, 157, 0.04)');
        distortionHalo.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 70, 0, Math.PI * 2);
        this.ctx.fillStyle = distortionHalo;
        this.ctx.fill();
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
    // Initialiser l'univers cosmique
    const cosmicCanvas = document.getElementById('cosmicCanvas');
    if (cosmicCanvas) {
        new CosmicUniverse(cosmicCanvas);
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
