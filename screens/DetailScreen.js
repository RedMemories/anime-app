import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailScreen({ route, navigation }) {
  const { anime } = route.params;
  const [showEpisodes, setShowEpisodes] = useState(false);
  // RIMOSSO: const [showEpisodesModal, setShowEpisodesModal] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [episodesPage, setEpisodesPage] = useState(1);
  const [episodesHasNextPage, setEpisodesHasNextPage] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const CATALOG_URL = 'https://raw.githubusercontent.com/RedMemories/anime-app/master/public/catalog.json';
  
  const [catalog, setCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  
  const loadCatalog = async () => {
    setCatalogLoading(true);
    try {
      const res = await fetch(`${CATALOG_URL}?t=${Date.now()}`);
      const body = await res.text();
      try {
        const json = JSON.parse(body);
        setCatalog(json);
      } catch (parseErr) {
        console.warn(
          'catalog.json parse failed',
          { status: res.status, contentType: res.headers.get('content-type') }
        );
        console.warn('head:', body.slice(0, 200)); 
      }
    } catch (e) {
      console.warn('fetch catalog.json failed', e);
    } finally {
      setCatalogLoading(false);
    }
  };
  
  useEffect(() => {
    loadCatalog();
  }, []);

  const PREFERRED_AUDIO_LANG = 'ita';
  const PREFER_DUBBED = true;

  const slug = (s) => (s || '').toLowerCase().replace(/[\W_]+/g, '');

  const detectVersion = (s) => {
    const v = (s || '').toLowerCase();
    const isSubbed = v.includes('sub') || v.includes('hardsub');
    const isDubbed = !isSubbed && (v.includes('dub') || v.includes('doppi') || (v.includes('ita') && !isSubbed));
    let audioLang = null;
    if (isDubbed) {
      if (v.includes('ita')) audioLang = 'ita';
      else if (v.includes('eng')) audioLang = 'eng';
      else if (v.includes('jpn') || v.includes('jp')) audioLang = 'ja';
    }
    const subLangs = [];
    if (isSubbed) {
      if (v.includes('ita')) subLangs.push('ita');
      if (v.includes('eng')) subLangs.push('eng');
    }
    return { isDubbed, isSubbed, audioLang, subLangs };
  };

  const scoreVersion = (version) => {
    let score = 0;
    if (PREFER_DUBBED) {
      if (version.isDubbed) score += 10;
      if (version.isSubbed) score -= 2;
    } else {
      if (version.isSubbed) score += 5;
      if (version.isDubbed) score -= 1;
    }
    if (PREFERRED_AUDIO_LANG && version.audioLang === PREFERRED_AUDIO_LANG) score += 3;
    if (PREFERRED_AUDIO_LANG && version.subLangs?.includes(PREFERRED_AUDIO_LANG)) score += 2;
    return score;
  };

  const scoreKey = (key) => scoreVersion(detectVersion(key));
  const scoreUrl = (url) => scoreVersion(detectVersion(url));

  const findUrlInCatalog = (animeObj, epNumber) => {
    if (!catalog) return null;
    const candidates = [
      slug(animeObj?.title),
      slug(animeObj?.title_english),
      slug(animeObj?.title_japanese),
    ].filter(Boolean);

    // Trova tutte le chiavi compatibili
    const matched = Object.entries(catalog).filter(([key]) => {
      const keySlug = slug(key);
      return candidates.some(s => keySlug === s || keySlug.includes(s) || s.includes(keySlug));
    });
    if (matched.length === 0) return null;

    // Ordina le chiavi in base alla preferenza (doppiato ITA > sub ITA > altro)
    matched.sort((a, b) => scoreKey(b[0]) - scoreKey(a[0]));
    const [, entry] = matched[0];

    // Cerca l’episodio
    const ep = (entry.episodes || []).find(e => e.number === epNumber);
    if (!ep) return null;

    // Seleziona la migliore tra hls/mp4/directUrl
    const sources = [ep.hls, ep.mp4, ep.directUrl].filter(Boolean);
    if (sources.length === 0) return null;
    sources.sort((u1, u2) => scoreUrl(u2) - scoreUrl(u1));
    return sources[0];
  };

  const fetchEpisodes = async (page = 1) => {
    if (!anime?.mal_id) return;
    try {
      setEpisodesLoading(true);
      const res = await fetch(`https://api.jikan.moe/v4/anime/${anime.mal_id}/episodes?page=${page}`);
      const json = await res.json();
      const epList = Array.isArray(json?.data) ? json.data : [];
      setEpisodes(prev => page === 1 ? epList : [...prev, ...epList]);
      setEpisodesHasNextPage(!!json?.pagination?.has_next_page);
      setEpisodesPage(page);
    } catch (e) {
      console.error('Errore episodi Jikan', e);
    } finally {
      setEpisodesLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes(1);
  }, [anime?.mal_id]);
  

  const getPlayable = (a) => {
    const epUrl = Array.isArray(a?.episodes) ? a.episodes.find(e => typeof e?.url === 'string')?.url : null;
    const stream = typeof a?.streamUrl === 'string' ? a.streamUrl : null;
    const direct = typeof a?.videoUrl === 'string' ? a.videoUrl : null;
    const fromSources = Array.isArray(a?.sources) ? a.sources.find(s => typeof s?.url === 'string')?.url : null;

    const url =
      epUrl ||
      stream ||
      direct ||
      fromSources ||
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

    return { type: 'video', url };
  };

  const imageUrl = anime?.images?.webp?.large_image_url
    || anime?.images?.jpg?.large_image_url
    || anime?.images?.jpg?.image_url
    || 'https://via.placeholder.com/1200x700?text=Anime';

  const sanitizeSynopsis = (text) => {
    if (!text) return '';
    return text
      .replace(/(^|\n)\s*Source:\s*.*(?=\n|$)/gmi, '')
      .replace(/\bMAL Rewrite\b/gmi, '')
      .replace(/(^|\n)\s*Written by\s*.*(?=\n|$)/gmi, '')
      .replace(/\[(?:\s*)?(?:Written by|Source)(?::)?[^\]]*\]/gmi, '')
      .replace(/\((?:\s*)?(?:Written by|Source)(?::)?[^)]*\)/gmi, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  const cleanSynopsis = sanitizeSynopsis(anime?.synopsis) || 'Nessuna descrizione disponibile.';
  const playable = getPlayable(anime);
  const isLongSynopsis = (cleanSynopsis || '').length > 220;

  return (
    <ScrollView style={styles.container}>
      {/* HERO con immagine sfocata + overlay + contenuto */}
      <View style={styles.hero}>
        <Image source={{ uri: imageUrl }} style={styles.heroImage} blurRadius={3} />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle} numberOfLines={2}>{anime.title}</Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {(anime.type || 'Anime')} • {(anime.episodes || '?')} ep • ★ {anime.score ?? 'N/A'}
          </Text>

          <View style={styles.heroChips}>
            {(anime.genres || []).slice(0, 3).map((g) => (
              <View key={`genre-${g?.name}`} style={styles.chip}>
                <Text style={styles.chipText}>{g?.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Descrizione */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Descrizione</Text>
        <Text style={styles.text} numberOfLines={descExpanded ? undefined : 6}>
          {cleanSynopsis}
        </Text>
        {isLongSynopsis && (
          <TouchableOpacity style={styles.readMoreBtn} onPress={() => setDescExpanded(!descExpanded)}>
            <Text style={styles.readMoreText}>
              {descExpanded ? 'Mostra meno' : 'Leggi di più'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Episodi sempre visibili (inline) */}
      <Text style={styles.sectionLabel}>Episodi</Text>
      {episodesLoading && episodes.length === 0 ? (
        <ActivityIndicator color="#fff" size="large" />
      ) : episodes.length === 0 ? (
        <Text style={styles.text}>Nessun episodio disponibile.</Text>
      ) : (
        <View style={styles.episodesList}>
          {episodes.map((ep, idx) => (
            <TouchableOpacity
              key={`${anime.mal_id}-ep-${ep.mal_id || idx}`}
              style={styles.episodeItem}
              onPress={() => {
                const num = ep?.mal_id ?? ep?.number ?? (idx + 1);
                const urlFromCatalog = findUrlInCatalog(anime, num);
                const videoUrl = urlFromCatalog || ep?.url || playable.url;
                const epTitle = ep?.title || `Episodio ${num}`;
                navigation.navigate('Player', {
                  videoUrl,
                  type: 'video',
                  title: `${anime.title} - ${epTitle}`,
                  posterUrl: imageUrl,
                  animeId: anime.mal_id,
                });
              }}
            >
              <View style={styles.episodeLeft}>
                <Text style={styles.episodeNumber}>{ep?.mal_id ? `#${ep.mal_id}` : `Ep ${idx + 1}`}</Text>
              </View>
              <View style={styles.episodeRight}>
                <Text style={styles.episodeTitle} numberOfLines={1}>
                  {ep?.title || `Episodio ${ep?.mal_id || (idx + 1)}`}
                </Text>
                {!!ep?.aired && (
                  <Text style={styles.episodeMeta}>
                    {new Date(ep.aired).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}

          {episodesHasNextPage && (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => fetchEpisodes(episodesPage + 1)}
            >
              <Text style={styles.loadMoreText}>
                {episodesLoading ? 'Carico...' : 'Carica altri'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* RIMOSSO: Modal episodi */}
      {/* <Modal visible={showEpisodesModal} ...> ... </Modal> */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingHorizontal: 10 },

  // Hero moderno
  hero: { height: 300, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  heroContent: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  heroMeta: { color: '#ddd', fontSize: 12, marginTop: 4 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 6, marginBottom: 6 },
  chipText: { color: '#fff', fontSize: 12 },
  heroActions: { flexDirection: 'row', marginTop: 10 },

  // CTA uniformi con HomeScreen
  ctaPrimary: { backgroundColor: '#ff5722', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, marginRight: 10 },
  ctaPrimaryText: { color: '#fff', fontWeight: 'bold' },
  ctaSecondary: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  ctaSecondaryText: { color: '#fff' },

  // Sezioni
  section: { marginBottom: 16, paddingHorizontal: 2 },
  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4, marginBottom: 6 },
  text: { color: '#ccc', fontSize: 16, lineHeight: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#222' },
  toggleText: { color: '#fff' },

  // Episodi
  episodesList: { marginBottom: 12 },
  episodeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#222', borderRadius: 8, marginBottom: 6 },
  episodeLeft: { width: 60, alignItems: 'center', justifyContent: 'center' },
  episodeNumber: { color: '#ff5722', fontWeight: 'bold' },
  episodeRight: { flex: 1 },
  episodeTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  episodeMeta: { color: '#aaa', fontSize: 12, marginTop: 2 },
  loadMoreBtn: { alignSelf: 'center', backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 6 },
  loadMoreText: { color: '#fff' },
  readMoreBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#222',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8
  },
  readMoreText: { color: '#fff' },
});

