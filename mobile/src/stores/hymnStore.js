// src/stores/hymnStore.js
import { create } from "zustand";
import {
  addFavorite as dbAddFavorite,
  addHymnToPlaylist as dbAddHymnToPlaylist,
  addToHistory as dbAddToHistory,
  clearHistory as dbClearHistory,
  createPlaylist as dbCreatePlaylist,
  deletePlaylist as dbDeletePlaylist,
  getAllCategories as dbGetAllCategories,
  getAllHymns,
  getAllPlaylists as dbGetAllPlaylists,
  getDownloads as dbGetDownloads,
  getFavorites as dbGetFavorites,
  getHistory as dbGetHistory,
  getHymnCount,
  getHymnsByCategory as dbGetHymnsByCategory,
  removeFavorite as dbRemoveFavorite,
  removeHymnFromPlaylist as dbRemoveHymnFromPlaylist,
  searchHymns as dbSearchHymns,
} from "../database/localDb";

export const useHymnStore = create((set, get) => ({
  hymns: [],
  favorites: [],
  playlists: [],
  downloads: [],
  history: [],
  categories: [],
  searchResults: [],
  activeCategoryFilter: null,
  selectedCategory: null,
  totalHymns: 0,
  isLoading: false,
  error: null,

  loadHymns: () => {
    set({ isLoading: true });
    try {
      const hymns = getAllHymns();
      const count = getHymnCount();
      set({ hymns, totalHymns: count, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      console.error("Error loading hymns:", error);
    }
  },

  searchHymns: (query) => {
    if (!query || query.trim() === "") {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = dbSearchHymns(query.trim());
      set({ searchResults: results });
    } catch (error) {
      console.error("Search error:", error);
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  loadFavorites: () => {
    try {
      const favorites = dbGetFavorites();
      set({ favorites });
    } catch (error) {
      console.error("Error loading favorites:", error);
    }
  },

  toggleFavorite: (hymnId) => {
    try {
      const current = get().favorites;
      const isFav = current.some((h) => h.id === hymnId);
      if (isFav) {
        dbRemoveFavorite(hymnId);
      } else {
        dbAddFavorite(hymnId);
      }
      const favorites = dbGetFavorites();
      const hymns = getAllHymns();
      set({ favorites, hymns });
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  },

  loadHistory: () => {
    try {
      const history = dbGetHistory();
      set({ history });
    } catch (error) {
      console.error("Error loading history:", error);
    }
  },

  recordHymnView: (hymnId) => {
    try {
      dbAddToHistory(hymnId);
      const history = dbGetHistory();
      set({ history });
    } catch (error) {
      console.error("Error recording hymn view:", error);
    }
  },

  clearHistory: () => {
    try {
      dbClearHistory();
      set({ history: [] });
    } catch (error) {
      console.error("Error clearing history:", error);
    }
  },

  loadPlaylists: () => {
    try {
      const playlists = dbGetAllPlaylists();
      set({ playlists });
    } catch (error) {
      console.error("Error loading playlists:", error);
    }
  },

  createPlaylist: (name, description) => {
    try {
      dbCreatePlaylist(name, description);
      const playlists = dbGetAllPlaylists();
      set({ playlists });
    } catch (error) {
      console.error("Error creating playlist:", error);
    }
  },

  deletePlaylist: (playlistId) => {
    try {
      dbDeletePlaylist(playlistId);
      const playlists = dbGetAllPlaylists();
      set({ playlists });
    } catch (error) {
      console.error("Error deleting playlist:", error);
    }
  },

  addToPlaylist: (playlistId, hymnId) => {
    try {
      dbAddHymnToPlaylist(playlistId, hymnId);
      const playlists = dbGetAllPlaylists();
      set({ playlists });
    } catch (error) {
      console.error("Error adding to playlist:", error);
    }
  },

  removeFromPlaylist: (playlistId, hymnId) => {
    try {
      dbRemoveHymnFromPlaylist(playlistId, hymnId);
      const playlists = dbGetAllPlaylists();
      set({ playlists });
    } catch (error) {
      console.error("Error removing from playlist:", error);
    }
  },

  loadDownloads: () => {
    try {
      const downloads = dbGetDownloads();
      set({ downloads });
    } catch (error) {
      console.error("Error loading downloads:", error);
    }
  },

  loadCategories: () => {
    try {
      const categories = dbGetAllCategories();
      set({ categories });
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  },

  filterByCategory: (categoryId) => {
    if (!categoryId) {
      set({ activeCategoryFilter: null, selectedCategory: null });
      get().loadHymns();
      return;
    }
    try {
      const filtered = dbGetHymnsByCategory(categoryId);
      set({ hymns: filtered, activeCategoryFilter: categoryId, selectedCategory: categoryId });
    } catch (error) {
      console.error("Error filtering category:", error);
    }
  },

  getHymnsWithAudio: () => {
    return (get().hymns || []).filter((h) => !!h.audio_url);
  },
}));
