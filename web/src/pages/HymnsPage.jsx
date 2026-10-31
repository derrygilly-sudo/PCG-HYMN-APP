// src/pages/HymnsPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import HymnDetailDrawer from '../components/HymnDetailDrawer';
import HymnImportModal from '../components/HymnImportModal';
import Swal from 'sweetalert2';
import {
  SearchIcon,
  RefreshIcon,
  CloseIcon,
  EditIcon,
  DeleteIcon,
  ViewIcon,
  AddIcon,
  SortIcon,
  SortAscIcon,
  SortDescIcon,
  SolfaIcon,
  PublishedIcon,
  DraftIcon,
  AudioIcon,
  PresenterIcon,
  BatchIcon,
  PlayIcon,
  PauseIcon,
  TwiIcon,
  MoreIcon,
  UploadCloudIcon,
} from '../config/icons';

const ITEMS_PER_PAGE = 20;

const HymnsPage = ({ onOpenHymnForm }) => {
  const navigate = useNavigate();
  const [hymns, setHymns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [audioFilter, setAudioFilter] = useState('all'); // 'all' | 'has_audio' | 'no_audio'
  const [twiFilter, setTwiFilter] = useState('all'); // 'all' | 'has_twi' | 'no_twi'
  const [solfaFilter, setSolfaFilter] = useState('all'); // 'all' | 'has_solfa' | 'no_solfa'
  const [publishFilter, setPublishFilter] = useState('all'); // 'all' | 'published' | 'draft'

  // Sorting & Pagination
  const [sortField, setSortField] = useState('hymn_number');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);

  // Multi-Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Detail Drawer & Action Menu
  const [detailHymn, setDetailHymn] = useState(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});

  // Inline Audio playback
  const [playingHymnId, setPlayingHymnId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  // Click outside to close action menu
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

  const loadData = async () => {
    setLoading(true);
    const [hymnRes, catRes] = await Promise.all([
      supabase.from('hymns').select('*').order('hymn_number', { ascending: true }),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    ]);

    if (!hymnRes.error) setHymns(hymnRes.data || []);
    if (!catRes.error) setCategories(catRes.data || []);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <SortIcon className="sort-icon" />;
    return sortDirection === 'asc' ? <SortAscIcon className="sort-icon" /> : <SortDescIcon className="sort-icon" />;
  };

  // Inline Audio Playback Toggle
  const toggleInlineAudio = (hymn) => {
    if (!hymn.audio_url) return;
    if (playingHymnId === hymn.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingHymnId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const newAudio = new Audio(hymn.audio_url);
      newAudio.onended = () => setPlayingHymnId(null);
      newAudio.play();
      audioRef.current = newAudio;
      setPlayingHymnId(hymn.id);
    }
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginated.map((h) => h.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkPublish = async (status) => {
    if (selectedIds.length === 0) return;
    const { error } = await supabase
      .from('hymns')
      .update({ is_published: status, updated_at: new Date().toISOString() })
      .in('id', selectedIds);

    if (!error) {
      Swal.fire({
        title: status ? 'Published!' : 'Unpublished!',
        text: `${selectedIds.length} hymns updated.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
      setSelectedIds([]);
      loadData();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const result = await Swal.fire({
      title: 'Bulk Delete?',
      text: `Are you sure you want to permanently delete ${selectedIds.length} hymns?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, delete all',
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from('hymns').delete().in('id', selectedIds);
    if (!error) {
      Swal.fire('Deleted!', `${selectedIds.length} hymns deleted.`, 'success');
      setSelectedIds([]);
      loadData();
    }
  };

  const handleDeleteSingle = async (id, title) => {
    setOpenMenuId(null);
    const result = await Swal.fire({
      title: 'Delete Hymn?',
      html: `Are you sure you want to delete <strong>"${title}"</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, delete it',
    });

    if (!result.isConfirmed) return;

    const { error } = await supabase.from('hymns').delete().eq('id', id);
    if (!error) {
      Swal.fire('Deleted!', 'Hymn removed successfully.', 'success');
      loadData();
    }
  };

  const togglePublishSingle = async (id, currentStatus) => {
    await supabase.from('hymns').update({ is_published: !currentStatus }).eq('id', id);
    loadData();
  };

  // Comprehensive Multi-Filtered Dataset
  const filtered = hymns.filter((h) => {
    // 1. Search Query across number, English title, Twi title, Composer, Scripture, and Lyrics
    if (search) {
      const q = search.toLowerCase();
      const matchNum = h.hymn_number?.toString().includes(q);
      const matchEn = h.title_en?.toLowerCase().includes(q);
      const matchTwi = h.title_twi?.toLowerCase().includes(q);
      const matchComp = h.composer?.toLowerCase().includes(q);
      const matchLyricsEn = h.lyrics_en?.toLowerCase().includes(q);
      const matchLyricsTwi = h.lyrics_twi?.toLowerCase().includes(q);
      if (!matchNum && !matchEn && !matchTwi && !matchComp && !matchLyricsEn && !matchLyricsTwi) {
        return false;
      }
    }

    // 2. Category filter
    if (selectedCategory && h.category_id !== selectedCategory) {
      return false;
    }

    // 3. Audio filter
    if (audioFilter === 'has_audio' && !h.audio_url) return false;
    if (audioFilter === 'no_audio' && h.audio_url) return false;

    // 4. Twi filter
    if (twiFilter === 'has_twi' && !h.title_twi && !h.lyrics_twi) return false;
    if (twiFilter === 'no_twi' && (h.title_twi || h.lyrics_twi)) return false;

    // 5. Sol-fa filter
    if (solfaFilter === 'has_solfa' && !h.tonic_solfa) return false;
    if (solfaFilter === 'no_solfa' && h.tonic_solfa) return false;

    // 6. Published filter
    if (publishFilter === 'published' && !h.is_published) return false;
    if (publishFilter === 'draft' && h.is_published) return false;

    return true;
  });

  // Sorted Dataset
  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });

  // Paginated Dataset
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = sorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Category Map lookup
  const categoryMap = {};
  categories.forEach((c) => {
    categoryMap[c.id] = c.name_en;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Hymns Library</h1>
          <p>Manage, translate, and audit {hymns.length} Presbyterian Church hymns</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon className={refreshing ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => setImportModalOpen(true)}>
            <UploadCloudIcon /> Import Excel / CSV
          </button>
          <button className="btn btn-primary" onClick={() => onOpenHymnForm ? onOpenHymnForm() : null}>
            <AddIcon /> Add Hymn
          </button>
        </div>
      </div>

      {/* Multi-Filter Toolbar */}
      <div className="filter-toolbar">
        {/* Row 1: Search & Dropdowns */}
        <div className="filter-row-top">
          <div className="filter-search-box">
            <span className="search-icon-pos" style={{ left: 12, top: 11, position: 'absolute' }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by hymn #, title, lyrics, or author..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <CloseIcon />
              </button>
            )}
          </div>

          <select
            className="filter-select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={audioFilter}
            onChange={(e) => {
              setAudioFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Audio: All</option>
            <option value="has_audio">Has Audio Recording</option>
            <option value="no_audio">Missing Audio</option>
          </select>

          <select
            className="filter-select"
            value={twiFilter}
            onChange={(e) => {
              setTwiFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Language: All</option>
            <option value="has_twi">English + Twi</option>
            <option value="no_twi">English Only</option>
          </select>

          <select
            className="filter-select"
            value={publishFilter}
            onChange={(e) => {
              setPublishFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Status: All</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </select>
        </div>

        {/* Row 2: Quick Filter Pills */}
        <div className="filter-pill-group">
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Quick Views:
          </span>
          <button
            className={`filter-pill ${audioFilter === 'no_audio' ? 'active' : ''}`}
            onClick={() => setAudioFilter(audioFilter === 'no_audio' ? 'all' : 'no_audio')}
          >
            <AudioIcon /> Missing Audio ({hymns.filter((h) => !h.audio_url).length})
          </button>
          <button
            className={`filter-pill ${twiFilter === 'no_twi' ? 'active' : ''}`}
            onClick={() => setTwiFilter(twiFilter === 'no_twi' ? 'all' : 'no_twi')}
          >
            <TwiIcon /> Needs Twi Translation ({hymns.filter((h) => !h.title_twi).length})
          </button>
          <button
            className={`filter-pill ${publishFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setPublishFilter(publishFilter === 'draft' ? 'all' : 'draft')}
          >
            <DraftIcon /> Unpublished Drafts ({hymns.filter((h) => !h.is_published).length})
          </button>

          {(search || selectedCategory || audioFilter !== 'all' || twiFilter !== 'all' || publishFilter !== 'all') && (
            <button
              className="filter-pill"
              style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
                setAudioFilter('all');
                setTwiFilter('all');
                setPublishFilter('all');
                setSolfaFilter('all');
              }}
            >
              Reset Filters ✕
            </button>
          )}
        </div>
      </div>

      {/* Bulk Selection Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="bulk-actions-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BatchIcon size={20} />
            <span style={{ fontWeight: 700 }}>{selectedIds.length} Hymns Selected</span>
          </div>

          <div className="bulk-actions-group">
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkPublish(true)}>
              <PublishedIcon /> Publish All
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleBulkPublish(false)}>
              <DraftIcon /> Unpublish All
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
              <DeleteIcon /> Delete Selected
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="table-container">
        <table className="modern-table">
          <thead>
            <tr>
              <th style={{ width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={paginated.length > 0 && selectedIds.length === paginated.length}
                />
              </th>
              <th style={{ width: 90 }} className="sortable" onClick={() => handleSort('hymn_number')}>
                Hymn # {getSortIcon('hymn_number')}
              </th>
              <th className="sortable" onClick={() => handleSort('title_en')}>
                Title & Details {getSortIcon('title_en')}
              </th>
              <th>Category</th>
              <th>Audio Tune</th>
              <th>Tonic Sol-fa</th>
              <th className="sortable" onClick={() => handleSort('is_published')}>
                Status {getSortIcon('is_published')}
              </th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                  Loading Presbyterian hymnal library...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '50px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    No hymns match your current search / filters
                  </div>
                  <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                    Try broadening your search query or clearing filter options.
                  </p>
                </td>
              </tr>
            ) : (
              paginated.map((h) => {
                const isSelected = selectedIds.includes(h.id);
                const isPlaying = playingHymnId === h.id;

                return (
                  <tr key={h.id} className={isSelected ? 'selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(h.id)}
                      />
                    </td>
                    <td>
                      <span className="hymn-number-badge">#{h.hymn_number}</span>
                    </td>
                    <td>
                      <div className="hymn-title-cell">
                        <span
                          className="hymn-title-primary"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            setDetailHymn(h);
                            setDetailDrawerOpen(true);
                          }}
                        >
                          {h.title_en}
                        </span>
                        {h.title_twi && <span className="hymn-title-twi">{h.title_twi}</span>}
                        {h.composer && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {h.composer}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray">
                        {categoryMap[h.category_id] || 'General'}
                      </span>
                    </td>
                    <td>
                      {h.audio_url ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleInlineAudio(h)}
                          style={{
                            padding: '4px 10px',
                            background: isPlaying ? 'var(--purple-bg)' : undefined,
                            borderColor: isPlaying ? 'var(--purple)' : undefined,
                          }}
                        >
                          {isPlaying ? <PauseIcon style={{ color: 'var(--purple)' }} /> : <PlayIcon />}
                          {isPlaying ? 'Playing' : 'Listen'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audio</span>
                      )}
                    </td>
                    <td>
                      {h.tonic_solfa ? (
                        <span className="badge badge-blue">
                          <SolfaIcon /> Sol-fa
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${h.is_published ? 'badge-green' : 'badge-gold'}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => togglePublishSingle(h.id, h.is_published)}
                        title="Click to toggle publish status"
                      >
                        {h.is_published ? '✓ Published' : 'Draft'}
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
                                setDetailHymn(h);
                                setDetailDrawerOpen(true);
                              }}
                            >
                              <ViewIcon /> View Details
                            </button>
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
                                if (onOpenHymnForm) onOpenHymnForm(h.id);
                              }}
                            >
                              <EditIcon /> Edit Hymn
                            </button>
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setOpenMenuId(null);
                                togglePublishSingle(h.id, h.is_published);
                              }}
                            >
                              <PublishedIcon /> {h.is_published ? 'Unpublish' : 'Publish'}
                            </button>
                            <div className="dropdown-divider" />
                            <button
                              type="button"
                              className="dropdown-item dropdown-item-danger"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDeleteSingle(h.id, h.title_en);
                              }}
                            >
                              <DeleteIcon /> Delete Hymn
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="pagination-row">
          <div>
            Showing <strong>{sorted.length > 0 ? startIndex + 1 : 0}</strong> to{' '}
            <strong>{Math.min(startIndex + ITEMS_PER_PAGE, sorted.length)}</strong> of{' '}
            <strong>{sorted.length}</strong> matching hymns
          </div>

          <div className="pagination-controls">
            <button
              className="page-btn"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
            >
              ‹
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, idx) => {
              const pageNum = idx + 1;
              return (
                <button
                  key={pageNum}
                  className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 7 && <span style={{ padding: '0 4px' }}>...</span>}

            <button
              className="page-btn"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Hymn Detail Drawer */}
      <HymnDetailDrawer
        hymn={detailHymn}
        isOpen={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        onEdit={(id) => {
          setDetailDrawerOpen(false);
          if (onOpenHymnForm) onOpenHymnForm(id);
        }}
      />

      {/* Excel & CSV Import Modal */}
      <HymnImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={loadData}
        categories={categories}
        existingHymns={hymns}
      />
    </div>
  );
};

export default HymnsPage;