// src/database/localDb.js
import * as SQLite from "expo-sqlite";

let db = null;

export const getDb = () => {
  if (!db) {
    db = SQLite.openDatabaseSync("hymnapp.db");
  }
  return db;
};

export const initDatabase = async () => {
  const database = getDb();

  database.execSync(`PRAGMA journal_mode = WAL`);
  database.execSync(`PRAGMA foreign_keys = ON`);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS hymns (
      id TEXT PRIMARY KEY,
      hymn_number INTEGER NOT NULL UNIQUE,
      category_id TEXT,
      title_en TEXT NOT NULL,
      title_twi TEXT,
      lyrics_en TEXT NOT NULL,
      lyrics_twi TEXT,
      tonic_solfa TEXT,
      composer TEXT,
      scripture_reference TEXT,
      meter TEXT,
      key_signature TEXT,
      audio_url TEXT,
      audio_duration INTEGER DEFAULT 0,
      audio_size_bytes INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 1,
      updated_at TEXT,
      created_at TEXT
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_twi TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS favorites (
      hymn_id TEXT PRIMARY KEY,
      added_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS history (
      hymn_id TEXT PRIMARY KEY,
      viewed_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS playlist_hymns (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      hymn_id TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS downloads (
      hymn_id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      downloaded_at TEXT DEFAULT (datetime('now'))
    )
  `);

  database.execSync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_hymns_number ON hymns(hymn_number)
  `);

  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_hymns_title_en ON hymns(title_en)
  `);

  database.execSync(`
    CREATE INDEX IF NOT EXISTS idx_playlist_hymns_playlist 
    ON playlist_hymns(playlist_id)
  `);

  // Migration: add PDF columns to hymns tables created by older app versions
  const hymnColumns = database
    .getAllSync(`PRAGMA table_info(hymns)`)
    .map((col) => col.name);
  if (!hymnColumns.includes("score_pdf_url")) {
    database.execSync(`ALTER TABLE hymns ADD COLUMN score_pdf_url TEXT`);
  }
  if (!hymnColumns.includes("solfa_pdf_url")) {
    database.execSync(`ALTER TABLE hymns ADD COLUMN solfa_pdf_url TEXT`);
  }
  if (!hymnColumns.includes("tunes_json")) {
    database.execSync(`ALTER TABLE hymns ADD COLUMN tunes_json TEXT`);
  }

  // One row per downloaded tune (a hymn can have several tunes)
  database.execSync(`
    CREATE TABLE IF NOT EXISTS tune_downloads (
      hymn_id TEXT NOT NULL,
      tune_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      downloaded_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (hymn_id, tune_id)
    )
  `);

  // One-time: older single-audio downloads become the "main" tune
  const tuneMigrated = database.getFirstSync(
    `SELECT value FROM sync_meta WHERE key = ?`,
    ["tune_downloads_migrated"],
  );
  if (!tuneMigrated) {
    database.execSync(`
      INSERT OR IGNORE INTO tune_downloads (hymn_id, tune_id, file_path, file_size, downloaded_at)
      SELECT hymn_id, 'main', file_path, file_size, downloaded_at FROM downloads
    `);
    database.runSync(
      `INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`,
      ["tune_downloads_migrated", "1"],
    );
  }

  const existing = database.getFirstSync(
    `SELECT value FROM sync_meta WHERE key = ?`,
    ["last_synced_at"],
  );

  if (!existing) {
    database.runSync(`INSERT INTO sync_meta (key, value) VALUES (?, ?)`, [
      "last_synced_at",
      "2000-01-01T00:00:00Z",
    ]);
  }

  // Seed standard church categories if table is empty
  const categoryCount = database.getFirstSync(`SELECT COUNT(*) as count FROM categories`);
  if (!categoryCount || categoryCount.count === 0) {
    const defaultCategories = [
      { id: "cat_praise", name_en: "Praise & Adoration", name_twi: "Nkamfoɔ Ne Nnaase", sort_order: 1 },
      { id: "cat_morning", name_en: "Morning & Evening", name_twi: "Anɔpa Ne Anwummere", sort_order: 2 },
      { id: "cat_communion", name_en: "Holy Communion", name_twi: "Awurade Aduane", sort_order: 3 },
      { id: "cat_baptism", name_en: "Baptism & Confirmation", name_twi: "Asubɔ Ne Ɔsom Hyehyɛɛ", sort_order: 4 },
      { id: "cat_prayer", name_en: "Prayer & Supplication", name_twi: "Mpaebɔ Ne Nsrɛ", sort_order: 5 },
      { id: "cat_faith", name_en: "Faith & Trust", name_twi: "Gyedie Ne Ahotɔsoɔ", sort_order: 6 },
      { id: "cat_easter", name_en: "Cross & Resurrection", name_twi: "Asɛndua Ne Wusɔreɛ", sort_order: 7 },
      { id: "cat_funeral", name_en: "Comfort & Eternal Hope", name_twi: "Aweredikyekye Ne Anidasoɔ", sort_order: 8 },
    ];
    for (const cat of defaultCategories) {
      database.runSync(
        `INSERT OR IGNORE INTO categories (id, name_en, name_twi, sort_order) VALUES (?, ?, ?, ?)`,
        [cat.id, cat.name_en, cat.name_twi, cat.sort_order]
      );
    }
  }

  console.log("Database initialized successfully");
  return database;
};

// ============ HYMN QUERIES ============

export const getAllHymns = () => {
  const database = getDb();
  return database.getAllSync(
    `SELECT h.*, 
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded
    FROM hymns h
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.is_published = 1
    ORDER BY h.hymn_number ASC`,
  );
};

export const getHymnById = (id) => {
  const database = getDb();
  return database.getFirstSync(
    `SELECT h.*, 
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded,
      d.file_path as local_audio_path
    FROM hymns h
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.id = ?`,
    [id],
  );
};

export const getHymnByNumber = (number) => {
  const database = getDb();
  return database.getFirstSync(
    `SELECT h.*, 
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded
    FROM hymns h
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.hymn_number = ? AND h.is_published = 1`,
    [number],
  );
};

export const searchHymns = (query) => {
  const database = getDb();
  const searchTerm = `%${query}%`;
  return database.getAllSync(
    `SELECT h.*, 
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded
    FROM hymns h
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.is_published = 1
    AND (
      CAST(h.hymn_number AS TEXT) LIKE ?
      OR h.title_en LIKE ?
      OR h.title_twi LIKE ?
      OR h.lyrics_en LIKE ?
      OR h.lyrics_twi LIKE ?
      OR h.composer LIKE ?
      OR h.scripture_reference LIKE ?
    )
    ORDER BY h.hymn_number ASC`,
    [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm],
  );
};

export const getHymnsByCategory = (categoryId) => {
  const database = getDb();
  return database.getAllSync(
    `SELECT h.*, 
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded
    FROM hymns h
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.category_id = ? AND h.is_published = 1
    ORDER BY h.hymn_number ASC`,
    [categoryId],
  );
};

export const insertOrUpdateHymn = (hymn) => {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO hymns 
    (id, hymn_number, category_id, title_en, title_twi, lyrics_en, lyrics_twi, 
     tonic_solfa, composer, scripture_reference, meter, key_signature,
     audio_url, audio_duration, audio_size_bytes, is_published, updated_at, created_at,
     score_pdf_url, solfa_pdf_url, tunes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hymn.id,
      hymn.hymn_number,
      hymn.category_id || null,
      hymn.title_en,
      hymn.title_twi || null,
      hymn.lyrics_en,
      hymn.lyrics_twi || null,
      hymn.tonic_solfa || null,
      hymn.composer || null,
      hymn.scripture_reference || null,
      hymn.meter || null,
      hymn.key_signature || null,
      hymn.audio_url || null,
      hymn.audio_duration || 0,
      hymn.audio_size_bytes || 0,
      hymn.is_published ? 1 : 0,
      hymn.updated_at || null,
      hymn.created_at || null,
      hymn.score_pdf_url || null,
      hymn.solfa_pdf_url || null,
      Array.isArray(hymn.tunes) && hymn.tunes.length > 0
        ? JSON.stringify(hymn.tunes)
        : null,
    ],
  );
};

// ============ FAVORITES ============

export const getFavorites = () => {
  const database = getDb();
  return database.getAllSync(
    `SELECT h.*, 1 as is_favorite, 
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded
    FROM hymns h
    INNER JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.is_published = 1
    ORDER BY f.added_at DESC`,
  );
};

export const addFavorite = (hymnId) => {
  const database = getDb();
  database.runSync(`INSERT OR IGNORE INTO favorites (hymn_id) VALUES (?)`, [
    hymnId,
  ]);
};

export const removeFavorite = (hymnId) => {
  const database = getDb();
  database.runSync(`DELETE FROM favorites WHERE hymn_id = ?`, [hymnId]);
};

export const isFavorite = (hymnId) => {
  const database = getDb();
  const result = database.getFirstSync(
    `SELECT hymn_id FROM favorites WHERE hymn_id = ?`,
    [hymnId],
  );
  return !!result;
};

// ============ HISTORY ============

export const getHistory = () => {
  const database = getDb();
  return database.getAllSync(
    `SELECT h.*, 
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded,
      ht.viewed_at
    FROM hymns h
    INNER JOIN history ht ON h.id = ht.hymn_id
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE h.is_published = 1
    ORDER BY ht.viewed_at DESC
    LIMIT 30`,
  );
};

export const addToHistory = (hymnId) => {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO history (hymn_id, viewed_at) VALUES (?, datetime('now'))`,
    [hymnId],
  );
};

export const clearHistory = () => {
  const database = getDb();
  database.runSync(`DELETE FROM history`);
};

// ============ PLAYLISTS ============

export const getAllPlaylists = () => {
  const database = getDb();
  return database.getAllSync(
    `SELECT p.*, COUNT(ph.id) as hymn_count
    FROM playlists p
    LEFT JOIN playlist_hymns ph ON p.id = ph.playlist_id
    GROUP BY p.id
    ORDER BY p.updated_at DESC`,
  );
};

export const createPlaylist = (name, description = "") => {
  const database = getDb();
  const id = generateUUID();
  database.runSync(
    `INSERT INTO playlists (id, name, description) VALUES (?, ?, ?)`,
    [id, name, description],
  );
  return id;
};

export const deletePlaylist = (playlistId) => {
  const database = getDb();
  database.runSync(`DELETE FROM playlist_hymns WHERE playlist_id = ?`, [
    playlistId,
  ]);
  database.runSync(`DELETE FROM playlists WHERE id = ?`, [playlistId]);
};

export const getPlaylistHymns = (playlistId) => {
  const database = getDb();
  return database.getAllSync(
    `SELECT h.*, ph.sort_order,
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
      CASE WHEN d.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_downloaded
    FROM hymns h
    INNER JOIN playlist_hymns ph ON h.id = ph.hymn_id
    LEFT JOIN favorites f ON h.id = f.hymn_id
    LEFT JOIN downloads d ON h.id = d.hymn_id
    WHERE ph.playlist_id = ?
    ORDER BY ph.sort_order ASC`,
    [playlistId],
  );
};

export const addHymnToPlaylist = (playlistId, hymnId) => {
  const database = getDb();
  const id = generateUUID();
  const maxOrder = database.getFirstSync(
    `SELECT MAX(sort_order) as max_order 
     FROM playlist_hymns WHERE playlist_id = ?`,
    [playlistId],
  );
  const sortOrder = (maxOrder?.max_order || 0) + 1;
  database.runSync(
    `INSERT OR IGNORE INTO playlist_hymns 
     (id, playlist_id, hymn_id, sort_order) VALUES (?, ?, ?, ?)`,
    [id, playlistId, hymnId, sortOrder],
  );
};

export const removeHymnFromPlaylist = (playlistId, hymnId) => {
  const database = getDb();
  database.runSync(
    `DELETE FROM playlist_hymns 
     WHERE playlist_id = ? AND hymn_id = ?`,
    [playlistId, hymnId],
  );
};

// ============ DOWNLOADS ============

export const getDownloads = () => {
  const database = getDb();
  return database.getAllSync(
    `SELECT h.*, d.file_path, d.file_size, d.downloaded_at, 
      1 as is_downloaded,
      CASE WHEN f.hymn_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
    FROM hymns h
    INNER JOIN downloads d ON h.id = d.hymn_id
    LEFT JOIN favorites f ON h.id = f.hymn_id
    ORDER BY d.downloaded_at DESC`,
  );
};

export const addDownloadRecord = (hymnId, filePath, fileSize) => {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO downloads 
     (hymn_id, file_path, file_size) VALUES (?, ?, ?)`,
    [hymnId, filePath, fileSize],
  );
};

export const removeDownloadRecord = (hymnId) => {
  const database = getDb();
  database.runSync(`DELETE FROM downloads WHERE hymn_id = ?`, [hymnId]);
};

// Keeps the one-row-per-hymn "downloads" summary in sync with tune_downloads.
// (Library/Downloads lists and the "is_downloaded" flag use the summary row.)
const refreshDownloadSummary = (hymnId) => {
  const database = getDb();
  const row = database.getFirstSync(
    `SELECT COUNT(*) as c, COALESCE(SUM(file_size), 0) as s, MIN(file_path) as p
     FROM tune_downloads WHERE hymn_id = ?`,
    [hymnId],
  );
  if (row && row.c > 0) {
    const existing = database.getFirstSync(
      `SELECT hymn_id FROM downloads WHERE hymn_id = ?`,
      [hymnId],
    );
    if (existing) {
      database.runSync(
        `UPDATE downloads SET file_path = ?, file_size = ? WHERE hymn_id = ?`,
        [row.p, row.s, hymnId],
      );
    } else {
      database.runSync(
        `INSERT INTO downloads (hymn_id, file_path, file_size) VALUES (?, ?, ?)`,
        [hymnId, row.p, row.s],
      );
    }
  } else {
    database.runSync(`DELETE FROM downloads WHERE hymn_id = ?`, [hymnId]);
  }
};

export const getTuneDownloads = (hymnId) => {
  const database = getDb();
  return database.getAllSync(
    `SELECT tune_id, file_path, file_size FROM tune_downloads WHERE hymn_id = ?`,
    [hymnId],
  );
};

export const addTuneDownload = (hymnId, tuneId, filePath, fileSize) => {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO tune_downloads (hymn_id, tune_id, file_path, file_size)
     VALUES (?, ?, ?, ?)`,
    [hymnId, tuneId, filePath, fileSize],
  );
  refreshDownloadSummary(hymnId);
};

export const removeTuneDownload = (hymnId, tuneId) => {
  const database = getDb();
  database.runSync(
    `DELETE FROM tune_downloads WHERE hymn_id = ? AND tune_id = ?`,
    [hymnId, tuneId],
  );
  refreshDownloadSummary(hymnId);
};

export const getDownloadPath = (hymnId) => {
  const database = getDb();
  const result = database.getFirstSync(
    `SELECT file_path FROM downloads WHERE hymn_id = ?`,
    [hymnId],
  );
  return result?.file_path || null;
};

// ============ CATEGORIES ============

export const getAllCategories = () => {
  const database = getDb();
  return database.getAllSync(
    `SELECT c.*, COUNT(h.id) as hymn_count
     FROM categories c
     LEFT JOIN hymns h ON c.id = h.category_id AND h.is_published = 1
     GROUP BY c.id
     ORDER BY c.sort_order ASC`,
  );
};

export const insertOrUpdateCategory = (category) => {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO categories 
     (id, name_en, name_twi, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      category.id,
      category.name_en,
      category.name_twi || null,
      category.sort_order || 0,
      category.updated_at || null,
    ],
  );
};

// ============ SYNC META ============

export const getSyncMeta = (key) => {
  const database = getDb();
  const result = database.getFirstSync(
    `SELECT value FROM sync_meta WHERE key = ?`,
    [key],
  );
  return result?.value || null;
};

export const setSyncMeta = (key, value) => {
  const database = getDb();
  database.runSync(
    `INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`,
    [key, value],
  );
};

// ============ HELPERS ============

export const getHymnCount = () => {
  const database = getDb();
  const result = database.getFirstSync(
    `SELECT COUNT(*) as count FROM hymns WHERE is_published = 1`,
  );
  return result?.count || 0;
};

export const getDownloadCount = () => {
  const database = getDb();
  const result = database.getFirstSync(
    `SELECT COUNT(*) as count FROM downloads`,
  );
  return result?.count || 0;
};

const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
