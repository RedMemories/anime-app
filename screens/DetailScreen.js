import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';

export default function DetailScreen({ route }) {
  const { anime } = route.params;

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
    <ScrollView style={styles.container}>
      <Image source={{ uri: anime.images.jpg.image_url }} style={styles.image} />
      <Text style={styles.title}>{anime.title}</Text>
      <Text style={styles.text}>{cleanSynopsis}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 10 },
  image: { width: '100%', height: 400, borderRadius: 12 },
  title: { color: '#fff', fontSize: 24, marginVertical: 10, fontWeight: 'bold' },
  text: { color: '#ccc', fontSize: 16, lineHeight: 22 },
});
