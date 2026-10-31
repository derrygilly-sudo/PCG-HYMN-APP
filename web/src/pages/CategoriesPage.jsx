// src/pages/CategoriesPage.jsx
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';
import {
  SearchIcon,
  RefreshIcon,
  CloseIcon,
  EditIcon,
  DeleteIcon,
  AddIcon,
  SingleCheckIcon,
  MoreIcon,
  ViewIcon,
} from '../config/icons';

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [hymns, setHymns] = useState([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Selected Category to view assigned hymns
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});

  // Drawer / Modal for Add & Edit
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name_en: '', name_twi: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [catRes, hymnRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }),
      supabase.from('hymns').select('id, hymn_number, title_en, title_twi, category_id, is_published'),
    ]);

    if (!catRes.error) setCategories(catRes.data || []);
    if (!hymnRes.error) setHymns(hymnRes.data || []);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 400);
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name_en: '',
      name_twi: '',
      sort_order: (categories.length + 1) * 10,
    });
    setError('');
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name_en: cat.name_en || '',
      name_twi: cat.name_twi || '',
      sort_order: cat.sort_order || 0,
    });
    setError('');
    setIsDrawerOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name_en.trim()) {
      setError('English category name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name_en: formData.name_en.trim(),
      name_twi: formData.name_twi.trim() || null,
      sort_order: parseInt(formData.sort_order, 10) || 0,
    };

    if (editingCategory) {
      const { error: updateErr } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editingCategory.id);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertErr } = await supabase.from('categories').insert([payload]);
      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setIsDrawerOpen(false);
    Swal.fire({
      title: 'Success!',
      text: `Category "${payload.name_en}" saved.`,
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
    });
    loadData();
  };

  const handleDelete = async (cat) => {
    const assignedCount = hymns.filter((h) => h.category_id === cat.id).length;
    if (assignedCount > 0) {
      const confirm = await Swal.fire({
        title: 'Category in Use',
        html: `This category has <strong>${assignedCount} hymns</strong> assigned to it. Deleting will unassign these hymns.<br/>Do you wish to proceed?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Yes, delete & unassign',
      });
      if (!confirm.isConfirmed) return;
    } else {
      const confirm = await Swal.fire({
        title: 'Delete Category?',
        text: `Delete "${cat.name_en}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Delete',
      });
      if (!confirm.isConfirmed) return;
    }

    const { error: delErr } = await supabase.from('categories').delete().eq('id', cat.id);
    if (!delErr) {
      Swal.fire('Deleted', 'Category removed successfully', 'success');
      loadData();
    }
  };

  const filteredCategories = categories.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name_en?.toLowerCase().includes(q) || c.name_twi?.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Hymn Categories & Liturgical Themes</h1>
          <p>Organize hymns by Presbyterian topical sections, seasons, and sacraments</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleRefresh} disabled={refreshing}>
            <RefreshIcon className={refreshing ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <AddIcon /> Add Category
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="filter-toolbar" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="filter-search-box" style={{ maxWidth: 360 }}>
          <span className="search-icon-pos" style={{ left: 12, top: 11, position: 'absolute' }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search categories in English or Twi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Total Categories: <strong>{categories.length}</strong>
        </div>
      </div>

      {/* Categories Grid / Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {filteredCategories.map((cat) => {
          const assignedHymns = hymns.filter((h) => h.category_id === cat.id);
          const isExpanded = expandedCategoryId === cat.id;

          return (
            <div key={cat.id} className="card-container" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="badge badge-gold">Order #{cat.sort_order}</span>
                    <span className="badge badge-blue">{assignedHymns.length} Hymns</span>
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 8, color: 'var(--pcg-blue-dark)' }}>
                    {cat.name_en}
                  </h3>
                  {cat.name_twi && (
                    <div style={{ fontSize: 13.5, color: '#64748b', fontStyle: 'italic' }}>
                      {cat.name_twi}
                    </div>
                  )}
                </div>

                <div
                  className="action-menu-wrapper"
                  ref={(el) => {
                    menuRefs.current[cat.id] = el;
                  }}
                >
                  <button
                    type="button"
                    className={`ellipsis-btn ${openMenuId === cat.id ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === cat.id ? null : cat.id);
                    }}
                    title="Actions"
                  >
                    <MoreIcon />
                  </button>

                  {openMenuId === cat.id && (
                    <div className="dropdown-menu">
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setOpenMenuId(null);
                          handleOpenEdit(cat);
                        }}
                      >
                        <EditIcon /> Edit Category
                      </button>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setOpenMenuId(null);
                          setExpandedCategoryId(isExpanded ? null : cat.id);
                        }}
                      >
                        <ViewIcon /> {isExpanded ? 'Hide Hymns' : 'View Hymns'}
                      </button>
                      <div className="dropdown-divider" />
                      <button
                        type="button"
                        className="dropdown-item dropdown-item-danger"
                        onClick={() => {
                          setOpenMenuId(null);
                          handleDelete(cat);
                        }}
                      >
                        <DeleteIcon /> Delete Category
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Accordion Toggle */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'space-between' }}
                  onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                >
                  <span>{isExpanded ? 'Hide Hymns List' : 'View Assigned Hymns'}</span>
                  <span>{isExpanded ? '▲' : '▼'}</span>
                </button>
              </div>

              {/* Expanded Hymns Accordion */}
              {isExpanded && (
                <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 12, maxHeight: 220, overflowY: 'auto' }}>
                  {assignedHymns.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>
                      No hymns currently assigned to this category.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {assignedHymns.map((h) => (
                        <div
                          key={h.id}
                          style={{
                            fontSize: 13,
                            display: 'flex',
                            justifyContent: 'space-between',
                            background: '#ffffff',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>#{h.hymn_number} {h.title_en}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.title_twi || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Category Add/Edit Drawer */}
      {isDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)}>
          <div className="drawer-container" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button className="page-btn" onClick={() => setIsDrawerOpen(false)} style={{ border: 'none' }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="drawer-body">
                {error && (
                  <div style={{ padding: 12, background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                    ⚠️ {error}
                  </div>
                )}

                <div className="form-group">
                  <label>Category Name (English) *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    placeholder="e.g. Praise & Thanksgiving"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category Name (Twi / Asɛmti)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name_twi}
                    onChange={(e) => setFormData({ ...formData, name_twi: e.target.value })}
                    placeholder="e.g. Nkamfoɔ & Nnaase"
                  />
                </div>

                <div className="form-group">
                  <label>Display Sort Order (Numeric rank)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                    placeholder="e.g. 10"
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Lower numbers appear first in the hymnal.
                  </span>
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsDrawerOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <SingleCheckIcon /> {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesPage;