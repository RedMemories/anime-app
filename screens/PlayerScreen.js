import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, StatusBar } from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PlayerScreen({ route, navigation }) {
    const { videoUrl, source: sourceParam, title, posterUrl, animeId } = route?.params || {};

    const playbackUrlString = useMemo(() => {
        if (typeof sourceParam === 'string' && sourceParam.trim()) return sourceParam.trim();
        if (sourceParam && typeof sourceParam === 'object' && typeof sourceParam.uri === 'string' && sourceParam.uri.trim()) return sourceParam.uri.trim();
        if (typeof videoUrl === 'string' && videoUrl.trim()) return videoUrl.trim();
        return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    }, [sourceParam, videoUrl]);

    const player = useVideoPlayer(
        playbackUrlString,
        (p) => {
            p.loop = false;
            p.rate = 1;
            p.volume = 1;
            p.muted = false;
            p.timeUpdateEventInterval = 1;
            p.play();
        }
    );

    // Chiavi/Ref per cronologia e ripresa
    const progressKey = useMemo(() => `watchProgress:${playbackUrlString}`, [playbackUrlString]);
    const lastSavedRef = useRef(0);
    const resumeTargetRef = useRef(0);
    const resumedRef = useRef(false);

    // Ripristino posizione (legge la posizione salvata, seek solo quando la durata è nota)
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(progressKey);
                const saved = raw ? JSON.parse(raw) : null;
                const pos = Math.max(0, Number(saved?.position || 0));
                resumeTargetRef.current = pos;
            } catch { }
        })();
    }, [progressKey]);

    const tryResume = () => {
        if (resumedRef.current) return;
        const pos = resumeTargetRef.current || 0;
        const d = typeof player.duration === 'number' ? player.duration : 0;
        if (pos > 0 && d > 0) {
            const target = Math.min(pos, Math.max(0, d - 1));
            try {
                player.currentTime = target;
                resumedRef.current = true;
            } catch { }
        }
    };

    useEventListener(player, 'durationChange', () => {
        setDuration(player.duration ?? 0);
        tryResume();
    });
    useEventListener(player, 'playingChange', () => {
        tryResume();
    });

    // Salvataggio cronologia — nel punto corretto (dopo player)
    useEffect(() => {
        const appendHistory = async () => {
            try {
                const raw = await AsyncStorage.getItem('watchHistory');
                const list = raw ? JSON.parse(raw) : [];
                const entry = {
                    animeId: animeId || null,
                    title: title || 'Riproduzione',
                    videoUrl: playbackUrlString,
                    posterUrl: posterUrl || null,
                    watchedAt: Date.now(),
                };
                const last = list[0];
                if (!last || last.videoUrl !== entry.videoUrl) {
                    list.unshift(entry);
                    await AsyncStorage.setItem('watchHistory', JSON.stringify(list.slice(0, 200)));
                }
            } catch { }
        };
        appendHistory();
    }, [playbackUrlString, title, posterUrl, animeId]);

    // Salva posizione ogni ~5s
    useEventListener(player, 'timeUpdate', ({ currentTime }) => {
        setPosition(currentTime ?? 0);
        const d = player.duration;
        if (typeof d === 'number' && d > 0) setDuration(d);
        const now = Math.floor(currentTime || 0);
        if (now - lastSavedRef.current >= 5) {
            lastSavedRef.current = now;
            AsyncStorage.setItem(progressKey, JSON.stringify({ position: now })).catch(() => {});
        }
    });

    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [showOverlay, setShowOverlay] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubTarget, setScrubTarget] = useState(0);
    const [sliderWidth, setSliderWidth] = useState(0);

    useEffect(() => {
        let sub;
        (async () => {
            try {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
                const current = await ScreenOrientation.getOrientationAsync();
                const landscape =
                    current === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                    current === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
                setIsFullscreen(landscape);
                StatusBar.setHidden(true, 'fade');
            } catch { }
        })();

        sub = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
            const o = orientationInfo.orientation;
            const landscape =
                o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
                o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
            setIsFullscreen(landscape);
            StatusBar.setHidden(true, 'fade');
        });

        return () => {
            ScreenOrientation.removeOrientationChangeListener(sub);
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            StatusBar.setHidden(false, 'fade');
        };
    }, []);

    const toggleFullscreen = async () => {
        setShowOverlay(true);
        try {
            if (!isFullscreen) {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            } else {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            }
        } catch { }
    };

    useEventListener(player, 'timeUpdate', ({ currentTime }) => {
        setPosition(currentTime ?? 0);
        const d = player.duration;
        if (typeof d === 'number' && d > 0) setDuration(d);
        const now = Math.floor(currentTime || 0);
        if (now - lastSavedRef.current >= 5) {
            lastSavedRef.current = now;
            AsyncStorage.setItem(progressKey, JSON.stringify({ position: now })).catch(() => {});
        }
    });
    useEventListener(player, 'durationChange', ({ duration }) => {
        setDuration(duration ?? 0);
    });
    useEventListener(player, 'statusChange', () => {
        const d = player.duration;
        if (typeof d === 'number' && d > 0) setDuration(d);
    });
    useEventListener(player, 'playingChange', ({ isPlaying }) => {
        setIsPlaying(!!isPlaying);
    });
    useEventListener(player, 'mutedChange', (payload) => {
        const val = payload?.muted ?? payload?.isMuted ?? player.muted ?? false;
        setIsMuted(!!val);
    });
    useEventListener(player, 'rateChange', ({ rate }) => {
        setRate(rate ?? 1);
    });

    const togglePlay = () => {
        setShowOverlay(true);
        if (isPlaying) player.pause();
        else player.play();
    };

    const seekBy = (deltaSec) => {
        setShowOverlay(true);
        const d = player.duration ?? duration ?? 0;
        const now = player.currentTime ?? position ?? 0;
        const target = Math.max(0, Math.min(d, now + deltaSec));
        player.currentTime = target;
    };

    const toggleMute = () => {
        setShowOverlay(true);
        const next = !player.muted;
        player.muted = next;
        setIsMuted(next);
    };

    const setSpeed = (r) => {
        // Aggiorna subito la velocità e lo stato locale
        try {
            player.rate = r;
            setRate(r);
            // Se necessario, forza un play per applicare la rate in alcuni player
            if (!isPlaying) player.play();
        } catch {}
    };

    const formatTime = (sec) => {
        const s = Math.floor(sec || 0);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        const hh = h > 0 ? `${h}:` : '';
        const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
        const ss = String(r).padStart(2, '0');
        return `${hh}${mm}:${ss}`;
    };

    const handleTap = () => {
        setShowOverlay((v) => !v);
    };
    useEffect(() => {
        const parent = navigation.getParent?.();
        parent?.setOptions({
            tabBarStyle: { display: 'none' },
        });

        return () => {
            // Ripristina la tab bar all'uscita
            parent?.setOptions({
                tabBarStyle: {
                    display: 'flex',
                    backgroundColor: '#111',
                },
                tabBarActiveTintColor: '#ff5722',
                tabBarInactiveTintColor: '#aaa',
            });
        };
    }, [navigation]);

    return (
        <View style={styles.container}>
            <Pressable onPress={handleTap} style={styles.videoTapper}>
                <VideoView
                    style={styles.video}
                    player={player}
                    contentFit={isFullscreen ? 'cover' : 'contain'}
                    nativeControls={false}
                />
            </Pressable>

            {showOverlay && (
                <View style={styles.overlay} pointerEvents="box-none">
                    <View style={styles.topBar}>
                        <TouchableOpacity style={styles.topBtn} onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={22} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.topTitle} numberOfLines={1}>{title || 'Riproduzione'}</Text>
                        <View style={styles.topRight}>
                            {/* Rimosso pulsante impostazioni */}
                            <TouchableOpacity style={styles.topBtn} onPress={toggleFullscreen}>
                                <MaterialIcons name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.centerControls}>
                        <TouchableOpacity onPress={() => seekBy(-10)} style={styles.centerBtn}>
                            <MaterialCommunityIcons name="rewind-10" size={34} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                            {isPlaying ? (
                                <Ionicons name="pause" size={36} color="#fff" />
                            ) : (
                                <Ionicons name="play" size={36} color="#fff" />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => seekBy(10)} style={styles.centerBtn}>
                            <MaterialCommunityIcons name="fast-forward-10" size={34} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.bottomBar}>
                        <TouchableOpacity onPress={toggleMute} style={styles.bottomBtn}>
                            {isMuted ? (
                                <Ionicons name="volume-mute" size={18} color="#fff" />
                            ) : (
                                <Ionicons name="volume-high" size={18} color="#fff" />
                            )}
                        </TouchableOpacity>

                        <Text style={styles.timeText}>
                            {formatTime(position)} / {formatTime(duration)}
                        </Text>

                        <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={duration || 1}
                            value={position}
                            step={1}
                            onSlidingStart={() => setShowOverlay(true)}
                            onSlidingComplete={(sec) => {
                                const d = duration || player.duration || 0;
                                player.currentTime = Math.max(0, Math.min(d, sec));
                            }}
                            minimumTrackTintColor="#e50914"
                            maximumTrackTintColor="rgba(255,255,255,0.3)"
                            thumbTintColor="#e50914"
                        />
                        {/* Rimosso pulsante velocità */}
                    </View>
                </View>
            )}
            {/* Rimosso il Modal impostazioni */}
            <StatusBar hidden />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    videoTapper: { flex: 1 },
    video: { width: '100%', height: '100%', backgroundColor: '#000' },
    overlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'space-between',
    },
    topBar: {
        marginTop: 8,
        paddingHorizontal: 10,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
    },
    topBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    topTitle: {
        marginLeft: 8,
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    topRight: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    centerControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
    },
    centerBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    playBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    bottomBar: {
        paddingHorizontal: 12,
        paddingBottom: 14,
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
    },
    slider: {
        flex: 1,
        height: 28,
        marginHorizontal: 10,
    },
    timeText: { color: '#fff', fontSize: 12, marginLeft: 12 },
    bottomBtn: {
        height: 32,
        minWidth: 36,
        borderRadius: 16,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    speedBtn: {
        width: 36,
        height: 32,
        paddingHorizontal: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    speedText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCard: {
        width: '86%',
        borderRadius: 12,
        backgroundColor: '#181818',
        padding: 16,
    },
    modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
    modalSection: { marginTop: 10 },
    modalLabel: { color: '#fff', fontSize: 13, opacity: 0.8, marginBottom: 6 },
    speedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    speedChoice: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    speedChoiceText: { color: '#fff', fontSize: 13 },
    speedChoiceTextActive: { color: '#e50914', fontWeight: '700' },
    sliderWrap: {
    flex: 1,
    height: 28,
    marginHorizontal: 10,
    position: 'relative',
    },
    scrubBubble: {
    position: 'absolute',
    bottom: 34,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    },
    scrubBubbleText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    scrubMarker: {
    position: 'absolute',
    bottom: 28,
    width: 2,
    height: 16,
    backgroundColor: '#e50914',
    borderRadius: 1,
    },
});