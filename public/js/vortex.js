// VORTEX - Univers Cosmique Immersif

// Animation de trou noir avec fond spatial profond
class BlackHoleUniverse {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.shootingStars = [];
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
        this.initShootingStars();
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
        // Milliers d'étoiles fixes
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 120);
        
        for (let i = 0; i < starCount; i++) {
            const depth = Math.random();
            const isBright = Math.random() < 0.015; // 1.5% d'étoiles plus lumineuses
            
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: isBright ? (0.5 + Math.random() * 0.4) : (0.06 + Math.random() * 0.12),
                opacity: isBright ? (0.2 + Math.random() * 0.15) : (0.01 + Math.random() * 0.02),
                depth: depth,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: (0.002 + Math.random() * 0.004) * (1 - depth * 0.4),
                color: isBright ? '#e8f4ff' : this.getStarColor(depth)
            });
        }
    }

    getStarColor(depth) {
        // Diversité des couleurs d'étoiles comme dans un véritable ciel
        const colors = [
            // Étoiles blanches (majorité)
            '#ffffff',
            '#f0f4ff',
            '#e8f0ff',
            '#f8f8ff',
            // Étoiles bleu clair
            '#c8d8ff',
            '#b8c8f0',
            '#a8b8e8',
            '#98a8e0',
            // Étoiles légèrement dorées (rares)
            '#fff8e0',
            '#fff0d0',
            '#ffe8c0',
            // Étoiles cyan (très rares)
            '#d0f0ff',
            '#c0e8f8',
            '#b0e0f0',
            // Étoiles violettes très discrètes (extrêmement rares)
            '#e8d0f0',
            '#e0c8e8',
            '#d8c0e0'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initShootingStars() {
        this.shootingStars = [];
    }

    createShootingStar() {
        const startX = Math.random() * this.canvas.width;
        const startY = Math.random() * this.canvas.height * 0.4;
        const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.4;
        const speed = 10 + Math.random() * 5;
        
        this.shootingStars.push({
            x: startX,
            y: startY,
            angle: angle,
            speed: speed,
            length: 60 + Math.random() * 40,
            opacity: 0.2 + Math.random() * 0.1,
            life: 1
        });
    }

    initNebulaClouds() {
        this.nebulaClouds = [];
        const cloudCount = 5;
        
        for (let i = 0; i < cloudCount; i++) {
            const offsetX = (Math.random() - 0.5) * 400;
            const offsetY = (Math.random() - 0.5) * 300;
            
            this.nebulaClouds.push({
                x: this.centerX + offsetX,
                y: this.centerY + offsetY,
                radius: 120 + Math.random() * 180,
                color: this.getNebulaColor(),
                opacity: Math.random() * 0.004 + 0.002,
                pulseSpeed: Math.random() * 0.006 + 0.002,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
    }

    getNebulaColor() {
        const colors = [
            'rgba(74, 26, 107, 0.06)',
            'rgba(30, 58, 138, 0.05)',
            'rgba(8, 145, 178, 0.04)',
            'rgba(20, 184, 166, 0.035)',
            'rgba(34, 197, 94, 0.03)',
            'rgba(245, 158, 11, 0.025)',
            'rgba(139, 0, 0, 0.02)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initInnerPlasma() {
        this.innerPlasma = [];
        const particleCount = 1000;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 45 + Math.random() * 55;
            this.innerPlasma.push({
                angle: angle,
                distance: distance,
                speed: (0.0005 + Math.random() * 0.001) * (100 / distance),
                size: Math.random() * 0.7 + 0.2,
                opacity: Math.random() * 0.3 + 0.15,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: Math.random() * 0.018 + 0.006,
                color: this.getPlasmaColor(distance)
            });
        }
    }

    getPlasmaColor(distance) {
        if (distance < 60) return { r: 74, g: 26, b: 107 };
        if (distance < 70) return { r: 30, g: 58, b: 138 };
        if (distance < 80) return { r: 8, g: 145, b: 178 };
        if (distance < 90) return { r: 20, g: 184, b: 166 };
        return { r: 34, g: 197, b: 94 };
    }

    initOuterSpiral() {
        this.outerSpiral = [];
        const armCount = 10;
        
        for (let i = 0; i < armCount; i++) {
            const particles = [];
            const particleCount = 300;
            const baseAngle = (i / armCount) * Math.PI * 2;
            
            for (let j = 0; j < particleCount; j++) {
                const t = j / particleCount;
                const angle = baseAngle + t * Math.PI * 1.8;
                const radius = 100 + t * 300 + Math.sin(t * Math.PI * 6) * 25;
                particles.push({
                    baseAngle: baseAngle,
                    t: t,
                    angle: angle,
                    radius: radius,
                    baseRadius: radius,
                    speed: 0.0003 + Math.random() * 0.0002,
                    size: Math.random() * 0.6 + 0.1,
                    opacity: Math.random() * 0.2 + 0.06,
                    wobble: Math.random() * Math.PI * 2,
                    color: this.getSpiralColor(t)
                });
            }
            
            this.outerSpiral.push(particles);
        }
    }

    getSpiralColor(t) {
        if (t < 0.2) return { r: 8, g: 145, b: 178 };
        if (t < 0.35) return { r: 20, g: 184, b: 166 };
        if (t < 0.5) return { r: 34, g: 197, b: 94 };
        if (t < 0.65) return { r: 245, g: 158, b: 11 };
        if (t < 0.8) return { r: 139, g: 0, b: 0 };
        return { r: 74, g: 26, b: 107 };
    }

    initCosmicMatter() {
        this.cosmicMatter = [];
        const matterCount = 600;
        
        for (let i = 0; i < matterCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 350 + Math.random() * 300;
            this.cosmicMatter.push({
                angle: angle,
                distance: distance,
                speed: (0.00015 + Math.random() * 0.00035) * (650 / distance),
                size: Math.random() * 0.4 + 0.08,
                opacity: Math.random() * 0.08 + 0.02,
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
            { r: 34, g: 197, b: 94 },
            { r: 245, g: 158, b: 11 },
            { r: 139, g: 0, b: 0 }
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initHaloLayers() {
        this.haloLayers = [];
        const layerCount = 5;
        
        for (let i = 0; i < layerCount; i++) {
            this.haloLayers.push({
                radius: 50 + i * 35,
                opacity: Math.random() * 0.01 + 0.004,
                pulseSpeed: Math.random() * 0.008 + 0.003,
                pulsePhase: Math.random() * Math.PI * 2,
                color: this.getHaloColor(i)
            });
        }
    }

    getHaloColor(layerIndex) {
        const colors = [
            'rgba(74, 26, 107, 0.1)',
            'rgba(30, 58, 138, 0.08)',
            'rgba(8, 145, 178, 0.07)',
            'rgba(20, 184, 166, 0.06)',
            'rgba(34, 197, 94, 0.05)'
        ];
        return colors[layerIndex];
    }

    animate() {
        // Fond noir profond avec légères variations
        const gradient = this.ctx.createRadialGradient(
            this.canvas.width * 0.5, this.canvas.height * 0.5, 0,
            this.canvas.width * 0.5, this.canvas.height * 0.5, this.canvas.width * 0.8
        );
        gradient.addColorStop(0, '#050505');
        gradient.addColorStop(0.5, '#020202');
        gradient.addColorStop(1, '#000000');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.time += 0.016;
        
        // Dessiner les nébula (arrière-plan)
        this.drawNebulaClouds();
        
        // Dessiner les étoiles fixes (toute la page)
        this.drawStars();
        
        // Dessiner les étoiles filantes
        this.drawShootingStars();
        
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
        
        this.angle += 0.00015;
        requestAnimationFrame(() => this.animate());
    }

    drawNebulaClouds() {
        this.nebulaClouds.forEach(cloud => {
            cloud.pulsePhase += cloud.pulseSpeed;
            const pulse = 1 + Math.sin(cloud.pulsePhase) * 0.06;
            
            const gradient = this.ctx.createRadialGradient(
                cloud.x, cloud.y, 0,
                cloud.x, cloud.y, cloud.radius * pulse
            );
            gradient.addColorStop(0, cloud.color.replace('0.06', (cloud.opacity * 1.5).toString()).replace('0.05', (cloud.opacity * 1.4).toString()).replace('0.04', (cloud.opacity * 1.3).toString()).replace('0.035', (cloud.opacity * 1.2).toString()).replace('0.03', (cloud.opacity * 1.1).toString()).replace('0.025', (cloud.opacity * 1.0).toString()).replace('0.02', (cloud.opacity * 0.9).toString()));
            gradient.addColorStop(0.5, cloud.color.replace('0.06', (cloud.opacity * 0.5).toString()).replace('0.05', (cloud.opacity * 0.45).toString()).replace('0.04', (cloud.opacity * 0.4).toString()).replace('0.035', (cloud.opacity * 0.38).toString()).replace('0.03', (cloud.opacity * 0.35).toString()).replace('0.025', (cloud.opacity * 0.3).toString()).replace('0.02', (cloud.opacity * 0.25).toString()));
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(cloud.x, cloud.y, cloud.radius * pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(100px)';
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

    drawShootingStars() {
        // Créer une étoile filante aléatoirement (toutes les quelques secondes)
        if (Math.random() < 0.003) { // ~0.3% de chance par frame
            this.createShootingStar();
        }
        
        this.shootingStars = this.shootingStars.filter(star => {
            star.x += Math.cos(star.angle) * star.speed;
            star.y += Math.sin(star.angle) * star.speed;
            star.life -= 0.012;
            
            if (star.life <= 0 || star.x > this.canvas.width || star.y > this.canvas.height) {
                return false;
            }
            
            const gradient = this.ctx.createLinearGradient(
                star.x, star.y,
                star.x - Math.cos(star.angle) * star.length,
                star.y - Math.sin(star.angle) * star.length
            );
            gradient.addColorStop(0, `rgba(232, 244, 255, ${star.opacity * star.life})`);
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.moveTo(star.x, star.y);
            this.ctx.lineTo(
                star.x - Math.cos(star.angle) * star.length,
                star.y - Math.sin(star.angle) * star.length
            );
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            
            return true;
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
                particle.wobble += 0.01;
                particle.angle = particle.baseAngle + particle.t * Math.PI * 1.8 + this.angle * 0.3;
                const wobbleOffset = Math.sin(particle.wobble) * 7;
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
            
            const wobbleOffset = Math.sin(particle.wobble) * 3;
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
            const pulse = 1 + Math.sin(halo.pulsePhase) * 0.06;
            
            const gradient = this.ctx.createRadialGradient(
                this.centerX, this.centerY, halo.radius * 0.8,
                this.centerX, this.centerY, halo.radius * pulse
            );
            gradient.addColorStop(0, halo.color);
            gradient.addColorStop(0.5, halo.color.replace('0.1', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.5).toString()).replace('0.08', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.45).toString()).replace('0.07', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.4).toString()).replace('0.06', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.35).toString()).replace('0.05', (parseFloat(halo.color.match(/[\d.]+/)[0]) * 0.3).toString()));
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, halo.radius * pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(30px)';
            this.ctx.fill();
            this.ctx.filter = 'none';
        });
    }

    drawBlackHole() {
        // Gradient du trou noir - centre absolument noir
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 45
        );
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.95, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.999)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 45, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Halo de distorsion gravitationnelle très subtil
        const distortionHalo = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 45,
            this.centerX, this.centerY, 65
        );
        distortionHalo.addColorStop(0, 'rgba(74, 26, 107, 0.006)');
        distortionHalo.addColorStop(0.5, 'rgba(30, 58, 138, 0.005)');
        distortionHalo.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 65, 0, Math.PI * 2);
        this.ctx.fillStyle = distortionHalo;
        this.ctx.filter = 'blur(18px)';
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
