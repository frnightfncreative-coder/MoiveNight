/* ════════════════════════════════════════════
   MOVIE NIGHT — app.js
   All TMDB calls, sidebar, modal, search, etc.
════════════════════════════════════════════ */

'use strict';

/* ── REAL POPUP SUPPRESSOR ──────────────────────────────────────────
   window.open override only works in THIS frame.
   Iframe ads fire from their OWN frame — we can't override that.
   What we CAN do: detect the instant our window loses focus
   (= a popup just opened) and snap focus right back.
   Most ad tabs close themselves when they never get focus.      */
let _popupGuardActive = false;

function enablePopupGuard() {
  if (_popupGuardActive) return;
  _popupGuardActive = true;
  window.addEventListener('blur', _onBlur);
}
function disablePopupGuard() {
  _popupGuardActive = false;
  window.removeEventListener('blur', _onBlur);
}
function _onBlur() {
  // Tiny delay lets the browser finish opening the popup,
  // then we yank focus back immediately
  requestAnimationFrame(() => window.focus());
}

// Also kill any window.open fired from THIS frame (belt + suspenders)
window.open = () => null;

const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MGFjOTgwNWJiMDA1ZjAwMDUzNGM4OTZmZGY2YjRmNyIsIm5iZiI6MTc4OTMzNDIxMi41OTMsInN1YiI6IjZhYTcxMmM0YTVlMjIwYTkzOWE5ODRkMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.cbQ9XDPZQ_AAgsaUtY3s4Qd3OgG-xoC4RNiFEMMByIw';
const TMDB_BASE  = 'https://api.themoviedb.org/3/';
const IMG_BASE   = 'https://image.tmdb.org/t/p/';
const VIDSRC     = 'https://vidsrc.to/embed';

/* ── TMDB FETCH ── */
async function tmdb(path) {
  const r = await fetch(TMDB_BASE + path, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` }
  });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

function posterUrl(path, size = 'w342') {
  return path ? IMG_BASE + size + path : '';
}
function backdropUrl(path, size = 'w1280') {
  return path ? IMG_BASE + size + path : '';
}
function title(item) {
  return item.title || item.name || '';
}
function year(item) {
  const d = item.release_date || item.first_air_date || '';
  return d.slice(0, 4);
}
function metaLine(item) {
  const parts = [];
  if (item.vote_average > 0) parts.push('★ ' + item.vote_average.toFixed(1));
  if (year(item)) parts.push(year(item));
  parts.push(item.media_type === 'tv' || item.first_air_date ? 'TV Series' : 'Movie');
  return parts.join('  •  ');
}
function embedUrl(item) {
  const kind = item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie';
  return `${VIDSRC}/${kind}/${item.id}`;
}

/* ── DOM REFS ── */
const sidebar       = document.getElementById('sidebar');
const mainContent   = document.getElementById('mainContent');
const navItems      = document.querySelectorAll('.nav-item');
const pageTitle     = document.getElementById('pageTitle');

const searchInput   = document.getElementById('searchInput');
const searchClear   = document.getElementById('searchClear');
const searchDropdown= document.getElementById('searchDropdown');
const searchTitle   = document.getElementById('searchTitle');
const searchGrid    = document.getElementById('searchGrid');
const searchSpinner = document.getElementById('searchSpinner');

const heroBackdrop  = document.getElementById('heroBackdrop');
const heroContent   = document.getElementById('heroContent');
const rowsArea      = document.getElementById('rowsArea');
const loadingRows   = document.getElementById('loadingRows');

const modalOverlay  = document.getElementById('modalOverlay');
const modal         = document.getElementById('modal');
const modalClose    = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalPoster   = document.getElementById('modalPoster');
const modalTitle    = document.getElementById('modalTitle');
const modalMeta     = document.getElementById('modalMeta');
const modalOverview = document.getElementById('modalOverview');
const modalPlay     = document.getElementById('modalPlay');

const movieGrid     = document.getElementById('movieGrid');
const movieSpinner  = document.getElementById('movieSpinner');
const movieCat      = document.getElementById('movieCategory');
const movieSort     = document.getElementById('movieSort');
const movieMature   = document.getElementById('movieMature');
const movieGenres   = document.getElementById('movieGenres');

const tvGrid        = document.getElementById('tvGrid');
const tvSpinner     = document.getElementById('tvSpinner');
const tvCat         = document.getElementById('tvCategory');
const tvSort        = document.getElementById('tvSort');
const tvMature      = document.getElementById('tvMature');
const tvGenres      = document.getElementById('tvGenres');

const familyGrid    = document.getElementById('familyGrid');
const familySpinner = document.getElementById('familySpinner');
const familyCat     = document.getElementById('familyCategory');
const familySort    = document.getElementById('familySort');

/* ── STATE ── */
let currentTab       = 'home';
let homeLoaded       = false;
let movieGenresLoaded= false;
let tvGenresLoaded   = false;
let familyLoaded     = false;

let movieMatureOn    = false;
let tvMatureOn       = false;
let movieActiveGenres= new Set();
let tvActiveGenres   = new Set();

let suggestTimer;

/* ════════════════════════════════════
   NAVIGATION
════════════════════════════════════ */
function switchTab(tab) {
  if (currentTab === tab) return;
  currentTab = tab;

  // deactivate all
  navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === tab));
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

  const view = document.getElementById('tab-' + tab);
  if (view) view.classList.add('active');

  // page title
  const labels = { home:'Home', movies:'Movies', tv:'TV Shows', family:'Family & Kids', sports:'Sports', live:'Live TV', search:'Search' };
  pageTitle.textContent = labels[tab] || '';

  mainContent.scrollTo({ top: 0, behavior: 'smooth' });

  // lazy loads
  if (tab === 'home'   && !homeLoaded)         loadHome();
  if (tab === 'movies' && !movieGenresLoaded)  loadMovieBrowse();
  if (tab === 'tv'     && !tvGenresLoaded)     loadTvBrowse();
  if (tab === 'family' && !familyLoaded)       loadFamily();
}

navItems.forEach(item => {
  item.addEventListener('click', () => switchTab(item.dataset.tab));
});

/* ════════════════════════════════════
   HOME TAB
════════════════════════════════════ */
async function loadHome() {
  homeLoaded = true;
  try {
    const data = await tmdb('trending/all/week?language=en-US');
    const items = data.results || [];

    // Hero
    const hero = items.find(m => m.backdrop_path) || items[0];
    if (hero) renderHero(hero);

    // Rows
    loadingRows.style.display = 'none';
    const rowDefs = [
      { title: 'Trending This Week', items },
    ];

    // parallel fetches for rows
    const [popMovies, topMovies, popTv, topTv] = await Promise.allSettled([
      tmdb('movie/popular?language=en-US&page=1'),
      tmdb('movie/top_rated?language=en-US&page=1'),
      tmdb('tv/popular?language=en-US&page=1'),
      tmdb('tv/top_rated?language=en-US&page=1'),
    ]);

    const allRows = [
      { title: 'Trending This Week', items },
      { title: 'Popular Movies',     items: popMovies.value?.results || [] },
      { title: 'Top Rated Movies',   items: topMovies.value?.results || [] },
      { title: 'Popular TV Shows',   items: popTv.value?.results || [] },
      { title: 'Top Rated Shows',    items: topTv.value?.results || [] },
    ].filter(r => r.items.length > 0);

    rowsArea.innerHTML = '';
    allRows.forEach((row, i) => {
      const el = buildRow(row.title, row.items);
      el.style.animationDelay = `${i * 0.07}s`;
      rowsArea.appendChild(el);
    });

    // scroll reveal
    observeReveal();

  } catch (e) {
    console.error('Home load error', e);
  }
}

function renderHero(item) {
  heroBackdrop.style.backgroundImage = `url('${backdropUrl(item.backdrop_path)}')`;
  heroContent.innerHTML = `
    <div class="hero-title">${title(item)}</div>
    <div class="hero-meta">${metaLine(item)}</div>
    <div class="hero-overview">${item.overview || ''}</div>
    <div class="hero-actions">
      <button class="btn-primary" onclick="openModal(${JSON.stringify(item).replace(/"/g,"'")})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Watch Now
      </button>
      <button class="btn-ghost" onclick="openModal(${JSON.stringify(item).replace(/"/g,"'")})">More Info</button>
    </div>
  `;
}

function buildRow(rowTitle, items) {
  const row = document.createElement('div');
  row.className = 'content-row reveal';

  const header = document.createElement('div');
  header.className = 'row-header';
  header.textContent = rowTitle;

  const strip = document.createElement('div');
  strip.className = 'poster-row';

  items.slice(0, 20).forEach(item => {
    strip.appendChild(buildCard(item));
  });

  row.appendChild(header);
  row.appendChild(strip);
  return row;
}

/* ════════════════════════════════════
   POSTER CARD
════════════════════════════════════ */
function buildCard(item) {
  const card = document.createElement('div');
  card.className = 'poster-card';

  const pUrl = posterUrl(item.poster_path);
  const safeItem = encodeURIComponent(JSON.stringify(item));

  card.innerHTML = `
    <div class="poster-card-inner">
      ${pUrl
        ? `<img class="poster-img" src="${pUrl}" alt="${title(item)}" loading="lazy" />`
        : `<div class="poster-img" style="background:#1a1625;"></div>`
      }
      <div class="poster-overlay">
        <div class="play-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div class="poster-foot">
        <div class="poster-title">${title(item)}</div>
        <div class="poster-rating">${item.vote_average > 0 ? '★ ' + item.vote_average.toFixed(1) : ''}</div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => openModalFromData(item));
  return card;
}

function buildGridCard(item) {
  const card = buildCard(item);
  return card;
}

/* ════════════════════════════════════
   MODAL
════════════════════════════════════ */
let _currentModalItem = null;

function openModalFromData(item) {
  _currentModalItem = item;

  const pUrl = posterUrl(item.poster_path, 'w342');
  const bUrl = backdropUrl(item.backdrop_path, 'w780');

  modalBackdrop.style.backgroundImage = bUrl ? `url('${bUrl}')` : 'none';
  modalPoster.src                = pUrl || '';
  modalPoster.alt                = title(item);
  modalTitle.textContent         = title(item);
  modalMeta.textContent          = metaLine(item);
  modalOverview.textContent      = item.overview || 'No description available.';

  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// called from inline onclick in hero
window.openModal = function(item) {
  openModalFromData(item);
};

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.getElementById('playerOverlay')?.classList.contains('open')) closeModal(); });

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ════════════════════════════════════
   MOVIES BROWSE
════════════════════════════════════ */
async function loadMovieBrowse() {
  movieGenresLoaded = true;
  try {
    const genData = await tmdb('genre/movie/list?language=en-US');
    buildGenrePills(movieGenres, genData.genres, movieActiveGenres, () => fetchMovies());
  } catch(e) {}
  fetchMovies();
}

async function fetchMovies() {
  movieSpinner.classList.add('active');
  movieGrid.innerHTML = '';
  try {
    const cat     = movieCat.value;
    const sortBy  = movieSort.value;
    const genres  = [...movieActiveGenres].join(',');

    let url;
    if (!genres && !movieMatureOn && sortBy === 'popularity.desc') {
      url = `movie/${cat}?language=en-US&page=1`;
    } else {
      url = `discover/movie?language=en-US&include_adult=false&page=1&sort_by=${sortBy}`;
      if (genres)      url += `&with_genres=${genres}`;
      if (movieMatureOn) url += `&certification_country=US&certification=R`;
      if (cat === 'upcoming') url += `&primary_release_date.gte=${today()}`;
    }

    const data = await tmdb(url);
    (data.results || []).forEach(item => {
      item.media_type = 'movie';
      movieGrid.appendChild(buildGridCard(item));
    });
  } catch(e) {}
  finally { movieSpinner.classList.remove('active'); }
}

movieCat.addEventListener('change',   () => fetchMovies());
movieSort.addEventListener('change',  () => fetchMovies());
movieMature.addEventListener('click', () => {
  movieMatureOn = !movieMatureOn;
  movieMature.classList.toggle('on', movieMatureOn);
  fetchMovies();
});

/* ════════════════════════════════════
   TV BROWSE
════════════════════════════════════ */
async function loadTvBrowse() {
  tvGenresLoaded = true;
  try {
    const genData = await tmdb('genre/tv/list?language=en-US');
    buildGenrePills(tvGenres, genData.genres, tvActiveGenres, () => fetchTv());
  } catch(e) {}
  fetchTv();
}

async function fetchTv() {
  tvSpinner.classList.add('active');
  tvGrid.innerHTML = '';
  try {
    const cat    = tvCat.value;
    const sortBy = tvSort.value;
    const genres = [...tvActiveGenres].join(',');

    let url;
    if (!genres && !tvMatureOn && sortBy === 'popularity.desc') {
      url = `tv/${cat}?language=en-US&page=1`;
    } else {
      url = `discover/tv?language=en-US&include_adult=false&page=1&sort_by=${sortBy}`;
      if (genres) url += `&with_genres=${genres}`;
      if (cat === 'on_the_air') url += `&first_air_date.gte=${today()}`;
    }

    const data = await tmdb(url);
    (data.results || []).forEach(item => {
      item.media_type = 'tv';
      tvGrid.appendChild(buildGridCard(item));
    });
  } catch(e) {}
  finally { tvSpinner.classList.remove('active'); }
}

tvCat.addEventListener('change',   () => fetchTv());
tvSort.addEventListener('change',  () => fetchTv());
tvMature.addEventListener('click', () => {
  tvMatureOn = !tvMatureOn;
  tvMature.classList.toggle('on', tvMatureOn);
  fetchTv();
});

/* ════════════════════════════════════
   FAMILY BROWSE
════════════════════════════════════ */
async function loadFamily() {
  familyLoaded = true;
  familySpinner.classList.add('active');
  familyGrid.innerHTML = '';
  try {
    const cat    = familyCat.value;
    const sortBy = familySort.value;
    // Family = genre 10751
    const url = `discover/movie?language=en-US&include_adult=false&page=1&sort_by=${sortBy}&with_genres=10751`;
    const data = await tmdb(url);
    (data.results || []).forEach(item => {
      item.media_type = 'movie';
      familyGrid.appendChild(buildGridCard(item));
    });
  } catch(e) {}
  finally { familySpinner.classList.remove('active'); }
}

familyCat.addEventListener('change',  () => { familyLoaded = false; loadFamily(); });
familySort.addEventListener('change', () => { familyLoaded = false; loadFamily(); });

/* ════════════════════════════════════
   GENRE PILLS BUILDER
════════════════════════════════════ */
function buildGenrePills(container, genres, activeSet, onChange) {
  container.innerHTML = '';
  genres.forEach(g => {
    const pill = document.createElement('button');
    pill.className = 'genre-pill';
    pill.textContent = g.name;
    pill.addEventListener('click', () => {
      if (activeSet.has(g.id)) {
        activeSet.delete(g.id);
        pill.classList.remove('active');
      } else {
        activeSet.add(g.id);
        pill.classList.add('active');
      }
      onChange();
    });
    container.appendChild(pill);
  });
}

/* ════════════════════════════════════
   SEARCH
════════════════════════════════════ */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  searchClear.classList.toggle('visible', q.length > 0);
  clearTimeout(suggestTimer);
  if (q.length === 0) {
    searchDropdown.classList.remove('open');
    searchDropdown.innerHTML = '';
    return;
  }
  suggestTimer = setTimeout(() => fetchSuggestions(q), 200);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    clearTimeout(suggestTimer);
    searchDropdown.classList.remove('open');
    const q = searchInput.value.trim();
    if (q) executeSearch(q);
  }
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  searchDropdown.classList.remove('open');
  searchDropdown.innerHTML = '';
  if (currentTab === 'search') switchTab('home');
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    searchDropdown.classList.remove('open');
  }
});

async function fetchSuggestions(query) {
  try {
    const data = await tmdb('search/multi?query=' + encodeURIComponent(query) + '&language=en-US&include_adult=false&page=1');
    const items = (data.results || []).filter(r => r.media_type !== 'person').slice(0, 7);
    if (items.length === 0) { searchDropdown.classList.remove('open'); return; }

    searchDropdown.innerHTML = '';
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'suggest-item';
      div.innerHTML = `
        <span class="suggest-title">${title(item)}</span>
        <span class="suggest-meta">${metaLine(item)}</span>
      `;
      div.addEventListener('click', () => {
        searchDropdown.classList.remove('open');
        openModalFromData(item);
      });
      searchDropdown.appendChild(div);
    });
    searchDropdown.classList.add('open');
  } catch(e) {}
}

async function executeSearch(query) {
  // switch to search pseudo-tab
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  document.getElementById('tab-search').classList.add('active');
  currentTab = 'search';
  pageTitle.textContent = 'Search';
  navItems.forEach(n => n.classList.remove('active'));

  searchTitle.textContent = `Results for "${query}"`;
  searchGrid.innerHTML = '';
  searchSpinner.classList.add('active');
  mainContent.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const data = await tmdb('search/multi?query=' + encodeURIComponent(query) + '&language=en-US&include_adult=false&page=1');
    (data.results || [])
      .filter(r => r.media_type !== 'person')
      .forEach(item => searchGrid.appendChild(buildGridCard(item)));
  } catch(e) {}
  finally { searchSpinner.classList.remove('active'); }
}

/* ════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════ */
function observeReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
}

/* ════════════════════════════════════
   HELPERS
════════════════════════════════════ */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ════════════════════════════════════
   MODAL → PLAYER wiring
════════════════════════════════════ */
modalPlay.addEventListener('click', () => {
  closeModal();
  if (_currentModalItem) openPlayer(_currentModalItem);
});

/* ════════════════════════════════════
   PLAYER
════════════════════════════════════ */
const playerOverlay    = document.getElementById('playerOverlay');
const playerBack       = document.getElementById('playerBack');
const playerTopTitle   = document.getElementById('playerTopTitle');
const playerLayout     = document.getElementById('playerLayout');
const playerIframe     = document.getElementById('playerIframe');
const playerTitle      = document.getElementById('playerTitle');
const playerMeta       = document.getElementById('playerMeta');
const playerRating     = document.getElementById('playerRating');
const playerOverviewEl = document.getElementById('playerOverview');
const playerEpSection  = document.getElementById('playerEpisodeSection');
const seasonPicker     = document.getElementById('seasonPicker');
const episodeList      = document.getElementById('episodeList');
const relatedList      = document.getElementById('relatedList');
const sourceBtns       = document.getElementById('sourceBtns');
const playerTheatre    = document.getElementById('playerTheatre');
const playerFullscreen = document.getElementById('playerFullscreen');

let _playerItem   = null;
let _playerSeason = 1;
let _playerEp     = 1;
let _playerSource = 'vidsrcxyz';
let _theatreOn    = false;

// Source map — autoplay=1 means video plays immediately without user clicking inside iframe
const SOURCES = {
  'vidsrcxyz': (kind, id, s, e) => {
    if (kind === 'tv') return `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}&autoplay=1`;
    return `https://vidsrc.xyz/embed/movie?tmdb=${id}&autoplay=1`;
  },
  '2embed': (kind, id, s, e) => {
    if (kind === 'tv') return `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}&autoplay=1`;
    return `https://www.2embed.cc/embed/${id}?autoplay=1`;
  },
  'embedsu': (kind, id, s, e) => {
    if (kind === 'tv') return `https://embed.su/embed/tv/${id}/${s}/${e}?autoplay=1`;
    return `https://embed.su/embed/movie/${id}?autoplay=1`;
  },
};

function buildEmbed(item, season, ep) {
  const isTV = item.media_type === 'tv' || !!item.first_air_date;
  const kind = isTV ? 'tv' : 'movie';
  const fn = SOURCES[_playerSource] || SOURCES['vidsrcxyz'];
  return isTV ? fn(kind, item.id, season, ep) : fn(kind, item.id, null, null);
}

const playerPosterShell = document.getElementById('playerPosterShell');
const playerPosterBg    = document.getElementById('playerPosterBg');
const playerBigPlay     = document.getElementById('playerBigPlay');

// Load iframe only when user explicitly clicks play
playerBigPlay.addEventListener('click', () => {
  playerIframe.src = buildEmbed(_playerItem, _playerSeason, _playerEp);
  playerIframe.style.display = 'block';
  playerPosterShell.style.display = 'none';
});

async function openPlayer(item) {
  _playerItem   = item;
  _playerSeason = 1;
  _playerEp     = 1;

  const isTV = item.media_type === 'tv' || !!item.first_air_date;

  // populate top UI
  const t = title(item);
  playerTopTitle.textContent   = t;
  playerTitle.textContent      = t;
  playerMeta.textContent       = metaLine(item);
  playerOverviewEl.textContent = item.overview || '';
  playerRating.textContent     = item.vote_average > 0 ? '★ ' + item.vote_average.toFixed(1) : '';

  // show poster, hide iframe — user must click OUR play button first
  const bUrl = backdropUrl(item.backdrop_path, 'w1280');
  playerPosterBg.style.backgroundImage = bUrl ? `url('${bUrl}')` : 'none';
  playerPosterShell.style.display = 'flex';
  playerIframe.style.display = 'none';
  playerIframe.src = '';   // ensure no stale content

  // reset source btns
  sourceBtns.querySelectorAll('.source-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.src === _playerSource);
  });

  // TV: load seasons & first episode list
  playerEpSection.style.display = isTV ? 'block' : 'none';
  if (isTV) {
    await loadSeasons(item);
  }

  // load related
  loadRelated(item);

  // show overlay + activate popup guard
  playerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  enablePopupGuard();

  // scroll player back to top
  document.querySelector('.player-left').scrollTo(0, 0);
}

async function loadSeasons(item) {
  seasonPicker.innerHTML = '';
  episodeList.innerHTML  = '';
  try {
    const detail = await tmdb(`tv/${item.id}?language=en-US`);
    const seasons = (detail.seasons || []).filter(s => s.season_number > 0);
    seasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = s.name || `Season ${s.season_number}`;
      seasonPicker.appendChild(opt);
    });
    if (seasons.length > 0) await loadEpisodes(item, 1);
  } catch(e) {}
}

async function loadEpisodes(item, seasonNum) {
  _playerSeason = seasonNum;
  episodeList.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">Loading episodes…</div>';
  try {
    const data = await tmdb(`tv/${item.id}/season/${seasonNum}?language=en-US`);
    const eps  = (data.episodes || []).filter(e => e.episode_number > 0);
    episodeList.innerHTML = '';
    eps.forEach(ep => {
      const row = document.createElement('div');
      row.className = 'ep-item' + (ep.episode_number === _playerEp && seasonNum === _playerSeason ? ' active' : '');
      const thumb = ep.still_path ? `<img class="ep-thumb" src="${IMG_BASE}w300${ep.still_path}" alt="" loading="lazy"/>` : `<div class="ep-thumb"></div>`;
      row.innerHTML = `
        <span class="ep-number">${ep.episode_number}</span>
        ${thumb}
        <div class="ep-info">
          <div class="ep-name">${ep.name || `Episode ${ep.episode_number}`}</div>
          <div class="ep-desc">${ep.overview || ''}</div>
        </div>
        <div class="ep-play-icon">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      `;
      row.addEventListener('click', () => {
        _playerEp = ep.episode_number;
        playerIframe.src = buildEmbed(_playerItem, _playerSeason, _playerEp);
        document.querySelectorAll('.ep-item').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        // scroll player video into view
        document.querySelector('.player-left').scrollTo({ top: 0, behavior: 'smooth' });
      });
      episodeList.appendChild(row);
    });
  } catch(e) {
    episodeList.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">Could not load episodes.</div>';
  }
}

seasonPicker.addEventListener('change', () => {
  loadEpisodes(_playerItem, parseInt(seasonPicker.value));
});

/* ── SOURCE SWITCHING ── */
sourceBtns.addEventListener('click', e => {
  const btn = e.target.closest('.source-btn');
  if (!btn) return;
  _playerSource = btn.dataset.src;
  sourceBtns.querySelectorAll('.source-btn').forEach(b => b.classList.toggle('active', b === btn));
  if (_playerItem) {
    playerIframe.src = buildEmbed(_playerItem, _playerSeason, _playerEp);
  }
});

/* ── THEATRE MODE ── */
playerTheatre.addEventListener('click', () => {
  _theatreOn = !_theatreOn;
  playerLayout.classList.toggle('theatre', _theatreOn);
  playerTheatre.classList.toggle('active', _theatreOn);
});

/* ── FULLSCREEN ── */
playerFullscreen.addEventListener('click', () => {
  const shell = document.getElementById('playerVideoShell');
  if (document.fullscreenElement) {
    document.exitFullscreen();
    playerFullscreen.classList.remove('active');
  } else {
    // Try iframe first, fall back to shell
    (playerIframe.requestFullscreen || shell.requestFullscreen.bind(shell))();
    playerFullscreen.classList.add('active');
  }
});
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) playerFullscreen.classList.remove('active');
});

/* ── BACK BUTTON ── */
playerBack.addEventListener('click', closePlayer);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && playerOverlay.classList.contains('open')) closePlayer();
});

function closePlayer() {
  playerOverlay.classList.remove('open');
  document.body.style.overflow = '';
  disablePopupGuard();
  // Stop iframe by clearing src after transition
  setTimeout(() => { playerIframe.src = ''; }, 320);
}

/* ── RELATED SIDEBAR ── */
async function loadRelated(item) {
  relatedList.innerHTML = '';
  try {
    const kind = item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie';
    const data = await tmdb(`${kind}/${item.id}/similar?language=en-US&page=1`);
    const results = (data.results || []).slice(0, 12);
    results.forEach(rel => {
      rel.media_type = kind;
      const card = document.createElement('div');
      card.className = 'related-card';
      const pUrl = posterUrl(rel.poster_path, 'w185');
      card.innerHTML = `
        ${pUrl ? `<img class="related-thumb" src="${pUrl}" alt="" loading="lazy"/>` : `<div class="related-thumb"></div>`}
        <div class="related-info">
          <div class="related-title">${title(rel)}</div>
          <div class="related-meta">${metaLine(rel)}</div>
          <div class="related-play">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Watch
          </div>
        </div>
      `;
      card.addEventListener('click', () => openPlayer(rel));
      relatedList.appendChild(card);
    });
  } catch(e) {}
}



/* ════════════════════════════════════
   INIT
════════════════════════════════════ */
loadHome();
