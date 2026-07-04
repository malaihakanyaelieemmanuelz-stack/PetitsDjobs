// JavaScript pour Vortex Hub
document.addEventListener('DOMContentLoaded', function() {
    // Effet de scroll sur le header
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.vortex-header');
        if (header) {
            if (window.scrollY > 50) {
                header.style.padding = '20px 50px';
            } else {
                header.style.padding = '30px 50px';
            }
        }
    });

    // Toggle mot de passe - Fonction générique
    function setupPasswordToggle(toggleId, inputId) {
        const passwordToggle = document.getElementById(toggleId);
        const passwordInput = document.getElementById(inputId);
        const eyeOpen = passwordToggle?.querySelector('.eye-open');
        const eyeClosed = passwordToggle?.querySelector('.eye-closed');

        if (passwordToggle && passwordInput) {
            passwordToggle.addEventListener('click', () => {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    eyeOpen.style.display = 'none';
                    eyeClosed.style.display = 'block';
                } else {
                    passwordInput.type = 'password';
                    eyeOpen.style.display = 'block';
                    eyeClosed.style.display = 'none';
                }
            });
        }
    }

    // Setup pour tous les toggles de mot de passe
    setupPasswordToggle('passwordToggle', 'password');
    setupPasswordToggle('confirmPasswordToggle', 'confirmPassword');

    // Soumission du formulaire de connexion
    const connexionForm = document.getElementById('connexionForm');
    if (connexionForm) {
        connexionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Ici vous pouvez ajouter la logique de connexion
            alert('Formulaire de connexion soumis !');
        });
    }

    // Soumission du formulaire d'inscription
    const inscriptionForm = document.getElementById('inscriptionForm');
    if (inscriptionForm) {
        inscriptionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('Les mots de passe ne correspondent pas !');
                return;
            }
            
            // Ici vous pouvez ajouter la logique d'inscription
            alert('Formulaire d\'inscription soumis !');
        });
    }
});
