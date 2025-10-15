import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function LibraryScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const insets = useSafeAreaInsets();
  const NUM_COLS = 2;

  const [showFilters, setShowFilters] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);

  const typeOptions = ['TV', 'Movie', 'OVA', 'ONA', 'Special', 'Music'];
  const statusOptions = [
    { key: 'currently airing', label: 'In corso' },
    { key: 'finished airing', label: 'Completato' },
    { key: 'not yet aired', label: 'In arrivo' },
  ];

  const normalizeStatus = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

  const STATUS_QUERY_MAP = {
    'currently airing': 'airing',
    'finished airing': 'complete',
    'not yet aired': 'upcoming',
  };

  const allGenres = useMemo(() => {
    const names = new Set();
    (items || []).forEach((i) => (i?.genres || []).forEach((g) => names.add(g?.name)));
    return Array.from(names).filter(Boolean).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      const itemGenres = (item?.genres || []).map((g) => g.name);
      const itemType = (item?.type || '').toString();
      const itemStatus = normalizeStatus(item?.status);

      const matchGenres =
        selectedGenres.length === 0 || selectedGenres.some((g) => itemGenres.includes(g));

      const matchType = selectedTypes.length === 0 || selectedTypes.includes(itemType);

      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(itemStatus);

      return matchGenres && matchType && matchStatus;
    });
  }, [items, selectedGenres, selectedTypes, selectedStatuses]);

  const toggleSelection = (list, setter, key) => {
    setter(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
  };

  const [mode, setMode] = useState('browse');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);

  const fetchBrowse = async (pageArg = 1) => {
    try {
      setMode('browse');
      setLoading(true);
      const res = await fetch(`https://api.jikan.moe/v4/top/anime?limit=24&sfw=true&page=${pageArg}`);
      const json = await res.json();
      const data = (json?.data || []).map((item, index) => ({
        ...item,
        uniqueId: `${item.mal_id || 'unknown'}-lib-${pageArg}-${index}`,
      }));
      setHasNextPage(!!json?.pagination?.has_next_page);
      setItems(prev => pageArg === 1 ? data : [...prev, ...data]);
      setPage(pageArg);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchByStatuses = async (statusKeys, pageArg = 1) => {
    try {
      setMode('status');
      setLoading(true);
      const queries = statusKeys
        .map(normalizeStatus)
        .map((key) => STATUS_QUERY_MAP[key])
        .filter(Boolean);

      if (queries.length === 0) {
        await fetchBrowse(1);
        return;
      }

      const urls = queries.map(
        (q) =>
          `https://api.jikan.moe/v4/anime?status=${q}&order_by=members&sort=desc&limit=24&sfw=true&page=${pageArg}`
      );
      const responses = await Promise.all(
        urls.map((u) => fetch(u).then((r) => r.json()).catch(() => ({ data: [], pagination: {} })))
      );

      const merged = [];
      const seen = new Set();
      responses.forEach((j, i) => {
        (j?.data || []).forEach((item, idx) => {
          if (seen.has(item.mal_id)) return;
          seen.add(item.mal_id);
          merged.push({
            ...item,
            uniqueId: `${item.mal_id || 'unknown'}-lib-${i}-${pageArg}-${idx}`,
          });
        });
      });

      const anyHasNext = responses.some(r => !!r?.pagination?.has_next_page);
      setHasNextPage(anyHasNext);
      setItems(prev => pageArg === 1 ? merged : [...prev, ...merged]);
      setPage(pageArg);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSearchPage = async (q, pageArg = 1) => {
    try {
      setMode('search');
      setLoading(true);
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&sfw=true&limit=24&page=${pageArg}`);
      const json = await res.json();
      const data = (json?.data || []).map((item, index) => ({
        ...item,
        uniqueId: `search-${item.mal_id || 'unknown'}-${pageArg}-${index}`
      }));
      setHasNextPage(!!json?.pagination?.has_next_page);
      setItems(prev => pageArg === 1 ? data : [...prev, ...data]);
      setPage(pageArg);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    if (selectedStatuses.length > 0) {
      fetchByStatuses(selectedStatuses, 1);
    } else {
      fetchBrowse(1);
    }
  }, [selectedStatuses]);

  const statusLabel = (s) => {
    const n = normalizeStatus(s);
    if (n === 'currently airing') return 'In corso';
    if (n === 'finished airing') return 'Completato';
    if (n === 'not yet aired') return 'In arrivo';
    return '';
  };
  const statusBadgeStyle = (s) => {
    const n = normalizeStatus(s);
    if (n === 'currently airing') return styles.badgeAiring;
    if (n === 'finished airing') return styles.badgeComplete;
    if (n === 'not yet aired') return styles.badgeUpcoming;
    return styles.badgeDefault;
  };

  const renderCard = ({ item }) => {
    const imageUrl =
      item?.images?.webp?.large_image_url ||
      item?.images?.jpg?.large_image_url ||
      item?.images?.jpg?.image_url ||
      'https://via.placeholder.com/300x450?text=Anime';
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Dettagli', { anime: item })}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} />
        {!!item?.status && (
          <View style={[styles.statusBadge, statusBadgeStyle(item.status)]}>
            <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  const searchAnime = async () => {
    const q = query.trim();
    if (q === '') {
      setMode('browse');
      setPage(1);
      fetchBrowse(1);
      return;
    }
    setPage(1);
    await fetchSearchPage(q, 1);
  };

  const loadMore = () => {
    if (loading || !hasNextPage) return;
    const nextPage = page + 1;
    if (mode === 'browse') {
      fetchBrowse(nextPage);
    } else if (mode === 'status') {
      fetchByStatuses(selectedStatuses, nextPage);
    } else {
      fetchSearchPage(query.trim(), nextPage);
    }
  };

  const renderItem = ({ item }) => {
    const imageUrl = item?.images?.webp?.large_image_url
      || item?.images?.jpg?.large_image_url
      || item?.images?.jpg?.image_url
      || 'https://via.placeholder.com/300x450?text=Anime';
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Dettagli', { anime: item })}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <Text style={styles.name} numberOfLines={1}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Cerca nella libreria..."
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

        {/* Manteniamo sempre la FlatList montata: se loading e lista vuota, mostriamo l'empty loader */}
        <>
          <FlatList
            data={filteredItems}
            key={`grid-${NUM_COLS}`}
            keyExtractor={(item) => item.uniqueId}
            renderItem={renderCard}
            numColumns={NUM_COLS}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 12 }}
            contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loading && hasNextPage && page > 1 ? (
                <View style={{ paddingVertical: 16 }}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null
            }
          />

          {/* FAB Filtri */}
          <View style={styles.fabWrapper}>
            <TouchableOpacity style={styles.fab} onPress={() => setShowFilters(true)}>
              <LinearGradient
                colors={['#ff7a45', '#ff5722']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabGradient}
              >
                <Ionicons name="funnel" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Popover Filtri */}
          {showFilters && (
            <View style={styles.popoverOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setShowFilters(false)}
              />
              <View style={styles.filterPopover}>
                <Text style={styles.popoverTitle}>Filtri</Text>

                {/* Generi */}
                <View style={styles.filterSection}>
                  <Text style={styles.sectionLabel}>Generi</Text>
                  <View style={styles.chipsWrap}>
                    {allGenres.map((g) => {
                      const selected = selectedGenres.includes(g);
                      return (
                        <TouchableOpacity
                          key={`genre-${g}`}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => toggleSelection(selectedGenres, setSelectedGenres, g)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{g}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionLabel}>Tipo</Text>
                  <View style={styles.chipsWrap}>
                    {typeOptions.map((t) => {
                      const selected = selectedTypes.includes(t);
                      return (
                        <TouchableOpacity
                          key={`type-${t}`}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => toggleSelection(selectedTypes, setSelectedTypes, t)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.filterSection}>
                  <Text style={styles.sectionLabel}>Stato</Text>
                  <View style={styles.chipsWrap}>
                    {statusOptions.map((s) => {
                      const selected = selectedStatuses.includes(s.key);
                      return (
                        <TouchableOpacity
                          key={`status-${s.key}`}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => toggleSelection(selectedStatuses, setSelectedStatuses, s.key)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.filterActions}>
                  <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                    <Text style={styles.clearText}>Pulisci</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
                    <Text style={styles.applyText}>Applica</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          </>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  searchRow: { flexDirection: 'row', padding: 12 },
  input: { flex: 1, backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 10, fontSize: 16 },
  searchButton: { marginLeft: 10, backgroundColor: '#ff5722', borderRadius: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { fontSize: 18 },
  list: { paddingBottom: 12, paddingHorizontal: 12 },
  card: { width: '48%', marginBottom: 12 },
  image: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#000' },
  name: { color: '#fff', marginTop: 6, fontWeight: 'bold' },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)'
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  badgeAiring: { backgroundColor: 'rgba(76, 175, 80, 0.85)' },     // verde
  badgeComplete: { backgroundColor: 'rgba(33, 150, 243, 0.85)' },  // blu
  badgeUpcoming: { backgroundColor: 'rgba(255, 193, 7, 0.85)' },   // amber
  badgeDefault: { backgroundColor: 'rgba(0,0,0,0.6)' },

  // FAB
  fabWrapper: { position: 'absolute', right: 16, bottom: 20 },
  fab: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', elevation: 6 },
  fabGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Popover/Overlay
  popoverOverlay: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    padding: 12
  },
  filterPopover: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#333',
    maxHeight: '60%'
  },
  popoverTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  filterSection: { marginBottom: 8 },
  sectionLabel: { color: '#fff', fontWeight: 'bold', marginBottom: 6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18
  },
  chipSelected: { backgroundColor: 'rgba(255, 87, 34, 0.25)', borderColor: '#ff5722' },
  chipText: { color: '#fff' },
  chipTextSelected: { color: '#ffeadf' },
  filterActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  clearBtn: { backgroundColor: '#333', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  clearText: { color: '#fff', fontWeight: 'bold' },
  applyBtn: { backgroundColor: '#ff5722', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  applyText: { color: '#fff', fontWeight: 'bold' },
  });