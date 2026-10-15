// src/components/MiniPlayer.jsx
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconX,
} from "@tabler/icons-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors, theme } from "../theme/theme";
import { LANGUAGES } from "../utils/constants";

import { useSafeAreaInsets } from "react-native-safe-area-context";

const MiniPlayer = () => {
  const insets = useSafeAreaInsets();
  const {
    currentHymn,
    currentTune,
    isPlaying,
    isVisible,
    position,
    duration,
    togglePlayPause,
    stop,
    expandPlayer,
  } = usePlayerStore();

  const darkMode = useSettingsStore((state) => state.darkMode);
  const language = useSettingsStore((state) => state.language);
  const colors = getThemeColors(darkMode);

  if (!isVisible || !currentHymn) return null;

  const progress = duration > 0 ? position / duration : 0;
  const title =
    language === LANGUAGES.TWI && currentHymn.title_twi
      ? currentHymn.title_twi
      : currentHymn.title_en;

  const bottomOffset = 56 + (insets.bottom > 0 ? insets.bottom : 8) + 10;

  return (
    <View
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.primary,
        },
      ]}
    >
      {/* Top Gold Progress Indicator */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: colors.secondary,
            },
          ]}
        />
      </View>

      <TouchableOpacity
        style={styles.touchArea}
        activeOpacity={0.85}
        onPress={expandPlayer}
      >
        {/* Hymn Number Badge */}
        <View
          style={[styles.numberBadge, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.numberText}>{currentHymn.hymn_number}</Text>
        </View>

        {/* Title & Status */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {currentTune ? `${currentTune.name} · ` : ""}
            {isPlaying ? "Playing" : "Paused"}
          </Text>
        </View>

        {/* Play/Pause Button */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          style={[styles.playBtn, { backgroundColor: colors.surfaceCard }]}
        >
          {isPlaying ? (
            <IconPlayerPauseFilled size={18} color={colors.primary} />
          ) : (
            <IconPlayerPlayFilled size={18} color={colors.primary} />
          )}
        </TouchableOpacity>

        {/* Close Button */}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            stop();
          }}
          style={styles.closeBtn}
        >
          <IconX size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 85,
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    zIndex: 999,
    ...theme.shadows.md,
  },
  progressTrack: {
    height: 3,
    width: "100%",
  },
  progressFill: {
    height: 3,
  },
  touchArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  numberBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  numberText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtn: {
    padding: 6,
  },
});

export default MiniPlayer;