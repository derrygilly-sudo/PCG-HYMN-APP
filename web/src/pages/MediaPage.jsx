// src/pages/MediaPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';
import {
  AudioIcon,
  PlayIcon,
  PauseIcon,
  UploadCloudIcon,
  RefreshIcon,
  SearchIcon,
  SingleCheckIcon,
  SparkleIcon,
  HymnIcon,
  MoreIcon,
  DeleteIcon,
} from '../config/icons';

const MediaPage = () => {
  const [hymns, setHymns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState('missing'); // 'all' | 'with_audio' | 'missing'
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId === null) return;
      const activeRef = menuRefs.current[openMenuId];
      if (activeRef && !activeRef.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Bulk Upload Queue
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Audio Playback
  const [currentlyPlayingUrl, setCurrentlyPlayingUrl] = useState(null);
  const audioPlayerRef = useRef(null);

  useEffect(() => {
    loadHymns();
  }, []);

  const loadHymns = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hymns')
      .select('id, hymn_number, title_en, title_twi, audio_url')
      .order('hymn_number', { ascending: true });

    if (!error) setHymns(data || []);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHymns();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Smart Regex to extract hymn number from filename
  const extractHymnNumber = (filename) => {
    const cleanName = filename.replace(/\.[^/.]+$/, ""); // strip extension
    const match = cleanName.match(/(?:hymn[_\s-]*)?(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const handleFilesSelected = (files) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('audio/') || f.name.endsWith('.mp3'));
    if (fileArray.length === 0) {
      Swal.fire('Invalid Files', 'Please select audio files (.mp3, .m4a, .wav)', 'warning');
      return;
    }

    const newQueueItems = fileArray.map((file) => {
      const detectedNum = extractHymnNumber(file.name);
      const matchedHymn = detectedNum ? hymns.find((h) => h.hymn_number === detectedNum) : null;

      return {
        id: `file_${Date.now()}_${Math.random()}`,
        file,
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2),
        detectedNumber: detectedNum,
        matchedHymn,
        status: matchedHymn ? 'ready' : 'unmatched', // 'ready' | 'unmatched' | 'uploading' | 'done' | 'error'
        progress: 0,
      };
    });

    setUploadQueue((prev) => [...prev, ...newQueueItems]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleManualMatch = (queueId, hymnId) => {
    const selectedHymn = hymns.find((h) => h.id === hymnId);
    setUploadQueue((prev) =>
      prev.map((item) =>
        item.id === queueId
          ? { ...item, matchedHymn: selectedHymn, status: selectedHymn ? 'ready' : 'unmatched' }
          : item
      )
    );
  };

  const handleRemoveQueueItem = (queueId) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== queueId));
  };

  const startBatchUpload = async () => {
    const readyItems = uploadQueue.filter((item) => item.matchedHymn && item.status === 'ready');
    if (readyItems.length === 0) {
      Swal.fire('No Ready Items', 'Please match your audio files to hymns before uploading.', 'info');
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (const item of readyItems) {
      try {
        // Mark as uploading
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading' } : q))
        );

        const fileExt = item.file.name.split('.').pop();
        const fileName = `hymn_${item.matchedHymn.hymn_number}_${Date.now()}.${fileExt}`;

        // 1. Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from('audio')
          .upload(fileName, item.file, { upsert: true });

        if (uploadErr) throw uploadErr;

        // 2. Get Public URL
        const { data: urlData } = supabase.storage.from('audio').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // 3. Update Hymn record (replaces the first/default tune, keeps any other tunes)
        const { data: current } = await supabase
          .from('hymns')
          .select('tunes')
          .eq('id', item.matchedHymn.id)
          .single();
        const existingTunes = Array.isArray(current?.tunes) ? current.tunes : [];
        const firstTune = {
          id: existingTunes[0]?.id || 'main',
          name: existingTunes[0]?.name || 'Main Tune',
          audio_url: publicUrl,
          audio_duration: 0,
          audio_size_bytes: item.file.size || 0,
        };
        const nextTunes = [firstTune, ...existingTunes.slice(1)];

        const { error: updateErr } = await supabase
          .from('hymns')
          .update({
            audio_url: publicUrl,
            tunes: nextTunes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.matchedHymn.id);

        if (updateErr) throw updateErr;

        successCount++;
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'done' } : q))
        );
      } catch (err) {
        console.error('Upload failed for:', item.name, err);
        setUploadQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'error', error: err.message } : q))
        );
      }
    }

    setUploading(false);
    Swal.fire({
      title: 'Batch Complete!',
      text: `Successfully uploaded and linked ${successCount} audio files.`,
      icon: 'success',
    });
    loadHymns();
  };

  const togglePlayAudio = (url) => {
    if (currentlyPlayingUrl === url) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setCurrentlyPlayingUrl(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audio.onended = () => setCurrentlyPlayingUrl(null);
      audio.play();
      audioPlayerRef.current = audio;
      setCurrentlyPlayingUrl(url);
    }
  };

  const withAudioCount = hymns.filter((h) => h.audio_url).length;
  const missingAudioCount = hymns.length - withAudioCount;

  const filteredHymns = hymns.filter((h) => {
    if (filterMode === 'with_audio' && !h.audio_url) return false;
    if (filterMode === 'missing' && h.audio_url) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        h.hymn_number.toString().includes(q) ||
        h.title_en.toLowerCase().includes(q) ||
        h.title_twi?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Audio & Media Manager</h1>
          <p>Batch upload organ tunes and choir recordings with smart hymn matching</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon className={refreshing ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Top Metrics Banner */}
      <div className="dashboard-stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card-modern stat-card-purple">
          <div className="stat-icon-wrapper stat-icon-purple">
            <AudioIcon />
          </div>
          <div>
            <div className="stat-value">{withAudioCount}</div>
            <div className="stat-label">Hymns with Audio Attached</div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-gold">
          <div className="stat-icon-wrapper stat-icon-gold">
            <HymnIcon />
          </div>
          <div>
            <div className="stat-value">{missingAudioCount}</div>
            <div className="stat-label">Missing Recordings to Record</div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-blue">
          <div className="stat-icon-wrapper stat-icon-blue">
            <SparkleIcon />
          </div>
          <div>
            <div className="stat-value">{Math.round((withAudioCount / (hymns.length || 1)) * 100)}%</div>
            <div className="stat-label">Audio Library Coverage</div>
          </div>
        </div>
      </div>

      {/* Bulk Upload Drag & Drop Area */}
      <div className="card-container" style={{ marginBottom: 28 }}>
        <div className="card-header-row">
          <h3>Smart Bulk Audio Uploader</h3>
          <span className="badge badge-purple">Auto Hymn Number Matcher</span>
        </div>

        <div
          className={`dropzone-container ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <input
            type="file"
            multiple
            accept="audio/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <UploadCloudIcon size={44} style={{ color: 'var(--pcg-blue)', marginBottom: 10 }} />
          <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
            Drag & Drop Audio Files Here or Click to Browse
          </h4>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Files named like <code>001.mp3</code>, <code>hymn_45.mp3</code>, or <code>Hymn 120.mp3</code> will auto-match to hymns!
          </p>
        </div>

        {/* Upload Queue Table */}
        {uploadQueue.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Selected Files Queue ({uploadQueue.length} files)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setUploadQueue([])}
                  disabled={uploading}
                >
                  Clear Queue
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={startBatchUpload}
                  disabled={uploading || uploadQueue.filter((i) => i.status === 'ready').length === 0}
                >
                  <SingleCheckIcon />
                  {uploading ? 'Uploading Batch...' : `Upload & Link ${uploadQueue.filter((i) => i.status === 'ready').length} Hymns`}
                </button>
              </div>
            </div>

            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Matched Hymn</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadQueue.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.size} MB</td>
                      <td>
                        {item.matchedHymn ? (
                          <span className="badge badge-green">
                            ✓ Hymn #{item.matchedHymn.hymn_number} - {item.matchedHymn.title_en}
                          </span>
                        ) : (
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onChange={(e) => handleManualMatch(item.id, e.target.value)}
                          >
                            <option value="">Select Matching Hymn...</option>
                            {hymns.map((h) => (
                              <option key={h.id} value={h.id}>
                                #{h.hymn_number} {h.title_en}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        {item.status === 'ready' && <span className="badge badge-blue">Ready</span>}
                        {item.status === 'uploading' && <span className="badge badge-gold">Uploading...</span>}
                        {item.status === 'done' && <span className="badge badge-green">✓ Completed</span>}
                        {item.status === 'error' && <span className="badge badge-red">Error</span>}
                        {item.status === 'unmatched' && <span className="badge badge-gray">Needs Match</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="page-btn"
                          style={{ border: 'none', color: 'var(--danger)', margin: '0 0 0 auto' }}
                          onClick={() => handleRemoveQueueItem(item.id)}
                          disabled={uploading}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hymnal Audio Library Status Explorer */}
      <div className="card-container">
        <div className="card-header-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3>Hymn Audio Health Auditor</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`filter-pill ${filterMode === 'missing' ? 'active' : ''}`}
                onClick={() => setFilterMode('missing')}
              >
                Missing Audio ({missingAudioCount})
              </button>
              <button
                className={`filter-pill ${filterMode === 'with_audio' ? 'active' : ''}`}
                onClick={() => setFilterMode('with_audio')}
              >
                Has Audio ({withAudioCount})
              </button>
              <button
                className={`filter-pill ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All Hymns ({hymns.length})
              </button>
            </div>
          </div>

          <div className="filter-search-box" style={{ maxWidth: 280 }}>
            <span className="search-icon-pos" style={{ left: 10, top: 10, position: 'absolute' }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search hymns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '7px 12px 7px 30px' }}
            />
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>#</th>
                <th>Hymn Title</th>
                <th>Twi Title</th>
                <th>Audio Status</th>
                <th style={{ textAlign: 'right' }}>Audio Control</th>
              </tr>
            </thead>
            <tbody>
              {filteredHymns.slice(0, 50).map((h) => {
                const isPlaying = currentlyPlayingUrl === h.audio_url;
                return (
                  <tr key={h.id}>
                    <td>
                      <span className="hymn-number-badge">#{h.hymn_number}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{h.title_en}</td>
                    <td style={{ color: '#64748b', fontStyle: 'italic' }}>{h.title_twi || '—'}</td>
                    <td>
                      {h.audio_url ? (
                        <span className="badge badge-green">✓ Audio Attached</span>
                      ) : (
                        <span className="badge badge-gold">Missing Audio Recording</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        className="action-menu-wrapper"
                        ref={(el) => {
                          menuRefs.current[h.id] = el;
                        }}
                      >
                        <button
                          type="button"
                          className={`ellipsis-btn ${openMenuId === h.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === h.id ? null : h.id);
                          }}
                          title="Actions"
                        >
                          <MoreIcon />
                        </button>

                        {openMenuId === h.id && (
                          <div className="dropdown-menu">
                            {h.audio_url ? (
                              <button
                                type="button"
                                className="dropdown-item"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  togglePlayAudio(h.audio_url);
                                }}
                              >
                                {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                {isPlaying ? 'Pause Tune' : 'Play Tune'}
                              </button>
                            ) : null}

                            <label
                              className="dropdown-item"
                              style={{ cursor: 'pointer', margin: 0 }}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <UploadCloudIcon /> {h.audio_url ? 'Replace Audio' : 'Upload Audio'}
                              <input
                                type="file"
                                accept="audio/*"
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFilesSelected(e.target.files);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MediaPage;
