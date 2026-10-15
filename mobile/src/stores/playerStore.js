// src/stores/playerStore.js
// Audio playback built on expo-audio (expo-av was removed in Expo SDK 55).
// The public state/actions are unchanged: position and duration are in milliseconds.
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { create } from "zustand";

let statusSubscription = null;

const releasePlayer = (player) => {
  if (statusSubscription) {
    try {
      statusSubscription.remove();
    } catch (e) {
      // ignore
    }
    statusSubscription = null;
  }
  if (player) {
    try {
      player.clearLockScreenControls();
    } catch (e) {
      // ignore
    }
    try {
      player.remove();
    } catch (e) {
      // ignore
    }
  }
};

export const usePlayerStore = create((set, get) => ({
  sound: null, // the expo-audio AudioPlayer
  currentHymn: null,
  currentTune: null, // the tune currently loaded (a hymn can have several)
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  isVisible: false,
  isExpanded: false,
  playbackRate: 1.0,

  loadAndPlay: async (hymn, audioUri, tune = null) => {
    try {
      releasePlayer(get().sound);

      set({
        isLoading: true,
        currentHymn: hymn,
        currentTune: tune,
        isVisible: true,
        sound: null,
        position: 0,
        duration: 0,
      });

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: "doNotMix",
        allowsRecording: false,
      });

      const player = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });

      statusSubscription = player.addListener("playbackStatusUpdate", (status) => {
        if (!status.isLoaded) return;
        set({
          position: Math.round((status.currentTime || 0) * 1000),
          duration: Math.round((status.duration || 0) * 1000),
          isPlaying: status.playing,
        });
        if (status.didJustFinish) {
          set({ isPlaying: false, position: 0 });
          player.seekTo(0).catch(() => {});
        }
      });

      player.setPlaybackRate(get().playbackRate);
      player.play();

      // Lock-screen controls; on Android this keeps playback alive in the background
      try {
        player.setActiveForLockScreen(true, {
          title: hymn?.title_en || "PCG Hymn",
          artist: [hymn?.hymn_number ? `Hymn ${hymn.hymn_number}` : "PCG Hymnal", tune?.name]
            .filter(Boolean)
            .join(" · "),
        });
      } catch (e) {
        console.warn("Lock screen controls unavailable:", e);
      }

      set({ sound: player, isLoading: false, isPlaying: true });
    } catch (error) {
      console.error("Error loading audio:", error);
      set({ isLoading: false });
    }
  },

  togglePlayPause: async () => {
    const { sound, isPlaying } = get();
    if (!sound) return;
    try {
      if (isPlaying) {
        sound.pause();
      } else {
        sound.play();
      }
    } catch (error) {
      console.error("Error toggling play/pause:", error);
    }
  },

  seekTo: async (positionMillis) => {
    const { sound } = get();
    if (!sound) return;
    try {
      await sound.seekTo(positionMillis / 1000);
    } catch (error) {
      console.error("Error seeking:", error);
    }
  },

  setPlaybackRate: async (rate) => {
    const { sound } = get();
    set({ playbackRate: rate });
    if (sound) {
      try {
        sound.setPlaybackRate(rate);
      } catch (error) {
        console.error("Error setting playback rate:", error);
      }
    }
  },

  stop: async () => {
    const { sound } = get();
    if (sound) {
      try {
        sound.pause();
      } catch (error) {
        console.error("Error stopping:", error);
      }
      releasePlayer(sound);
    }
    set({
      sound: null,
      currentHymn: null,
      currentTune: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      isVisible: false,
      isExpanded: false,
    });
  },

  expandPlayer: () => set({ isExpanded: true }),
  collapsePlayer: () => set({ isExpanded: false }),
  hidePlayer: () => set({ isVisible: false, isExpanded: false }),
}));
