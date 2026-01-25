const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const Image = require("@11ty/eleventy-img");
const { execSync } = require('child_process');
const path = require('path');

module.exports = function(eleventyConfig) {
  // Plugins
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Image optimization shortcode with optional class parameter
  async function imageShortcode(src, alt, sizes = "(max-width: 768px) 100vw, 800px", className = "") {
    let metadata = await Image(src, {
      widths: [400, 800, 1200],
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/assets/images/optimized/",
      urlPath: "/assets/images/optimized/",
      sharpOptions: {
        quality: 85,
      }
    });

    let imageAttributes = {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
    };

    // Add class if provided
    if (className) {
      imageAttributes.class = className;
    }

    eleventyConfig.addCollection("projects", function(collectionApi) {
      return require("./_data/projects.json")
    })
    return {
      dir: {
        input: ".",
        includes: "_includes",
        data: "_data",
        output: "_site"
      }
    }

    return Image.generateHTML(metadata, imageAttributes);
  }

  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

  // Copy static files
  eleventyConfig.addPassthroughCopy("src/assets/js");
  // Copy only specific CSS files that aren't processed by PostCSS
  // main.css is built by PostCSS, tailwind.css is imported by main.css
  eleventyConfig.addPassthroughCopy("src/assets/css/theme-tokens.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/fonts.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/modern-design.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/cybersecurity-effects.css");
  eleventyConfig.addPassthroughCopy("src/assets/css/enhancements.css");
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/CNAME");
  eleventyConfig.addPassthroughCopy({ "src/.nojekyll": ".nojekyll" });
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/manifest.json");

  // Watch for changes
  eleventyConfig.addWatchTarget("src/assets/");

  // Layout aliases
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addLayoutAlias("post", "layouts/post.njk");
  eleventyConfig.addLayoutAlias("redirect", "redirect.njk");

  // Date filters
  eleventyConfig.addFilter("readableDate", dateObj => {
    return new Date(dateObj).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  eleventyConfig.addFilter("htmlDateString", dateObj => {
    return new Date(dateObj).toISOString().split('T')[0];
  });

  // Limit filter
  eleventyConfig.addFilter("limit", (array, limit) => {
    return array.slice(0, limit);
  });

  // Min filter - returns minimum value from array
  eleventyConfig.addFilter("min", (values) => {
    if (!values || !Array.isArray(values) || values.length === 0) return 0;
    return Math.min(...values);
  });

  // Split filter for stats page
  eleventyConfig.addFilter("split", (str, delimiter) => {
    if (!str) return [];
    return str.split(delimiter);
  });

  // Unique filter to get unique values from array
  eleventyConfig.addFilter("unique", (array) => {
    if (!array || !Array.isArray(array)) return [];
    return [...new Set(array)];
  });

  // toLocaleString filter for number formatting
  eleventyConfig.addFilter("toLocaleString", (num) => {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
  });

  // Reading time filter
  eleventyConfig.addFilter("readingTime", (content) => {
    if (!content) return 0;

    // Strip HTML tags and get plain text
    const plainText = content.replace(/<[^>]*>/g, '');

    // Count words (split by whitespace)
    const wordCount = plainText.split(/\s+/).filter(word => word.length > 0).length;

    // Average reading speed is 200-250 words per minute
    // Using 225 as a middle ground
    const wordsPerMinute = 225;
    const readingTime = Math.ceil(wordCount / wordsPerMinute);

    return readingTime;
  });

  // Get the newest date from a collection
  eleventyConfig.addFilter("getNewestCollectionItemDate", collection => {
    if (!collection || !collection.length) {
      return new Date();
    }
    return new Date(Math.max(...collection.map(item => item.date)));
  });

  // Normilize tags on posts
  eleventyConfig.addFilter("normalizeTag", tag =>
    tag.trim().toLowerCase()
  );

  // Convert URLs to absolute URLs for RSS
  eleventyConfig.addFilter("htmlToAbsoluteUrls", (htmlContent, base) => {
    if (!htmlContent) return '';

    // Simple regex to convert relative URLs to absolute
    return htmlContent
      .replace(/src="\/([^"]+)"/g, `src="${base}/$1"`)
      .replace(/href="\/([^"]+)"/g, `href="${base}/$1"`);
  });

  // Add rel="noopener noreferrer" to external links for security
  eleventyConfig.addFilter("externalLinks", (content) => {
    if (!content) return '';

    // Add rel attribute to external links
    return content.replace(
      /<a\s+href="https?:\/\/(?!williamzujkowski\.github\.io)[^"]+"/g,
      (match) => {
        // Check if rel attribute already exists
        if (match.includes('rel=')) {
          return match;
        }
        // Add rel attribute before the closing >
        return match + ' rel="noopener noreferrer"';
      }
    );
  });

  // Add lazy loading and responsive attributes to images
  eleventyConfig.addFilter("lazyImages", (content) => {
    if (!content) return '';

    // Add loading="lazy" and responsive classes to img tags
    return content.replace(
      /<img\s+(?![^>]*\sloading=)[^>]*>/gi,
      (match) => {
        // Skip if it's an SVG or data URI
        if (match.includes('data:') || match.includes('.svg')) {
          return match;
        }

        // Add responsive classes if not already present
        let updatedMatch = match;
        if (!match.includes('class=')) {
          updatedMatch = match.replace('<img', '<img class="max-w-full h-auto"');
        } else if (!match.includes('max-w-full')) {
          updatedMatch = match.replace(/class="([^"]*)"/, 'class="$1 max-w-full h-auto"');
        }

        // Add loading="lazy" before the closing >
        return updatedMatch.replace(/>$/, ' loading="lazy">');
      }
    );
  });

  // Get git last modified date for a file
  eleventyConfig.addFilter("gitLastModified", (inputPath) => {
    try {
      if (!inputPath) return null;

      // Remove the leading ./ and src/ if present
      let cleanPath = inputPath.replace(/^\.\//, '');
      if (cleanPath.startsWith('src/')) {
        cleanPath = cleanPath.substring(4);
      }

      // Construct the full file path
      const filePath = path.join(__dirname, 'src', cleanPath);

      // Get the last commit date for this file
      const gitCommand = `git log -1 --format=%cI -- "${filePath}"`;
      const result = execSync(gitCommand, { encoding: 'utf-8' }).trim();

      if (result) {
        return new Date(result);
      }
    } catch (error) {
      console.error(`Error getting git date for ${inputPath}:`, error.message);
    }

    return null;
  });

  // Create collection of all tags
  eleventyConfig.addCollection("tagList", function(collection) {
    let tagSet = new Set();
    collection.getAll().forEach(item => {
      (item.data.tags || []).forEach(tag => tagSet.add(tag));
    });
    // Convert to array and sort
    return [...tagSet].sort();
  });

  // Create search index collection
  eleventyConfig.addCollection("searchIndex", function(collection) {
    return collection.getFilteredByTag('posts').map(post => {
      return {
        title: post.data.title || '',
        description: post.data.description || '',
        tags: (post.data.tags || []).filter(tag => tag !== 'posts').join(' '),
        date: post.date.toISOString(),
        url: post.url,
        excerpt: post.data.description || ''
      };
    });
  });

  // Slugify filter for URLs
  eleventyConfig.addFilter("slugify", (str) => {
    if (!str) return "";
    return str.toString().toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  });

  // Override the built-in slug filter to properly handle apostrophes
  eleventyConfig.addFilter("slug", (str) => {
    if (!str) return "";
    return str.toString().toLowerCase()
      .replace(/['′'']/g, '')        // Remove apostrophes and smart quotes
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  });

  // Truncate filter
  eleventyConfig.addFilter("truncate", (str, length = 100) => {
    if (!str) return "";
    if (str.length <= length) return str;
    return str.substring(0, length).trim() + "...";
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk"
  };
};

