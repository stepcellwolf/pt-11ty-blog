// Search functionality for blog posts with pagination support
(function() {
    'use strict';
    
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', async function() {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const searchClear = document.getElementById('search-clear');
        const postsContainer = document.getElementById('posts-container');
        const paginationControls = document.querySelectorAll('nav[aria-label="Pagination"]');
        
        if (!searchInput || !postsContainer) return;
        
        // Load search index
        let searchIndex = [];
        try {
            const response = await fetch('/assets/js/search-index.json');
            searchIndex = await response.json();
        } catch (error) {
            console.error('Failed to load search index:', error);
            // Fallback to current page posts
            searchIndex = Array.from(postsContainer.querySelectorAll('article[data-search]')).map(article => {
                return {
                    title: article.getAttribute('data-title') || '',
                    description: article.getAttribute('data-description') || '',
                    tags: article.getAttribute('data-tags') || '',
                    date: article.getAttribute('data-date') || '',
                    url: article.querySelector('a').getAttribute('href'),
                    excerpt: article.getAttribute('data-search') || ''
                };
            });
        }
        
        // Store original posts HTML for restoration
        const originalPostsHTML = postsContainer.innerHTML;
        
        // Search function
        function performSearch(query) {
            if (!query || query.length < 2) {
                restoreOriginalPosts();
                hideSearchResults();
                showPaginationControls();
                return;
            }
            
            const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
            const results = [];
            
            searchIndex.forEach(post => {
                const searchableText = `${post.title} ${post.description} ${post.tags} ${post.excerpt}`.toLowerCase();
                let score = 0;
                
                searchTerms.forEach(term => {
                    // Title matches are worth more
                    if (post.title.toLowerCase().includes(term)) {
                        score += 10;
                    }
                    // Description matches
                    if (post.description.toLowerCase().includes(term)) {
                        score += 5;
                    }
                    // Tag matches
                    if (post.tags.toLowerCase().includes(term)) {
                        score += 3;
                    }
                    // Content matches
                    if (post.excerpt.toLowerCase().includes(term)) {
                        score += 1;
                    }
                });
                
                if (score > 0) {
                    results.push({ post, score });
                }
            });
            
            // Sort by score
            results.sort((a, b) => b.score - a.score);
            
            // Display results
            displaySearchResults(results, query);
            hidePaginationControls();
        }
        
        // Display search results
        function displaySearchResults(results, query) {
            if (results.length === 0) {
                showNoResults(query);
                return;
            }
            
            // Create HTML for search results
            let resultsHTML = '';
            results.forEach(({ post }) => {
                const postDate = new Date(post.date);
                const formattedDate = postDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                // Calculate reading time (rough estimate)
                const wordCount = post.excerpt.split(/\s+/).length;
                const readingTime = Math.max(1, Math.ceil(wordCount / 225));
                
                const tagsHTML = post.tags ? post.tags.split(' ').map(tag => 
                    tag ? `<a href="/tags/${tag.toLowerCase().replace(/\s+/g, '-')}/" class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">${tag}</a>` : ''
                ).join(' ') : '';
                
                resultsHTML += `
                    <article class="group relative glass dark:glass-dark rounded-2xl p-8 hover-card search-highlight">
                        <div class="flex items-center space-x-3 text-sm">
                            <time datetime="${post.date}" class="font-medium text-primary-600 dark:text-primary-400">
                                ${formattedDate}
                            </time>
                            <span class="text-gray-400 dark:text-gray-600">•</span>
                            <span class="text-gray-600 dark:text-gray-400">
                                ${readingTime} min read
                            </span>
                        </div>
                        <h2 class="mt-3 text-2xl font-semibold leading-7 text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            <a href="${post.url}">
                                <span class="absolute inset-0"></span>
                                ${escapeHtml(post.title)}
                            </a>
                        </h2>
                        ${post.description ? `
                        <p class="mt-3 text-base leading-7 text-gray-600 dark:text-gray-300">
                            ${escapeHtml(post.description)}
                        </p>
                        ` : ''}
                        ${tagsHTML ? `
                        <div class="mt-4 flex flex-wrap gap-2">
                            ${tagsHTML}
                        </div>
                        ` : ''}
                        <div class="mt-4">
                            <span class="text-sm font-semibold text-primary-600 dark:text-primary-400">
                                Read more <span aria-hidden="true">→</span>
                            </span>
                        </div>
                    </article>
                `;
            });
            
            // Update posts container with search results
            postsContainer.innerHTML = resultsHTML;
            
            // Update results count
            if (searchResults) {
                searchResults.innerHTML = `
                    <div class="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                            Found <strong>${results.length}</strong> ${results.length === 1 ? 'post' : 'posts'} matching 
                            "<strong>${escapeHtml(query)}</strong>"
                        </p>
                    </div>
                `;
                searchResults.style.display = 'block';
            }
        }
        
        // Show no results message
        function showNoResults(query) {
            postsContainer.innerHTML = `
                <div class="text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">No posts found</h3>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        No posts match "<strong>${escapeHtml(query)}</strong>". Try different keywords.
                    </p>
                </div>
            `;
            
            if (searchResults) {
                searchResults.innerHTML = `
                    <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <p class="text-sm text-gray-700 dark:text-gray-300">
                            No posts found matching "<strong>${escapeHtml(query)}</strong>"
                        </p>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Try different keywords or clear the search to browse all posts
                        </p>
                    </div>
                `;
                searchResults.style.display = 'block';
            }
        }
        
        // Restore original posts
        function restoreOriginalPosts() {
            postsContainer.innerHTML = originalPostsHTML;
        }
        
        // Hide search results
        function hideSearchResults() {
            if (searchResults) {
                searchResults.style.display = 'none';
                searchResults.innerHTML = '';
            }
            if (searchClear) {
                searchClear.style.display = 'none';
            }
        }
        
        // Show/hide pagination controls
        function showPaginationControls() {
            paginationControls.forEach(nav => {
                nav.style.display = '';
            });
        }
        
        function hidePaginationControls() {
            paginationControls.forEach(nav => {
                nav.style.display = 'none';
            });
        }
        
        // Escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Debounce function
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        // Event listeners
        const debouncedSearch = debounce(performSearch, 300);
        
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim();
            debouncedSearch(query);
            
            // Show/hide clear button
            if (searchClear) {
                searchClear.style.display = query.length > 0 ? 'block' : 'none';
            }
        });
        
        // Clear search
        if (searchClear) {
            searchClear.addEventListener('click', function() {
                searchInput.value = '';
                restoreOriginalPosts();
                hideSearchResults();
                showPaginationControls();
                searchInput.focus();
            });
        }
        
        // Handle direct navigation with search query
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q') || urlParams.get('search');
        if (searchQuery) {
            searchInput.value = searchQuery;
            performSearch(searchQuery);
        }
    });
})();