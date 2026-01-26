/**
 * UI/UX Enhancements JavaScript
 * Provides improved interactivity and mobile experience
 */

(function() {
  'use strict';

  // ===========================
  // 1. ENHANCED MOBILE MENU
  // ===========================

  class MobileMenu {
    constructor() {
      this.menuButton = document.querySelector('[data-mobile-menu-button]');
      this.menuPanel = document.querySelector('[data-mobile-menu-panel]');
      this.menuOverlay = document.querySelector('[data-mobile-menu-overlay]');
      this.closeButton = document.querySelector('[data-mobile-menu-close]');
      this.isOpen = false;
      this.init();
    }

    init() {
      if (!this.menuButton) return;

      // Toggle menu
      this.menuButton.addEventListener('click', () => this.toggle());

      // Close menu
      if (this.closeButton) {
        this.closeButton.addEventListener('click', () => this.close());
      }

      if (this.menuOverlay) {
        this.menuOverlay.addEventListener('click', () => this.close());
      }

      // Close on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      // Handle swipe gestures
      this.handleSwipeGestures();
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      this.isOpen = true;
      document.body.style.overflow = 'hidden';

      if (this.menuPanel) {
        this.menuPanel.classList.add('active');
      }
      if (this.menuOverlay) {
        this.menuOverlay.classList.add('active');
      }

      // Trap focus
      this.trapFocus();
    }

    close() {
      this.isOpen = false;
      document.body.style.overflow = '';

      if (this.menuPanel) {
        this.menuPanel.classList.remove('active');
      }
      if (this.menuOverlay) {
        this.menuOverlay.classList.remove('active');
      }

      // Return focus
      this.menuButton.focus();
    }

    trapFocus() {
      if (!this.menuPanel) return;

      const focusableElements = this.menuPanel.querySelectorAll(
        'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      firstElement.focus();

      this.menuPanel.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      });
    }

    handleSwipeGestures() {
      if (!this.menuPanel) return;

      let touchStartX = 0;
      let touchEndX = 0;

      this.menuPanel.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      });

      this.menuPanel.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe(touchStartX, touchEndX);
      });
    }

    handleSwipe(startX, endX) {
      const swipeThreshold = 50;
      const diff = startX - endX;

      // Swipe right to close
      if (diff < -swipeThreshold) {
        this.close();
      }
    }
  }

  // ===========================
  // 2. READING PROGRESS BAR
  // ===========================

  class ReadingProgress {
    constructor() {
      this.progressBar = null;
      this.init();
    }

    init() {
      // Only show on article pages
      if (!document.querySelector('article')) return;

      this.createProgressBar();
      this.updateProgress();

      // Throttled scroll handler
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            this.updateProgress();
            ticking = false;
          });
          ticking = true;
        }
      });
    }

    createProgressBar() {
      this.progressBar = document.createElement('div');
      this.progressBar.className = 'reading-progress';
      this.progressBar.setAttribute('role', 'progressbar');
      this.progressBar.setAttribute('aria-valuemin', '0');
      this.progressBar.setAttribute('aria-valuemax', '100');
      document.body.appendChild(this.progressBar);
    }

    updateProgress() {
      const scrolled = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const progress = height > 0 ? (scrolled / height) * 100 : 0;

      if (this.progressBar) {
        this.progressBar.style.width = `${progress}%`;
        this.progressBar.setAttribute('aria-valuenow', Math.round(progress));
      }
    }
  }

  // ===========================
  // 3. CODE COPY FUNCTIONALITY
  // ===========================

  class CodeCopy {
    constructor() {
      this.init();
    }

    init() {
      const codeBlocks = document.querySelectorAll('pre code');

      codeBlocks.forEach(block => {
        this.addCopyButton(block);
      });
    }

    addCopyButton(codeBlock) {
      const pre = codeBlock.parentElement;
      if (pre.querySelector('.code-copy-btn')) return;

      const button = document.createElement('button');
      button.className = 'code-copy-btn';
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code to clipboard');

      button.addEventListener('click', () => {
        this.copyCode(codeBlock, button);
      });

      pre.style.position = 'relative';
      pre.appendChild(button);
    }

    async copyCode(codeBlock, button) {
      const text = codeBlock.textContent;

      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied!';
        button.classList.add('copied');

        setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();

        try {
          document.execCommand('copy');
          button.textContent = 'Copied!';
          button.classList.add('copied');

          setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
          }, 2000);
        } catch (err) {
          button.textContent = 'Failed';
        }

        document.body.removeChild(textArea);
      }
    }
  }

  // ===========================
  // 4. SMOOTH SCROLL WITH OFFSET
  // ===========================

  class SmoothScroll {
    constructor() {
      this.headerHeight = 80;
      this.init();
    }

    init() {
      // Handle anchor links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
          const href = anchor.getAttribute('href');
          if (href === '#') return;

          e.preventDefault();
          const target = document.querySelector(href);

          if (target) {
            this.scrollToElement(target);

            // Update URL
            history.pushState(null, null, href);
          }
        });
      });

      // Handle initial hash
      if (window.location.hash) {
        setTimeout(() => {
          const target = document.querySelector(window.location.hash);
          if (target) {
            this.scrollToElement(target);
          }
        }, 100);
      }
    }

    scrollToElement(element) {
      const top = element.offsetTop - this.headerHeight;

      window.scrollTo({
        top: top,
        behavior: 'smooth'
      });
    }
  }

  // ===========================
  // 5. PULL TO REFRESH (Mobile)
  // ===========================

  class PullToRefresh {
    constructor() {
      this.touchStartY = 0;
      this.isPulling = false;
      this.threshold = 100;
      this.init();
    }

    init() {
      // Only enable on mobile
      if (!('ontouchstart' in window)) return;

      this.createIndicator();

      document.addEventListener('touchstart', (e) => this.handleTouchStart(e));
      document.addEventListener('touchmove', (e) => this.handleTouchMove(e));
      document.addEventListener('touchend', () => this.handleTouchEnd());
    }

    createIndicator() {
      this.indicator = document.createElement('div');
      this.indicator.className = 'pull-to-refresh';
      this.indicator.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9 9 0 0 0-9 9"></path>
        </svg>
      `;
      document.body.appendChild(this.indicator);
    }

    handleTouchStart(e) {
      if (window.scrollY === 0) {
        this.touchStartY = e.touches[0].clientY;
        this.isPulling = true;
      }
    }

    handleTouchMove(e) {
      if (!this.isPulling) return;

      const touchY = e.touches[0].clientY;
      const pullDistance = touchY - this.touchStartY;

      if (pullDistance > 0 && pullDistance < this.threshold * 2) {
        const progress = Math.min(pullDistance / this.threshold, 1);
        this.indicator.style.top = `${pullDistance / 3}px`;
        this.indicator.style.opacity = progress;

        if (pullDistance > this.threshold) {
          this.indicator.classList.add('active');
        } else {
          this.indicator.classList.remove('active');
        }
      }
    }

    handleTouchEnd() {
      if (!this.isPulling) return;

      if (this.indicator.classList.contains('active')) {
        this.refresh();
      }

      this.indicator.style.top = '-60px';
      this.indicator.style.opacity = '0';
      this.indicator.classList.remove('active');
      this.isPulling = false;
    }

    refresh() {
      // Trigger page refresh
      window.location.reload();
    }
  }

  // ===========================
  // 6. KEYBOARD SHORTCUTS
  // ===========================

  class KeyboardShortcuts {
    constructor() {
      this.shortcuts = {
        '/': () => this.focusSearch(),
        'g h': () => this.goHome(),
        'g p': () => this.goPosts(),
        'g a': () => this.goAbout(),
        '?': () => this.showHelp()
      };
      this.lastKey = '';
      this.init();
    }

    init() {
      document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          return;
        }

        const key = e.key;
        const combo = this.lastKey + ' ' + key;

        if (this.shortcuts[combo]) {
          e.preventDefault();
          this.shortcuts[combo]();
          this.lastKey = '';
        } else if (this.shortcuts[key]) {
          e.preventDefault();
          this.shortcuts[key]();
          this.lastKey = '';
        } else {
          this.lastKey = key;

          // Clear after 1 second
          setTimeout(() => {
            this.lastKey = '';
          }, 1000);
        }
      });
    }

    focusSearch() {
      const searchInput = document.querySelector('#search-input');
      if (searchInput) {
        searchInput.focus();
      }
    }

    goHome() {
      window.location.href = '/';
    }

    goPosts() {
      window.location.href = '/posts/';
    }

    goAbout() {
      window.location.href = '/about/';
    }

    showHelp() {
      alert('Keyboard Shortcuts:\n\n' +
            '/ - Search\n' +
            'g h - Go Home\n' +
            'g p - Go to Posts\n' +
            'g a - Go to About\n' +
            '? - Show this help');
    }
  }

  // ===========================
  // 7. RESPONSIVE TABLES
  // ===========================

  class ResponsiveTables {
    constructor() {
      this.init();
    }

    init() {
      const tables = document.querySelectorAll('table');

      tables.forEach(table => {
        this.makeResponsive(table);
      });
    }

    makeResponsive(table) {
      // Wrap table for horizontal scroll
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      // Add data attributes for mobile display
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);

      table.querySelectorAll('tbody tr').forEach(row => {
        row.querySelectorAll('td').forEach((cell, index) => {
          if (headers[index]) {
            cell.setAttribute('data-label', headers[index]);
          }
        });
      });

      // Add responsive class
      table.classList.add('responsive-table');
    }
  }

  // ===========================
  // 8. LAZY LOADING ENHANCEMENTS
  // ===========================

  class LazyLoader {
    constructor() {
      this.init();
    }

    init() {
      // Native lazy loading for images
      const images = document.querySelectorAll('img[data-src]');

      if ('loading' in HTMLImageElement.prototype) {
        images.forEach(img => {
          img.loading = 'lazy';
          img.src = img.dataset.src;
        });
      } else {
        // Fallback to Intersection Observer
        const imageObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              imageObserver.unobserve(img);
            }
          });
        });

        images.forEach(img => imageObserver.observe(img));
      }
    }
  }

  // ===========================
  // INITIALIZE ALL FEATURES
  // ===========================

  document.addEventListener('DOMContentLoaded', () => {
    // Check if we should reduce motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize features
    new MobileMenu();
    new ReadingProgress();
    new CodeCopy();

    if (!prefersReducedMotion) {
      new SmoothScroll();
    }

    // Mobile-only features
    if (window.innerWidth <= 768) {
      new PullToRefresh();
    }

    // Desktop features
    if (window.innerWidth > 768) {
      new KeyboardShortcuts();
    }

    new ResponsiveTables();
    new LazyLoader();

    // Log initialization
    console.log('UI/UX enhancements initialized');
  });

})();