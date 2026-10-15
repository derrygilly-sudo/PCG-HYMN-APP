// src/components/DownloadButton.jsx
import {
  IconCloudCheck,
  IconDownload,
} from "@tabler/icons-react-native";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { deleteDownloadedAudio, downloadAudio } from "../services/audioService";
import { useHymnStore } from "../stores/hymnStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors } from "../theme/theme";

// `tune` (optional): which tune to download. Without it the hymn's main audio is used.
// `downloaded` (optional): whether this tune is saved; defaults to hymn.is_downloaded.
// `onChanged` (optional): called after a download or delete finishes.
const DownloadButton = ({ hymn, tune = null, downloaded, onChanged, compact = false }) => {
  const audioUrl = tune ? tune.audio_url : hymn.audio_url;
  const tuneId = tune ? tune.id : "main";
  const isSaved = downloaded !== undefined ? downloaded : !!hymn.is_downloaded;
  const buttonSize = compact ? styles.buttonCompact : null;
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const loadDownloads = useHymnStore((state) => state.loadDownloads);
  const loadHymns = useHymnStore((state) => state.loadHymns);
  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);

  const handleDownload = async () => {
    if (!audioUrl) {
      Alert.alert("No Audio", "This hymn does not have an audio track yet.");
      return;
    }

    setIsDownloading(true);
    setProgress(0);

    const result = await downloadAudio(
      hymn.id,
      audioUrl,
      (p) => {
        setProgress(p);
      },
      tuneId,
    );

    setIsDownloading(false);

    if (result.success) {
      await loadDownloads();
      await loadHymns();
      if (onChanged) onChanged();
      Alert.alert(
        "Downloaded",
        `${tune ? tune.name : "Audio"} saved for offline playback.`,
      );
    } else {
      Alert.alert("Error", "Failed to download audio. Please try again.");
    }
  };

  const handleDelete = () => {
    Alert.alert("Remove Download", "Delete this audio from your device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteDownloadedAudio(hymn.id, tuneId);
          await loadDownloads();
          await loadHymns();
          if (onChanged) onChanged();
        },
      },
    ]);
  };

  if (isDownloading) {
    return (
      <View style={[styles.button, buttonSize, { backgroundColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    );
  }

  if (isSaved) {
    return (
      <TouchableOpacity
        style={[styles.button, buttonSize, { backgroundColor: colors.surfaceCard, borderColor: colors.border, borderWidth: 1 }]}
        onPress={handleDelete}
      >
        <IconCloudCheck size={20} color={colors.primary} strokeWidth={2} />
        <Text style={[styles.buttonText, { color: colors.primary }]}>Saved</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, buttonSize, { backgroundColor: colors.surfaceCard, borderColor: colors.border, borderWidth: 1 }]}
      onPress={handleDownload}
    >
      <IconDownload size={20} color={colors.text} strokeWidth={2} />
      <Text style={[styles.buttonText, { color: colors.text }]}>Download</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 6,
  },
  buttonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});

export default DownloadButton;