// src/components/HymnDetailDrawer.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CloseIcon,
  PresenterIcon,
  EditIcon,
  AudioIcon,
  SolfaIcon,
} from '../config/icons';

const HymnDetailDrawer = ({ hymn, isOpen, onClose, onEdit }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('lyrics');

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('drawer-open');
    } else {
      document.body.classList.remove('drawer-open');
    }
    return () => {
      document.body.classList.remove('drawer-open');
    };
  }, [isOpen]);

  if (!hymn || !isOpen) return null;

  // All audio tunes (older hymns with a single audio_url count as one tune)
  const hymnTunes =
    Array.isArray(hymn.tunes) && hymn.tunes.length > 0
      ? hymn.tunes.filter((t) => t && t.audio_url)
      : hymn.audio_url
      ? [{ id: 'main', name: 'Main Tune', audio_url: hymn.audio_url }]
      : [];

  const launchPresenter = () => {
    onClose();
    navigate(`/presenter/${hymn.id || hymn.hymn_number}`);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="hymn-number-badge" style={{ fontSize: 16, padding: '6px 14px' }}>
              #{hymn.hymn_number}
            </span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--pcg-blue-dark)' }}>
                {hymn.title_en}
              </h2>
              {hymn.title_twi && (
                <p style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                  {hymn.title_twi}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-gold btn-sm"
              onClick={launchPresenter}
              title="Launch Church Projector Mode"
            >
              <PresenterIcon /> Presenter Mode
            </button>
            {onEdit && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onClose();
                  onEdit(hymn.id);
                }}
              >
                <EditIcon /> Edit
              </button>
            )}
            <button
              type="button"
              className="page-btn"
              onClick={onClose}
              style={{ border: 'none' }}
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ padding: '12px 28px 0', display: 'flex', gap: 8, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`filter-pill ${activeTab === 'lyrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('lyrics')}
          >
            English & Twi Lyrics
          </button>
          {hymn.tonic_solfa && (
            <button
              type="button"
              className={`filter-pill ${activeTab === 'solfa' ? 'active' : ''}`}
              onClick={() => setActiveTab('solfa')}
            >
              Tonic Sol-fa
            </button>
          )}
          <button
            type="button"
            className={`filter-pill ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Hymn Information
          </button>
        </div>

        {/* Body Content */}
        <div className="drawer-body">
          {/* Audio Section */}
          {hymnTunes.length > 0 && (
            <div className="card-container" style={{ padding: 16, background: 'var(--pcg-blue-subtle)', borderColor: 'rgba(24, 34, 124, 0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 700, color: 'var(--pcg-blue)' }}>
                <AudioIcon /> {hymnTunes.length > 1 ? `Audio Tunes (${hymnTunes.length})` : 'Organ / Choir Audio Recording'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hymnTunes.map((t, i) => (
                  <div key={t.id || i}>
                    {hymnTunes.length > 1 && (
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.name || `Tune ${i + 1}`}</div>
                    )}
                    <audio controls src={t.audio_url} style={{ width: '100%', height: 40 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: LYRICS */}
          {activeTab === 'lyrics' && (
            <div style={{ display: 'grid', gridTemplateColumns: hymn.lyrics_twi ? '1fr 1fr' : '1fr', gap: 24 }}>
              {/* English */}
              <div className="card-container" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pcg-blue-dark)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                  English Lyrics
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>
                  {hymn.lyrics_en}
                </div>
              </div>

              {/* Twi */}
              {hymn.lyrics_twi && (
                <div className="card-container" style={{ padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pcg-blue-dark)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
                    Twi Lyrics (Nkyekyɛmu)
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.8, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>
                    {hymn.lyrics_twi}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SOLFA */}
          {activeTab === 'solfa' && hymn.tonic_solfa && (
            <div className="card-container" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pcg-blue-dark)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <SolfaIcon /> Tonic Sol-fa Musical Notation
              </div>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, background: '#f8fafc', padding: 18, borderRadius: 'var(--radius-md)', overflowX: 'auto', lineHeight: 1.7, border: '1px solid var(--border-color)' }}>
                {hymn.tonic_solfa}
              </pre>
            </div>
          )}

          {/* TAB 3: INFO */}
          {activeTab === 'info' && (
            <div className="card-container" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-grid-2">
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Composer / Author</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{hymn.composer || 'Traditional / Unknown'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Scripture Reference</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{hymn.scripture_reference || 'None specified'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Meter</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{hymn.meter || 'Standard'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Key Signature</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{hymn.key_signature || 'Not specified'}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, display: 'flex', gap: 10 }}>
                <span className={`badge ${hymn.is_published ? 'badge-green' : 'badge-gold'}`}>
                  {hymn.is_published ? '✓ Published to Mobile App' : 'Draft / Unpublished'}
                </span>
                {hymnTunes.length > 0 && (
                  <span className="badge badge-blue">
                    ✓ {hymnTunes.length > 1 ? `${hymnTunes.length} Tunes Attached` : 'Audio Attached'}
                  </span>
                )}
                {hymn.title_twi && <span className="badge badge-purple">✓ Twi Translated</span>}
                {hymn.tonic_solfa && <span className="badge badge-gray">✓ Sol-fa Added</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-gold" onClick={launchPresenter}>
            <PresenterIcon /> Launch Presenter
          </button>
        </div>
      </div>
    </div>
  );
};

export default HymnDetailDrawer;