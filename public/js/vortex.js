// VORTEX - Trou Noir Cosmique Réaliste

// Animation de trou noir avec disque d'accrétion organique
class BlackHoleUniverse {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stars = [];
        this.cosmicDust = [];
        this.accretionLayers = [];
        this.plasmaStreams = [];
        this.gasClouds = [];
        this.distortionRings = [];
        this.angle = 0;
        this.time = 0;
        this.centerX = 0;
        this.centerY = 0;
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.initStars();
        this.initCosmicDust();
        this.initAccretionLayers();
        this.initPlasmaStreams();
        this.initGasClouds();
        this.initDistortionRings();
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
        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 600);
        
        for (let i = 0; i < starCount; i++) {
            const depth = Math.random();
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: (0.2 + Math.random() * 0.5) * (1 - depth * 0.4),
                opacity: (0.1 + Math.random() * 0.2) * (1 - depth * 0.3),
                depth: depth,
                twinkle: Math.random() * Math.PI * 2,
                twinkleSpeed: (0.01 + Math.random() * 0.015) * (1 - depth * 0.4),
                color: this.getStarColor(depth)
            });
        }
    }

    getStarColor(depth) {
        const colors = [
            '#ffffff',
            '#f0f4ff',
            '#e8f0ff',
            '#d8e8ff',
            '#c8d8ff',
            '#b8c8ff'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initCosmicDust() {
        this.cosmicDust = [];
        const dustCount = Math.floor((this.canvas.width * this.canvas.height) / 2500);
        
        for (let i = 0; i < dustCount; i++) {
            this.cosmicDust.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 0.6 + 0.15,
                opacity: Math.random() * 0.03 + 0.005,
                speedX: (Math.random() - 0.5) * 0.006,
                speedY: (Math.random() - 0.5) * 0.006
            });
        }
    }

    initAccretionLayers() {
        this.accretionLayers = [];
        const layerCount = 5;
        
        for (let i = 0; i < layerCount; i++) {
            const particles = [];
            const particleCount = 400 + i * 100;
            const baseRadius = 60 + i * 35;
            
            for (let j = 0; j < particleCount; j++) {
                const angle = Math.random() * Math.PI * 2;
                const radiusOffset = (Math.random() - 0.5) * 30;
                particles.push({
                    angle: angle,
                    radius: baseRadius + radiusOffset,
                    speed: (0.002 + Math.random() * 0.003) * (150 / baseRadius),
                    size: Math.random() * 1.5 + 0.4,
                    opacity: Math.random() * 0.4 + 0.2,
                    wobble: Math.random() * Math.PI * 2,
                    wobbleSpeed: Math.random() * 0.03 + 0.01
                });
            }
            
            this.accretionLayers.push({
                particles: particles,
                baseRadius: baseRadius,
                color: this.getLayerColor(i)
            });
        }
    }

    getLayerColor(layerIndex) {
        const colors = [
            { r: 255, g: 180, b: 120 }, // Couche proche - chaud
            { r: 255, g: 150, b: 100 },
            { r: 255, g: 120, b: 80 },
            { r: 200, g: 100, b: 150 }, // Couche moyenne - violet
            { r: 150, g: 80, b: 200 }  // Couche externe - violet foncé
        ];
        return colors[layerIndex];
    }

    initPlasmaStreams() {
        this.plasmaStreams = [];
        const streamCount = 12;
        
        for (let i = 0; i < streamCount; i++) {
            const points = [];
            const pointCount = 50;
            const baseAngle = (i / streamCount) * Math.PI * 2;
            
            for (let j = 0; j < pointCount; j++) {
                const t = j / pointCount;
                const angle = baseAngle + t * Math.PI * 0.8;
                const radius = 70 + t * 250 + Math.sin(t * Math.PI * 3) * 20;
                points.push({
                    angle: angle,
                    radius: radius,
                    baseRadius: radius,
                    wobble: Math.random() * Math.PI * 2
                });
            }
            
            this.plasmaStreams.push({
                points: points,
                color: this.getStreamColor(),
                opacity: Math.random() * 0.15 + 0.08
            });
        }
    }

    getStreamColor() {
        const colors = [
            'rgba(255, 200, 150, 0.6)',
            'rgba(255, 180, 130, 0.5)',
            'rgba(200, 150, 200, 0.4)',
            'rgba(180, 130, 220, 0.3)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initGasClouds() {
        this.gasClouds = [];
        const cloudCount = 8;
        
        for (let i = 0; i < cloudCount; i++) {
            this.gasClouds.push({
                angle: Math.random() * Math.PI * 2,
                distance: 200 + Math.random() * 300,
                radius: 80 + Math.random() * 120,
                color: this.getGasColor(),
                opacity: Math.random() * 0.06 + 0.02,
                rotationSpeed: (Math.random() - 0.5) * 0.001,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
    }

    getGasColor() {
        const colors = [
            'rgba(200, 150, 180, 0.4)',
            'rgba(180, 140, 200, 0.35)',
            'rgba(160, 130, 220, 0.3)',
            'rgba(220, 170, 160, 0.35)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    initDistortionRings() {
        this.distortionRings = [];
        const ringCount = 4;
        
        for (let i = 0; i < ringCount; i++) {
            this.distortionRings.push({
                radius: 55 + i * 15,
                opacity: Math.random() * 0.08 + 0.03,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: Math.random() * 0.02 + 0.01
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.time += 0.016;
        
        // Dessiner les étoiles (fond spatial)
        this.drawStars();
        
        // Dessiner la poussière cosmique
        this.drawCosmicDust();
        
        // Dessiner les nuages de gaz (arrière-plan)
        this.drawGasClouds();
        
        // Dessiner les flux de plasma
        this.drawPlasmaStreams();
        
        // Dessiner les couches d'accrétion
        this.drawAccretionLayers();
        
        // Dessiner les anneaux de distorsion
        this.drawDistortionRings();
        
        // Dessiner le trou noir central
        this.drawBlackHole();
        
        this.angle += 0.001;
        requestAnimationFrame(() => this.animate());
    }

    drawStars() {
        this.stars.forEach(star => {
            star.twinkle += star.twinkleSpeed;
            const twinkleOpacity = star.opacity * (0.4 + Math.sin(star.twinkle) * 0.6);
            
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

    drawGasClouds() {
        this.gasClouds.forEach(cloud => {
            cloud.angle += cloud.rotationSpeed;
            cloud.pulsePhase += cloud.pulseSpeed;
            
            const pulse = 1 + Math.sin(cloud.pulsePhase) * 0.15;
            const x = this.centerX + Math.cos(cloud.angle + this.angle * 0.5) * cloud.distance;
            const y = this.centerY + Math.sin(cloud.angle + this.angle * 0.5) * cloud.distance;
            
            const gradient = this.ctx.createRadialGradient(
                x, y, 0,
                x, y, cloud.radius * pulse
            );
            gradient.addColorStop(0, cloud.color.replace('0.4', (cloud.opacity * 1.5).toString()).replace('0.35', (cloud.opacity * 1.3).toString()).replace('0.3', (cloud.opacity * 1.1).toString()));
            gradient.addColorStop(0.5, cloud.color.replace('0.4', (cloud.opacity * 0.7).toString()).replace('0.35', (cloud.opacity * 0.6).toString()).replace('0.3', (cloud.opacity * 0.5).toString()));
            gradient.addColorStop(1, 'transparent');
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, cloud.radius * pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.filter = 'blur(40px)';
            this.ctx.fill();
            this.ctx.filter = 'none';
        });
    }

    drawPlasmaStreams() {
        this.plasmaStreams.forEach(stream => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = stream.color;
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.globalAlpha = stream.opacity;
            
            let firstPoint = true;
            stream.points.forEach((point, index) => {
                point.wobble += 0.02;
                const wobbleOffset = Math.sin(point.wobble) * 15;
                const angle = point.angle + this.angle * 0.8;
                const radius = point.baseRadius + wobbleOffset;
                const x = this.centerX + Math.cos(angle) * radius;
                const y = this.centerY + Math.sin(angle) * radius;
                
                if (firstPoint) {
                    this.ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    this.ctx.lineTo(x, y);
                }
            });
            
            this.ctx.stroke();
            this.ctx.globalAlpha = 1;
        });
    }

    drawAccretionLayers() {
        this.accretionLayers.forEach(layer => {
            layer.particles.forEach(particle => {
                particle.angle += particle.speed;
                particle.wobble += particle.wobbleSpeed;
                
                const wobbleOffset = Math.sin(particle.wobble) * 8;
                const x = this.centerX + Math.cos(particle.angle + this.angle) * (particle.radius + wobbleOffset);
                const y = this.centerY + Math.sin(particle.angle + this.angle) * (particle.radius + wobbleOffset);
                
                const color = layer.color;
                this.ctx.beginPath();
                this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${particle.opacity})`;
                this.ctx.fill();
            });
        });
    }

    drawDistortionRings() {
        this.distortionRings.forEach(ring => {
            ring.wobble += ring.wobbleSpeed;
            const wobbleOffset = Math.sin(ring.wobble) * 3;
            
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, ring.radius + wobbleOffset, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${ring.opacity})`;
            this.ctx.lineWidth = 1;
            this.ctx.filter = 'blur(2px)';
            this.ctx.stroke();
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
        gradient.addColorStop(0.9, '#000000');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.999)');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 50, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Halo de distorsion gravitationnelle très subtil
        const distortionHalo = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 50,
            this.centerX, this.centerY, 80
        );
        distortionHalo.addColorStop(0, 'rgba(255, 200, 150, 0.05)');
        distortionHalo.addColorStop(0.5, 'rgba(200, 150, 180, 0.03)');
        distortionHalo.addColorStop(1, 'transparent');
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, 80, 0, Math.PI * 2);
        this.ctx.fillStyle = distortionHalo;
        this.ctx.filter = 'blur(15px)';
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
