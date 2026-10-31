// src/components/DownloadButton.jsx
import {
  IconCloudCheck,
  IconDownload,
} from "@tabler/icons-react-native";
import React, { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { deleteDownloadedAudio, downloadAudio } from "../services/audioService";
import {
  deleteCachedPdf,
  downloadAndCachePdf,
  isPdfDocument,
} from "../services/pdfService";
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
    const pdfTargets = [
      { type: "solfa", url: hymn.solfa_pdf_url },
      {
        type: "solfa",
        url: isPdfDocument(hymn.tonic_solfa) ? hymn.tonic_solfa : null,
      },
      { type: "staff", url: hymn.score_pdf_url },
      { type: "staff", url: hymn.staff_notation },
    ].filter((target) => target.url);

    if (!audioUrl && pdfTargets.length === 0) {
      Alert.alert("No Media", "This hymn does not have audio or PDF scores attached.");
      return;
    }

    setIsDownloading(true);
    setProgress(0);

    let audioSuccess = !audioUrl;
    let pdfResults = [];
    try {
      if (audioUrl) {
        const result = await downloadAudio(
          hymn.id,
          audioUrl,
          setProgress,
          tuneId,
        );
        audioSuccess = result.success;
      }

      if (!tune) {
        pdfResults = await Promise.all(
          pdfTargets.map(({ type, url }) =>
            downloadAndCachePdf(hymn.id, type, url),
          ),
        );
      }
    } finally {
      setIsDownloading(false);
    }

    const pdfSuccess = pdfResults.every((result) => result.success);
    if (audioSuccess) {
      await loadDownloads();
      await loadHymns();
      if (onChanged) onChanged();
      if (pdfSuccess) {
        const downloadedContent = [
          audioUrl ? (tune ? tune.name : "Audio") : null,
          pdfResults.length ? "sheet scores" : null,
        ]
          .filter(Boolean)
          .join(" and ");
        Alert.alert(
          "Downloaded",
          `${downloadedContent} saved for offline use.`,
        );
      } else {
        Alert.alert(
          "Partially Downloaded",
          "Audio was saved, but one or more sheet scores could not be cached.",
        );
      }
    } else {
      Alert.alert("Error", "Failed to download media. Please try again.");
    }
  };

  const handleDelete = () => {
    Alert.alert("Remove Download", "Delete saved audio and offline scores from your device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (audioUrl) {
            await deleteDownloadedAudio(hymn.id, tuneId);
          }
          if (!tune) {
            await deleteCachedPdf(hymn.id, "solfa");
            await deleteCachedPdf(hymn.id, "staff");
          }
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