# 📱 PCG Hymnal Mobile App (React Native / Expo)

Cross-platform mobile application for the **Presbyterian Church of Ghana Hymnal**, built with React Native and Expo.

---

## 🚀 Key Features

- **Offline-First SQLite Storage**: Fast local queries and offline access using `expo-sqlite`.
- **Bilingual Hymns**: English (`lyrics_en`, `title_en`) and Twi (`lyrics_twi`, `title_twi`).
- **Tonic Sol-fa Notation**: In-app sol-fa sheet viewer for choristers and instrumentalists.
- **Audio Streaming & Offline Downloads**: Stream via `expo-audio` or download MP3s to device storage with `expo-file-system`.
- **Floating Mini Player & Expandable Modal Player**: Seamless audio playback throughout the app.
- **Smart Search & Quick Dialpad**: Instant number jump and fuzzy search with `fuse.js`.
- **Personal Library**: Custom playlists, favorite bookmarks, and recent history.
- **Creeds & Liturgies**: Full Apostles' Creed, Nicene Creed, and service orders.
- **Dark Mode & Dynamic Typography**: Theme customizer with font size adjustment.
- **Supabase Cloud Sync**: Automatic delta synchronization for new/updated hymns.

---

## 🛠 Tech Stack

- **Framework**: React Native 0.86.3 / Expo SDK 57
- **Navigation**: React Navigation v7 (Bottom Tabs + Stack)
- **State Management**: Zustand v5
- **Local DB**: Expo SQLite (WAL mode)
- **Backend / Sync**: Supabase JS Client v2
- **Audio**: Expo Audio & Expo File System
- **Icons**: Tabler Icons React Native

---

## 📦 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Backend
Check `src/config/supabase.js` to ensure the Supabase URL and anonymous key match your project backend.

### 3. Run Locally
```bash
# Start Expo development server
npx expo start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run in Web browser
npm run web
```

---

## 📂 Directory Structure

- `src/components/`: Reusable UI elements (Audio player, dials, presentation cards, lyrics viewer)
- `src/config/`: Supabase client configuration
- `src/data/`: Built-in liturgy and creed definitions
- `src/database/`: SQLite database initialization and queries (`localDb.js`)
- `src/navigation/`: App navigation stacks and tab bars (`AppNavigator.jsx`)
- `src/screens/`: Screen components (`HomeScreen`, `HymnDetailScreen`, `LibraryScreen`, etc.)
- `src/services/`: Audio caching, delta sync engine, and search services
- `src/stores/`: Zustand state management (`hymnStore`, `playerStore`, `settingsStore`)
- `src/theme/`: Theme palettes and styling tokens
