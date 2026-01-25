/**
 * Table of Contents Generator
 * Generates an accessible table of contents accordion for blog posts
 */

(function() {
  'use strict';

  /**
   * Initialize table of contents
   */
  function initTableOfContents() {
    // Find the ToC content container
    const tocContent = document.getElementById('toc-content');
    if (!tocContent) return;

    // Find all headings in the article
    const article = document.querySelector('article .prose');
    if (!article) return;

    // Find all headings (h2 and h3 for cleaner TOC)
    const headings = article.querySelectorAll('h2, h3');

    // Hide TOC if we don't have enough headings
    if (headings.length < 2) {
      const tocAccordion = document.querySelector('.toc-accordion');
      if (tocAccordion) {
        tocAccordion.style.display = 'none';
      }
      return;
    }

    // Create TOC list
    const tocList = document.createElement('ul');
    tocList.className = 'space-y-2';

    // Process headings and build TOC
    let currentH2Item = null;

    headings.forEach((heading, index) => {
      // Generate ID if not present
      if (!heading.id) {
        heading.id = 'heading-' + heading.textContent.toLowerCase()
          .replace(/[^\w\s-]/g, '') // Remove special chars
          .replace(/\s+/g, '-')      // Replace spaces with hyphens
          .replace(/-+/g, '-')       // Replace multiple hyphens with single
          .trim();
      }

      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent;
      link.className = 'block py-1 px-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300';
      
      if (heading.tagName === 'H2') {
        // Main section
        listItem.appendChild(link);
        tocList.appendChild(listItem);
        currentH2Item = listItem;
      } else if (heading.tagName === 'H3' && currentH2Item) {
        // Subsection - indent it
        link.className = 'block py-1 px-2 ml-4 text-sm rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300';

        // Create or get the nested list
        let nestedList = currentH2Item.querySelector('ul');
        if (!nestedList) {
          nestedList = document.createElement('ul');
          nestedList.className = 'mt-1 space-y-1';
          currentH2Item.appendChild(nestedList);
        }

        listItem.appendChild(link);
        nestedList.appendChild(listItem);
      }
    });

    // Insert TOC into the accordion content
    tocContent.appendChild(tocList);

    // Smooth scroll behavior
    tocList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').slice(1);
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          const offset = 100; // Account for sticky header
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - offset;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });

          // Close the accordion on mobile after clicking
          if (window.innerWidth < 768) {
            const details = tocContent.closest('details');
            if (details) {
              details.open = false;
            }
          }
        }
      });
    });

    // Highlight current section on scroll
    let activeHeading = null;
    const observerOptions = {
      rootMargin: '-100px 0px -66% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.id;
        const tocLink = tocList.querySelector(`a[href="#${id}"]`);

        if (entry.isIntersecting) {
          // Remove previous active states
          tocList.querySelectorAll('.text-blue-600, .dark\\:text-blue-400').forEach(link => {
            link.classList.remove('text-blue-600', 'dark:text-blue-400', 'font-semibold');
            link.classList.add('text-gray-600', 'dark:text-gray-400');
          });

          // Add active state to current link
          if (tocLink) {
            tocLink.classList.remove('text-gray-600', 'dark:text-gray-400');
            tocLink.classList.add('text-blue-600', 'dark:text-blue-400', 'font-semibold');
          }
        }
      });
    });

    // Observe all headings
    headings.forEach(heading => {
      observer.observe(heading);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTableOfContents);
  } else {
    initTableOfContents();
  }
})();