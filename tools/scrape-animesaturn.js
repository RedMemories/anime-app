const path = require('path');
const fse = require('fs-extra');
const axios = require('axios');
const cheerio = require('cheerio');

const cfg = require('./config.json');
const root = path.join(__dirname, '..');
const publicPath = path.join(root, cfg.publicDir || 'public');
const catalogPath = path.join(root, cfg.catalogPath || 'public/catalog.json');
// Stato incrementale: tiene traccia degli epUrl già processati per ogni anime
const statePath = path.join(__dirname, 'state.json');
let state = { seen: {} };

function loadState() {
  try {
    const s = fse.readJsonSync(statePath);
    // normalizza struttura
    return s && typeof s === 'object' ? { seen: s.seen || {} } : { seen: {} };
  } catch {
    return { seen: {} };
  }
}

function saveState(s) {
  try {
    fse.outputJsonSync(statePath, s, { spaces: 2 });
  } catch {
    // ignora errori di scrittura
  }
}

// Inizializza lo stato solo se abilitato in config
if (cfg?.sourceSite?.resumeStateEnabled) {
  state = loadState();
}

function markEpSeen(animeKey, epUrl) {
  state.seen[animeKey] = state.seen[animeKey] || {};
  state.seen[animeKey][epUrl] = true;
}

function isEpSeen(animeKey, epUrl) {
  return !!(state.seen[animeKey] && state.seen[animeKey][epUrl]);
}

const AXIOS_OPTS = {
  headers: cfg.sourceSite?.headers || {},
  timeout: 20000,
  maxRedirects: 5,
  validateStatus: s => s >= 200 && s < 400
};

// Piccolo helper: retry se rate-limited (429)
async function fetchHtmlWithRateLimit(url) {
  try {
    return await fetchHtml(url);
  } catch (err) {
    const is429 = (err?.response?.status === 429) || /429/.test(String(err?.message || ''));
    if (is429) {
      console.warn(`Rate limit su ${url}. Pausa 1500ms e retry...`);
      await sleep(1500);
      return await fetchHtml(url);
    }
    throw err;
  }
}

function ensureSetup() {
  fse.ensureDirSync(publicPath);
  if (!fse.existsSync(catalogPath)) {
    fse.outputJsonSync(catalogPath, {}, { spaces: 2 });
  }
  // carica catalog in memoria
  catalog = fse.readJsonSync(catalogPath);
  // se abilitato, carica anche lo stato incrementale
  if (cfg?.sourceSite?.resumeStateEnabled) {
    state = loadState();
  }
}

function absoluteUrl(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

function extractMediaLinksFromHtml(html, baseUrl) {
  const results = [];
  const re = /(https?:\/\/[^"'\s>]+?\.(?:m3u8|mp4))(?![^<]*<\/a>)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const abs = absoluteUrl(m[1], baseUrl);
    if (abs) results.push(abs);
  }
  return Array.from(new Set(results));
}

function parseEpisodeNumber(textOrName) {
  const s = String(textOrName || '');
  const patterns = [
    /Episodio[_\s-]*(\d{1,4})/i,
    /Episode[_\s-]*(\d{1,4})/i,
    /Ep[_\s-]*(\d{1,4})/i,
    /[_\s-](\d{1,4})(\.\w+)?$/ 
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return parseInt(m[1], 10);
  }
  const m2 = s.match(/(\d{1,4})(?!.*\d)/);
  if (m2 && m2[1]) return parseInt(m2[1], 10);
  return null;
}

function animeKeyFromUrl(animeUrl) {
  const u = new URL(animeUrl);
  const parts = u.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('anime');
  const slug = idx >= 0 && parts[idx + 1] ? parts[idx + 1] : parts[parts.length - 1];
  return slug || 'unknown';
}

function updateCatalog({ animeKey, episode, hlsUrl, mp4Url, titleHint }) {
  const key = animeKey;
  const displayTitle = titleHint || decodeURIComponent(animeKey).replace(/_/g, ' ');
  if (!catalog[key]) catalog[key] = { title: displayTitle, episodes: [] };

  const existingIdx = catalog[key].episodes.findIndex(e => e.number === episode);
  const epData = {
    number: episode,
    title: `Episodio ${episode}`,
    hls: hlsUrl || (existingIdx >= 0 ? catalog[key].episodes[existingIdx].hls : null),
    mp4: mp4Url || (existingIdx >= 0 ? catalog[key].episodes[existingIdx].mp4 : null),
    directUrl: (hlsUrl || mp4Url) || (existingIdx >= 0 ? catalog[key].episodes[existingIdx].directUrl : null),
    source: 'remote'
  };

  if (existingIdx >= 0) {
    catalog[key].episodes[existingIdx] = { ...catalog[key].episodes[existingIdx], ...epData };
  } else {
    catalog[key].episodes.push(epData);
  }
  console.log(`Catalog: ${displayTitle} #${episode} -> ${hlsUrl ? 'HLS' : mp4Url ? 'MP4' : 'N/A'}`);
}

async function fetchHtml(url) {
  const res = await axios.get(url, AXIOS_OPTS);
  return res.data;
}

async function getAnimeLinks() {
  const listUrl = cfg.sourceSite?.animeListUrl;
  if (!listUrl) throw new Error('Config.sourceSite.animeListUrl mancante');
  console.log(`Leggo lista anime: ${listUrl}`);
  const html = await fetchHtml(listUrl);
  const $ = cheerio.load(html);
  const urls = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/\/anime\//i.test(href)) {
      const abs = absoluteUrl(href, listUrl);
      if (abs) urls.add(abs);
    }
  });
  console.log(`Anime trovati: ${urls.size}`);
  return Array.from(urls);
}

// Costruisce l’URL della pagina episodi in base allo stile rilevato
function buildAnimePageUrl(animeUrl, page, style) {
  const base = new URL(animeUrl);
  if (style === 'path') {
    // https://site/anime/slug/page/2 (forma comune)
    const pathname = base.pathname.replace(/\/$/, '');
    return new URL(`${pathname}/page/${page}`, base.origin).href;
  }
  // default: query ?page=2
  const u = new URL(animeUrl);
  u.searchParams.set('page', String(page));
  return u.href;
}

// Estrae gli episodi seguendo tutte le pagine della scheda anime
async function getEpisodeLinks(animeUrl) {
  // 1) Leggi pagina iniziale
  let html;
  try {
    html = await fetchHtmlWithRateLimit(animeUrl);
  } catch (err) {
    console.warn(`Impossibile leggere anime page: ${animeUrl} -> ${err.message}`);
    return [];
  }
  let $ = cheerio.load(html);

  const epSet = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/\/ep\//i.test(href)) {
      const abs = absoluteUrl(href, animeUrl);
      if (abs) epSet.add(abs);
    }
  });

  // 2) Rileva stile e numero pagine della paginazione episodi
  let style = 'query'; // 'query' (?page=) oppure 'path' (/page/N)
  let maxPages = 1;

  // Rilevamento stile
  let sawQuery = false, sawPath = false;
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const abs = absoluteUrl(href, animeUrl);
    if (!abs) return;
    try {
      const u = new URL(abs);
      const base = new URL(animeUrl);
      if (u.origin !== base.origin) return;
      if (!u.pathname.startsWith(base.pathname.replace(/\/$/, ''))) return;
      if (u.searchParams.has('page')) sawQuery = true;
      if (/\/page\/\d+/.test(u.pathname)) sawPath = true;
    } catch { /* ignore */ }
  });
  style = sawPath ? 'path' : (sawQuery ? 'query' : 'query');

  // Rilevamento maxPages (simile a getTotalPagesForLetter)
  let maxNum = 1;

  $('li.page-item .page-link').each((_, el) => {
    const n = parseInt(($(el).text() || '').replace(/\D+/g, ''), 10);
    if (Number.isFinite(n) && n > maxNum) maxNum = n;
  });

  // Fallback: massimo page da href
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const abs = absoluteUrl(href, animeUrl);
    if (!abs) return;
    try {
      const u = new URL(abs);
      const base = new URL(animeUrl);
      if (u.origin !== base.origin) return;
      if (!u.pathname.startsWith(base.pathname.replace(/\/$/, ''))) return;
      const qp = parseInt(u.searchParams.get('page') || '', 10);
      const pathPage = (u.pathname.match(/\/page\/(\d+)/) || [])[1];
      const pp = parseInt(pathPage || '', 10);
      const n = Number.isFinite(qp) ? qp : (Number.isFinite(pp) ? pp : NaN);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    } catch { /* ignore */ }
  });

  maxPages = Math.max(1, maxNum);
  const SAFE_CAP = Number(cfg.sourceSite?.maxAnimePages ?? 300);
  if (maxPages > SAFE_CAP) {
    console.warn(`Cap pagine episodi per sicurezza: rilevato=${maxPages}, cap=${SAFE_CAP}`);
    maxPages = SAFE_CAP;
  }

  // 3) Itera le pagine dalla 2 alla maxPages
  for (let page = 2; page <= maxPages; page++) {
    const pageUrl = buildAnimePageUrl(animeUrl, page, style);
    try {
      const pageHtml = await fetchHtmlWithRateLimit(pageUrl);
      $ = cheerio.load(pageHtml);
      $('a[href]').each((_, a) => {
        const href = $(a).attr('href') || '';
        if (/\/ep\//i.test(href)) {
          const abs = absoluteUrl(href, pageUrl);
          if (abs) epSet.add(abs);
        }
      });
      await sleep(300); // riduce rate-limit
    } catch (err) {
      console.warn(`Skip anime page=${pageUrl}: ${err.message}`);
      // Se la pagina non esiste o errore persistente, prova a continuare
      continue;
    }
  }

  return Array.from(epSet);
}

function decodeFileParam(fileParam, baseUrl) {
  let v = fileParam || '';
  try { v = decodeURIComponent(v); } catch {}
  try {
    const decoded = Buffer.from(v, 'base64').toString('utf-8');
    if (/^https?:\/\//i.test(decoded) || decoded.startsWith('/')) v = decoded;
  } catch {}
  const abs = absoluteUrl(v, baseUrl);
  return abs;
}

async function extractFromWatchPage(watchUrl) {
  const u = new URL(watchUrl);
  const fileParam = u.searchParams.get('file');
  const sources = new Set();
  const direct = decodeFileParam(fileParam, watchUrl);
  if (direct && /\.(m3u8|mp4)(\?|#|$)/i.test(direct)) sources.add(direct);

  try {
    const html = await fetchHtml(watchUrl);
    extractMediaLinksFromHtml(html, watchUrl).forEach(s => sources.add(s));
  } catch (err) {
    console.warn(`Impossibile leggere watch: ${watchUrl} -> ${err.message}`);
  }
  return Array.from(sources);
}

async function processEpisode(animeUrl, epUrl) {
  const animeKey = animeKeyFromUrl(animeUrl);

  if (cfg.sourceSite?.onlyNew && isEpSeen(animeKey, epUrl)) {
    return;
  }

  let epHtml;
  try { epHtml = await fetchHtml(epUrl); } catch (err) {
    console.warn(`Skip ep ${epUrl}: ${err.message}`); return;
  }
  const $ = cheerio.load(epHtml);

  let epNum = parseEpisodeNumber($('h1, h2, .title, .episode-title').first().text() || '');
  if (!epNum) epNum = parseEpisodeNumber(epUrl);

  if (epNum && cfg.sourceSite?.onlyNew && !cfg.sourceSite?.refreshMissingSources && episodeInCatalogHasSource(animeKey, epNum)) {
    markEpSeen(animeKey, epUrl);
    return;
  }

  let watchHref = null;
  $('a[href*="/watch?file="]').each((_, a) => {
    const href = $(a).attr('href');
    if (!watchHref) watchHref = absoluteUrl(href, epUrl);
  });
  if (!watchHref) {
    const mWatch = epHtml.match(/\/watch\?file=[^"'\s<>]+/i);
    if (mWatch) watchHref = absoluteUrl(mWatch[0], epUrl);
  }

  let sources = [];
  if (watchHref) sources = await extractFromWatchPage(watchHref);
  if (!sources.length) extractMediaLinksFromHtml(epHtml, epUrl).forEach(s => sources.push(s));

  sources = Array.from(new Set(sources));
  const hls = sources.find(u => /\.m3u8(\?|#|$)/i.test(u)) || null;
  const mp4 = sources.find(u => /\.mp4(\?|#|$)/i.test(u)) || null;

  if (!epNum) {
    const candidate = hls || mp4 || watchHref || epUrl;
    epNum = parseEpisodeNumber(candidate) || null;
  }

  if (epNum && cfg.sourceSite?.onlyNew && episodeInCatalogHasSource(animeKey, epNum) && !cfg.sourceSite?.refreshMissingSources) {
    markEpSeen(animeKey, epUrl);
    return;
  }

  if (epNum) {
    updateCatalog({ animeKey, episode: epNum, hlsUrl: hls, mp4Url: mp4, titleHint: animeKey });
  } else {
    console.log(`Saltato (episodio non riconosciuto): ${animeKey} -> ${epUrl}`);
  }

  if (cfg.sourceSite?.resumeStateEnabled) {
    markEpSeen(animeKey, epUrl);
    saveState(state);
  }
}

// Top-level helpers (stato/catalogo)
function episodeInCatalogHasSource(animeKey, epNum) {
  try {
    const entry = catalog[animeKey];
    if (!entry || !Array.isArray(entry.episodes)) return false;
    const ep = entry.episodes.find(e => e.number === epNum);
    if (!ep) return false;
    return !!(ep.hls || ep.mp4 || ep.directUrl);
  } catch {
    return false;
  }
}

async function main() {
  ensureSetup();
  const animeLinks = await getAnimeLinksAll();
  for (const animeUrl of animeLinks) {
    console.log(`Anime: ${animeUrl}`);
    const epLinks = await getEpisodeLinks(animeUrl);
    const animeKey = animeKeyFromUrl(animeUrl);

    const filtered = epLinks.filter(epUrl => {
      if (cfg.sourceSite?.onlyNew && isEpSeen(animeKey, epUrl)) return false;
      const numGuess = parseEpisodeNumber(epUrl);
      if (numGuess && cfg.sourceSite?.onlyNew && episodeInCatalogHasSource(animeKey, numGuess) && !cfg.sourceSite?.refreshMissingSources) {
        return false;
      }
      return true;
    });

    console.log(`  Episodi: ${epLinks.length} | da processare: ${filtered.length}`);
    for (const epUrl of filtered) {
      await processEpisode(animeUrl, epUrl);
    }
  }
  fse.outputJsonSync(catalogPath, catalog, { spaces: 2 });
  console.log('Scrape completato. Apri http://localhost:3001/catalog.json');
}

main().catch(err => {
  console.error('Errore scraping', err);
  process.exit(1);
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function makeListUrl(letter, page) {
  const u = new URL(cfg.sourceSite.animeListUrl);
  if (letter) u.searchParams.set('letter', letter);
  if (page) u.searchParams.set('page', String(page));
  return u.href;
}

async function getAnimeLinksPage(letter, page) {
  const url = makeListUrl(letter, page);
  console.log(`Leggo animelist: letter=${letter} page=${page} -> ${url}`);
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const urls = new Set();
  $('a[href]').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (/\/anime\//i.test(href)) {
      const abs = absoluteUrl(href, url);
      if (abs) urls.add(abs);
    }
  });

  let hasNext = false;
  $('a[href]').each((_, a) => {
    const abs = absoluteUrl($(a).attr('href') || '', url);
    if (!abs) return;
    try {
      const u = new URL(abs);
      if (!/\/animelist/i.test(u.pathname)) return;
      const lp = parseInt(u.searchParams.get('page') || '0', 10);
      const ll = (u.searchParams.get('letter') || '').toUpperCase();
      if (ll === String(letter).toUpperCase() && lp === (page + 1)) {
        hasNext = true;
      }
      const text = ($(a).text() || '').trim().toLowerCase();
      if ((text.includes('next') || text.includes('»')) && ll === String(letter).toUpperCase()) {
        hasNext = true;
      }
    } catch { /* ignore */ }
  });

  return { urls: Array.from(urls), hasAny: urls.size > 0, hasNext };
}

// funzione: getAnimeLinksAll()
async function getAnimeLinksAll() {
  const letters = Array.isArray(cfg.sourceSite?.letters)
    ? cfg.sourceSite.letters
    : ['0-9','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

  // DEFINISCI QUI il cap di sicurezza (errore attuale: variabile non definita)
  const defaultMaxPages = Number(cfg.sourceSite?.maxPagesPerLetter ?? 50);

  const all = new Set();
  for (const letter of letters) {
    const detected = await getTotalPagesForLetter(letter);
    let maxPages = defaultMaxPages;

    // Usa la stima anche quando è 1
    if (typeof detected === 'number' && detected >= 1) {
      maxPages = Math.min(defaultMaxPages, detected);
      console.log(`Lettera ${letter}: pagine stimate=${detected}, limite=${maxPages}`);
    } else {
      console.log(`Lettera ${letter}: pagine stimate NON disponibili, uso limite di sicurezza=${maxPages}`);
    }

    for (let page = 1; page <= maxPages; page++) {
      let data;
      try {
        data = await getAnimeLinksPage(letter, page);
      } catch (err) {
        console.warn(`Errore animelist ${letter} page=${page}: ${err.message}`);
        break;
      }
      data.urls.forEach(u => all.add(u));
      if (!data.hasAny || !data.hasNext) {
        console.log(`Stop letter=${letter} at page=${page} (hasAny=${data.hasAny}, hasNext=${data.hasNext})`);
        break;
      }
      await sleep(300);
    }
  }
  console.log(`Anime totali raccolti: ${all.size}`);
  return Array.from(all);
}

// funzione: getTotalPagesForLetter(letter)
async function getTotalPagesForLetter(letter) {
  const url = makeListUrl(letter, 1);
  console.log(`Stimo pagine: letter=${letter} -> ${url}`);
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // 0) Leggi totalPages dai <script> (inizializzazione twbsPagination)
    let totalFromScript = null;
    $('script').each((_, s) => {
      const txt = ($(s).html() || '').toString();
      if (!txt) return;
      // Cerca 'twbsPagination({ ... totalPages: N ... })' oppure 'totalPages: "N"'
      const m1 = txt.match(/twbsPagination\s*\(\s*\{[^}]*totalPages\s*:\s*([0-9]+)/i);
      const m2 = txt.match(/totalPages\s*:\s*["']?([0-9]+)["']?/i);
      const val = (m1 && m1[1]) || (m2 && m2[1]);
      if (val && Number(val) > 0) {
        totalFromScript = Math.max(totalFromScript || 0, Number(val));
      }
    });
    if (Number.isFinite(totalFromScript) && totalFromScript > 0) return totalFromScript;

    // 1) Caso principale: numero nel testo <li class="page-item last"><a class="page-link">N</a>
    const lastLink = $('li.page-item.last .page-link').first();
    const textNum = parseInt((lastLink.text() || '').replace(/\D+/g, ''), 10);
    if (Number.isFinite(textNum) && textNum > 0) return textNum;

    // 2) Fallback: massimo tra tutti i numeri in paginazione
    let maxNum = 0;
    $('li.page-item .page-link').each((_, el) => {
      const n = parseInt(($(el).text() || '').replace(/\D+/g, ''), 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    });
    if (maxNum > 0) return maxNum;

    // 3) Ultimo fallback: massimo tra gli href con ?page=
    let maxPage = 1;
    $('a[href]').each((_, a) => {
      const abs = absoluteUrl($(a).attr('href') || '', url);
      if (!abs) return;
      try {
        const u = new URL(abs);
        if (!/\/animelist/i.test(u.pathname)) return;
        const lp = parseInt(u.searchParams.get('page') || '', 10);
        if (Number.isFinite(lp) && lp > maxPage) maxPage = lp;
      } catch { /* ignore */ }
    });
    if (maxPage > 1) return maxPage;

    // 4) Nessun numero visibile lato server: lascia che 'hasNext' guidi il ciclo
    return null;
  } catch (err) {
    console.warn(`Errore stima pagine ${letter}: ${err.message}`);
    return null;
  }
}