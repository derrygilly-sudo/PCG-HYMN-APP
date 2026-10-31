// src/screens/HymnListScreen.jsx
import {
  IconCircleX,
  IconDialpad,
  IconHeart,
  IconMusic,
  IconSearch,
} from "@tabler/icons-react-native";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import HymnCard from "../components/HymnCard";
import LanguageToggle from "../components/LanguageToggle";
import MiniPlayer from "../components/MiniPlayer";
import QuickDialPadModal from "../components/QuickDialPadModal";
import SearchBar from "../components/SearchBar";
import { useHymnStore } from "../stores/hymnStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getThemeColors } from "../theme/theme";

const HymnListScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'audio' | 'favorites'
  const [showDialPad, setShowDialPad] = useState(false);

  const {
    hymns,
    searchResults,
    selectedCategory,
    loadHymns,
    searchHymns,
    clearSearch,
    filterByCategory,
    // getHymnsWithAudio,
  } = useHymnStore();

  const darkMode = useSettingsStore((state) => state.darkMode);
  const colors = getThemeColors(darkMode);

  useEffect(() => {
    loadHymns();
  }, [loadHymns]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchHymns(query);
    } else {
      clearSearch();
    }
  };

  const getFilteredHymns = () => {
    let list = searchQuery.trim() ? searchResults : hymns;
    if (activeFilter === "audio") {
      list = list.filter((h) => !!h.audio_url);
    } else if (activeFilter === "favorites") {
      list = list.filter((h) => !!h.is_favorite);
    }
    return list;
  };

  const displayHymns = getFilteredHymns();

  const handleSelectHymn = (hymn) => {
    navigation.navigate("HymnDetail", {
      hymnId: hymn.id,
      hymnNumber: hymn.hymn_number,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Language Toggle */}
      <LanguageToggle />

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearch}
        onClear={() => {
          setSearchQuery("");
          clearSearch();
        }}
        placeholder="Search by number, title, lyrics, composer..."
      />

      {/* Active Category Filter Tag */}
      {selectedCategory && (
        <View
          style={[
            styles.categoryTagBar,
            { backgroundColor: colors.surfaceCard, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.categoryTagText, { color: colors.primary }]}>
            Filtered by Category
          </Text>
          <TouchableOpacity
            onPress={() => filterByCategory(null)}
            style={styles.clearCatBtn}
          >
            <IconCircleX size={18} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.clearCatText, { color: colors.textSecondary }]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Quick Pills */}
      <View style={styles.filterPillsRow}>
        {[
          { key: "all", label: `All (${hymns.length})` },
          { key: "audio", label: "With Audio", IconComponent: IconMusic },
          { key: "favorites", label: "Favorites", IconComponent: IconHeart },
        ].map((pill) => {
          const isSelected = activeFilter === pill.key;
          const iconColor = isSelected ? "#FFFFFF" : colors.textSecondary;
          return (
            <TouchableOpacity
              key={pill.key}
              style={[
                styles.filterPill,
                {
                  backgroundColor: isSelected
                    ? colors.primary
                    : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveFilter(pill.key)}
            >
              {pill.IconComponent && (
                <pill.IconComponent
                  size={14}
                  color={iconColor}
                  strokeWidth={2}
                />
              )}
              <Text
                style={[
                  styles.filterPillText,
                  { color: isSelected ? "#FFFFFF" : colors.text },
                ]}
              >
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Hymn List */}
      <FlatList
        data={displayHymns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HymnCard hymn={item} onPress={() => handleSelectHymn(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSearch size={48} color={colors.textLight} strokeWidth={1.5} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Hymns Found
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Try searching with another number, title, or lyric keywords.
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Keypad Dial Button */}
      <TouchableOpacity
        style={[
          styles.floatingDialBtn,
          {
            backgroundColor: colors.secondary,
            shadowColor: colors.primary,
          },
        ]}
        onPress={() => setShowDialPad(true)}
        activeOpacity={0.85}
      >
        <IconDialpad size={24} color="#000000" strokeWidth={2} />
      </TouchableOpacity>

      {/* Quick Dial Pad Modal */}
      <QuickDialPadModal
        visible={showDialPad}
        onClose={() => setShowDialPad(false)}
        onSelectHymn={handleSelectHymn}
      />

      <MiniPlayer />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  categoryTagBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryTagText: {
    fontSize: 13,
    fontWeight: "700",
  },
  clearCatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearCatText: {
    fontSize: 12,
    fontWeight: "600",
  },
  filterPillsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    paddingBottom: 110,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  floatingDialBtn: {
    position: "absolute",
    right: 20,
    bottom: 140,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 50,
  },
});

export default HymnListScreen;