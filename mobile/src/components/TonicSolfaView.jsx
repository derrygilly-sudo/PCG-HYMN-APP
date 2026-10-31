// src/components/TonicSolfaView.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { getThemeColors } from '../theme/theme';
import { isPdfDocument } from '../services/pdfService';
import PdfScoreViewer from './PdfScoreViewer';

const openPdf = async (url) => {
  try {
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert('Cannot open PDF', 'Check your internet connection and try again.');
  }
};

const PdfButton = ({ label, url, colors }) => (
  <TouchableOpacity
    style={[styles.pdfButton, { backgroundColor: colors.surface, borderColor: colors.primary }]}
    onPress={() => openPdf(url)}
    activeOpacity={0.7}
  >
    <Text style={[styles.pdfButtonText, { color: colors.primary }]}>📄 {label}</Text>
  </TouchableOpacity>
);

const TonicSolfaView = ({
  tonicSolfa,
  solfaPdfUrl,
  scorePdfUrl,
  hymn,
}) => {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);
  const hasPdf = !!(solfaPdfUrl || scorePdfUrl);

  if (!tonicSolfa && !hasPdf) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Tonic sol-fa not available for this hymn
        </Text>
      </View>
    );
  }

  // If the tonic sol-fa is a PDF document (URL or file)
  if (isPdfDocument(tonicSolfa)) {
    return (
      <PdfScoreViewer
        rawUrl={tonicSolfa}
        hymn={hymn}
        scoreType="solfa"
        label="Tonic Sol-fa Notation"
      />
    );
  }

  // Legacy plain-text tonic sol-fa notation
  return (
    <View>
      {hasPdf && (
        <View style={styles.pdfRow}>
          {solfaPdfUrl ? (
            <PdfButton label="Open Tonic Sol-fa (PDF)" url={solfaPdfUrl} colors={colors} />
          ) : null}
          {scorePdfUrl ? (
            <PdfButton label="Open Music Score (PDF)" url={scorePdfUrl} colors={colors} />
          ) : null}
        </View>
      )}

      {tonicSolfa ? (
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: colors.primary }]}>Tonic Sol-fa Notation</Text>
            <View style={[styles.badge, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.secondary }]}>Text Notation</Text>
            </View>
          </View>
          <Text style={[styles.notation, { color: colors.text }]}>{tonicSolfa}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notation: {
    fontSize: 15,
    fontFamily: undefined,
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  pdfRow: {
    marginHorizontal: 16,
    marginTop: 8,
    gap: 10,
  },
  pdfButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  pdfButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontStyle: 'italic',
  },
});

export default TonicSolfaView;
