// JavaScript pour Vortex Hub
document.addEventListener('DOMContentLoaded', function() {
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
