// src/utils/tunes.js
// A hymn can have several audio tunes. They are stored as JSON in hymn.tunes_json.
// Older hymns that only have a single audio_url are treated as one "Main Tune".

export const getHymnTunes = (hymn) => {
  if (!hymn) return [];

  let tunes = [];
  if (hymn.tunes_json) {
    try {
      const parsed = JSON.parse(hymn.tunes_json);
      if (Array.isArray(parsed)) {
        tunes = parsed.filter((t) => t && t.audio_url);
      }
    } catch (e) {
      tunes = [];
    }
  }

  if (tunes.length === 0 && hymn.audio_url) {
    tunes = [
      {
        id: "main",
        name: "Main Tune",
        audio_url: hymn.audio_url,
        audio_duration: hymn.audio_duration || 0,
        audio_size_bytes: hymn.audio_size_bytes || 0,
      },
    ];
  }

  return tunes.map((t, i) => ({
    ...t,
    id: String(t.id || `t${i + 1}`),
    name: (t.name && String(t.name).trim()) || `Tune ${i + 1}`,
  }));
};
