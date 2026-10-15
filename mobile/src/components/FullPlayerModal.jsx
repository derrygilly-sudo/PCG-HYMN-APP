// src/components/FullPlayerModal.jsx
import {
  IconChevronDown,
  IconHeart,
  IconHeartFilled,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerStop,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
} from "@tabler/icons-react-native";
import React from "react";
import {
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useHymnStore } from "../stores/hymnStore";
import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors, theme } from "../theme/theme";
import { LANGUAGES } from "../utils/constants";
import { formatDuration } from "../utils/helpers";

const FullPlayerModal = () => {
  const {
    currentHymn,
    currentTune,
    isPlaying,
    position,
    duration,
    isExpanded,
    playbackRate,
    togglePlayPause,
    seekTo,
    setPlaybackRate,
    collapsePlayer,
    stop,
  } = usePlayerStore();

  const darkMode = useSettingsStore((state) => state.darkMode);
  const language = useSettingsStore((state) => state.language);
  const colors = getThemeColors(darkMode);
  const { toggleFavorite, favorites } = useHymnStore();

  if (!currentHymn) return null;

  const isFav = favorites.some((f) => f.id === currentHymn.id);
  const progress = duration > 0 ? position / duration : 0;

  const title =
    language === LANGUAGES.TWI && currentHymn.title_twi
      ? currentHymn.title_twi
      : currentHymn.title_en;

  const rates = [0.75, 1.0, 1.25, 1.5];
  const nextRate = () => {
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  const handleSeek = (evt) => {
    const { locationX } = evt.nativeEvent;
    // Estimated width of progress bar is ~300px
    const percentage = Math.max(0, Math.min(1, locationX / 300));
    seekTo(percentage * duration);
  };

  return (
    <Modal
      visible={isExpanded}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={collapsePlayer}
    >
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        {/* Header Toolbar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={collapsePlayer} style={styles.iconBtn}>
            <IconChevronDown size={28} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerTitleBlock}>
            <Text style={[styles.headerSub, { color: colors.secondary }]}>
              NOW PLAYING
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              PCG Hymnal
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => toggleFavorite(currentHymn.id)}
            style={styles.iconBtn}
          >
            {isFav ? (
              <IconHeartFilled size={26} color={theme.colors.error} />
            ) : (
              <IconHeart size={26} color={colors.text} strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>

        {/* Artwork / Number Disc */}
        <View style={styles.artworkContainer}>
          <View
            style={[
              styles.discOuter,
              {
                backgroundColor: colors.surface,
                borderColor: colors.secondary,
                shadowColor: colors.primary,
              },
            ]}
          >
            <View
              style={[styles.discInner, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.discNumberText}>
                {currentHymn.hymn_number}
              </Text>
              <Text style={styles.discSubText}>HYMN</Text>
            </View>
          </View>
        </View>

        {/* Hymn Info */}
        <View style={styles.infoSection}>
          <Text style={[styles.hymnTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {currentTune ? (
            <Text style={[styles.composerText, { color: colors.primary, fontWeight: "700" }]}>
              {currentTune.name}
            </Text>
          ) : null}
          {currentHymn.composer && (
            <Text style={[styles.composerText, { color: colors.textSecondary }]}>
              {currentHymn.composer}
            </Text>
          )}
          {currentHymn.meter && (
            <Text style={[styles.metaPillText, { color: colors.secondary }]}>
              Meter: {currentHymn.meter}
            </Text>
          )}
        </View>

        {/* Scrubber / Progress Bar */}
        <View style={styles.scrubberSection}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSeek}
            style={[styles.progressTrack, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: colors.secondary,
                },
              ]}
            />
            <View
              style={[
                styles.scrubberThumb,
                {
                  left: `${progress * 100}%`,
                  backgroundColor: colors.secondary,
                  borderColor: colors.surface,
                },
              ]}
            />
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatDuration(position / 1000)}
            </Text>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatDuration(duration / 1000)}
            </Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controlsRow}>
          {/* Speed Toggle */}
          <TouchableOpacity
            onPress={nextRate}
            style={[styles.speedBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
          >
            <Text style={[styles.speedBtnText, { color: colors.text }]}>
              {playbackRate}x
            </Text>
          </TouchableOpacity>

          {/* 10s Rewind */}
          <TouchableOpacity
            onPress={() => seekTo(Math.max(0, position - 10000))}
            style={styles.seekBtn}
          >
            <IconPlayerTrackPrev size={30} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>

          {/* Play/Pause Hero Button */}
          <TouchableOpacity
            onPress={togglePlayPause}
            style={[styles.playHeroBtn, { backgroundColor: colors.primary }]}
          >
            {isPlaying ? (
              <IconPlayerPauseFilled size={36} color="#FFFFFF" />
            ) : (
              <IconPlayerPlayFilled size={36} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          {/* 10s Forward */}
          <TouchableOpacity
            onPress={() => seekTo(Math.min(duration, position + 10000))}
            style={styles.seekBtn}
          >
            <IconPlayerTrackNext size={30} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>

          {/* Stop / Dismiss */}
          <TouchableOpacity
            onPress={stop}
            style={[styles.speedBtn, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
          >
            <IconPlayerStop size={20} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 30 }} />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  iconBtn: {
    padding: 8,
  },
  headerTitleBlock: {
    alignItems: "center",
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  artworkContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
  },
  discOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  discInner: {
    width: 170,
    height: 170,
    borderRadius: 85,
    justifyContent: "center",
    alignItems: "center",
  },
  discNumberText: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "900",
  },
  discSubText: {
    color: "#C89D3C",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 2,
  },
  infoSection: {
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  hymnTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 6,
  },
  composerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  scrubberSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  scrubberThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    marginLeft: -8,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 10,
  },
  speedBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  speedBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  seekBtn: {
    padding: 8,
  },
  playHeroBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
});

export default FullPlayerModal;
