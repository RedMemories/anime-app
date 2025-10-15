import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailScreen({ route, navigation }) {
  const { anime } = route.params;

  const getPlayable = (a) => {
    return { type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' };
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
      <TouchableOpacity
        style={styles.playButton}
        onPress={() => navigation.navigate('Player', { videoUrl: playable.url, type: playable.type, title: anime.title })}
      >
        <Text style={styles.playButtonText}>▶ Guarda</Text>
      </TouchableOpacity>
      <Text style={styles.sectionLabel}>Descrizione</Text>
      <Text style={styles.text}>{cleanSynopsis}</Text>
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
  text: { color: '#ccc', fontSize: 16, lineHeight: 22 }
});
