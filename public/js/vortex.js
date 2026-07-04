// VORTEX - JavaScript Principal

// Données des carousels
const petitsdjobsData = [
    { name: 'Électricien', icon: '⚡' },
    { name: 'Plombier', icon: '🔧' },
    { name: 'Développeur', icon: '💻' },
    { name: 'Graphiste', icon: '🎨' },
    { name: 'Couturier', icon: '🧵' },
    { name: 'Mécanicien', icon: '🔩' },
    { name: 'Menuisier', icon: '🪚' },
    { name: 'Maçon', icon: '🧱' },
    { name: 'Soudeur', icon: '🔥' },
    { name: 'Coiffeur', icon: '✂️' },
    { name: 'Enseignant', icon: '📚' },
    { name: 'Jardinier', icon: '🌱' },
    { name: 'Informaticien', icon: '💾' }
];

const vendiaData = [
    { name: 'Téléphones', icon: '📱' },
    { name: 'Ordinateurs', icon: '💻' },
    { name: 'Chaussures', icon: '👟' },
    { name: 'Vêtements', icon: '👕' },
    { name: 'Meubles', icon: '🪑' },
    { name: 'Électroménager', icon: '🏠' },
    { name: 'Voitures', icon: '🚗' },
    { name: 'Livres', icon: '📖' },
    { name: 'Accessoires', icon: '⌚' }
];

const profilioData = [
    { name: 'CV professionnels', icon: '📄' },
    { name: 'Portfolios', icon: '🎯' },
    { name: 'Certifications', icon: '🏆' },
    { name: 'Diplômes', icon: '🎓' },
    { name: 'Compétences', icon: '⭐' },
    { name: 'Recommandations', icon: '💬' },
    { name: 'Freelances', icon: '🚀' },
    { name: 'Entrepreneurs', icon: '💼' },
    { name: 'Étudiants', icon: '📚' },
    { name: 'Artisans', icon: '🛠️' }
];

const topSellers = [
    { name: 'Jean Dupont', rating: 4.9 },
    { name: 'Marie Martin', rating: 4.8 },
    { name: 'Pierre Bernard', rating: 4.7 },
    { name: 'Sophie Petit', rating: 4.9 }
];

// Animation du Vortex
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
        for (let i = 0; i < 200; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                radius: Math.random() * 200 + 50,
                speed: Math.random() * 0.02 + 0.01,
                size: Math.random() * 3 + 1,
                color: Math.random() > 0.5 ? '#FF8C00' : '#228B22',
                opacity: Math.random() * 0.5 + 0.3
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dessiner le vortex principal
        this.drawVortex();
        
        // Dessiner les particules
        this.drawParticles();
        
        this.angle += 0.005;
        requestAnimationFrame(() => this.animate());
    }

    drawVortex() {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 250
        );
        
        gradient.addColorStop(0, 'rgba(255, 140, 0, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(34, 139, 34, 0.3)');
        
        // Spirales
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.strokeStyle = i === 0 ? 'rgba(255, 140, 0, 0.5)' : 
                                  i === 1 ? 'rgba(255, 255, 255, 0.3)' : 
                                  'rgba(34, 139, 34, 0.5)';
            this.ctx.lineWidth = 2;
            
            for (let j = 0; j < 360; j++) {
                const angle = (j * Math.PI / 180) + this.angle + (i * 0.5);
                const radius = j * 0.5 + (i * 20);
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
            
            const x = this.centerX + Math.cos(particle.angle + this.angle) * particle.radius;
            const y = this.centerY + Math.sin(particle.angle + this.angle) * particle.radius;
            
            this.ctx.beginPath();
            this.ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        });
    }
}

// Génération des carousels
function generateCarousel(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'carousel-card fade-in';
        card.innerHTML = `
            <div class="carousel-card-icon">${item.icon}</div>
            <h3 class="carousel-card-title">${item.name}</h3>
        `;
        container.appendChild(card);
    });
}

// Génération des vendeurs
function generateSellers() {
    const container = document.getElementById('sellersGrid');
    if (!container) return;
    
    topSellers.forEach(seller => {
        const card = document.createElement('div');
        card.className = 'seller-card fade-in';
        card.innerHTML = `
            <div class="seller-avatar">${seller.name.charAt(0)}</div>
            <h4 class="seller-name">${seller.name}</h4>
            <div class="seller-rating">
                <span>★</span>
                <span>${seller.rating}</span>
            </div>
            <span class="seller-badge">Vendeur vérifié</span>
        `;
        container.appendChild(card);
    });
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
    // Initialiser le vortex
    const vortexCanvas = document.getElementById('vortexCanvas');
    if (vortexCanvas) {
        new VortexAnimation(vortexCanvas);
    }
    
    // Générer les carousels
    generateCarousel('petitsdjobsCarousel', petitsdjobsData);
    generateCarousel('vendiaCarousel', vendiaData);
    generateCarousel('profilioCarousel', profilioData);
    
    // Générer les vendeurs
    generateSellers();
    
    // Initialiser les fonctionnalités
    handleNavbarScroll();
    handleMobileMenu();
    handleScrollAnimations();
    handleSmoothScroll();
    autoScrollCarousels();
});
