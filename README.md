# 🎬 Movie Night — Web

A sleek, glassmorphic movie discovery web app powered by the TMDB API. Built to be hosted on **GitHub Pages** with zero backend required.

## Features

- **Collapsible sidebar** — icon-only when idle, expands with labels on hover (pushes content)
- **Transparent glassmorphic UI** — poster cards with frosted-glass overlays that blend into the dark background
- **Hero banner** — full-width scrolling backdrop for trending titles
- **Home, Movies, TV Shows, Family & Kids, Sports, Live TV** sections
- **Genre filtering** — pill-style genre toggles for Movies and TV
- **Sorting & categories** — Popular, Top Rated, Now Playing, Upcoming, etc.
- **Rated R / TV-MA toggle** — mature content filter
- **Live search with suggestions** — typeahead dropdown, full results page on Enter
- **Detail modal** — backdrop image, poster, overview, and direct Watch link
- **Scroll reveal animations** — rows fade up as you scroll
- **Skeleton loaders** — shimmer placeholders while content loads

## Live Demo

> Host on GitHub Pages → `https://<your-username>.github.io/<repo-name>/web/`

## Quick Start (GitHub Pages)

1. Fork or clone this repo
2. Go to **Settings → Pages**
3. Set source to `main` branch, folder `/web` (or root if you move files)
4. Done — your site is live!

## Folder Structure

```
web/
├── index.html   # Single-page shell
├── style.css    # All styles (glassmorphic, animations, layout)
├── app.js       # TMDB API, tab logic, search, modal
└── README.md    # This file
```

## Tech Stack

- Vanilla HTML / CSS / JavaScript — no frameworks, no build step
- [TMDB API](https://www.themoviedb.org/documentation/api) for movie & TV data
- [VidSrc](https://vidsrc.to) for streaming embeds

## API Keys

TMDB credentials are embedded in `app.js` for convenience. For production use, proxy the API through a serverless function to keep your token private.

---

*Built with 🖤 by Movie Night*
