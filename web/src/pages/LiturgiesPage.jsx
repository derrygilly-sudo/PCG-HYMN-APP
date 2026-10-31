// src/pages/LiturgiesPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { DEFAULT_LITURGIES } from '../data/liturgyData';
import Select from 'react-select';
import {
  SearchIcon,
  AddIcon,
  EditIcon,
  CloseIcon,
  CopyIcon,
  SingleCheckIcon,
  HymnIcon,
  RefreshIcon,
  DeleteIcon,
  PresenterIcon,
} from '../config/icons';
import Swal from 'sweetalert2';

const LOCAL_STORAGE_KEY = 'pcg_custom_liturgies';

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

const CATEGORY_OPTIONS = [
  { value: 'Creed', label: 'Creed (Apostles\', Nicene, Athanasian)' },
  { value: 'Sacrament', label: 'Sacrament (Baptism, Holy Communion)' },
  { value: 'Prayer', label: 'Prayer (Lord\'s Prayer, Collects, Intercessions)' },
  { value: 'Canticle', label: 'Canticle (Te Deum, Magnificat, Benedictus)' },
  { value: 'Order of Service', label: 'Order of Service (Lord\'s Day, Ordination, Burial)' },
  { value: 'Scripture', label: 'Scripture & Lectionary (Beatitudes, Psalter)' },
  { value: 'Law', label: 'Law & The Ten Commandments' },
];

const LiturgiesPage = () => {
  const navigate = useNavigate();
  const [liturgies, setLiturgies] = useState(DEFAULT_LITURGIES);
  const [hymns, setHymns] = useState([]);
  const [selectedId, setSelectedId] = useState(DEFAULT_LITURGIES[0]?.id || null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCloudSync, setIsCloudSync] = useState(false);

  // Edit/Add modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    title_en: '',
    title_twi: '',
    category: 'Creed',
    rubric: '',
    content_en: '',
    content_twi: '',
    recommended_hymns: [],
  });

  // Fetch real data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch real hymns for recommended hymn linkage
      const { data: hymnsData } = await supabase
        .from('hymns')
        .select('id, hymn_number, title_en, title_twi')
        .order('hymn_number', { ascending: true });

      setHymns(hymnsData || []);

      // 2. Fetch liturgies from Supabase if table exists
      const { data: dbLiturgies, error: litErr } = await supabase
        .from('liturgies')
        .select('*')
        .order('created_at', { ascending: true });

      let list = [];
      if (!litErr && Array.isArray(dbLiturgies) && dbLiturgies.length > 0) {
        setIsCloudSync(true);
        list = dbLiturgies;
      } else {
        setIsCloudSync(false);
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            list = JSON.parse(saved);
          } catch {
            list = DEFAULT_LITURGIES;
          }
        } else {
          list = DEFAULT_LITURGIES;
        }
      }

      setLiturgies(list);
      if (list.length > 0) {
        setSelectedId((prev) => {
          if (!prev) return list[0].id;
          const found = list.find((l) => l.id === prev);
          return found ? found.id : list[0].id;
        });
      }
    } catch (err) {
      console.error('Error fetching liturgies:', err);
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

  const saveLiturgiesToStorage = async (newList) => {
    setLiturgies(newList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newList));
    if (isCloudSync) {
      // If table exists, update cloud
    }
  };

  // Convert real hymns into react-select options
  const hymnSelectOptions = useMemo(() => {
    return hymns.map((h) => ({
      value: h.hymn_number,
      label: `#${h.hymn_number} - ${h.title_en}${h.title_twi ? ` (${h.title_twi})` : ''}`,
      hymn: h,
    }));
  }, [hymns]);

  const currentLiturgy = liturgies.find((l) => l.id === selectedId) || liturgies[0];

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      title_en: '',
      title_twi: '',
      category: 'Order of Service',
      rubric: '',
      content_en: '',
      content_twi: '',
      recommended_hymns: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title_en: item.title_en || '',
      title_twi: item.title_twi || '',
      category: item.category || 'Creed',
      rubric: item.rubric || '',
      content_en: item.content_en || '',
      content_twi: item.content_twi || '',
      recommended_hymns: Array.isArray(item.recommended_hymns) ? item.recommended_hymns : [],
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!formData.title_en.trim() || !formData.content_en.trim()) {
      Swal.fire('Required Fields', 'Please provide English title and content.', 'warning');
      return;
    }

    const newItem = {
      id: editingItem ? editingItem.id : `liturgy_${Date.now()}`,
      title_en: formData.title_en.trim(),
      title_twi: formData.title_twi.trim() || null,
      category: formData.category,
      rubric: formData.rubric.trim() || null,
      content_en: formData.content_en.trim(),
      content_twi: formData.content_twi.trim() || null,
      recommended_hymns: formData.recommended_hymns,
      updated_at: new Date().toISOString(),
    };

    let updated;
    if (editingItem) {
      updated = liturgies.map((l) => (l.id === editingItem.id ? newItem : l));
    } else {
      updated = [newItem, ...liturgies];
      setSelectedId(newItem.id);
    }

    saveLiturgiesToStorage(updated);
    setIsModalOpen(false);
    Swal.fire({
      title: 'Saved!',
      text: `Liturgy "${newItem.title_en}" saved successfully.`,
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
    });
  };

  const handleDeleteLiturgy = async (id, title) => {
    const result = await Swal.fire({
      title: 'Delete Liturgy?',
      text: `Are you sure you want to delete "${title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#e02424',
    });

    if (result.isConfirmed) {
      const remaining = liturgies.filter((l) => l.id !== id);
      saveLiturgiesToStorage(remaining);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
      Swal.fire('Deleted', `"${title}" has been deleted.`, 'info');
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      title: 'Copied to Clipboard!',
      text: 'Liturgical text is ready to paste into your bulletin or slides.',
      icon: 'success',
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const categories = ['All', ...new Set(liturgies.map((l) => l.category))];

  const categoryFilterOptions = [
    { value: 'All', label: 'All Categories' },
    ...categories.filter((c) => c !== 'All').map((c) => ({ value: c, label: c })),
  ];

  const filteredLiturgies = liturgies.filter((l) => {
    if (selectedCategory !== 'All' && l.category !== selectedCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.title_en.toLowerCase().includes(q) ||
        l.title_twi?.toLowerCase().includes(q) ||
        l.content_en.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Presbyterian Liturgies & Orders of Service</h1>
          <p>Creeds, Sacraments, Canticles, and Lord's Day service rituals in English & Twi</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className={`btn btn-secondary ${refreshing ? 'rotating' : ''}`}
            onClick={handleRefresh}
            title="Refresh Real Data"
          >
            <RefreshIcon /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <AddIcon /> Add Liturgy / Order
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card-container" style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading official Presbyterian liturgies and real hymns...
        </div>
      ) : (
        /* Main Split Layout */
        <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 24 }}>
          {/* Left: Liturgies Sidebar List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card-container" style={{ padding: 16 }}>
              {/* Search */}
              <div className="filter-search-box" style={{ width: '100%', marginBottom: 12 }}>
                <span className="search-icon-pos" style={{ left: 10, top: 10, position: 'absolute' }}>
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  placeholder="Search liturgies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: '8px 12px 8px 32px' }}
                />
              </div>

              {/* Category Filter using React-Select */}
              <div style={{ marginBottom: 12 }}>
                <Select
                  options={categoryFilterOptions}
                  value={categoryFilterOptions.find((opt) => opt.value === selectedCategory) || categoryFilterOptions[0]}
                  onChange={(selected) => setSelectedCategory(selected ? selected.value : 'All')}
                  styles={selectStyles}
                  isSearchable={false}
                  placeholder="Filter by category..."
                />
              </div>

              {/* Liturgy Items Navigation List */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 'calc(100vh - 360px)',
                  overflowY: 'auto',
                }}
              >
                {filteredLiturgies.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No liturgies match your search filter.
                  </div>
                ) : (
                  filteredLiturgies.map((item) => {
                    const isActive = item.id === selectedId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          background: isActive ? 'var(--pcg-blue-subtle)' : '#ffffff',
                          border: isActive ? '1.5px solid var(--pcg-blue)' : '1px solid var(--border-color)',
                          transition: 'var(--transition)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="badge badge-gray" style={{ fontSize: 10 }}>{item.category}</span>
                          {item.recommended_hymns && item.recommended_hymns.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--pcg-blue)', fontWeight: 600 }}>
                              {item.recommended_hymns.length} Hymns
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 13.5,
                            color: isActive ? 'var(--pcg-blue)' : 'var(--text-primary)',
                            marginTop: 4,
                          }}
                        >
                          {item.title_en}
                        </div>
                        {item.title_twi && (
                          <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                            {item.title_twi}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Dual Column Display Panel */}
          {currentLiturgy ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Top Toolbar for Selected Liturgy */}
              <div
                className="card-container"
                style={{
                  padding: '18px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-blue">{currentLiturgy.category}</span>
                    {currentLiturgy.rubric && (
                      <span className="rubric-text" style={{ margin: 0 }}>
                        ⚠️ {currentLiturgy.rubric}
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--pcg-blue-dark)', marginTop: 6 }}>
                    {currentLiturgy.title_en}
                  </h2>
                  {currentLiturgy.title_twi && (
                    <p style={{ fontSize: 14, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                      {currentLiturgy.title_twi}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      handleCopyText(`${currentLiturgy.title_en}\n\n${currentLiturgy.content_en}`)
                    }
                  >
                    <CopyIcon /> Copy English
                  </button>
                  {currentLiturgy.content_twi && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        handleCopyText(`${currentLiturgy.title_twi}\n\n${currentLiturgy.content_twi}`)
                      }
                    >
                      <CopyIcon /> Copy Twi
                    </button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={() => handleOpenEdit(currentLiturgy)}>
                    <EditIcon /> Edit
                  </button>
                  {liturgies.length > 1 && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: '#dc2626' }}
                      onClick={() => handleDeleteLiturgy(currentLiturgy.id, currentLiturgy.title_en)}
                      title="Delete this liturgy"
                    >
                      <DeleteIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* Recommended Linked Hymns with Real Data */}
              {currentLiturgy.recommended_hymns && currentLiturgy.recommended_hymns.length > 0 && (
                <div
                  className="card-container"
                  style={{
                    padding: '14px 20px',
                    background: 'var(--pcg-gold-light)',
                    borderColor: '#fde68a',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <HymnIcon style={{ color: '#b45309' }} />
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: '#92400e' }}>
                      Recommended Liturgical Hymns:
                    </span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {currentLiturgy.recommended_hymns.map((num) => {
                        const hymnObj = hymns.find((h) => h.hymn_number === num);
                        return (
                          <span
                            key={num}
                            className="hymn-number-badge"
                            style={{
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 10px',
                            }}
                            onClick={() => {
                              if (hymnObj?.id) {
                                navigate(`/presenter/${hymnObj.id}`);
                              } else {
                                navigate('/hymns');
                              }
                            }}
                            title="Click to launch presenter or view hymn"
                          >
                            <strong>#{num}</strong> {hymnObj ? `• ${hymnObj.title_en}` : ''}
                            <PresenterIcon size={13} style={{ color: 'var(--pcg-blue)' }} />
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Dual Content Columns */}
              <div className="liturgy-split-view" style={{ marginTop: 0 }}>
                {/* English Column */}
                <div className="liturgy-panel">
                  <div className="liturgy-panel-header">
                    <span style={{ fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>English Liturgical Text</span>
                    <span className="badge badge-blue">Official PCG Order</span>
                  </div>
                  <div className="liturgy-text-content" style={{ whiteSpace: 'pre-line' }}>
                    {currentLiturgy.content_en}
                  </div>
                </div>

                {/* Twi Column */}
                <div className="liturgy-panel">
                  <div className="liturgy-panel-header">
                    <span style={{ fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>Twi Kasasuo (Liturgi)</span>
                    <span className="badge badge-gold">Twi Translation</span>
                  </div>
                  <div className="liturgy-text-content" style={{ whiteSpace: 'pre-line' }}>
                    {currentLiturgy.content_twi || (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No Twi translation provided for this liturgy yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-container" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a liturgy from the left panel or click "Add Liturgy / Order" to create one.
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Liturgy Modal */}
      {isModalOpen && (
        <div className="drawer-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="drawer-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {editingItem ? 'Edit Liturgy Order' : 'Add New Presbyterian Liturgy'}
                </h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  Presbyterian Church of Ghana Creeds, Orders of Service, and Sacraments
                </p>
              </div>
              <button className="page-btn" onClick={() => setIsModalOpen(false)} style={{ border: 'none' }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="drawer-body">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Title (English) *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title_en}
                      onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                      placeholder="e.g. Order for Confirmation"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Title (Twi)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title_twi}
                      onChange={(e) => setFormData({ ...formData, title_twi: e.target.value })}
                      placeholder="e.g. Gyedie Mu Kuruwa"
                    />
                  </div>

                  <div className="form-group">
                    <label>Category *</label>
                    <Select
                      options={CATEGORY_OPTIONS}
                      value={CATEGORY_OPTIONS.find((c) => c.value === formData.category) || CATEGORY_OPTIONS[0]}
                      onChange={(selected) =>
                        setFormData({ ...formData, category: selected ? selected.value : 'Creed' })
                      }
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      isSearchable={false}
                      placeholder="Select category..."
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Rubric (Liturgical instructions in red)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.rubric}
                      onChange={(e) => setFormData({ ...formData, rubric: e.target.value })}
                      placeholder="e.g. The Congregation stands"
                    />
                  </div>

                  <div className="form-group">
                    <label>Recommended Hymns (Pick from Database)</label>
                    <Select
                      isMulti
                      options={hymnSelectOptions}
                      value={hymnSelectOptions.filter((opt) => formData.recommended_hymns.includes(opt.value))}
                      onChange={(selected) =>
                        setFormData({
                          ...formData,
                          recommended_hymns: selected ? selected.map((s) => s.value) : [],
                        })
                      }
                      styles={selectStyles}
                      menuPortalTarget={document.body}
                      placeholder="Search and pick hymns from database..."
                      isSearchable={true}
                      closeMenuOnSelect={false}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>English Content *</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 200, fontFamily: 'var(--font-serif)' }}
                      value={formData.content_en}
                      onChange={(e) => setFormData({ ...formData, content_en: e.target.value })}
                      placeholder="Enter liturgy dialogue, leader/congregation responses..."
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Twi Content (Nkyekyɛmu)</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 200, fontFamily: 'var(--font-serif)' }}
                      value={formData.content_twi}
                      onChange={(e) => setFormData({ ...formData, content_twi: e.target.value })}
                      placeholder="Fa Twi nsɛm no hyɛ ha..."
                    />
                  </div>
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <SingleCheckIcon /> {editingItem ? 'Save Changes' : 'Create Liturgy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiturgiesPage;
