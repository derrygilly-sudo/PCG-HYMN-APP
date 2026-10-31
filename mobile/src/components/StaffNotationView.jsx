// src/components/StaffNotationView.jsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { getThemeColors } from '../theme/theme';
import PdfScoreViewer from './PdfScoreViewer';

const StaffNotationView = ({ staffNotation, hymn }) => {
  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);

  if (!staffNotation) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Staff notation PDF not available for this hymn
        </Text>
      </View>
    );
  }

  return (
    <PdfScoreViewer
      rawUrl={staffNotation}
      hymn={hymn}
      scoreType="staff"
      label="Staff Notation"
    />
  );
};

const styles = StyleSheet.create({
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontStyle: 'italic',
  },
});

export default StaffNotationView;
