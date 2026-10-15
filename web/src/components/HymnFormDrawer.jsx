// src/components/HymnFormDrawer.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';
import {
  CloseIcon,
  AudioIcon,
  SolfaIcon,
  SingleCheckIcon,
} from '../config/icons';

const emptyHymn = {
  hymn_number: '',
  title_en: '',
  title_twi: '',
  lyrics_en: '',
  lyrics_twi: '',
  tonic_solfa: '',
  composer: '',
  scripture_reference: '',
  meter: '',
  key_signature: '',
  category_id: '',
  is_published: true,
  audio_url: '',
  score_pdf_url: '',
  solfa_pdf_url: '',
};

const MAX_PDF_MB = 20;

const TUNE_NAME_SUGGESTIONS = [
  'Tune 1',
  'Tune 2',
  'Tune 3',
  'Tune 4',
  'Original Tune',
  'Alternative Tune',
  'Common Tune',
  'Organ Version',
  'Choir Version',
];

const newTuneId = () => `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const makeEmptyTune = (number) => ({
  id: newTuneId(),
  name: `Tune ${number}`,
  audio_url: '',
  audio_duration: 0,
  audio_size_bytes: 0,
  file: null,
  previewUrl: '',
});

// Builds the editable tune list from a hymn row.
// Older hymns that only have a single audio_url become one "Main Tune".
const tunesFromHymn = (data) => {
  let list = Array.isArray(data.tunes) ? data.tunes : [];
  if (list.length === 0 && data.audio_url) {
    list = [
      {
        id: 'main',
        name: 'Main Tune',
        audio_url: data.audio_url,
        audio_duration: data.audio_duration || 0,
        audio_size_bytes: data.audio_size_bytes || 0,
      },
    ];
  }
  return list.map((t, i) => ({
    id: t.id || newTuneId(),
    name: t.name || `Tune ${i + 1}`,
    audio_url: t.audio_url || '',
    audio_duration: t.audio_duration || 0,
    audio_size_bytes: t.audio_size_bytes || 0,
    file: null,
    previewUrl: '',
  }));
};

// Reusable upload card for PDF files (music score / tonic sol-fa)
const PdfUploadCard = ({ title, inputId, file, existingUrl, onSelect, onRemove, hint }) => (
  <div className="card-container" style={{ padding: 18 }}>
    <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
      {title}
    </label>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <input
        type="file"
        accept="application/pdf,.pdf"
        id={inputId}
        onChange={onSelect}
        style={{ display: 'none' }}
      />
      <label htmlFor={inputId} className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
        {file || existingUrl ? 'Replace PDF' : 'Choose PDF File'}
      </label>

      {file && (
        <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
          ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB) — uploads when you save
        </span>
      )}

      {!file && existingUrl && (
        <a href={existingUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
          View current PDF
        </a>
      )}

      {(file || existingUrl) && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRemove}>
          Remove
        </button>
      )}
    </div>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{hint}</p>
  </div>
);

const HymnFormDrawer = ({ hymnId, isOpen, onClose, onSaved }) => {
  const [hymn, setHymn] = useState(emptyHymn);
  const [categories, setCategories] = useState([]);
  const [tunes, setTunes] = useState([]);
  const [scoreFile, setScoreFile] = useState(null);
  const [solfaFile, setSolfaFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('lyrics'); // 'lyrics' | 'metadata' | 'music'
  const isEditing = !!hymnId;

  // Load categories and hymn on open
  useEffect(() => {
    if (isOpen) {
      loadCategories();
      if (hymnId) {
        loadHymn();
      } else {
        // Check for draft recovery in localStorage
        const savedDraft = localStorage.getItem('pcg_hymn_draft');
        if (savedDraft) {
          try {
            setHymn(JSON.parse(savedDraft));
          } catch (e) {
            setHymn(emptyHymn);
          }
        } else {
          setHymn(emptyHymn);
        }
      }
      setTunes([]);
      setScoreFile(null);
      setSolfaFile(null);
      setError('');
      document.body.classList.add('drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
    }

    return () => {
      document.body.classList.remove('drawer-open');
    };
  }, [isOpen, hymnId]);

  // Draft auto-save for new hymns
  useEffect(() => {
    if (isOpen && !hymnId && (hymn.title_en || hymn.lyrics_en)) {
      localStorage.setItem('pcg_hymn_draft', JSON.stringify(hymn));
    }
  }, [hymn, isOpen, hymnId]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    setCategories(data || []);
  };

  const loadHymn = async () => {
    const { data, error } = await supabase.from('hymns').select('*').eq('id', hymnId).single();
    if (!error && data) {
      setHymn(data);
      setTunes(tunesFromHymn(data));
    }
  };

  const handleChange = (field, value) => {
    setHymn((prev) => ({ ...prev, [field]: value }));
  };

  // ---- Tune (audio) handlers ----
  const addTune = () => setTunes((prev) => [...prev, makeEmptyTune(prev.length + 1)]);

  const updateTune = (id, patch) =>
    setTunes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const removeTune = (id) => {
    const tune = tunes.find((t) => t.id === id);
    if (tune?.previewUrl) URL.revokeObjectURL(tune.previewUrl);
    setTunes((prev) => prev.filter((t) => t.id !== id));
  };

  const moveTune = (id, direction) =>
    setTunes((prev) => {
      const from = prev.findIndex((t) => t.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      [copy[from], copy[to]] = [copy[to], copy[from]];
      return copy;
    });

  const handleTuneFile = (id, e) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('Please select a valid audio file (e.g. .mp3, .m4a, .wav)');
      return;
    }
    setError('');

    const previewUrl = URL.createObjectURL(file);

    // Read the duration from the file itself
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = previewUrl;
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) {
        updateTune(id, { audio_duration: Math.round(probe.duration) });
      }
    };

    setTunes((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if (t.previewUrl) URL.revokeObjectURL(t.previewUrl);
        return { ...t, file, previewUrl, audio_size_bytes: file.size };
      })
    );
  };

  const handlePdfSelect = (e, setFile) => {
    const file = e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Please select a PDF file (.pdf).');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setError(`PDF is too large. Maximum size is ${MAX_PDF_MB} MB.`);
      return;
    }
    setError('');
    setFile(file);
  };

  const uploadPdf = async (file, prefix) => {
    const fileName = `${prefix}_${hymn.hymn_number || 'new'}_${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('scores')
      .upload(fileName, file, { cacheControl: '3600', upsert: true, contentType: 'application/pdf' });
    if (uploadError) {
      throw new Error(`${prefix === 'score' ? 'Music score' : 'Sol-fa'} PDF upload failed: ${uploadError.message}`);
    }
    const { data } = supabase.storage.from('scores').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ---- Verse helpers (unlimited verses) ----
  // Finds the highest verse number already typed ("1.", "2)", ...) and returns the next one.
  const getNextVerseNumber = (text) => {
    const nums = [...(text || '').matchAll(/^\s*(\d+)\s*[.)]/gm)].map((m) => parseInt(m[1], 10));
    return nums.length ? Math.max(...nums) + 1 : 1;
  };

  // Counts blocks separated by a blank line (verses and choruses)
  const countVerses = (text) =>
    (text || '').split(/\n\s*\n/).filter((block) => block.trim().length > 0).length;

  // langs: ['en'], ['twi'] or ['en', 'twi'] — adds the next numbered verse to each
  const addVerse = (langs) => {
    setHymn((prev) => {
      const updated = { ...prev };
      const fieldFor = (lang) => (lang === 'en' ? 'lyrics_en' : 'lyrics_twi');
      // When adding to both languages, use the same number in each so they stay aligned
      const sharedNumber = Math.max(
        ...langs.map((lang) => getNextVerseNumber(prev[fieldFor(lang)]))
      );
      langs.forEach((lang) => {
        const field = fieldFor(lang);
        const current = (prev[field] || '').replace(/\s+$/, '');
        const prefix = current ? '\n\n' : '';
        updated[field] = `${current}${prefix}${sharedNumber}. `;
      });
      return updated;
    });
  };

  // Cleans up blank lines so the mobile app and presenter split verses correctly
  const normalizeLyrics = (text) =>
    (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n[ \t]*(?=\n)/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const addChorusHeader = (lang) => {
    const field = lang === 'en' ? 'lyrics_en' : 'lyrics_twi';
    const current = hymn[field] || '';
    const prefix = current ? '\n\n' : '';
    const textToAdd = `${prefix}[Chorus / Nnyesoɔ]\n`;
    handleChange(field, current + textToAdd);
  };

  // Tonic Sol-fa notation helper symbols
  const insertSolfaSymbol = (sym) => {
    const current = hymn.tonic_solfa || '';
    handleChange('tonic_solfa', current + sym);
  };

  const uploadTuneAudio = async (tune) => {
    const fileExt = (tune.file.name.split('.').pop() || 'mp3').toLowerCase();
    const fileName = `hymn_${hymn.hymn_number || 'new'}_${tune.id}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, tune.file, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      throw new Error(`Audio upload failed for "${tune.name}": ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (!hymn.hymn_number || !hymn.title_en || !hymn.lyrics_en) {
        setError('Hymn number, English title, and English lyrics are required.');
        setSaving(false);
        return;
      }

      // Validate tunes: every tune needs a name and an audio file
      for (let i = 0; i < tunes.length; i++) {
        const t = tunes[i];
        if (!t.name.trim()) {
          setError(`Tune ${i + 1} needs a name.`);
          setSaving(false);
          return;
        }
        if (!t.file && !t.audio_url) {
          setError(`"${t.name}" has no audio file. Choose a file or remove this tune.`);
          setSaving(false);
          return;
        }
      }

      let scoreUrl = hymn.score_pdf_url;
      let solfaUrl = hymn.solfa_pdf_url;
      const finalTunes = [];
      setUploading(true);
      try {
        // Upload each new/replaced tune audio file, keep existing ones as they are
        for (const t of tunes) {
          const url = t.file ? await uploadTuneAudio(t) : t.audio_url;
          finalTunes.push({
            id: t.id,
            name: t.name.trim(),
            audio_url: url,
            audio_duration: t.audio_duration || 0,
            audio_size_bytes: t.audio_size_bytes || 0,
          });
        }
        if (scoreFile) scoreUrl = await uploadPdf(scoreFile, 'score');
        if (solfaFile) solfaUrl = await uploadPdf(solfaFile, 'solfa');
      } finally {
        setUploading(false);
      }

      const hymnPayload = {
        hymn_number: parseInt(hymn.hymn_number, 10),
        title_en: hymn.title_en.trim(),
        title_twi: hymn.title_twi ? hymn.title_twi.trim() : null,
        lyrics_en: normalizeLyrics(hymn.lyrics_en),
        lyrics_twi: hymn.lyrics_twi ? normalizeLyrics(hymn.lyrics_twi) : null,
        tonic_solfa: hymn.tonic_solfa ? hymn.tonic_solfa.trim() : null,
        composer: hymn.composer ? hymn.composer.trim() : null,
        scripture_reference: hymn.scripture_reference ? hymn.scripture_reference.trim() : null,
        meter: hymn.meter ? hymn.meter.trim() : null,
        key_signature: hymn.key_signature ? hymn.key_signature.trim() : null,
        category_id: hymn.category_id || null,
        is_published: hymn.is_published,
        tunes: finalTunes,
        // The first tune is also kept in the old single-audio fields for compatibility
        audio_url: finalTunes[0]?.audio_url || null,
        audio_duration: finalTunes[0]?.audio_duration || 0,
        audio_size_bytes: finalTunes[0]?.audio_size_bytes || 0,
        score_pdf_url: scoreUrl || null,
        solfa_pdf_url: solfaUrl || null,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error: updateErr } = await supabase
          .from('hymns')
          .update(hymnPayload)
          .eq('id', hymnId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('hymns')
          .insert([hymnPayload]);
        if (insertErr) throw insertErr;
        localStorage.removeItem('pcg_hymn_draft');
      }

      Swal.fire({
        title: isEditing ? 'Hymn Updated!' : 'Hymn Created!',
        text: `Hymn #${hymn.hymn_number} - "${hymn.title_en}" saved successfully.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false,
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save hymn. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
              {isEditing ? `Edit Hymn #${hymn.hymn_number}` : 'Add New PCG Hymn'}
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Presbyterian Church of Ghana Hymnal Record
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className={`filter-pill ${activeTab === 'lyrics' ? 'active' : ''}`}
              onClick={() => setActiveTab('lyrics')}
            >
              Lyrics & Dual Translation
            </button>
            <button
              type="button"
              className={`filter-pill ${activeTab === 'metadata' ? 'active' : ''}`}
              onClick={() => setActiveTab('metadata')}
            >
              Details & Category
            </button>
            <button
              type="button"
              className={`filter-pill ${activeTab === 'music' ? 'active' : ''}`}
              onClick={() => setActiveTab('music')}
            >
              Audio, Scores & Sol-fa
            </button>
            <button
              type="button"
              className="page-btn"
              onClick={onClose}
              style={{ border: 'none', marginLeft: 8 }}
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="drawer-body">
            {error && (
              <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Quick Header Fields Always Visible */}
            <div className="form-grid-3">
              <div className="form-group">
                <label>Hymn Number *</label>
                <input
                  type="number"
                  className="form-input"
                  value={hymn.hymn_number}
                  onChange={(e) => handleChange('hymn_number', e.target.value)}
                  placeholder="e.g. 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>English Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={hymn.title_en}
                  onChange={(e) => handleChange('title_en', e.target.value)}
                  placeholder="e.g. Praise to the Lord"
                  required
                />
              </div>
              <div className="form-group">
                <label>Twi Title (Asɛmti)</label>
                <input
                  type="text"
                  className="form-input"
                  value={hymn.title_twi || ''}
                  onChange={(e) => handleChange('title_twi', e.target.value)}
                  placeholder="e.g. Kamfo Awurade"
                />
              </div>
            </div>

            {/* TAB 1: LYRICS & DUAL TRANSLATION */}
            {activeTab === 'lyrics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    Add as many verses as you need. Separate each verse with a blank line.
                    In dual-language view, English and Twi verses are matched in order.
                  </span>
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => addVerse(['en', 'twi'])}>
                    + Next Verse in Both Languages
                  </button>
                </div>

                {countVerses(hymn.lyrics_en) > 0 &&
                  countVerses(hymn.lyrics_twi) > 0 &&
                  countVerses(hymn.lyrics_en) !== countVerses(hymn.lyrics_twi) && (
                    <div style={{ padding: '10px 14px', background: 'var(--warning-bg, #fff7e0)', borderRadius: 'var(--radius-md)', fontSize: 12.5 }}>
                      ⚠️ English has {countVerses(hymn.lyrics_en)} verse/chorus blocks but Twi has{' '}
                      {countVerses(hymn.lyrics_twi)}. In dual view they are matched in order, so keep the counts equal.
                    </div>
                  )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  {/* English Column */}
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label>English Lyrics (Verses) *</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addVerse(['en'])}>+ Next Verse</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addChorusHeader('en')}>+ Chorus</button>
                      </div>
                    </div>
                    <textarea
                      className="form-textarea lyrics-textarea"
                      value={hymn.lyrics_en}
                      onChange={(e) => handleChange('lyrics_en', e.target.value)}
                      placeholder="1. Praise to the Lord, the Almighty, the King of creation!&#10;O my soul, praise Him, for He is thy health and salvation!&#10;&#10;2. Praise to the Lord..."
                      required
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {countVerses(hymn.lyrics_en)} verse/chorus block(s)
                    </span>
                  </div>

                  {/* Twi Column */}
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label>Twi Lyrics (Nkyekyɛmu)</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addVerse(['twi'])}>+ Next Verse</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => addChorusHeader('twi')}>+ Nnyesoɔ</button>
                      </div>
                    </div>
                    <textarea
                      className="form-textarea lyrics-textarea"
                      value={hymn.lyrics_twi || ''}
                      onChange={(e) => handleChange('lyrics_twi', e.target.value)}
                      placeholder="1. Kamfo Awurade, Otumfoɔ, abɔdeɛ Hene no!&#10;Me kra, kamfo No, na Ɔno ne w'apɔmuden ne nkwagyeɛ!&#10;&#10;2. Kamfo Awurade..."
                    />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {countVerses(hymn.lyrics_twi)} verse/chorus block(s)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: METADATA & CATEGORY */}
            {activeTab === 'metadata' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      className="form-select"
                      value={hymn.category_id || ''}
                      onChange={(e) => handleChange('category_id', e.target.value || null)}
                    >
                      <option value="">Select Category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_en} {c.name_twi ? `(${c.name_twi})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Composer / Author</label>
                    <input
                      type="text"
                      className="form-input"
                      value={hymn.composer || ''}
                      onChange={(e) => handleChange('composer', e.target.value)}
                      placeholder="e.g. Joachim Neander (1680)"
                    />
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Scripture Reference</label>
                    <input
                      type="text"
                      className="form-input"
                      value={hymn.scripture_reference || ''}
                      onChange={(e) => handleChange('scripture_reference', e.target.value)}
                      placeholder="e.g. Psalm 103:1-6"
                    />
                  </div>

                  <div className="form-group">
                    <label>Hymn Meter</label>
                    <input
                      type="text"
                      className="form-input"
                      value={hymn.meter || ''}
                      onChange={(e) => handleChange('meter', e.target.value)}
                      placeholder="e.g. 14. 14. 4. 7. 8"
                    />
                  </div>

                  <div className="form-group">
                    <label>Key Signature</label>
                    <input
                      type="text"
                      className="form-input"
                      value={hymn.key_signature || ''}
                      onChange={(e) => handleChange('key_signature', e.target.value)}
                      placeholder="e.g. G Major"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hymn.is_published}
                      onChange={(e) => handleChange('is_published', e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Publish Hymn to Mobile Apps & Public Directory</span>
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: AUDIO & TONIC SOL-FA */}
            {activeTab === 'music' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Audio Tunes (multiple versions) */}
                <div className="card-container" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <label style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AudioIcon /> Audio Tunes ({tunes.length})
                    </label>
                    <button type="button" className="btn btn-gold btn-sm" onClick={addTune}>
                      + Add Tune
                    </button>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 14 }}>
                    Add every tune version of this hymn (for example Tune 1, Tune 2, Original, Choir).
                    Each tune gets its own button in the mobile app and plays separately.
                    The first tune is the default.
                  </p>

                  <datalist id="tune-name-suggestions">
                    {TUNE_NAME_SUGGESTIONS.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>

                  {tunes.length === 0 && (
                    <div style={{ padding: 18, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
                      No tunes yet. Click “+ Add Tune” to upload the first one.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {tunes.map((t, idx) => {
                      const inputId = `tune-file-${t.id}`;
                      const src = t.previewUrl || t.audio_url;
                      return (
                        <div
                          key={t.id}
                          style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="badge badge-blue">#{idx + 1}</span>
                            <input
                              type="text"
                              className="form-input"
                              list="tune-name-suggestions"
                              placeholder="Tune name (e.g. Tune 1)"
                              value={t.name}
                              onChange={(e) => updateTune(t.id, { name: e.target.value })}
                              style={{ flex: 1, minWidth: 160 }}
                            />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveTune(t.id, -1)} disabled={idx === 0} title="Move up">▲</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => moveTune(t.id, 1)} disabled={idx === tunes.length - 1} title="Move down">▼</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeTune(t.id)} title="Remove this tune">✕ Remove</button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <input
                              type="file"
                              accept="audio/*"
                              id={inputId}
                              onChange={(e) => handleTuneFile(t.id, e)}
                              style={{ display: 'none' }}
                            />
                            <label htmlFor={inputId} className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                              {src ? 'Replace Audio File' : 'Choose Audio File (.mp3, .m4a)'}
                            </label>
                            {t.file && (
                              <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
                                ✓ {t.file.name} ({(t.file.size / 1024 / 1024).toFixed(2)} MB) — uploads when you save
                              </span>
                            )}
                            {!t.file && t.audio_url && (
                              <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>✓ Audio uploaded</span>
                            )}
                            {!src && (
                              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No audio chosen yet</span>
                            )}
                          </div>

                          {src && <audio controls src={src} style={{ width: '100%', height: 38 }} />}
                        </div>
                      );
                    })}
                  </div>

                  {tunes.length > 0 && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addTune} style={{ marginTop: 12 }}>
                      + Add Another Tune
                    </button>
                  )}
                </div>

                {/* Music Score PDF */}
                <PdfUploadCard
                  title="📄 Music Score (PDF)"
                  inputId="hymn-score-pdf-upload"
                  file={scoreFile}
                  existingUrl={hymn.score_pdf_url}
                  onSelect={(e) => handlePdfSelect(e, setScoreFile)}
                  onRemove={() => { setScoreFile(null); handleChange('score_pdf_url', ''); }}
                  hint={`Staff-notation score. PDF only, up to ${MAX_PDF_MB} MB.`}
                />

                {/* Tonic Sol-fa PDF */}
                <PdfUploadCard
                  title="📄 Tonic Sol-fa (PDF)"
                  inputId="hymn-solfa-pdf-upload"
                  file={solfaFile}
                  existingUrl={hymn.solfa_pdf_url}
                  onSelect={(e) => handlePdfSelect(e, setSolfaFile)}
                  onRemove={() => { setSolfaFile(null); handleChange('solfa_pdf_url', ''); }}
                  hint={`Sol-fa sheet. PDF only, up to ${MAX_PDF_MB} MB. You can still type sol-fa text below as well.`}
                />

                {/* Tonic Sol-fa */}
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SolfaIcon /> Tonic Sol-fa Musical Notation
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['d', 'r', 'm', 'f', 's', 'l', 't', 'd\'', '|', ':', '-'].map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          className="page-btn"
                          style={{ width: 28, height: 28, fontSize: 12 }}
                          onClick={() => insertSolfaSymbol(sym + ' ')}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    className="form-textarea solfa-textarea"
                    value={hymn.tonic_solfa || ''}
                    onChange={(e) => handleChange('tonic_solfa', e.target.value)}
                    placeholder="d : - : m | s : - : s | l : - : s | f : - : m&#10;m : - : r | d : - : - | r : - : m | d : - : -"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="drawer-footer">
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {!hymnId && 'Draft auto-saves locally'}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
                <SingleCheckIcon />
                {saving || uploading ? 'Saving Hymn...' : (isEditing ? 'Update Hymn' : 'Save Hymn')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HymnFormDrawer;
