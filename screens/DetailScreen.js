import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailScreen({ route, navigation }) {
  const { anime } = route.params;
  const [showEpisodesModal, setShowEpisodesModal] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [episodesPage, setEpisodesPage] = useState(1);
  const [episodesHasNextPage, setEpisodesHasNextPage] = useState(false);
  const [episodesLoading, setEpisodesLoading] = useState(false);

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

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: imageUrl }} style={styles.image} />
      <Text style={styles.title}>{anime.title}</Text>

      {/* Azioni: sostituisco "Guarda" con "Lista Episodi" */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={() => setShowEpisodesModal(true)}
        >
          <Text style={styles.playButtonText}>📃 Lista Episodi</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>Descrizione</Text>
      <Text style={styles.text}>{cleanSynopsis}</Text>

      {/* Modal Episodi Jikan */}
      <Modal
        visible={showEpisodesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEpisodesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Episodi — {anime.title}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEpisodesModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {episodesLoading && episodes.length === 0 ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : episodes.length === 0 ? (
                <Text style={styles.text}>Nessun episodio disponibile.</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalList}>
                  {episodes.map((ep, idx) => (
                    <TouchableOpacity
                      key={`${anime.mal_id}-ep-${ep.mal_id || idx}`}
                      style={styles.episodeItem}
                      onPress={() => {
                        const epTitle = ep?.title || `Episodio ${ep?.mal_id || (idx + 1)}`;
                        navigation.navigate('Player', {
                          videoUrl: playable.url,
                          type: playable.type,
                          title: `${anime.title} - ${epTitle}`
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
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingHorizontal: 10 },
  image: { width: '100%', height: 400, borderRadius: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4, marginBottom: 6 },
  playButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff5722',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8
  },
  playButtonText: { color: '#fff', fontWeight: 'bold' },

  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4, marginBottom: 6 },
  text: { color: '#ccc', fontSize: 16, lineHeight: 22 },

  actionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden', maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  closeBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#333' },
  closeBtnText: { color: '#fff', fontSize: 16 },
  modalBody: { paddingHorizontal: 10, paddingVertical: 10 },
  modalList: { paddingBottom: 10 },

  episodesList: { marginBottom: 12 },
  episodeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#222', borderRadius: 8, marginBottom: 6 },
  episodeLeft: { width: 60, alignItems: 'center', justifyContent: 'center' },
  episodeNumber: { color: '#ff5722', fontWeight: 'bold' },
  episodeRight: { flex: 1 },
  episodeTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  episodeMeta: { color: '#aaa', fontSize: 12, marginTop: 2 },
  loadMoreBtn: { alignSelf: 'center', backgroundColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 6 },
  loadMoreText: { color: '#fff' }
});

