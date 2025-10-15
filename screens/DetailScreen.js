import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DetailScreen({ route }) {
  const { anime } = route.params;
  const insets = useSafeAreaInsets();

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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
        <Text style={styles.title}>{anime.title}</Text>
        <Text style={styles.sectionLabel}>Descrizione</Text>
        <Text style={styles.text}>{cleanSynopsis}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', paddingHorizontal: 10 },
  image: { width: '100%', height: 400, borderRadius: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4, marginBottom: 6 },
  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 4, marginBottom: 6 },
  text: { color: '#ccc', fontSize: 16, lineHeight: 22 },
  sectionLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 8 },
});
