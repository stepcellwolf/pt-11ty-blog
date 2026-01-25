# stepcellwolf.github.io

**Version:** 2.7.0  
**Last Updated:** 2025-08-08  
**Status:** Active  
**Type:** Personal Website

Personal website of William Zujkowski, built with [Eleventy](https://www.11ty.dev/), styled with [Tailwind CSS](https://tailwindcss.com/), and hosted on GitHub Pages. Features 44 blog posts about security, AI/ML, homelab projects, and career development. Showcases personal open-source projects and 15+ years of cybersecurity expertise. Includes tag-based navigation, search functionality, social sharing, reading progress indicator, hero images, and PWA support.

cloned from: https://github.com/williamzujkowski/williamzujkowski.github.io

> **📌 IMPORTANT:** [CLAUDE.md](CLAUDE.md) is the **AUTHORITATIVE DOCUMENTATION** for this repository.
>
> - **For Development Standards**: See [CLAUDE.md](CLAUDE.md) - Authoritative source (v3.0.0)
> - **For Content Guidelines**: See [CLAUDE.md](CLAUDE.md#content-standards)
> - **For UI/UX Standards**: See [CLAUDE.md](CLAUDE.md#ui-ux-standards)
> - **For AI Assistants**: Start with [CLAUDE.md](CLAUDE.md) then [LLM_ONBOARDING.md](docs/guides/LLM_ONBOARDING.md)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/williamzujkowski/williamzujkowski.github.io.git
cd williamzujkowski.github.io

# Install dependencies (including Tailwind CSS)
npm install

# Start development server with hot-reload
npm run serve
```

The site will be available at `http://localhost:8080/` with live CSS updates.

### Build for Production

```bash
# Build optimized CSS and site
npm run build
```

The static site will be generated in the `_site` directory with minified CSS.

### Development Commands

```bash
npm run serve        # Start dev server with CSS watching
npm run build        # Production build
npm run build:css    # Build CSS only
npm run watch:css    # Watch CSS changes
npm run validate:km  # Validate Knowledge Management standards
python scripts/update-blog-images.py  # Update blog image metadata
python scripts/generate-blog-hero-images.py  # Generate hero images
bash scripts/optimize-blog-images.sh  # Optimize images
```

## ✨ Features

- **Personal Blog**: 44 technical posts about security, AI/ML, homelab, and career development
- **Professional Pages**: Experience timeline, skills matrix, project portfolio, uses, resources, and style guide
- **Interactive Features**: Tag navigation, blog search, social sharing, related posts, reading progress
- **Dark Mode**: Automatic theme switching with manual toggle and dynamic theme-color
- **SEO Optimized**: Extended meta descriptions, structured data, git-based dates, tag pages
- **PWA Support**: Web App Manifest, installable on mobile devices
- **Responsive Design**: Mobile-first approach with Tailwind CSS and glass morphism effects
- **Fast Performance**: Static site, lazy loading, resource hints, back-to-top button
- **Accessibility**: Semantic HTML, ARIA attributes, external link security, motion preferences
- **GitHub Actions**: Automated builds and deployments to GitHub Pages

## 📁 Project Structure

```
├── src/                    # Source files
│   ├── _includes/         # Templates and layouts
│   │   └── layouts/       # Page layouts
│   ├── _data/            # Global data files
│   ├── assets/           # CSS, JS, images
│   ├── pages/            # Static pages
│   ├── posts/            # Blog posts
│   └── index.njk         # Homepage
├── _site/                # Build output (git-ignored)
├── .eleventy.js          # Eleventy configuration
├── .github/workflows/    # GitHub Actions
├── .standards/           # Development standards (submodule)
└── package.json          # Dependencies
```

## 🛠️ Technologies

- **Static Site Generator**: Eleventy 2.0
- **Templating**: Nunjucks with eleventy-navigation
- **Styling**: Tailwind CSS 3.0 with PostCSS
- **UI Features**: Dark mode, responsive design, animations
- **Typography**: Inter font with Tailwind Typography plugin
- **Hosting**: GitHub Pages
- **CI/CD**: GitHub Actions
- **Standards**: Integrated via [standards repository](https://github.com/williamzujkowski/standards)

## 📝 Content Management

### Creating a New Post

1. Create a new Markdown file in `src/posts/`
2. Add front matter:

```yaml
---
title: Your Post Title
date: 2024-01-15
description: Brief description of your post
tags: [web-development, tutorial]  # Tags create category pages
---
```

3. Write your content in Markdown
4. The post will automatically appear in the posts listing

### Adding a New Page

1. Create a new file in `src/pages/`
2. Use either Markdown (`.md`) or Nunjucks (`.njk`)
3. Set the layout, permalink, and navigation in front matter:

```yaml
---
layout: page
title: Page Title
description: Page description
permalink: /page-url/
eleventyNavigation:
  key: Page Name      # Required for navigation
  order: 5           # Optional: controls menu order
  parent: About      # Optional: creates hierarchy
---
```

## 🚀 Deployment

The site automatically deploys to GitHub Pages when changes are pushed to the `main` branch.

### Manual Deployment

1. Push changes to the `main` branch
2. GitHub Actions will build and deploy the site
3. View at https://williamzujkowski.github.io

## 🔧 Configuration

### Site Metadata

Edit `src/_data/site.json` to update:
- Site title
- Description
- Author information
- URL

### Eleventy Configuration

Modify `.eleventy.js` to:
- Add plugins (eleventy-navigation included)
- Configure collections
- Set up filters
- Adjust build settings

### Tailwind CSS Customization

Edit `tailwind.config.js` to customize:
- **Colors**: Extended primary color palette
- **Fonts**: Currently using Inter font family
- **Dark Mode**: Configured with class-based toggle
- **Plugins**: Typography and Forms plugins included

Common customizations:
```javascript
// Add custom colors
colors: {
  brand: {
    50: '#your-color',
    // ... more shades
  }
}

// Add custom fonts
fontFamily: {
  sans: ['Your-Font', ...defaultTheme.fontFamily.sans],
}
```

### CSS Architecture

- **Main CSS**: `src/assets/css/tailwind.css`
- **Components**: Custom component classes using `@layer components`
- **Utilities**: Custom utilities using `@layer utilities`
- **Dark Mode**: Automatic with `.dark` class on `<html>`

## 📚 Knowledge Management

This project implements comprehensive knowledge management:

### Documentation
- **[CLAUDE.md](CLAUDE.md)** - AI-optimized interface for assistants
- **[MANIFEST.json](MANIFEST.json)** - Repository inventory and metadata
- **[Content Guide](docs/guides/CONTENT_GUIDE.md)** - How to create content
- **[Documentation Standards](docs/standards/SITE_DOCUMENTATION_STANDARDS.md)** - Documentation guidelines

### Standards Integration

This project follows the guidelines from the [standards repository](https://github.com/williamzujkowski/standards), which is included as a submodule at `.standards/`.

Key standards applied:
- **KM** - Knowledge Management Standards (this README structure)
- **CS** - Coding Standards (via submodule)
- **TS** - Testing Standards (build verification)
- **SEC** - Security Standards (GitHub Pages model)

### For AI Assistants

Use these commands in CLAUDE.md:
- `@load content-management` - Learn about posts/pages
- `@load troubleshooting` - Debug issues
- `@summary` - Get quick overview

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Live Site**: https://williamzujkowski.github.io
- **Standards**: https://github.com/williamzujkowski/standards
- **Eleventy Docs**: https://www.11ty.dev/docs/

---

## 📸 Blog Image Management

### Automated Image Pipeline

The site includes a comprehensive image management system for blog posts:

```bash
# Full pipeline for all blog images
python scripts/update-blog-images.py && \
python scripts/generate-blog-hero-images.py && \
bash scripts/optimize-blog-images.sh
```

### Features
- **Hero Images**: Automatically generated 1200x630px images for each post
- **Responsive Variants**: Multiple sizes (1200px, 800px, 400px, 200px) for performance
- **Smart Color Schemes**: Topic-based gradients (AI/ML, Security, Cloud, etc.)
- **Accessibility**: Context-aware alt text generation
- **Optimization**: JPEG compression, WebP support ready

See [CLAUDE.md](CLAUDE.md#blog-image-standards--implementation) for complete documentation.

## 📊 Changelog

### [2.7.0] - 2025-08-08
#### Added
- Comprehensive blog image management system with automated hero image generation
- 44 blog posts total (31 new posts added) covering diverse technical topics
- Hero images for all blog posts with responsive variants (352 total images)
- Automated image optimization pipeline with three Python/Bash scripts
- Topic-based color schemes and pattern overlays for visual consistency
- Context-aware alt text generation for accessibility
- Blog image standards documentation and implementation guide
- Image metadata in frontmatter for all posts

#### Changed
- Updated CLAUDE.md with blog image standards and workflows
- Enhanced documentation with accurate post counts and features
- Improved project structure with organized image directories

#### Technical Updates
- Created update-blog-images.py for metadata management
- Created generate-blog-hero-images.py for hero image creation
- Created optimize-blog-images.sh for image optimization
- Generated 88 hero/og images with smart color schemes
- Created 264 responsive image variants

### [2.6.0] - 2025-06-26
#### Added
- PWA support with Web App Manifest and icons for mobile installation
- Dynamic tag/category pages system at /tags/[tag-name]/
- Tag index page showing all tags with post counts
- Related posts feature based on shared tags (shows 3 most relevant)
- Reading progress indicator bar for blog posts
- Back-to-top button with smooth scrolling
- Functional search on 404 page
- Resource hints (preconnect/dns-prefetch) for performance
- Five new blog posts about incident response, eBPF, DNS, vulnerability management
- Dynamic theme-color meta tags that change with dark/light mode

#### Changed
- Updated welcome post with meaningful content about building the site
- Made all tags clickable links throughout the site
- Updated post count from 8 to 13
- Enhanced lazy loading implementation
- Removed tags page from main navigation (accessible via tag clicks)

#### Technical Updates
- Added slugify and truncate filters to Eleventy config
- Created tagList collection for dynamic tag generation
- Added reading-progress.js and back-to-top.js scripts
- All new features respect prefers-reduced-motion

### [2.5.0] - 2025-06-25
#### Added
- Enhanced structured data for better SEO (Person, BlogPosting, BreadcrumbList schemas)
- Automatic lazy loading for images to improve performance
- Resource hints (preconnect, dns-prefetch) for faster font loading
- Improved accessibility with enhanced focus states and reduced motion support
- Comprehensive site metadata with social links

#### Changed
- Enhanced keyboard navigation with better focus indicators
- Updated structured data to include git-based dateModified
- Added support for users who prefer reduced motion
- Improved SEO with extended site description and keywords

### [2.4.0] - 2025-06-25
#### Changed
- Combined Experience, Skills, and Projects pages into comprehensive About page
- Improved site navigation and information architecture
- Added redirect pages from old URLs to maintain backwards compatibility
- Enhanced user experience with unified professional profile

### [2.3.0] - 2025-06-25
#### Added
- Search functionality for blog posts with real-time filtering
- Social share buttons (LinkedIn, Hacker News, Reddit, copy link)
- Style Guide page documenting the design system
- 4 new blog posts (total now 8) including local LLM deployment and security mindset
- Custom security-themed favicon
- Git-based last updated dates for all pages
- External link security with automatic rel="noopener noreferrer"
- Resources page with 86+ curated links in 8 categories
- Reading time estimates for all posts (225 words per minute)

#### Changed
- Removed all Twitter references from the site
- Updated homepage with AI interest section and Asimov quote
- Projects page now focuses on personal GitHub projects
- Skills page reorganized to highlight AI/ML and Python expertise
- Extended all meta descriptions to 150-160 characters
- Fixed GitHub Pages deployment configuration

### [3.0.0] - 2024-01-24
#### Added
- Tailwind CSS 3.0 with PostCSS pipeline
- eleventy-navigation plugin for hierarchical navigation
- Dark mode support with system preference detection
- Responsive mobile menu
- Breadcrumb navigation
- Beautiful animations and transitions
- Glass morphism UI effects
- Social sharing buttons on posts

#### Changed
- Complete UI redesign with modern aesthetics
- Migrated from vanilla CSS to Tailwind CSS
- Enhanced navigation with automatic menu generation
- Improved typography with Tailwind Typography plugin

### [2.0.0] - 2024-01-24
#### Added
- Full integration with .standards submodule router
- Standards implementation checklist
- Applied standards: FE, WD, SEO, CONT, GH, TOOL
- Enhanced CLAUDE.md with standards commands

### [1.0.0] - 2024-01-24
#### Added
- Initial Eleventy site setup
- Knowledge Management Standards implementation
- CLAUDE.md AI interface
- MANIFEST.json metadata
- GitHub Actions CI/CD
- Documentation structure

---

**Note:** This README follows Knowledge Management Standards v1.0.0. For detailed documentation navigation, consult [CLAUDE.md](CLAUDE.md).