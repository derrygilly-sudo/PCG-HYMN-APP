// src/pages/PresenterPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import {
  FullscreenIcon,
  FullscreenExitIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SearchIcon,
  CloseIcon,
} from '../config/icons';

const PresenterPage = () => {
  const { hymnId } = useParams();
  const navigate = useNavigate();
  const [hymns, setHymns] = useState([]);
  const [currentHymn, setCurrentHymn] = useState(null);
  const [currentStanzaIndex, setCurrentStanzaIndex] = useState(0);
  const [languageMode, setLanguageMode] = useState('dual'); // 'en' | 'twi' | 'dual'
  const [themeMode, setThemeMode] = useState('stage'); // 'stage' | 'dark' | 'blue' | 'light'
  const [fontSizeMultiplier, setFontSizeMultiplier] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const loadAllHymns = async () => {
      const { data } = await supabase
        .from('hymns')
        .select('*')
        .order('hymn_number', { ascending: true });

      if (data && data.length > 0) {
        setHymns(data);
        if (hymnId) {
          const found = data.find((h) => h.id === hymnId || h.hymn_number === parseInt(hymnId, 10));
          setCurrentHymn(found || data[0]);
        } else {
          setCurrentHymn(data[0]);
        }
        setCurrentStanzaIndex(0);
      }
    };

    loadAllHymns();
  }, [hymnId]);

  // Helper to split lyrics into stanzas
  const parseStanzas = (lyricsText) => {
    if (!lyricsText) return [];
    // Split by double newlines or numbered verses
    const rawStanzas = lyricsText.split(/\n\s*\n/).filter((s) => s.trim().length > 0);
    return rawStanzas.map((text, idx) => ({
      index: idx,
      text: text.trim(),
    }));
  };

  const englishStanzas = parseStanzas(currentHymn?.lyrics_en);
  const twiStanzas = parseStanzas(currentHymn?.lyrics_twi);
  const totalStanzas = Math.max(englishStanzas.length, twiStanzas.length, 1);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (searchOpen) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setCurrentStanzaIndex((prev) => Math.min(prev + 1, totalStanzas - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentStanzaIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen();
        }
      }
    },
    [totalStanzas, searchOpen, isFullscreen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSelectHymn = (hymn) => {
    setCurrentHymn(hymn);
    setCurrentStanzaIndex(0);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const currentEnText = englishStanzas[currentStanzaIndex]?.text || '';
  const currentTwiText = twiStanzas[currentStanzaIndex]?.text || '';

  const filteredHymns = hymns.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.hymn_number.toString().includes(q) ||
      h.title_en.toLowerCase().includes(q) ||
      h.title_twi?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      ref={containerRef}
      className={`presenter-container presenter-theme-${themeMode}`}
      style={{ fontSize: `${fontSizeMultiplier}rem` }}
    >
      {/* Top Controls Header */}
      <div className="presenter-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/hymns')}
            style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: 'none' }}
          >
            ← Exit Presenter
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSearchOpen(true)}
            style={{ background: 'rgba(255, 255, 255, 0.15)', color: 'var(--pcg-gold)', border: 'none', fontWeight: 700 }}
          >
            <SearchIcon /> #{currentHymn?.hymn_number || '1'} {currentHymn?.title_en || 'Select Hymn'}
          </button>
        </div>

        {/* Middle: Language & Theme toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-full)', padding: 3 }}>
            <button
              type="button"
              className={`filter-pill ${languageMode === 'en' ? 'active' : ''}`}
              style={{ padding: '3px 10px', fontSize: 11, border: 'none' }}
              onClick={() => setLanguageMode('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`filter-pill ${languageMode === 'dual' ? 'active' : ''}`}
              style={{ padding: '3px 10px', fontSize: 11, border: 'none' }}
              onClick={() => setLanguageMode('dual')}
            >
              Dual Split
            </button>
            <button
              type="button"
              className={`filter-pill ${languageMode === 'twi' ? 'active' : ''}`}
              style={{ padding: '3px 10px', fontSize: 11, border: 'none' }}
              onClick={() => setLanguageMode('twi')}
            >
              Twi
            </button>
          </div>

          <select
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              border: 'none',
              padding: '5px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <option value="stage" style={{ color: '#000' }}>Stage Blackout (Gold Text)</option>
            <option value="blue" style={{ color: '#000' }}>PCG Sanctuary Blue</option>
            <option value="dark" style={{ color: '#000' }}>Slate Dark</option>
            <option value="light" style={{ color: '#000' }}>High-Contrast Light</option>
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className="page-btn"
              style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              onClick={() => setFontSizeMultiplier((prev) => Math.max(prev - 0.15, 0.7))}
              title="Decrease Font Size"
            >
              A-
            </button>
            <button
              type="button"
              className="page-btn"
              style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              onClick={() => setFontSizeMultiplier((prev) => Math.min(prev + 0.15, 1.8))}
              title="Increase Font Size"
            >
              A+
            </button>
            <button
              type="button"
              className="page-btn"
              style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              onClick={toggleFullscreen}
              title="Toggle Fullscreen Projection (F)"
            >
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Center Projection Canvas */}
      <div className="presenter-content-body">
        <div className="presenter-stanza-title">
          Hymn #{currentHymn?.hymn_number} • Stanza {currentStanzaIndex + 1} of {totalStanzas}
        </div>

        {languageMode === 'dual' && currentTwiText ? (
          <div className="presenter-dual-columns">
            <div className="presenter-column-card">
              <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 12 }}>
                English
              </div>
              <div className="presenter-lyrics-text" style={{ textAlign: 'left', fontSize: `${2.2 * fontSizeMultiplier}rem` }}>
                {currentEnText}
              </div>
            </div>

            <div className="presenter-column-card">
              <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 12 }}>
                Twi (Nkyekyɛmu)
              </div>
              <div className="presenter-lyrics-text" style={{ textAlign: 'left', fontSize: `${2.2 * fontSizeMultiplier}rem` }}>
                {currentTwiText}
              </div>
            </div>
          </div>
        ) : (
          <div className="presenter-lyrics-text" style={{ fontSize: `${2.8 * fontSizeMultiplier}rem` }}>
            {languageMode === 'twi' ? (currentTwiText || currentEnText) : currentEnText}
          </div>
        )}
      </div>

      {/* Bottom Footer Projection Controls */}
      <div className="presenter-footer-controls">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setCurrentStanzaIndex((prev) => Math.max(prev - 1, 0))}
          disabled={currentStanzaIndex === 0}
          style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', border: 'none' }}
        >
          <ArrowLeftIcon /> Previous (← / ↑)
        </button>

        {/* Stanza Dots indicator */}
        <div className="stanza-indicator-dots">
          {Array.from({ length: totalStanzas }, (_, idx) => (
            <div
              key={idx}
              className={`stanza-dot ${idx === currentStanzaIndex ? 'active' : ''}`}
              onClick={() => setCurrentStanzaIndex(idx)}
              title={`Stanza ${idx + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn btn-gold"
          onClick={() => setCurrentStanzaIndex((prev) => Math.min(prev + 1, totalStanzas - 1))}
          disabled={currentStanzaIndex === totalStanzas - 1}
        >
          Next Stanza (→ / Space) <ArrowRightIcon />
        </button>
      </div>

      {/* Quick Hymn Picker Overlay */}
      {searchOpen && (
        <div className="drawer-overlay" onClick={() => setSearchOpen(false)} style={{ zIndex: 120 }}>
          <div
            className="drawer-container"
            style={{ maxWidth: 480, height: '70vh', margin: 'auto', borderRadius: 'var(--radius-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
                Jump to PCG Hymn
              </h2>
              <button className="page-btn" onClick={() => setSearchOpen(false)} style={{ border: 'none' }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <input
                type="text"
                autoFocus
                className="form-input"
                placeholder="Type hymn number or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredHymns.slice(0, 40).map((h) => (
                <div
                  key={h.id}
                  onClick={() => handleSelectHymn(h)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: currentHymn?.id === h.id ? 'var(--pcg-blue-subtle)' : '#ffffff',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--pcg-blue)' }}>#{h.hymn_number}</span>
                  <span style={{ fontWeight: 600, flex: 1, marginLeft: 10 }}>{h.title_en}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.title_twi || ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresenterPage;
