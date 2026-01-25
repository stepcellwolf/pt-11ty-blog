---
layout: page
title: Talks
description: List of past and upcoming talks, presentations, and panels delivered by Predrag Tasevski, in descending order.
permalink: /talks/
eleventyNavigation:
  key: Talks
  title: Talks
  order: 4
---

<div class="prose prose-lg dark:prose-invert max-w-none">
  <div class="container py-6">

  {% set current_year = "" %}

  <div class="flex-col">

    {% for talk in talks | reverse %}
      {% if talk.date %}
        {% set year = talk.date | slice(-4) %}
      {% else %}
        {% set year = "Unknown" %}
      {% endif %}

      {% if year != current_year %}
        {% if not loop.first %}
          </div> <!-- close previous year's flex row -->
        {% endif %}

        <!-- Year heading -->
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-3">
          {{ year }}
        </h2>

        <!-- Talks row for this year -->
        <div class="flex flex-wrap gap-4">
        {% set current_year = year %}
      {% endif %}

      <!-- Talk card -->
      <div class="flex-1 min-w-[250px] border dark:border-gray-700 rounded p-4">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {{ talk.title }}
        </h3>
        <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {{ talk.date }}{% if talk.location %} · {{ talk.location }}{% endif %}
        </div>
        {% if talk.description %}
        <p class="text-gray-500 dark:text-gray-400">{{ talk.description }}</p>
        {% endif %}
      </div>

      {% if loop.last %}
        </div> <!-- close last year's flex row -->
      {% endif %}
    {% endfor %}

    </div>
  </div>

</div>

<!-- CONNECT -->
<section class="mt-16">
  <h2 class="text-3xl font-bold text-center mb-8">Connect</h2>

  <div class="bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50 dark:from-green-900/20 dark:via-teal-900/20 dark:to-emerald-900/20 p-10 rounded-2xl shadow-lg border border-green-200/50 dark:border-green-800/30">

    <p class="text-lg text-gray-700 dark:text-gray-300 mb-8 text-center">
      I enjoy connecting with professionals and teams working on cloud security,
      identity & federation, compliance automation, privacy engineering, and AI security.
    </p>

    <div class="flex justify-center gap-6 mt-8">
      <a href="mailto:pece@predragtasevski.com"
        class="inline-flex items-center justify-center px-8 py-4 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all duration-200 shadow-md hover:shadow-lg min-h-[64px]">
        <span class="font-medium text-white">Email Me</span>
      </a>

      <a href="https://github.com/stepcellwolf"
        class="inline-flex items-center justify-center px-8 py-4 bg-black text-white rounded-xl hover:bg-gray-900 transition-all duration-200 shadow-md hover:shadow-lg min-h-[64px]">
        <span class="font-medium text-white">GitHub</span>
      </a>

      <a href="https://www.linkedin.com/in/tpredrag"
        class="inline-flex items-center justify-center px-8 py-4 bg-blue-700 text-white rounded-xl hover:bg-blue-800 transition-all duration-200 shadow-md hover:shadow-lg min-h-[64px]">
        <span class="font-medium text-white">LinkedIn</span>
      </a>

      <a href="https://mastodon.social/@stepcellwolf"
        class="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg min-h-[64px]">
        <span class="font-medium text-white">Mastodon</span>
      </a>
    </div>

  </div>
</section>