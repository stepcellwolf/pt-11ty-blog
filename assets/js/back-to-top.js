// Back to Top Button Functionality
(function() {
    'use strict';
    
    // Create the button element
    const button = document.createElement('button');
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
    `;
    button.setAttribute('aria-label', 'Back to top');
    button.setAttribute('title', 'Back to top');
    button.className = 'fixed bottom-8 right-8 z-50 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all duration-300 opacity-0 invisible';
    button.id = 'back-to-top';
    
    // Add to DOM
    document.body.appendChild(button);
    
    // Show/hide based on scroll position
    let isVisible = false;
    const toggleVisibility = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const shouldShow = scrollTop > 500;
        
        if (shouldShow && !isVisible) {
            button.classList.remove('opacity-0', 'invisible');
            button.classList.add('opacity-100', 'visible');
            isVisible = true;
        } else if (!shouldShow && isVisible) {
            button.classList.remove('opacity-100', 'visible');
            button.classList.add('opacity-0', 'invisible');
            isVisible = false;
        }
    };
    
    // Smooth scroll to top
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };
    
    // Event listeners
    let ticking = false;
    const requestTick = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                toggleVisibility();
                ticking = false;
            });
            ticking = true;
        }
    };
    
    window.addEventListener('scroll', requestTick, { passive: true });
    button.addEventListener('click', scrollToTop);
    
    // Initial check
    toggleVisibility();
})();