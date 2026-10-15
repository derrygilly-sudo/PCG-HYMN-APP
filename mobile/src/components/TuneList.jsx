// src/components/TuneList.jsx
// Shows every audio tune of a hymn, each with its own play and download button.
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getTuneDownloads } from "../database/localDb";
import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors } from "../theme/theme";
import DownloadButton from "./DownloadButton";

const TuneList = ({ hymn, tunes, onPlay, onDownloadChanged }) => {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);

  const currentHymn = usePlayerStore((state) => state.currentHymn);
  const currentTune = usePlayerStore((state) => state.currentTune);
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  const [downloadedIds, setDownloadedIds] = useState(new Set());

  const refreshDownloads = useCallback(() => {
    try {
      const rows = getTuneDownloads(hymn.id);
      setDownloadedIds(new Set(rows.map((r) => r.tune_id)));
    } catch (e) {
      setDownloadedIds(new Set());
    }
  }, [hymn.id]);

  useEffect(() => {
    refreshDownloads();
  }, [refreshDownloads]);

  const handleChanged = () => {
    refreshDownloads();
    if (onDownloadChanged) onDownloadChanged();
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.text }]}>
        Tunes ({tunes.length})
      </Text>

      {tunes.map((tune, index) => {
        const isActive = currentHymn?.id === hymn.id && currentTune?.id === tune.id;
        const isThisPlaying = isActive && isPlaying;
        const isSaved = downloadedIds.has(tune.id);

        let status = "Tap to play";
        if (isThisPlaying) status = "Now playing";
        else if (isActive) status = "Paused";
        else if (isSaved) status = "Saved offline";

        return (
          <View
            key={tune.id}
            style={[
              styles.row,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: isActive ? colors.primary : colors.border,
                borderWidth: isActive ? 2 : 1,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.playArea}
              activeOpacity={0.7}
              onPress={() => onPlay(tune)}
            >
              <View
                style={[
                  styles.playCircle,
                  { backgroundColor: isThisPlaying ? colors.secondary : colors.primary },
                ]}
              >
                {isThisPlaying ? (
                  <IconPlayerPauseFilled size={20} color="#000000" />
                ) : (
                  <IconPlayerPlayFilled size={20} color="#FFFFFF" />
                )}
              </View>

              <View style={styles.textWrap}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {index + 1}. {tune.name}
                </Text>
                <Text style={[styles.status, { color: colors.textSecondary }]}>
                  {status}
                </Text>
              </View>
            </TouchableOpacity>

            <DownloadButton
              hymn={hymn}
              tune={tune}
              downloaded={isSaved}
              onChanged={handleChanged}
              compact
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 8,
    gap: 10,
  },
  heading: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    gap: 8,
  },
  playArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  playCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
});

export default TuneList;
