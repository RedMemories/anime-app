import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

export default function HistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem('watchHistory');
      const list = raw ? JSON.parse(raw) : [];
      setItems(list.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)));
    } catch (e) {
      setItems([]);
    }
  };

  useFocusEffect(useCallback(() => { loadHistory(); }, []));

  const clearHistory = async () => {
    await AsyncStorage.removeItem('watchHistory');
    setItems([]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() =>
        navigation.navigate('Player', {
          videoUrl: item.videoUrl,
          title: item.title,
          posterUrl: item.posterUrl,
        })
      }
    >
      <Image
        source={{ uri: item.posterUrl || 'https://via.placeholder.com/120x180?text=Anime' }}
        style={styles.poster}
      />
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.sub}>{new Date(item.watchedAt || Date.now()).toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Cronologia di visione</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clearHistory}>
          <Text style={styles.clearText}>Svuota</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item, idx) => `${item.videoUrl}-${item.watchedAt}-${idx}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  header: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  clearBtn: { backgroundColor: '#333', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  clearText: { color: '#fff' },
  list: { paddingHorizontal: 12, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', borderRadius: 10, padding: 8, marginBottom: 10 },
  poster: { width: 60, height: 90, borderRadius: 6, marginRight: 10, backgroundColor: '#000' },
  meta: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  sub: { color: '#aaa', fontSize: 12, marginTop: 2 },
});