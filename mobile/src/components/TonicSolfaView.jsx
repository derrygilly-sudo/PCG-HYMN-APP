// src/components/TonicSolfaView.jsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { getThemeColors } from '../theme/theme';

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

const TonicSolfaView = ({ tonicSolfa, solfaPdfUrl, scorePdfUrl }) => {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);
  const hasPdf = !!(solfaPdfUrl || scorePdfUrl);

  if (!tonicSolfa && !hasPdf) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Tonic solfa not available
        </Text>
      </View>
    );
  }

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
          <Text style={[styles.label, { color: colors.primary }]}>Tonic Solfa</Text>
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
    borderRadius: 10,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  notation: {
    fontSize: 16,
    fontFamily: undefined,
    lineHeight: 28,
    letterSpacing: 1,
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
    fontSize: 16,
    fontStyle: 'italic',
  },
});

export default TonicSolfaView;
