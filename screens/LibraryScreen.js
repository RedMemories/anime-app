import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

export default function LibraryScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);

  const fetchBrowse = async () => {
    try {
      setLoading(true);
      const res = await fetch('https://api.jikan.moe/v4/top/anime?limit=24&sfw=true');
      const json = await res.json();
      setItems((json?.data || []).map((item, index) => ({ ...item, uniqueId: `${item.mal_id || 'unknown'}-lib-${index}` })));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrowse(); }, []);

  const searchAnime = async () => {
    if (query.trim() === '') {
      fetchBrowse();
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&sfw=true`);
      const json = await res.json();
      setItems((json?.data || []).map((item, index) => ({ ...item, uniqueId: `search-${item.mal_id || 'unknown'}-${index}` })));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
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
      {loading ? (
        <ActivityIndicator color="#fff" size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.uniqueId}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 12 }}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  searchRow: { flexDirection: 'row', padding: 12 },
  input: { flex: 1, backgroundColor: '#222', color: '#fff', borderRadius: 8, padding: 10, fontSize: 16 },
  searchButton: { marginLeft: 10, backgroundColor: '#ff5722', borderRadius: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  searchButtonText: { fontSize: 18 },
  list: { paddingBottom: 12 },
  card: { width: '32%', marginBottom: 12 },
  image: { width: '100%', height: 160, borderRadius: 10, backgroundColor: '#000' },
  name: { color: '#fff', marginTop: 6, fontWeight: 'bold' },
});