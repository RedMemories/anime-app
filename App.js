import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from './screens/HomeScreen';
import DetailScreen from './screens/DetailScreen';
import PlayerScreen from './screens/PlayerScreen';
import HistoryScreen from './screens/HistoryScreen';
import LibraryScreen from './screens/LibraryScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{ headerStyle: { backgroundColor: '#111' }, headerTintColor: '#fff' }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dettagli" component={DetailScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function LibraryStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{ headerStyle: { backgroundColor: '#111' }, headerTintColor: '#fff' }}
    >
      <Stack.Screen name="Libreria" component={LibraryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dettagli" component={DetailScreen} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function HistoryStackScreen() {
  return (
    <Stack.Navigator
      screenOptions={{ headerStyle: { backgroundColor: '#111' }, headerTintColor: '#fff' }}
    >
      <Stack.Screen name="Cronologia" component={HistoryScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#111' },
          tabBarActiveTintColor: '#ff5722',
          tabBarInactiveTintColor: '#aaa',
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="HistoryTab"
          component={HistoryStackScreen}
          options={{
            title: 'Cronologia',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="LibraryTab"
          component={LibraryStackScreen}
          options={{
            title: 'Libreria',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'albums' : 'albums-outline'} size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
