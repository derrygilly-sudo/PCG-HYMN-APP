// src/screens/HymnDetailScreen.jsx
import {
  IconArrowsExchange,
  IconHeart,
  IconHeartFilled,
  IconMaximize,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlus,
  IconShare,
} from "@tabler/icons-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DownloadButton from "../components/DownloadButton";
import LanguageToggle from "../components/LanguageToggle";
import LyricsView from "../components/LyricsView";
import PlaylistModal from "../components/PlaylistModal";
import PresentationModal from "../components/PresentationModal";
import TonicSolfaView from "../components/TonicSolfaView";
import TuneList from "../components/TuneList";
import { getHymnById } from "../database/localDb";
import { getLocalAudioPath } from "../services/audioService";
import { useHymnStore } from "../stores/hymnStore";
import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors, theme } from "../theme/theme";
import { LANGUAGES } from "../utils/constants";
import { getHymnTunes } from "../utils/tunes";

const HymnDetailScreen = ({ route }) => {
  const { hymnId } = route.params;
  const [hymn, setHymn] = useState(null);
  const [activeTab, setActiveTab] = useState("lyrics"); // 'lyrics' | 'solfa'
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showPresentationModal, setShowPresentationModal] = useState(false);

  const { toggleFavorite, recordHymnView } = useHymnStore();
  const { loadAndPlay, currentHymn, currentTune, isPlaying, togglePlayPause } =
    usePlayerStore();
  const language = useSettingsStore((state) => state.language);
  const darkMode = useSettingsStore((state) => state.darkMode);
  const bilingualMode = useSettingsStore((state) => state.bilingualMode);
  const toggleBilingualMode = useSettingsStore(
    (state) => state.toggleBilingualMode,
  );
  const colors = getThemeColors(darkMode);

  useEffect(() => {
    loadHymn();
    recordHymnView(hymnId);
  }, [hymnId]);

  const loadHymn = () => {
    const h = getHymnById(hymnId);
    setHymn(h);
  };

  // Plays one specific tune of this hymn (tapping the playing tune pauses/resumes it)
  const handlePlayTune = async (tune) => {
    if (!hymn || !tune) return;

    if (currentHymn?.id === hymn.id && currentTune?.id === tune.id) {
      togglePlayPause();
      return;
    }

    const localPath = await getLocalAudioPath(hymn.id, tune.id);
    const audioUri = localPath || tune.audio_url;

    if (!audioUri) {
      Alert.alert("No Audio", "This tune does not have an audio file yet.");
      return;
    }

    await loadAndPlay(hymn, audioUri, tune);
  };

  const handleFavorite = () => {
    toggleFavorite(hymnId);
    loadHymn();
  };

  const handleShare = async () => {
    if (!hymn) return;
    const title =
      language === LANGUAGES.TWI && hymn.title_twi
        ? hymn.title_twi
        : hymn.title_en;
    const lyrics =
      language === LANGUAGES.TWI && hymn.lyrics_twi
        ? hymn.lyrics_twi
        : hymn.lyrics_en;

    try {
      await Share.share({
        message: `PCG Hymn #${hymn.hymn_number}: ${title}\n\n${lyrics}`,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  if (!hymn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: "center", marginTop: 40 }}>
          Loading hymn...
        </Text>
      </View>
    );
  }

  const title =
    language === LANGUAGES.TWI && hymn.title_twi
      ? hymn.title_twi
      : hymn.title_en;
  const secondaryTitle =
    language === LANGUAGES.TWI ? hymn.title_en : hymn.title_twi;
  const tunes = getHymnTunes(hymn);
  const isCurrentlyPlaying = currentHymn?.id === hymn.id && isPlaying;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hymn Header Card */}
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Top Bar with Number Badge & Actions */}
          <View style={styles.headerTop}>
            <View
              style={[styles.numberBadge, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.numberText}>{hymn.hymn_number}</Text>
            </View>

            <View style={styles.headerActions}>
              {/* Church Presentation Mode Button */}
              <TouchableOpacity
                onPress={() => setShowPresentationModal(true)}
                style={[styles.actionBtn, { backgroundColor: colors.surfaceCard }]}
              >
                <IconMaximize size={16} color={colors.primary} strokeWidth={2} />
                <Text style={[styles.actionBtnLabel, { color: colors.primary }]}>
                  Church View
                </Text>
              </TouchableOpacity>

              {/* Favorite */}
              <TouchableOpacity
                onPress={handleFavorite}
                style={[styles.iconActionBtn, { backgroundColor: colors.surfaceCard }]}
              >
                {hymn.is_favorite ? (
                  <IconHeartFilled size={20} color={theme.colors.error} />
                ) : (
                  <IconHeart size={20} color={colors.text} strokeWidth={2} />
                )}
              </TouchableOpacity>

              {/* Add to playlist */}
              <TouchableOpacity
                onPress={() => setShowPlaylistModal(true)}
                style={[styles.iconActionBtn, { backgroundColor: colors.surfaceCard }]}
              >
                <IconPlus size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.iconActionBtn, { backgroundColor: colors.surfaceCard }]}
              >
                <IconShare size={18} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Titles */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {secondaryTitle ? (
            <Text style={[styles.secondaryTitle, { color: colors.textSecondary }]}>
              {secondaryTitle}
            </Text>
          ) : null}

          {/* Metadata Badges */}
          <View style={styles.metaRow}>
            {hymn.composer ? (
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Composer: {hymn.composer}
              </Text>
            ) : null}
            {hymn.meter ? (
              <View
                style={[
                  styles.meterPill,
                  { backgroundColor: colors.surfaceCard, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.meterPillText, { color: colors.secondary }]}>
                  {hymn.meter}
                </Text>
              </View>
            ) : null}
            {hymn.key_signature ? (
              <View
                style={[
                  styles.meterPill,
                  { backgroundColor: colors.surfaceCard, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.meterPillText, { color: colors.primary }]}>
                  Key: {hymn.key_signature}
                </Text>
              </View>
            ) : null}
          </View>

          {hymn.scripture_reference ? (
            <Text style={[styles.scriptureText, { color: colors.secondary }]}>
              📖 {hymn.scripture_reference}
            </Text>
          ) : null}
        </View>

        {/* View Controls: Language + Bilingual switch */}
        <View style={styles.viewControls}>
          <View style={{ flex: 1 }}>
            <LanguageToggle />
          </View>
          <TouchableOpacity
            style={[
              styles.bilingualBtn,
              {
                backgroundColor: bilingualMode
                  ? colors.secondary
                  : colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
            onPress={toggleBilingualMode}
          >
            <IconArrowsExchange
              size={16}
              color={bilingualMode ? "#000000" : colors.text}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.bilingualText,
                { color: bilingualMode ? "#000000" : colors.text },
              ]}
            >
              Bilingual View
            </Text>
          </TouchableOpacity>
        </View>

        {/* Audio: one tune = single banner, several tunes = a list with a button per tune */}
        {tunes.length === 1 ? (
          <View style={styles.audioRow}>
            <TouchableOpacity
              style={[
                styles.playBanner,
                {
                  backgroundColor: isCurrentlyPlaying
                    ? colors.secondary
                    : colors.primary,
                },
              ]}
              onPress={() => handlePlayTune(tunes[0])}
            >
              {isCurrentlyPlaying ? (
                <IconPlayerPauseFilled size={26} color="#000000" />
              ) : (
                <IconPlayerPlayFilled size={26} color="#FFFFFF" />
              )}
              <Text
                style={[
                  styles.playText,
                  {
                    color: isCurrentlyPlaying ? "#000000" : "#FFFFFF",
                  },
                ]}
              >
                {isCurrentlyPlaying ? "Now Playing (Tap to Pause)" : "Listen to Tune"}
              </Text>
            </TouchableOpacity>

            <DownloadButton hymn={hymn} tune={tunes[0]} onChanged={loadHymn} />
          </View>
        ) : tunes.length > 1 ? (
          <TuneList
            hymn={hymn}
            tunes={tunes}
            onPlay={handlePlayTune}
            onDownloadChanged={loadHymn}
          />
        ) : null}

        {/* Tabs: Lyrics vs Tonic Solfa */}
        <View style={[styles.tabs, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "lyrics" && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 3,
              },
            ]}
            onPress={() => setActiveTab("lyrics")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "lyrics"
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              Lyrics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === "solfa" && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 3,
              },
            ]}
            onPress={() => setActiveTab("solfa")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "solfa"
                      ? colors.primary
                      : colors.textSecondary,
                },
              ]}
            >
              Sol-fa & Score
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === "lyrics" ? (
          <LyricsView hymn={hymn} />
        ) : (
          <TonicSolfaView
          tonicSolfa={hymn.tonic_solfa}
          solfaPdfUrl={hymn.solfa_pdf_url}
          scorePdfUrl={hymn.score_pdf_url}
        />
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Playlist Modal */}
      <PlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        hymnId={hymnId}
      />

      {/* Presentation Fullscreen Modal */}
      <PresentationModal
        visible={showPresentationModal}
        onClose={() => setShowPresentationModal(false)}
        hymn={hymn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  numberBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  numberText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 2,
  },
  secondaryTitle: {
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  meterPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  meterPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scriptureText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  viewControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  bilingualBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  bilingualText: {
    fontSize: 12,
    fontWeight: "700",
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 10,
    gap: 10,
  },
  playBanner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
  },
  playText: {
    fontSize: 15,
    fontWeight: "700",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 10,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "700",
  },
});

export default HymnDetailScreen;
