import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailScreen({ route, navigation }) {
  const { anime } = route.params;
  const [showEpisodes, setShowEpisodes] = useState(false);
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

  const [preferredAudioLang, setPreferredAudioLang] = useState('ita');
  const [preferDubbed, setPreferDubbed] = useState(false);
  const [hasDubIta, setHasDubIta] = useState(false);

  useEffect(() => {
    if (!catalog || !anime) {
      setHasDubIta(false);
      return;
    }
    const candidates = [
      slug(anime?.title),
      slug(anime?.title_english),
      slug(anime?.title_japanese),
    ].filter(Boolean);

    const matchedStrict = Object.entries(catalog).filter(([key]) => {
      const baseSlug = keyBaseSlug(key);
      return candidates.some((s) => baseSlug === s);
    });

    const hasDub = matchedStrict.some(([key]) => isDubKey(key));
    setHasDubIta(hasDub);
    if (!hasDub) setPreferDubbed(false);
  }, [catalog, anime]);
  const slug = (s) => (s || '').toLowerCase().replace(/[\W_]+/g, '');

  const isSubKey = (s) => ((s || '').toLowerCase().includes('_sub_ita'));
  const isDubKey = (s) => {
    const v = (s || '').toLowerCase();
    return (v.includes('_ita') || v.includes('-ita')) && !v.includes('_sub_ita');
  };

  // Aggiunto: marker SUB per detectVersion e fallback
  const hasSubItaMarker = (s) => {
    const v = (s || '').toLowerCase();
    return v.includes('_sub_ita') || /\bsub\b/.test(v) || /\bsottotitol\w*\b/.test(v);
  };

  // Estendo la normalizzazione per rimuovere '-aa' / '_aa' oltre ai marker ITA
  const stripKeyMarkers = (s) => (s || '')
    .replace(/(_sub_ita|_ita|-ita|-aa|_aa)/ig, '');
  const keyBaseSlug = (s) => slug(stripKeyMarkers(s));

  const detectVersion = (s) => {
    const v = (s || '').toLowerCase();
    const hasIta = v.includes('ita');
    const isSubbed = hasSubItaMarker(v);
    const dubHints = v.includes('dub') || v.includes('doppi') || v.includes('doppiat') || v.includes('-ita');
    const isDubbed = !isSubbed && (dubHints || (hasIta && !isSubbed));

    let audioLang = null;
    if (isDubbed) {
      if (hasIta) audioLang = 'ita';
      else if (v.includes('eng')) audioLang = 'eng';
      else if (v.includes('jpn') || v.includes('jp')) audioLang = 'ja';
    }

    const subLangs = [];
    if (isSubbed) {
      if (hasIta) subLangs.push('ita');
      if (v.includes('eng')) subLangs.push('eng');
    }

    return { isDubbed, isSubbed, audioLang, subLangs };
  };

  const scoreVersion = (version) => {
    let score = 0;
    if (preferDubbed) {
      if (version.isDubbed) score += 10;
      if (version.isSubbed) score -= 3;
      if (preferredAudioLang && version.audioLang === preferredAudioLang) score += 4;
      if (preferredAudioLang && version.subLangs?.includes(preferredAudioLang)) score += 1;
    } else {
      if (version.isSubbed) score += 10;
      if (version.isDubbed) score -= 2;
      if (preferredAudioLang && version.subLangs?.includes(preferredAudioLang)) score += 4;
    }
    return score;
  };

  const scoreKey = (key) => scoreVersion(detectVersion(key));
  const scoreUrl = (url) => scoreVersion(detectVersion(url));

  const computeTitleMatchScore = (key, candidates) => {
    const ks = slug(key);
    let best = 0;
    let bestDiff = 9999;
    candidates.forEach((c) => {
      const cs = slug(c);
      let s = 0;
      if (ks === cs) s = 3;
      else if (ks.startsWith(cs) || cs.startsWith(ks)) s = 2;
      else if (ks.includes(cs) || cs.includes(ks)) s = 1;
      const diff = Math.abs(ks.length - cs.length);
      if (s > best) {
        best = s;
        bestDiff = diff;
      } else if (s === best) {
        bestDiff = Math.min(bestDiff, diff);
      }
    });
    return best * 10 - Math.min(bestDiff, 9);
  };

  const findUrlInCatalog = (animeObj, epNumber) => {
    if (!catalog) return null;
    const candidates = [
      slug(animeObj?.title),
      slug(animeObj?.title_english),
      slug(animeObj?.title_japanese),
    ].filter(Boolean);
  
    const matched = Object.entries(catalog).filter(([key]) => {
      const baseSlug = keyBaseSlug(key);
      return candidates.some((s) => baseSlug === s);
    });
    if (matched.length === 0) return null;
  
    const dubKeys = matched.filter(([key]) => isDubKey(key));
    const subKeys = matched.filter(([key]) => isSubKey(key));
    const pool = preferDubbed ? (dubKeys.length ? dubKeys : matched) : (subKeys.length ? subKeys : matched);
  
    pool.sort((a, b) => {
      const aTitle = computeTitleMatchScore(a[0], candidates);
      const bTitle = computeTitleMatchScore(b[0], candidates);
      if (bTitle !== aTitle) return bTitle - aTitle;
      return 0;
    });
  
    const [, entry] = pool[0];
    const ep = (entry.episodes || []).find(e => e.number === epNumber);
    if (!ep) return null;
  
    if (preferDubbed) {
      return ep.mp4 || ep.hls || ep.directUrl || null;
    } else {
      return ep.hls || ep.mp4 || ep.directUrl || null;
    }
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

  const getFallbackCatalogEpisodes = (animeObj) => {
    if (!catalog) return [];
  
    const candidates = [
      slug(animeObj?.title),
      slug(animeObj?.title_english),
      slug(animeObj?.title_japanese),
    ].filter(Boolean);
  
    const matched = Object.entries(catalog).filter(([key]) => {
      const baseSlug = keyBaseSlug(key);
      return candidates.some(s => baseSlug === s);
    });
    if (matched.length === 0) return [];
  
    // Filtra usando i marker
    const dubKeys = matched.filter(([key]) => isDubKey(key));
    const subKeys = matched.filter(([key]) => isSubKey(key));
    const pool = preferDubbed ? (dubKeys.length ? dubKeys : matched) : (subKeys.length ? subKeys : matched);
  
    pool.sort((a, b) => {
      const aTitle = computeTitleMatchScore(a[0], candidates);
      const bTitle = computeTitleMatchScore(b[0], candidates);
      return bTitle - aTitle;
    });
  
    const [, entry] = pool[0] || [];
    const eps = Array.isArray(entry?.episodes) ? entry.episodes : [];
    const pickUrl = (ep) =>
      preferDubbed ? (ep.mp4 || ep.hls || ep.directUrl || null) : (ep.hls || ep.mp4 || ep.directUrl || null);
  
    return eps
      .map((ep, idx) => ({
        number: typeof ep.number === 'number' ? ep.number : (idx + 1),
        title: ep.title || null,
        url: pickUrl(ep),
      }))
      .filter((e) => typeof e.url === 'string');
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

      {/* Header Episodi con toggle SUB/DUB ITA (DUB nascosto se non disponibile) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Episodi</Text>
        <View style={styles.toggleGroup}>
          {hasDubIta && (
            <TouchableOpacity
              style={[styles.toggleBtn, preferDubbed ? styles.toggleBtnActive : styles.toggleBtnInactive]}
              onPress={() => {
                setPreferDubbed(true);
                setPreferredAudioLang('ita');
              }}
            >
              <Text style={[styles.toggleText, preferDubbed && styles.toggleTextActive]}>DUB ITA</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.toggleBtn, !preferDubbed ? styles.toggleBtnActive : styles.toggleBtnInactive]}
            onPress={() => {
              setPreferDubbed(false);
              setPreferredAudioLang('ita');
            }}
          >
            <Text style={[styles.toggleText, !preferDubbed && styles.toggleTextActive]}>SUB ITA</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Elenco episodi */}
      {episodesLoading && episodes.length === 0 ? (
        <ActivityIndicator color="#fff" size="large" />
      ) : episodes.length === 0 ? (
        (() => {
          const fallbackEps = getFallbackCatalogEpisodes(anime);
          if (fallbackEps.length === 0) {
            return <Text style={styles.text}>Nessun episodio disponibile.</Text>;
          }
          return (
            <View style={styles.episodesList}>
              {fallbackEps.map((fe, idx) => (
                <TouchableOpacity
                  key={`${anime.mal_id}-fallback-${fe.number}-${idx}`}
                  style={styles.episodeItem}
                  onPress={() => {
                    const epTitle = fe.title || `Episodio ${fe.number}`;
                    const videoUrl = fe.url;
                    navigation.navigate('Player', {
                      videoUrl,
                      type: 'video',
                      title: `${anime.title} - ${epTitle}`,
                      posterUrl: imageUrl,
                      animeId: anime.mal_id,
                    });
                    navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
                  }}
                >
                  <View style={styles.episodeLeft}>
                    <Text style={styles.episodeNumber}>{`Ep ${fe.number}`}</Text>
                  </View>
                  <View style={styles.episodeRight}>
                    <Text style={styles.episodeTitle} numberOfLines={1}>
                      {fe.title || `Episodio ${fe.number}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })()
      ) : (
        <View style={styles.episodesList}>
          {episodes.slice().reverse().map((ep, idx) => (
            <TouchableOpacity
              key={`${anime.mal_id}-ep-${ep.mal_id || idx}`}
              style={styles.episodeItem}
              onPress={() => {
                const num = ep?.number ?? (episodes.length - idx);
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
                navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } });
              }}
            >
              <View style={styles.episodeLeft}>
                <Text style={styles.episodeNumber}>
                  {`Ep ${ep?.number ?? (episodes.length - idx)}`}
                </Text>
              </View>
              <View style={styles.episodeRight}>
                <Text style={styles.episodeTitle} numberOfLines={1}>
                  {ep?.title || `Episodio ${ep?.number ?? (episodes.length - idx)}`}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingHorizontal: 10 },

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

  // Toggle migliorato
  toggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 4,
    gap: 6
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  toggleBtnActive: {
    backgroundColor: '#ff5722'
  },
  toggleBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  toggleText: { color: '#fff' },
  toggleTextActive: { fontWeight: 'bold' },
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
