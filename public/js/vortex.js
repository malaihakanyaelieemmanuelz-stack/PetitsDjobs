// VORTEX - Trou Noir Cosmique Réaliste

// Animation de trou noir avec disque d'accrétion organique
class BlackHoleUniverse {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.cosmicDust = [];
        this.nebulaClouds = [];
        this.innerPlasma = [];
        this.outerSpiral = [];
        this.cosmicMatter = [];
        this.haloLayers = [];
        this.angle = 0;
        this.time = 0;
        this.centerX = 0;
        this.centerY = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars();
        this.initCosmicDust();
        this.initNebulaClouds();
        this.initInnerPlasma();
        this.initOuterSpiral();
        this.initCosmicMatter();
        this.initHaloLayers();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width * 0.7;
        this.centerY = this.canvas.height * 0.5;
    }

    initStars() {
        this.stars = [];
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 500);
        
        for (let i = 0; i < starCount; i++) {
            const depth = Math.random();
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: (0.08 + Math.random() * 0.2) * (1 - depth * 0.4),
                opacity: (0.015 + Math.random() * 0.025) * (1 - depth * 0.3),
                depth: depth,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: (0.005 + Math.random() * 0.008) * (1 - depth * 0.4),
                color: this.getStarColor(depth)
            });
        }
    }

    getStarColor(depth) {
        const colors = [
            '#c8d0e8',
            '#b8c8e0',
            '#a8c0d8',
            '#98b8d0',
            '#88b0c8',
            '#78a8c0'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initCosmicDust() {
        this.cosmicDust = [];
        const dustCount = Math.floor((this.canvas.width * this.canvas.height) / 2000);
        
        for (let i = 0; i < dustCount; i++) {
            this.cosmicDust.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 0.3 + 0.05,
                opacity: Math.random() * 0.006 + 0.001,
                speedX: (Math.random() - 0.5) * 0.004,
                speedY: (Math.random() - 0.5) * 0.004
            });
        }
    }

    initNebulaClouds() {
        this.nebulaClouds = [];
        const cloudCount = 6;
        
        for (let i = 0; i < cloudCount; i++) {
            this.nebulaClouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: 80 + Math.random() * 150,
                color: this.getNebulaColor(),
                opacity: Math.random() * 0.003 + 0.001,
                speedX: (Math.random() - 0.5) * 0.003,
                speedY: (Math.random() - 0.5) * 0.003
            });
        }
    }

    getNebulaColor() {
        const colors = [
            'rgba(74, 26, 107, 0.08)',
            'rgba(30, 58, 138, 0.06)',
            'rgba(8, 145, 178, 0.05)',
            'rgba(20, 184, 166, 0.04)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initInnerPlasma() {
        this.innerPlasma = [];
        const particleCount = 600;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 55 + Math.random() * 40;
            this.innerPlasma.push({
                angle: angle,
                distance: distance,
                speed: (0.0008 + Math.random() * 0.0012) * (100 / distance),
                size: Math.random() * 0.8 + 0.2,
                opacity: Math.random() * 0.25 + 0.15,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: Math.random() * 0.02 + 0.008,
                color: this.getPlasmaColor(distance)
            });
        }
    }

    getPlasmaColor(distance) {
        if (distance < 70) return { r: 74, g: 26, b: 107 };
        if (distance < 80) return { r: 30, g: 58, b: 138 };
        if (distance < 90) return { r: 8, g: 145, b: 178 };
        return { r: 20, g: 184, b: 166 };
    }

    initOuterSpiral() {
        this.outerSpiral = [];
        const armCount = 6;
        
        for (let i = 0; i < armCount; i++) {
            const particles = [];
            const particleCount = 200;
            const baseAngle = (i / armCount) * Math.PI * 2;
            
            for (let j = 0; j < particleCount; j++) {
                const t = j / particleCount;
                const angle = baseAngle + t * Math.PI * 1.2;
                const radius = 100 + t * 200 + Math.sin(t * Math.PI * 4) * 15;
                particles.push({
                    baseAngle: baseAngle,
                    t: t,
                    angle: angle,
                    radius: radius,
                    baseRadius: radius,
                    speed: 0.0005 + Math.random() * 0.0003,
                    size: Math.random() * 0.6 + 0.1,
                    opacity: Math.random() * 0.18 + 0.08,
                    wobble: Math.random() * Math.PI * 2,
                    color: this.getSpiralColor(t)
                });
            }
            
            this.outerSpiral.push(particles);
        }
    }

    getSpiralColor(t) {
        if (t < 0.3) return { r: 8, g: 145, b: 178 };
        if (t < 0.5) return { r: 20, g: 184, b: 166 };
        if (t < 0.7) return { r: 34, g: 197, b: 94 };
        if (t < 0.85) return { r: 245, g: 158, b: 11 };
        return { r: 74, g: 26, b: 107 };
    }

    initCosmicMatter() {
        this.cosmicMatter = [];
        const matterCount = 400;
        
        for (let i = 0; i < matterCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 250 + Math.random() * 200;
            this.cosmicMatter.push({
                angle: angle,
                distance: distance,
                speed: (0.0003 + Math.random() * 0.0005) * (450 / distance),
                size: Math.random() * 0.4 + 0.1,
                opacity: Math.random() * 0.08 + 0.03,
                color: this.getMatterColor()
            });
        }
    }

    getMatterColor() {
        const colors = [
            { r: 74, g: 26, b: 107 },
            { r: 30, g: 58, b: 138 },
            { r: 8, g: 145, b: 178 },
            { r: 20, g: 184, b: 166 },
            { r: 34, g: 197, b: 94 }
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initHaloLayers() {
        this.haloLayers = [];
        const layerCount = 5;
        
        for (let i = 0; i < layerCount; i++) {
            this.haloLayers.push({
                radius: 60 + i * 25,
                opacity: Math.random() * 0.012 + 0.005,
                pulseSpeed: Math.random() * 0.015 + 0.005,
                pulsePhase: Math.random() * Math.PI * 2,
                color: this.getHaloColor(i)
            });
        }
    }

    getHaloColor(layerIndex) {
        const colors = [
            'rgba(74, 26, 107, 0.12)',
            'rgba(30, 58, 138, 0.1)',
            'rgba(8, 145, 178, 0.08)',
            'rgba(20, 184, 166, 0.06)',
            'rgba(34, 197, 94, 0.04)'
        ];
        return colors[layerIndex];
    }

    animate() {
        // Fond noir profond
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.time += 0.016;
        
        // Dessiner les nébula (arrière-plan)
        this.drawNebulaClouds();
        
        // Dessiner les étoiles (toute la page)
        this.drawStars();
        
        // Dessiner la poussière cosmique
        this.drawCosmicDust();
        
        // Dessiner la matière cosmique externe
        this.drawCosmicMatter();
        
        // Dessiner les bras spiraux externes
        this.drawOuterSpiral();
        
        // Dessiner le plasma interne dense
        this.drawInnerPlasma();
        
        // Dessiner les halos qui respirent
        this.drawHaloLayers();
        
        // Dessiner le trou noir central
        this.drawBlackHole();
        
        this.angle += 0.0003;
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
            gradient.addColorStop(0, cloud.color.replace('0.25', cloud.opacity.toString()).replace('0.2', (cloud.opacity * 0.8).toString()).replace('0.15', (cloud.opacity * 0.6).toString()).replace('0.12', (cloud.opacity * 0.5).toString()));
            gradient.addColorStop(0.5, cloud.color.replace('0.25', (cloud.opacity * 0.5).toString()).replace('0.2', (cloud.opacity * 0.4).toString()).replace('0.15', (cloud.opacity * 0.3).toString()).replace('0.12', (cloud.opacity * 0.25).toString()));
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(60px)';
            this.ctx.fill();
            this.ctx.filter = 'none';
        });
    }

    drawStars() {
        this.stars.forEach(star => {
            star.twinkle += star.twinkleSpeed;
            const twinkleOpacity = star.opacity * (0.3 + Math.sin(star.twinkle) * 0.7);
            
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fillStyle = star.color;
            this.ctx.globalAlpha = twinkleOpacity;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
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

    drawCosmicMatter() {
        this.cosmicMatter.forEach(matter => {
            matter.angle += matter.speed;
            
            const x = this.centerX + Math.cos(matter.angle + this.angle * 0.5) * matter.distance;
            const y = this.centerY + Math.sin(matter.angle + this.angle * 0.5) * matter.distance;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, matter.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${matter.color.r}, ${matter.color.g}, ${matter.color.b}, ${matter.opacity})`;
            this.ctx.fill();
        });
    }

    drawOuterSpiral() {
        this.outerSpiral.forEach(arm => {
            arm.forEach(particle => {
                particle.wobble += 0.015;
                particle.angle = particle.baseAngle + particle.t * Math.PI * 1.2 + this.angle * 0.4;
                const wobbleOffset = Math.sin(particle.wobble) * 10;
                const radius = particle.baseRadius + wobbleOffset;
                
                const x = this.centerX + Math.cos(particle.angle) * radius;
                const y = this.centerY + Math.sin(particle.angle) * radius;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity})`;
                this.ctx.fill();
            });
        });
    }

    drawInnerPlasma() {
        this.innerPlasma.forEach(particle => {
            particle.angle += particle.speed;
            particle.wobble += particle.wobbleSpeed;
            
            const wobbleOffset = Math.sin(particle.wobble) * 5;
            const x = this.centerX + Math.cos(particle.angle + this.angle) * (particle.distance + wobbleOffset);
            const y = this.centerY + Math.sin(particle.angle + this.angle) * (particle.distance + wobbleOffset);
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${particle.color.r}, ${particle.color.g}, ${particle.color.b}, ${particle.opacity})`;
            this.ctx.fill();
        });
    }

    drawHaloLayers() {
        this.haloLayers.forEach(halo => {
            halo.pulsePhase += halo.pulseSpeed;
            const pulse = 1 + Math.sin(halo.pulsePhase) * 0.1;
            
            const gradient = this.ctx.createRadialGradient(
                this.centerX, this.centerY, halo.radius * 0.8,
                this.centerX, this.centerY, halo.radius * pulse
            );
            gradient.addColorStop(0, halo.color);
            gradient.addColorStop(0.5, halo.color.replace('0.3', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.5).toString()).replace('0.25', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.4).toString()).replace('0.2', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.35).toString()).replace('0.15', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.3).toString()).replace('0.1', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.25).toString()));
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, halo.radius * pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(20px)';
            this.ctx.fill();
            this.ctx.filter = 'none';
        });
    }

    drawBlackHole() {
        // Gradient du trou noir - centre absolument noir
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 50
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.95, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.999)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 50, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Halo de distorsion gravitationnelle très subtil
        const distortionHalo = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 50,
            this.centerX, this.centerY, 75
        );
        distortionHalo.addColorStop(0, 'rgba(74, 26, 107, 0.01)');
        distortionHalo.addColorStop(0.5, 'rgba(30, 58, 138, 0.008)');
        distortionHalo.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 75, 0, Math.PI * 2);
        this.ctx.fillStyle = distortionHalo;
        this.ctx.filter = 'blur(12px)';
        this.ctx.fill();
        this.ctx.filter = 'none';
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
    // Initialiser l'univers de trou noir
    const cosmicCanvas = document.getElementById('cosmicCanvas');
    if (cosmicCanvas) {
        new BlackHoleUniverse(cosmicCanvas);
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
