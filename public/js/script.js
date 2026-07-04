// JavaScript pour Vortex Hub
document.addEventListener('DOMContentLoaded', function() {
    // Animation des carrousels
    const carousels = document.querySelectorAll('.carousel-track');
    
    carousels.forEach(carousel => {
        let isPaused = false;
        
        carousel.addEventListener('mouseenter', () => {
            isPaused = true;
            carousel.style.animationPlayState = 'paused';
        });
        
        carousel.addEventListener('mouseleave', () => {
            isPaused = false;
            carousel.style.animationPlayState = 'running';
        });
    });
    
    // Effet de scroll sur le header
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.vortex-header');
        if (window.scrollY > 50) {
            header.style.padding = '20px 50px';
        } else {
            header.style.padding = '30px 50px';
        }
    });
});
