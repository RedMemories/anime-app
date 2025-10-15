import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen({ navigation }) {
  const [topAnime, setTopAnime] = useState([]);
  const [trendingAnime, setTrendingAnime] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState({
    top: true,
    trending: true,
    new: true,
    search: false
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filtri rafforzati: solo anime giapponesi e SFW
  const bannedProducersOrStudios = [
    'bilibili', 'tencent', 'tencent penguin pictures', 'youku', 'iqiyi',
    'haoliners', 'yhkt', 'g.cmay', 'wawayu', 'beijing', 'shanghai'
  ];
  // const japaneseStudioNames = [
  //   'madhouse', 'mappa', 'bones', 'kyoto animation', 'studio pierrot',
  //   'production i.g', 'toei animation', 'sunrise', 'cloverworks',
  //   'a-1 pictures', 'david production', 'wit studio', 'ufotable',
  //   'tms entertainment', 'shaft', 'gonzo', 'feel', 'liden films',
  //   'silver link', 'passione', 'p.a. works', 'j.c.staff', 'studio deen',
  //   'doga kobo', "brain's base", 'studio bind', 'olm', 'white fox', 'trigger'
  // ];
  const containsKana = (s) => /[\u3040-\u30FF]/.test((s || '').toString());
  const hasJapaneseTitleKana = (item) => {
    if (containsKana(item?.title_japanese)) return true;
    const titles = item?.titles || [];
    return titles.some((t) =>
      ((t.type || '').toLowerCase().includes('japanese')) && containsKana(t.title)
    );
  };
  const hasJapaneseStudio = (item) => {
    const names = [...(item?.studios || []), ...(item?.producers || [])]
      .map((s) => (s.name || '').toLowerCase());
    return japaneseStudioNames.some((js) => names.some((n) => n.includes(js)));
  };
  const isChineseAffiliation = (item) => {
    const names = [...(item?.studios || []), ...(item?.producers || [])]
      .map((s) => (s.name || '').toLowerCase());
    return bannedProducersOrStudios.some((b) => names.some((n) => n.includes(b)));
  };
  const hasHentaiGenre = (item) => {
    const g1 = (item?.genres || []).some((g) => (g.name || '').toLowerCase() === 'hentai');
    const g2 = (item?.explicit_genres || []).some((g) => (g.name || '').toLowerCase() === 'hentai');
    return g1 || g2;
  };
  const isAdultRating = (item) => {
    const r = (item?.rating || '').toLowerCase();
    return r.startsWith('rx') || r.includes('r+');
  };
  const filterAvoidChineseOnly = (list) =>
    (list || []).filter((item) => !isChineseAffiliation(item));
  // Normalizzazione titoli e scoring di pertinenza
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokenize = (s) => normalize(s).split(' ').filter(Boolean);
  const titleVariants = (item) => {
    const base = [item?.title, item?.title_english, item?.title_japanese];
    const syns = (item?.titles || []).map(t => t?.title);
    return [...base, ...syns].filter(Boolean).map(normalize);
  };
  const scoreItem = (item, q) => {
    const nq = normalize(q);
    const qTokens = tokenize(q);
    let score = 0;
    for (const v of titleVariants(item)) {
      if (!v) continue;
      if (v === nq) { score = Math.max(score, 100); continue; }
      if (v.startsWith(nq)) { score = Math.max(score, 80); continue; }
      if (v.includes(nq)) { score = Math.max(score, 60); continue; }
      const vTokens = v.split(' ').filter(Boolean);
      const inter = qTokens.filter(t => vTokens.includes(t)).length;
      const ratio = qTokens.length ? inter / qTokens.length : 0;
      score = Math.max(score, Math.round(ratio * 60));
    }
    return score;
  };
  const rankAndFilterByQuery = (list, q) => {
    const scored = (list || []).map(item => ({ item, relevance: scoreItem(item, q) }));
    const exact = scored.filter(s => s.relevance >= 95);
    const keep = exact.length > 0 ? exact : scored.filter(s => s.relevance >= 60);
    keep.sort((a, b) => b.relevance - a.relevance);
    return keep.map(s => s.item);
  };
  const filterJapaneseStrict = (list) =>
    (list || []).filter((item) => {
      const japanese = hasJapaneseTitleKana(item) || hasJapaneseStudio(item);
      return !isAdultRating(item) && !hasHentaiGenre(item) && !isChineseAffiliation(item) && japanese;
    });

  const fetchData = (endpoint, setter, loadingKey) => {
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        const filtered = filterAvoidChineseOnly(data.data || []);
        const animeWithUniqueIds = filtered.map((item, index) => ({
          ...item,
          uniqueId: `${item.mal_id || 'unknown'}-${loadingKey}-${index}`
        }));
        setter(animeWithUniqueIds);
        setLoading(prev => ({ ...prev, [loadingKey]: false }));
      })
      .catch(err => {
        console.error(err);
        setLoading(prev => ({ ...prev, [loadingKey]: false }));
      });
  };
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Top (SFW)
    fetchData('https://api.jikan.moe/v4/top/anime?limit=10&sfw=true', setTopAnime, 'top');
    // Trending (SFW + TV + ordine desc)
    fetchData('https://api.jikan.moe/v4/anime?status=airing&order_by=members&sort=desc&limit=10&sfw=true', setTrendingAnime, 'trending');
    // Nuove uscite (SFW + TV)
    fetchData('https://api.jikan.moe/v4/anime?status=airing&order_by=start_date&sort=desc&limit=10&type=tv&sfw=true', setNewReleases, 'new');
  }, []);

  const searchAnime = () => {
    if (query.trim() === '') {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setLoading(prev => ({ ...prev, search: true }));

    fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&sfw=true`)
      .then(res => res.json())
      .then(data => {
        const filtered = filterAvoidChineseOnly(data.data || []);
        const ranked = rankAndFilterByQuery(filtered, query);
        const resultsWithUniqueIds = ranked.map((item, index) => ({
          ...item,
          uniqueId: `search-${item.mal_id || 'unknown'}-${index}`
        }));
        setSearchResults(resultsWithUniqueIds);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(prev => ({ ...prev, search: false })));
  };

  const renderHero = () => {
    if (loading.top || topAnime.length === 0) return null;
    const item = topAnime[0];
    const imageUrl = item?.images?.webp?.large_image_url
      || item?.images?.jpg?.large_image_url
      || item?.images?.jpg?.image_url
      || 'https://via.placeholder.com/800x450?text=Anime';
    return (
      <TouchableOpacity style={styles.hero} onPress={() => navigation.navigate('Dettagli', { anime: item })}>
        <Image source={{ uri: imageUrl }} style={styles.heroImage} />
        <LinearGradient colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']} style={styles.heroGradient} />
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.heroSynopsis} numberOfLines={2}>{item.synopsis || 'Scopri di più'}</Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={() => navigation.navigate('Dettagli', { anime: item })}>
              <Text style={styles.ctaPrimaryText}>▶ Guarda ora</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={() => navigation.navigate('Dettagli', { anime: item })}>
              <Text style={styles.ctaSecondaryText}>Dettagli</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAnimeItem = (item, size = 'normal') => {
    const imageStyle = size === 'large' ? styles.largeImage : 
                      size === 'small' ? styles.smallImage : styles.image;
    const imageUrl = item?.images?.webp?.large_image_url
      || item?.images?.jpg?.large_image_url
      || item?.images?.jpg?.image_url
      || 'https://via.placeholder.com/300x450?text=Anime';
    
    return (
      <TouchableOpacity
        style={[styles.card, size === 'large' ? styles.largeCard : size === 'small' ? styles.smallCard : {}]}
        onPress={() => navigation.navigate('Dettagli', { anime: item })}
      >
        <Image source={{ uri: imageUrl }} style={imageStyle} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.gradient}
        >
          <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
          {size === 'large' && item.score && (
            <View style={styles.ratingContainer}>
              <Text style={styles.rating}>★ {item.score}</Text>
            </View>
          )}
          {size === 'large' && item.genres?.length > 0 && (
            <View style={styles.chipsContainer}>
              {item.genres.slice(0, 2).map((g) => (
                <View key={`${item.uniqueId}-${g.name}`} style={styles.chip}>
                  <Text style={styles.chipText}>{g.name}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderHorizontalList = (data, title, loadingKey, size = 'normal') => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {loading[loadingKey] ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={data}
            keyExtractor={(item) => item.uniqueId}
            renderItem={({ item }) => renderAnimeItem(item, size)}
            contentContainerStyle={styles.horizontalList}
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      edges={['top', 'bottom']}
    >
      <StatusBar barStyle="light-content" backgroundColor="#111" />
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            setIsSearching(false);
            setQuery('');
          }}
        >
          <Text style={styles.title}>🔥 AnimStream</Text>
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Cerca un anime..."
            placeholderTextColor="#aaa"
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchAnime}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchAnime}>
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSearching ? (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.sectionTitle}>Risultati per "{query}"</Text>
          {loading.search ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uniqueId}
              renderItem={({ item }) => renderAnimeItem(item)}
              numColumns={2}
              contentContainerStyle={[styles.searchResults, { paddingBottom: 20 + insets.bottom }]}
            />
          )}
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {renderHorizontalList(topAnime.slice(0, 5), 'In Evidenza', 'top', 'large')}
          
          {renderHorizontalList(trendingAnime, 'Popolari ora', 'trending')}
          
          {renderHorizontalList(newReleases, 'Nuove Uscite', 'new', 'small')}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#111', 
  },
  header: {
    paddingHorizontal: 15,
    paddingBottom: 8
  },
  title: { 
    color: '#fff', 
    fontSize: 24,
    fontWeight: 'bold', 
    marginBottom: 8
  },
  searchContainer: { 
    flexDirection: 'row', 
    marginBottom: 10,
    alignItems: 'center'
  },
  input: { 
    flex: 1, 
    backgroundColor: '#222', 
    color: '#fff', 
    borderRadius: 8, 
    padding: 12,
    fontSize: 16
  },
  searchButton: {
    marginLeft: 10,
    backgroundColor: '#ff5722',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchButtonText: {
    fontSize: 18
  },
  section: {
    marginBottom: 20,
    paddingLeft: 15
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10
  },
  horizontalList: {
    paddingRight: 15
  },
  card: { 
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative'
  },
  largeCard: {
    width: 300,
    height: 180
  },
  smallCard: {
    width: 120,
    height: 180
  },
  image: { 
    width: 160, 
    height: 220, 
    borderRadius: 12 
  },
  largeImage: {
    width: 300,
    height: 180,
    borderRadius: 12
  },
  smallImage: {
    width: 120,
    height: 180,
    borderRadius: 12
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    justifyContent: 'flex-end',
    padding: 10
  },
  name: { 
    color: '#fff', 
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  ratingContainer: {
    marginTop: 5,
    backgroundColor: 'rgba(255, 87, 34, 0.8)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  rating: {
    color: '#fff',
    fontWeight: 'bold'
  },
  loading: { 
    color: '#fff', 
    textAlign: 'center', 
    marginTop: 20 
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 15
  },
  searchResults: {
    paddingBottom: 20
  },
  hero: {
    marginBottom: 20,
    marginHorizontal: 15,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    height: 220
  },
  heroImage: {
    width: '100%',
    height: '100%'
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0
  },
  heroContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold'
  },
  heroSynopsis: {
    color: '#ddd',
    fontSize: 14,
    marginTop: 4
  },
  heroButtons: {
    flexDirection: 'row',
    marginTop: 10
  },
  ctaPrimary: {
    backgroundColor: '#ff5722',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 10
  },
  ctaPrimaryText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  ctaSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  ctaSecondaryText: {
    color: '#fff'
  },
  chipsContainer: {
    flexDirection: 'row',
    marginTop: 6
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6
  },
  chipText: {
    color: '#fff',
    fontSize: 12
  },
  name: { 
    color: '#fff', 
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10
  },
  ratingContainer: {
    marginTop: 5,
    backgroundColor: 'rgba(255, 87, 34, 0.8)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  rating: {
    color: '#fff',
    fontWeight: 'bold'
  },
  loading: { 
    color: '#fff',
    textAlign: 'center',
    marginTop: 20 
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 15
  },
  searchResults: {
    paddingBottom: 20
  }
});
