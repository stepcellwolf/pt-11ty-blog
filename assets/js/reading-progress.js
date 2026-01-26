// Reading Progress Indicator
(function() {
    'use strict';
    
    // Only show on blog post pages
    if (!document.querySelector('article')) return;
    
    // Create progress bar element
    const progressBar = document.createElement('div');
    progressBar.className = 'fixed top-0 left-0 h-1 bg-primary-600 dark:bg-primary-400 transition-all duration-150 z-50';
    progressBar.style.width = '0%';
    progressBar.id = 'reading-progress';
    progressBar.setAttribute('role', 'progressbar');
    progressBar.setAttribute('aria-label', 'Reading progress');
    progressBar.setAttribute('aria-valuemin', '0');
    progressBar.setAttribute('aria-valuemax', '100');
    progressBar.setAttribute('aria-valuenow', '0');
    
    document.body.appendChild(progressBar);
    
    // Calculate and update progress
    const updateProgress = () => {
        const article = document.querySelector('article');
        if (!article) return;
        
        const articleTop = article.offsetTop;
        const articleHeight = article.offsetHeight;
        const windowHeight = window.innerHeight;
        const scrollPosition = window.pageYOffset;
        
        // Calculate progress (0 to 100)
        const progress = Math.max(0, Math.min(100, 
            ((scrollPosition - articleTop + windowHeight) / articleHeight) * 100
        ));
        
        // Update progress bar
        progressBar.style.width = progress + '%';
        progressBar.setAttribute('aria-valuenow', Math.round(progress));
        
        // Hide when at the very top
        if (scrollPosition < 100) {
            progressBar.style.opacity = '0';
        } else {
            progressBar.style.opacity = '1';
        }
    };
    
    // Throttle scroll events for performance
    let ticking = false;
    const requestTick = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateProgress();
                ticking = false;
            });
            ticking = true;
        }
    };
    
    // Listen for scroll and resize events
    window.addEventListener('scroll', requestTick, { passive: true });
    window.addEventListener('resize', requestTick, { passive: true });
    
    // Initial calculation
    updateProgress();
    
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReducedMotion.matches) {
        progressBar.style.transition = 'none';
    }
    
    prefersReducedMotion.addEventListener('change', (e) => {
        if (e.matches) {
            progressBar.style.transition = 'none';
        } else {
            progressBar.style.transition = 'all 150ms ease-out';
        }
    });
})();