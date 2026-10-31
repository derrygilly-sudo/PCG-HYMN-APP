import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { CHURCH_SEASONS } from '../data/collectionsData';
import Select from 'react-select';
import {
  PresenterIcon,
  AddIcon,
  ExportIcon,
  SingleCheckIcon,
  CloseIcon,
  MoreIcon,
  DeleteIcon,
  RefreshIcon,
  CheckIcon,
} from '../config/icons';
import Swal from 'sweetalert2';

const LOCAL_STORAGE_KEY = 'pcg_custom_collections';

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '40px',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--pcg-blue, #18227c)' : 'var(--border-color, #e2e8f0)',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(24, 34, 124, 0.15)' : 'none',
    backgroundColor: '#ffffff',
    fontSize: '13.5px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    '&:hover': {
      borderColor: state.isFocused ? 'var(--pcg-blue, #18227c)' : '#cbd5e1',
    },
  }),
  option: (base, state) => ({
    ...base,
    fontSize: '13px',
    padding: '9px 12px',
    backgroundColor: state.isSelected
      ? 'var(--pcg-blue, #18227c)'
      : state.isFocused
      ? '#f1f5f9'
      : '#ffffff',
    color: state.isSelected ? '#ffffff' : 'var(--text-primary, #0f172a)',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: state.isSelected ? 'var(--pcg-blue, #18227c)' : '#e2e8f0',
    },
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'var(--pcg-blue-subtle, #eef2ff)',
    borderRadius: '6px',
    border: '1px solid #c7d2fe',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'var(--pcg-blue, #18227c)',
    fontSize: '12px',
    fontWeight: 600,
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'var(--pcg-blue, #18227c)',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#fee2e2',
      color: '#dc2626',
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '8px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    zIndex: 9999,
    border: '1px solid var(--border-color, #e2e8f0)',
    overflow: 'hidden',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--text-muted, #94a3b8)',
    fontSize: '13px',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--text-primary, #0f172a)',
    fontWeight: 500,
  }),
};

const SEASON_OPTIONS = [
  ...CHURCH_SEASONS.map((s) => ({ value: s.name, label: `${s.name} (${s.theme})` })),
  { value: 'General Worship', label: 'General Worship' },
  { value: 'Sacraments', label: 'Sacraments & Communion' },
  { value: 'Funerals & Memorials', label: 'Funerals & Memorials' },
  { value: 'Youth & Children', label: 'Youth & Children' },
  { value: 'Daily Worship', label: 'Daily Worship (Morning & Evening)' },
];

function generateRealDefaultCollections(hymnsList) {
  const allNums = hymnsList.map((h) => h.hymn_number);

  return [
    {
      id: 'col_general_praise',
      title: 'Praise & Thanksgiving',
      title_twi: 'Ayeyi & Aseda Nnwom',
      description: 'Hymns of gratitude, praise, adoration, and worship of God Almighty.',
      season: 'Ordinary Time / Kingdom',
      color: '#18227c',
      hymn_numbers: allNums.slice(0, 4),
    },
    {
      id: 'col_communion',
      title: 'Holy Communion & Fellowship',
      title_twi: 'Awurade Adidie Kronkron',
      description: 'Solemn and devotional hymns for the preparation and celebration of the Lord\'s Supper.',
      season: 'Sacraments',
      color: '#b91c1c',
      hymn_numbers: allNums.filter((n) => n === 1 || n === 2),
    },
    {
      id: 'col_morning_devotion',
      title: 'Morning & Daily Devotions',
      title_twi: 'Anɔpa & Daa Asɔre Nnwom',
      description: 'Starting the day with songs of praise, divine guidance, and faithfulness.',
      season: 'Daily Worship',
      color: '#0284c7',
      hymn_numbers: allNums.filter((n) => n === 1 || n === 3),
    },
    {
      id: 'col_easter_resurrection',
      title: 'Easter & Resurrection Joy',
      title_twi: 'Kwesida Akyi & Wusɔreɛ',
      description: 'Hymns celebrating the triumph of Christ over death and the Resurrection.',
      season: 'Holy Week & Easter',
      color: '#d97706',
      hymn_numbers: allNums.filter((n) => n === 1),
    },
    {
      id: 'col_advent_christmas',
      title: 'Advent & Christmas Tidings',
      title_twi: 'Advent & Buronya Anigyeɛ',
      description: 'Anticipation of the Savior\'s birth, the Incarnation, and festive nativity carols.',
      season: 'Advent & Christmas',
      color: '#15803d',
      hymn_numbers: allNums.filter((n) => n === 2 || n === 3),
    },
  ];
}

const CollectionsPage = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [hymns, setHymns] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});

  // New Collection Form State
  const [newColData, setNewColData] = useState({
    title: '',
    title_twi: '',
    description: '',
    season: 'General Worship',
  });
  const [selectedHymnNums, setSelectedHymnNums] = useState([]);

  // Close open action menu on outside click
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

  // Load Real Data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch real hymns from Supabase
      const { data: hymnsData } = await supabase
        .from('hymns')
        .select('id, hymn_number, title_en, title_twi, audio_url, lyrics_en, lyrics_twi, is_published')
        .order('hymn_number', { ascending: true });

      const realHymns = hymnsData || [];
      setHymns(realHymns);

      // 2. Fetch real collections from Supabase (if collections table exists)
      const { data: dbCollections, error: colErr } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false });

      let loadedCollections = [];
      if (!colErr && Array.isArray(dbCollections) && dbCollections.length > 0) {
        loadedCollections = dbCollections;
      } else {
        // Check local storage for user created/modified sets
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            loadedCollections = JSON.parse(saved);
          } catch {
            loadedCollections = [];
          }
        }

        // If no saved collections, generate clean real default collections using existing hymns
        if (!loadedCollections || loadedCollections.length === 0) {
          loadedCollections = generateRealDefaultCollections(realHymns);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loadedCollections));
        }
      }

      setCollections(loadedCollections);
      if (loadedCollections.length > 0) {
        setSelectedCol((prev) => {
          if (!prev) return loadedCollections[0];
          const found = loadedCollections.find((c) => c.id === prev.id);
          return found || loadedCollections[0];
        });
      }
    } catch (err) {
      console.error('Error fetching real data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 400);
  };

  const saveCollections = async (newList) => {
    setCollections(newList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
  };

  // Hymn Select Options for react-select
  const hymnOptions = useMemo(() => {
    return hymns.map((h) => ({
      value: h.hymn_number,
      label: `#${h.hymn_number} - ${h.title_en}${h.title_twi ? ` (${h.title_twi})` : ''}`,
      hymn: h,
    }));
  }, [hymns]);

  // Options for Quick Add (excluding hymns already in the set)
  const quickAddOptions = useMemo(() => {
    if (!selectedCol) return hymnOptions;
    const existing = new Set(selectedCol.hymn_numbers || []);
    return hymnOptions.filter((opt) => !existing.has(opt.value));
  }, [hymnOptions, selectedCol]);

  // Add Hymn to Collection
  const handleAddHymnToCollection = (hymnNum) => {
    if (!hymnNum || !selectedCol) return;
    if (selectedCol.hymn_numbers?.includes(hymnNum)) return;

    const updatedCol = {
      ...selectedCol,
      hymn_numbers: [...(selectedCol.hymn_numbers || []), hymnNum],
    };
    const updatedList = collections.map((c) => (c.id === selectedCol.id ? updatedCol : c));
    saveCollections(updatedList);
    setSelectedCol(updatedCol);

    const hymnObj = hymns.find((h) => h.hymn_number === hymnNum);
    Swal.fire({
      title: 'Hymn Added',
      text: `Hymn #${hymnNum} (${hymnObj?.title_en || ''}) added to "${selectedCol.title}".`,
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Remove Hymn from Collection
  const handleRemoveHymnFromCollection = (hymnNum) => {
    if (!selectedCol) return;
    const updatedHymnNums = (selectedCol.hymn_numbers || []).filter((n) => n !== hymnNum);
    const updatedCol = { ...selectedCol, hymn_numbers: updatedHymnNums };
    const updatedList = collections.map((c) => (c.id === selectedCol.id ? updatedCol : c));
    saveCollections(updatedList);
    setSelectedCol(updatedCol);
  };

  // Create Collection
  const handleCreateCollection = (e) => {
    e.preventDefault();
    if (!newColData.title.trim()) return;

    const newCol = {
      id: `col_${Date.now()}`,
      title: newColData.title.trim(),
      title_twi: newColData.title_twi.trim() || null,
      description: newColData.description.trim() || 'Curated hymnal set for church worship.',
      season: newColData.season,
      color: '#18227c',
      hymn_numbers: selectedHymnNums,
    };

    const updated = [newCol, ...collections];
    saveCollections(updated);
    setSelectedCol(newCol);
    setIsAddModalOpen(false);
    setNewColData({
      title: '',
      title_twi: '',
      description: '',
      season: 'General Worship',
    });
    setSelectedHymnNums([]);

    Swal.fire('Collection Created!', `"${newCol.title}" is ready with ${newCol.hymn_numbers.length} hymns.`, 'success');
  };

  // Delete Collection
  const handleDeleteCollection = async (colId, title) => {
    const result = await Swal.fire({
      title: 'Delete Collection?',
      text: `Are you sure you want to remove "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#e02424',
    });

    if (result.isConfirmed) {
      const remaining = collections.filter((c) => c.id !== colId);
      saveCollections(remaining);
      setSelectedCol(remaining.length > 0 ? remaining[0] : null);
      Swal.fire('Deleted', `Collection "${title}" has been deleted.`, 'info');
    }
  };

  // Export Service Bulletin
  const handleExportBulletin = () => {
    if (!selectedCol) return;
    const matched = hymns.filter((h) => selectedCol.hymn_numbers?.includes(h.hymn_number));
    let text = `PRESBYTERIAN CHURCH OF GHANA\nSERVICE HYMNAL BULLETIN - ${selectedCol.title.toUpperCase()}\n${'='.repeat(55)}\n`;
    text += `Season: ${selectedCol.season}\n`;
    if (selectedCol.description) text += `Description: ${selectedCol.description}\n`;
    text += `Total Hymns: ${matched.length}\n${'='.repeat(55)}\n\n`;

    matched.forEach((h) => {
      text += `HYMN #${h.hymn_number} - ${h.title_en.toUpperCase()}\n`;
      if (h.title_twi) text += `Twi Title: ${h.title_twi}\n`;
      if (h.lyrics_en) text += `\n${h.lyrics_en}\n`;
      if (h.lyrics_twi) text += `\n[TWI TRANSLATION]\n${h.lyrics_twi}\n`;
      text += `\n${'-'.repeat(45)}\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PCG_Bulletin_${selectedCol.title.replace(/\s+/g, '_')}.txt`;
    a.click();
  };

  const matchedHymns = hymns.filter((h) => selectedCol?.hymn_numbers?.includes(h.hymn_number));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Church Seasons & Hymnal Collections</h1>
          <p>Curate themed service sets and sync with church calendar seasons</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className={`btn btn-secondary ${refreshing ? 'rotating' : ''}`}
            onClick={handleRefresh}
            title="Refresh Real Data"
          >
            <RefreshIcon /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={handleExportBulletin} disabled={!selectedCol}>
            <ExportIcon /> Export Bulletin
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <AddIcon /> New Collection
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-container" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading real hymns and seasonal collections...
        </div>
      ) : (
        /* Main Grid Layout */
        <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 24 }}>
          {/* Collections List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card-container" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--pcg-blue-dark)', marginBottom: 12 }}>
                Seasonal & Thematic Sets ({collections.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {collections.map((col) => {
                  const isActive = col.id === selectedCol?.id;
                  const count = col.hymn_numbers?.length || 0;
                  return (
                    <div
                      key={col.id}
                      onClick={() => setSelectedCol(col)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: isActive ? 'var(--pcg-blue-subtle)' : '#ffffff',
                        border: isActive ? '1.5px solid var(--pcg-blue)' : '1px solid var(--border-color)',
                        transition: 'var(--transition)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-gold" style={{ fontSize: 10 }}>{col.season}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--pcg-blue)' }}>
                          {count} {count === 1 ? 'Hymn' : 'Hymns'}
                        </span>
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: isActive ? 'var(--pcg-blue)' : 'var(--text-primary)',
                          marginTop: 6,
                        }}
                      >
                        {col.title}
                      </div>
                      {col.title_twi && (
                        <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                          {col.title_twi}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selected Collection View & Hymns Editor */}
          {selectedCol ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header Info Card */}
              <div className="card-container" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <span className="badge badge-blue">{selectedCol.season}</span>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--pcg-blue-dark)', marginTop: 6 }}>
                      {selectedCol.title}
                    </h2>
                    {selectedCol.title_twi && (
                      <p style={{ fontSize: 14, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                        {selectedCol.title_twi}
                      </p>
                    )}
                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8 }}>
                      {selectedCol.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-gold btn-sm"
                      onClick={() => {
                        if (matchedHymns.length > 0) {
                          navigate(`/presenter/${matchedHymns[0].id}`);
                        } else {
                          navigate('/presenter');
                        }
                      }}
                    >
                      <PresenterIcon /> Launch Presenter
                    </button>
                    {collections.length > 1 && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#dc2626' }}
                        onClick={() => handleDeleteCollection(selectedCol.id, selectedCol.title)}
                        title="Delete this set"
                      >
                        <DeleteIcon />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Add Hymn Input using React-Select */}
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pcg-blue-dark)', whiteSpace: 'nowrap' }}>
                    Add Hymn to Set:
                  </span>
                  <div style={{ flex: 1, minWidth: 260, maxWidth: 440 }}>
                    <Select
                      options={quickAddOptions}
                      value={null}
                      onChange={(selected) => {
                        if (selected) {
                          handleAddHymnToCollection(selected.value);
                        }
                      }}
                      placeholder="Search hymn by number or English / Twi title..."
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      isSearchable={true}
                      noOptionsMessage={() => 'All available hymns are already in this set'}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    ({hymns.length} total hymns in database)
                  </span>
                </div>
              </div>

              {/* Hymns in this Collection Table */}
              <div className="card-container" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    fontWeight: 700,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>Hymns Sequence ({selectedCol.hymn_numbers?.length || 0} hymns)</span>
                  <span className="badge badge-green">Real Hymnal Content</span>
                </div>

                {matchedHymns.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>No hymns in this collection yet.</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      Use the search dropdown above to select and add hymns to this set.
                    </p>
                  </div>
                ) : (
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>#</th>
                        <th>Hymn Title</th>
                        <th>Twi Title</th>
                        <th>Audio Tune</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCol.hymn_numbers?.map((hymnNum) => {
                        const hymnObj = hymns.find((h) => h.hymn_number === hymnNum);
                        return (
                          <tr key={hymnNum}>
                            <td>
                              <span className="hymn-number-badge">#{hymnNum}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {hymnObj ? hymnObj.title_en : `Hymn #${hymnNum}`}
                            </td>
                            <td style={{ color: '#64748b', fontStyle: 'italic' }}>
                              {hymnObj?.title_twi || '—'}
                            </td>
                            <td>
                              {hymnObj?.audio_url ? (
                                <span className="badge badge-green">
                                  <CheckIcon size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                                  Audio Ready
                                </span>
                              ) : (
                                <span className="badge badge-gray">No audio</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div
                                className="action-menu-wrapper"
                                ref={(el) => {
                                  menuRefs.current[hymnNum] = el;
                                }}
                              >
                                <button
                                  type="button"
                                  className={`ellipsis-btn ${openMenuId === hymnNum ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === hymnNum ? null : hymnNum);
                                  }}
                                  title="Actions"
                                >
                                  <MoreIcon />
                                </button>

                                {openMenuId === hymnNum && (
                                  <div className="dropdown-menu">
                                    <button
                                      type="button"
                                      className="dropdown-item"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        navigate(`/presenter/${hymnObj?.id || hymnNum}`);
                                      }}
                                    >
                                      <PresenterIcon /> Launch in Presenter
                                    </button>
                                    <button
                                      type="button"
                                      className="dropdown-item dropdown-item-danger"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleRemoveHymnFromCollection(hymnNum);
                                      }}
                                    >
                                      <DeleteIcon /> Remove from Set
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="card-container" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a collection from the left panel or click "New Collection" to create one.
            </div>
          )}
        </div>
      )}

      {/* Add Collection Modal */}
      {isAddModalOpen && (
        <div className="drawer-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="drawer-container" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>New Hymnal Collection</h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  Curate a themed set for Sunday services, sacraments, or church seasons
                </p>
              </div>
              <button className="page-btn" onClick={() => setIsAddModalOpen(false)} style={{ border: 'none' }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Collection Title (English) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newColData.title}
                    onChange={(e) => setNewColData({ ...newColData, title: e.target.value })}
                    placeholder="e.g. Easter Sunday Resurrection Hymns"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Collection Title (Twi)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newColData.title_twi}
                    onChange={(e) => setNewColData({ ...newColData, title_twi: e.target.value })}
                    placeholder="e.g. Wusɔreɛ Kwesida Nnwom"
                  />
                </div>

                <div className="form-group">
                  <label>Liturgical Church Season *</label>
                  <Select
                    options={SEASON_OPTIONS}
                    value={SEASON_OPTIONS.find((s) => s.value === newColData.season) || SEASON_OPTIONS[0]}
                    onChange={(selected) =>
                      setNewColData({ ...newColData, season: selected ? selected.value : 'General Worship' })
                    }
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    isSearchable={true}
                    placeholder="Select liturgical season..."
                  />
                </div>

                <div className="form-group">
                  <label>Select Initial Hymns</label>
                  <Select
                    isMulti
                    options={hymnOptions}
                    value={hymnOptions.filter((opt) => selectedHymnNums.includes(opt.value))}
                    onChange={(selected) =>
                      setSelectedHymnNums(selected ? selected.map((s) => s.value) : [])
                    }
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    placeholder="Search and pick hymns from database..."
                    isSearchable={true}
                    closeMenuOnSelect={false}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-textarea"
                    style={{ minHeight: 70 }}
                    value={newColData.description}
                    onChange={(e) => setNewColData({ ...newColData, description: e.target.value })}
                    placeholder="Describe the occasion, themes, or purpose of this hymnal set..."
                  />
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <SingleCheckIcon /> Create Set
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionsPage;
