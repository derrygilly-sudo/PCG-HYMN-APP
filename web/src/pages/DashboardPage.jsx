import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { CHURCH_SEASONS } from '../data/collectionsData';
import {
  HymnIcon,
  TotalIcon,
  AudioIcon,
  TwiIcon,
  AddIcon,
  ViewIcon,
  PresenterIcon,
  UploadCloudIcon,
  LiturgyIcon,
  SparkleIcon,
  CalendarIcon,
  MoreIcon,
  EditIcon,
} from '../config/icons';

const DashboardPage = ({ onOpenHymnForm }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    hymns: 0,
    categories: 0,
    withAudio: 0,
    withTwi: 0,
    withSolfa: 0,
    published: 0,
  });
  const [recentHymns, setRecentHymns] = useState([]);
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
  const [, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [hymnRes, catRes, audioRes, twiRes, solfaRes, pubRes, recRes] = await Promise.all([
        supabase.from('hymns').select('*', { count: 'exact', head: true }),
        supabase.from('categories').select('*', { count: 'exact', head: true }),
        supabase.from('hymns').select('*', { count: 'exact', head: true }).not('audio_url', 'is', null),
        supabase.from('hymns').select('*', { count: 'exact', head: true }).not('title_twi', 'is', null),
        supabase.from('hymns').select('*', { count: 'exact', head: true }).not('tonic_solfa', 'is', null),
        supabase.from('hymns').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('hymns').select('id, hymn_number, title_en, title_twi, audio_url, is_published, updated_at').order('hymn_number', { ascending: true }).limit(6),
      ]);

      setStats({
        hymns: hymnRes.count || 0,
        categories: catRes.count || 0,
        withAudio: audioRes.count || 0,
        withTwi: twiRes.count || 0,
        withSolfa: solfaRes.count || 0,
        published: pubRes.count || 0,
      });

      setRecentHymns(recRes.data || []);
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Determine current church liturgical season
  const currentMonth = new Date().getMonth() + 1;
  const currentSeason = CHURCH_SEASONS.find(
    (s) => currentMonth >= s.startMonth && currentMonth <= s.endMonth
  ) || CHURCH_SEASONS[4]; // Default to Ordinary Time

  const total = stats.hymns || 1;
  const twiPercent = Math.round((stats.withTwi / total) * 100);
  const audioPercent = Math.round((stats.withAudio / total) * 100);
  const solfaPercent = Math.round((stats.withSolfa / total) * 100);
  const publishedPercent = Math.round((stats.published / total) * 100);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard & Overview</h1>
          <p>Presbyterian Church of Ghana Hymnal & Worship Management Center</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => onOpenHymnForm ? onOpenHymnForm() : navigate('/hymns')}>
            <AddIcon /> Add New Hymn
          </button>
          <button className="btn btn-gold" onClick={() => navigate('/presenter')}>
            <PresenterIcon /> Live Presenter
          </button>
        </div>
      </div>

      {/* Liturgical Season Banner */}
      <div className="liturgical-season-banner">
        <div className="liturgical-banner-content">
          <div className="season-icon-badge">
            <SparkleIcon />
          </div>
          <div className="liturgical-banner-text">
            <div style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.1em', fontWeight: 700, color: 'var(--pcg-gold-light)' }}>
              Current Church Liturgical Calendar
            </div>
            <h3>Season of {currentSeason.name}</h3>
            <p>{currentSeason.theme}. Ensure relevant festival hymns and liturgy sections are reviewed for upcoming Lord's Day services.</p>
          </div>
        </div>

        <button className="btn btn-gold btn-sm" onClick={() => navigate('/collections')}>
          <CalendarIcon /> Explore Seasonal Hymns
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="dashboard-stats-grid">
        <div className="stat-card-modern stat-card-blue" onClick={() => navigate('/hymns')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper stat-icon-blue">
            <HymnIcon />
          </div>
          <div>
            <div className="stat-value">{stats.hymns}</div>
            <div className="stat-label">Total Hymns</div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-green" onClick={() => navigate('/categories')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper stat-icon-green">
            <TotalIcon />
          </div>
          <div>
            <div className="stat-value">{stats.categories}</div>
            <div className="stat-label">Hymn Categories</div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-purple" onClick={() => navigate('/media')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper stat-icon-purple">
            <AudioIcon />
          </div>
          <div>
            <div className="stat-value">{stats.withAudio}</div>
            <div className="stat-label">With Audio Tunes</div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-gold" onClick={() => navigate('/hymns')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper stat-icon-gold">
            <TwiIcon />
          </div>
          <div>
            <div className="stat-value">{stats.withTwi}</div>
            <div className="stat-label">With Twi Lyrics</div>
          </div>
        </div>
      </div>

      {/* Completeness Section & Quick Actions */}
      <div className="completeness-section">
        {/* Completeness Health */}
        <div className="card-container">
          <div className="card-header-row">
            <h3>Database Content Health & Completeness</h3>
          </div>

          <div className="progress-item">
            <div className="progress-header">
              <span>Twi Translation Coverage</span>
              <span>{twiPercent}% ({stats.withTwi}/{stats.hymns})</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${twiPercent}%`, background: 'var(--pcg-gold)' }} />
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-header">
              <span>Audio Recording Coverage</span>
              <span>{audioPercent}% ({stats.withAudio}/{stats.hymns})</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${audioPercent}%`, background: 'var(--purple)' }} />
            </div>
          </div>

          <div className="progress-item">
            <div className="progress-header">
              <span>Tonic Sol-fa Musical Notation</span>
              <span>{solfaPercent}% ({stats.withSolfa}/{stats.hymns})</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${solfaPercent}%`, background: 'var(--info)' }} />
            </div>
          </div>

          <div className="progress-item" style={{ marginBottom: 0 }}>
            <div className="progress-header">
              <span>Published to Mobile App</span>
              <span>{publishedPercent}% ({stats.published}/{stats.hymns})</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${publishedPercent}%`, background: 'var(--success)' }} />
            </div>
          </div>
        </div>

        {/* Quick Tools & Church Links */}
        <div className="card-container" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-header-row" style={{ marginBottom: 8 }}>
            <h3>Quick Actions</h3>
          </div>

          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/media')}>
            <AudioIcon /> Batch Audio Manager
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/liturgies')}>
            <LiturgyIcon /> Presbyterian Liturgies & Creeds
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/presenter')}>
            <PresenterIcon /> Launch Sunday Sanctuary Projector
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => navigate('/import-export')}>
            <UploadCloudIcon /> Database Backup & CSV Import
          </button>
        </div>
      </div>

      {/* Featured / Recent Hymns Preview */}
      <div className="card-container">
        <div className="card-header-row">
          <h3>Featured PCG Hymns Sample</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/hymns')}>
            <ViewIcon /> View Full Hymnal ({stats.hymns})
          </button>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>#</th>
                <th>Hymn Title</th>
                <th>Twi Title</th>
                <th>Audio</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentHymns.map((h) => (
                <tr key={h.id}>
                  <td>
                    <span className="hymn-number-badge">#{h.hymn_number}</span>
                  </td>
                  <td>
                    <div className="hymn-title-primary">{h.title_en}</div>
                  </td>
                  <td>
                    <div className="hymn-title-twi">{h.title_twi || '—'}</div>
                  </td>
                  <td>
                    {h.audio_url ? (
                      <span className="badge badge-purple"><AudioIcon /> Ready</span>
                    ) : (
                      <span className="badge badge-gray">No audio</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${h.is_published ? 'badge-green' : 'badge-gold'}`}>
                      {h.is_published ? 'Published' : 'Draft'}
                    </span>
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
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/presenter/${h.id}`);
                            }}
                          >
                            <PresenterIcon /> Launch Presenter
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate('/hymns');
                            }}
                          >
                            <ViewIcon /> View in Hymns Library
                          </button>
                          <button
                            type="button"
                            className="dropdown-item"
                            onClick={() => {
                              setOpenMenuId(null);
                              if (onOpenHymnForm) onOpenHymnForm(h.id);
                            }}
                          >
                            <EditIcon /> Edit Hymn
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;