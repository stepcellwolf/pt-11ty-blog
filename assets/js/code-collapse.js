/**
 * Collapsible Code Blocks
 * Makes long code blocks collapsible with a smooth expand/collapse animation
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    maxVisibleLines: 20,          // Show first 20 lines when collapsed
    minLinesForCollapse: 30,      // Only make collapsible if more than 30 lines
    animationDuration: 300,       // Animation duration in ms
    lineHeight: 24                // Approximate line height in pixels
  };

  /**
   * Initialize collapsible code blocks on page load
   */
  function initCollapsibleCodeBlocks() {
    // Find all code blocks in prose content that haven't been processed yet
    const codeBlocks = document.querySelectorAll('.prose pre:not([data-processed])');
    
    codeBlocks.forEach(block => {
      const codeElement = block.querySelector('code');
      if (!codeElement) return;

      // Mark as processed to prevent duplicate processing
      block.setAttribute('data-processed', 'true');

      // Skip Mermaid diagrams - they should not be collapsible
      if (codeElement.classList.contains('language-mermaid')) {
        return;
      }

      // Skip if marked as mermaid
      if (block.hasAttribute('data-mermaid') || block.classList.contains('mermaid-pre')) {
        return;
      }

      // Skip if this is actually a Mermaid div that was already converted
      if (block.parentElement && (block.parentElement.classList.contains('mermaid') || block.parentElement.hasAttribute('data-mermaid'))) {
        return;
      }

      // Skip if already in a wrapper (already processed)
      if (block.parentElement && block.parentElement.classList.contains('code-block-container')) {
        return;
      }

      // Calculate number of lines
      const text = codeElement.textContent || '';
      const lines = text.split('\n');
      const lineCount = lines.length;

      // Only make collapsible if it exceeds threshold
      if (lineCount > CONFIG.minLinesForCollapse) {
        makeCollapsible(block, lineCount);
      }
    });
  }

  /**
   * Make a code block collapsible
   */
  function makeCollapsible(preElement, lineCount) {
    // Create wrapper container
    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-wrapper relative';
    
    // Create inner container for the code
    const innerContainer = document.createElement('div');
    innerContainer.className = 'code-block-container';
    innerContainer.style.position = 'relative';
    
    // Wrap the pre element
    preElement.parentNode.insertBefore(wrapper, preElement);
    wrapper.appendChild(innerContainer);
    innerContainer.appendChild(preElement);

    // Calculate collapsed height (for smooth animation)
    const collapsedHeight = CONFIG.maxVisibleLines * CONFIG.lineHeight;
    
    // Add collapsed state by default
    innerContainer.style.maxHeight = `${collapsedHeight}px`;
    innerContainer.style.overflow = 'hidden';
    innerContainer.style.transition = `max-height ${CONFIG.animationDuration}ms ease-in-out`;
    
    // Add gradient overlay for collapsed state
    const gradient = document.createElement('div');
    gradient.className = 'code-gradient-overlay';
    gradient.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: linear-gradient(transparent, rgba(17, 24, 39, 0.9));
      pointer-events: none;
      transition: opacity ${CONFIG.animationDuration}ms ease-in-out;
      z-index: 1;
    `;
    innerContainer.appendChild(gradient);

    // Create expand/collapse button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'code-toggle-btn';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Toggle code block');
    
    // Button styling
    toggleBtn.style.cssText = `
      position: absolute;
      bottom: 10px;
      right: 10px;
      z-index: 2;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    // Add hover effect
    toggleBtn.addEventListener('mouseenter', () => {
      toggleBtn.style.background = 'rgba(37, 99, 235, 0.95)';
      toggleBtn.style.transform = 'translateY(-2px)';
    });

    toggleBtn.addEventListener('mouseleave', () => {
      toggleBtn.style.background = 'rgba(59, 130, 246, 0.9)';
      toggleBtn.style.transform = 'translateY(0)';
    });

    // Button content with icon
    const updateButtonContent = (expanded) => {
      const icon = expanded ? '▲' : '▼';
      const text = expanded ? 'Collapse' : `Expand (${lineCount} lines)`;
      toggleBtn.innerHTML = `<span>${icon}</span><span>${text}</span>`;
    };

    updateButtonContent(false);
    innerContainer.appendChild(toggleBtn);

    // Add line counter badge
    const lineCounter = document.createElement('div');
    lineCounter.className = 'code-line-counter';
    lineCounter.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.5);
      color: rgba(255, 255, 255, 0.7);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      backdrop-filter: blur(4px);
    `;
    lineCounter.textContent = `${lineCount} lines`;
    innerContainer.appendChild(lineCounter);

    // Track expanded state
    let isExpanded = false;

    // Toggle functionality
    toggleBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      
      if (isExpanded) {
        // Expand
        const fullHeight = preElement.scrollHeight + 40; // Add some padding
        innerContainer.style.maxHeight = `${fullHeight}px`;
        gradient.style.opacity = '0';
        toggleBtn.setAttribute('aria-expanded', 'true');
        
        // Move button to bottom after expansion
        setTimeout(() => {
          toggleBtn.style.position = 'sticky';
          toggleBtn.style.bottom = '10px';
        }, CONFIG.animationDuration);
      } else {
        // Collapse
        toggleBtn.style.position = 'absolute';
        innerContainer.style.maxHeight = `${collapsedHeight}px`;
        gradient.style.opacity = '1';
        toggleBtn.setAttribute('aria-expanded', 'false');
        
        // Scroll to code block if it's above viewport
        const rect = wrapper.getBoundingClientRect();
        if (rect.top < 0) {
          wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      
      updateButtonContent(isExpanded);
    });

    // Add keyboard support
    toggleBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleBtn.click();
      }
    });
  }

  /**
   * Add copy button and language labels to all code blocks
   */
  function addCopyButtons() {
    const codeBlocks = document.querySelectorAll('.prose pre:not([data-copy-processed])');
    
    codeBlocks.forEach(block => {
      // Mark as processed
      block.setAttribute('data-copy-processed', 'true');
      
      // Skip if already has a copy button
      if (block.querySelector('.code-copy-btn')) return;
      
      const codeElement = block.querySelector('code');
      if (!codeElement) return;

      // Skip Mermaid diagrams - they don't need copy buttons
      if (codeElement.classList.contains('language-mermaid')) {
        return;
      }

      // Skip if marked as mermaid
      if (block.hasAttribute('data-mermaid') || block.classList.contains('mermaid-pre')) {
        return;
      }

      // Skip if this is actually a Mermaid div
      if (block.parentElement && (block.parentElement.classList.contains('mermaid') || block.parentElement.hasAttribute('data-mermaid'))) {
        return;
      }

      // Extract language from class name
      let language = null;
      const classes = codeElement.className.split(' ');
      for (const cls of classes) {
        if (cls.startsWith('language-')) {
          language = cls.replace('language-', '');
          break;
        }
      }

      // Map common language names to display names
      const languageMap = {
        'js': 'JavaScript',
        'javascript': 'JavaScript',
        'ts': 'TypeScript',
        'typescript': 'TypeScript',
        'py': 'Python',
        'python': 'Python',
        'bash': 'Bash',
        'sh': 'Shell',
        'shell': 'Shell',
        'html': 'HTML',
        'css': 'CSS',
        'scss': 'SCSS',
        'json': 'JSON',
        'yaml': 'YAML',
        'yml': 'YAML',
        'xml': 'XML',
        'sql': 'SQL',
        'go': 'Go',
        'rust': 'Rust',
        'java': 'Java',
        'c': 'C',
        'cpp': 'C++',
        'csharp': 'C#',
        'php': 'PHP',
        'ruby': 'Ruby',
        'swift': 'Swift',
        'kotlin': 'Kotlin',
        'r': 'R',
        'dockerfile': 'Dockerfile',
        'makefile': 'Makefile',
        'nginx': 'Nginx',
        'apache': 'Apache',
        'toml': 'TOML',
        'ini': 'INI',
        'markdown': 'Markdown',
        'md': 'Markdown',
        'plaintext': 'Text',
        'text': 'Text'
      };

      // Add language label if detected
      if (language && language !== 'nohighlight') {
        const displayLanguage = languageMap[language.toLowerCase()] || language.charAt(0).toUpperCase() + language.slice(1);
        
        const langLabel = document.createElement('div');
        langLabel.className = 'code-language-label';
        langLabel.style.cssText = `
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(99, 102, 241, 0.15);
          color: rgba(99, 102, 241, 0.9);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 600;
          font-family: monospace;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          z-index: 2;
          pointer-events: none;
        `;
        langLabel.textContent = displayLanguage;
        block.appendChild(langLabel);
      }

      // Create copy button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.setAttribute('aria-label', 'Copy code');
      copyBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(75, 85, 99, 0.8);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 3;
      `;
      copyBtn.textContent = 'Copy';

      // Ensure parent has relative positioning
      block.style.position = 'relative';

      // Copy functionality
      copyBtn.addEventListener('click', async () => {
        const text = codeElement.textContent || '';
        
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = 'Copied!';
          copyBtn.style.background = 'rgba(34, 197, 94, 0.8)';
          
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.style.background = 'rgba(75, 85, 99, 0.8)';
          }, 2000);
        } catch (err) {
          copyBtn.textContent = 'Failed';
          copyBtn.style.background = 'rgba(239, 68, 68, 0.8)';
          
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.style.background = 'rgba(75, 85, 99, 0.8)';
          }, 2000);
        }
      });

      // Add hover effect
      copyBtn.addEventListener('mouseenter', () => {
        if (copyBtn.textContent === 'Copy') {
          copyBtn.style.background = 'rgba(55, 65, 81, 0.9)';
        }
      });

      copyBtn.addEventListener('mouseleave', () => {
        if (copyBtn.textContent === 'Copy') {
          copyBtn.style.background = 'rgba(75, 85, 99, 0.8)';
        }
      });

      block.appendChild(copyBtn);
    });
  }

  /**
   * Initialize when DOM is ready
   */
  // Export functions globally
  window.initCollapsibleCodeBlocks = initCollapsibleCodeBlocks;
  window.addCopyButtons = addCopyButtons;
  
  // Check if already initialized to prevent duplicate runs
  if (!window.codeCollapseInitialized) {
    window.codeCollapseInitialized = true;
    
    // Always initialize when this script loads
    // By the time this script is loaded dynamically, Mermaid has already processed its blocks
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initCollapsibleCodeBlocks();
        addCopyButtons();
      });
    } else {
      // DOM is already loaded, initialize immediately
      initCollapsibleCodeBlocks();
      addCopyButtons();
    }

    // Re-initialize on dynamic content changes (if using a SPA or dynamic content loading)
    window.addEventListener('codeBlocksUpdated', () => {
      initCollapsibleCodeBlocks();
      addCopyButtons();
    });
  }
})();