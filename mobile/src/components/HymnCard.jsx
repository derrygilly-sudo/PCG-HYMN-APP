// src/components/HymnCard.jsx
import {
  IconChevronRight,
  IconCloudCheck,
  IconHeartFilled,
  IconMusic,
} from "@tabler/icons-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors, theme } from "../theme/theme";
import { LANGUAGES } from "../utils/constants";
import { getFirstVerse } from "../utils/helpers";

const HymnCard = ({ hymn, onPress, showPreview = true }) => {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const language = useSettingsStore((state) => state.language);
  const colors = getThemeColors(darkMode);

  const title =
    language === LANGUAGES.TWI && hymn.title_twi
      ? hymn.title_twi
      : hymn.title_en;
  const secondaryTitle =
    language === LANGUAGES.TWI ? hymn.title_en : hymn.title_twi;

  const lyrics =
    language === LANGUAGES.TWI && hymn.lyrics_twi
      ? hymn.lyrics_twi
      : hymn.lyrics_en;
  const preview = getFirstVerse(lyrics);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {/* Left Hymn Number Badge */}
      <View style={styles.numberContainer}>
        <View
          style={[
            styles.numberBadge,
            {
              backgroundColor: colors.surfaceCard,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.number, { color: colors.primary }]}>
            {hymn.hymn_number}
          </Text>
        </View>
      </View>

      {/* Center Details */}
      <View style={styles.content}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {secondaryTitle ? (
          <Text
            style={[styles.secondaryTitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {secondaryTitle}
          </Text>
        ) : null}

        {showPreview && preview ? (
          <Text
            style={[styles.preview, { color: colors.textLight }]}
            numberOfLines={2}
          >
            {preview}
          </Text>
        ) : null}

        {/* Metadata Badges */}
        <View style={styles.metaRow}>
          {hymn.composer ? (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {hymn.composer}
            </Text>
          ) : null}
          {hymn.meter ? (
            <View
              style={[
                styles.meterPill,
                { backgroundColor: colors.surfaceCard, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.meterText, { color: colors.secondary }]}>
                {hymn.meter}
              </Text>
            </View>
          ) : null}
          {(hymn.staff_notation || hymn.tonic_solfa) ? (
            <View
              style={[
                styles.meterPill,
                { backgroundColor: colors.surfaceCard, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.meterText, { color: colors.primary }]}>
                {hymn.staff_notation ? "♫ Score" : "Sol-fa"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Right Icons */}
      <View style={styles.icons}>
        {hymn.is_favorite ? (
          <IconHeartFilled
            size={16}
            color={theme.colors.error}
            style={styles.icon}
          />
        ) : null}
        {hymn.is_downloaded ? (
          <IconCloudCheck
            size={16}
            color={colors.primary}
            strokeWidth={2}
            style={styles.icon}
          />
        ) : null}
        {hymn.audio_url ? (
          <IconMusic
            size={16}
            color={colors.secondary}
            strokeWidth={2}
            style={styles.icon}
          />
        ) : null}
        <IconChevronRight
          size={18}
          color={colors.textLight}
          strokeWidth={2}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  numberContainer: {
    marginRight: 14,
  },
  numberBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  number: {
    fontWeight: "800",
    fontSize: 16,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  secondaryTitle: {
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 4,
  },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  meterPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  meterText: {
    fontSize: 10,
    fontWeight: "700",
  },
  icons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  icon: {
    marginRight: 2,
  },
});

export default HymnCard;