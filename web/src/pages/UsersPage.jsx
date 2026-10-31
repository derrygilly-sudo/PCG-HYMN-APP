import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import {
  UserIcon,
  ShieldIcon,
  AddIcon,
  HistoryIcon,
  SingleCheckIcon,
  CloseIcon,
  SparkleIcon,
  MoreIcon,
  DeleteIcon,
  EditIcon,
  RefreshIcon,
  CheckIcon,
} from '../config/icons';
import Swal from 'sweetalert2';
import Select from 'react-select';

const ROLE_OPTIONS = [
  { value: 'Super Admin', label: 'Super Admin (Full DB & User Control)' },
  { value: 'Liturgy Director', label: 'Liturgy Director (Liturgies & Orders of Service)' },
  { value: 'Language Translator (Twi)', label: 'Language Translator (Twi Lyrics & Titles)' },
  { value: 'Music Director', label: 'Music Director (Audio Tunes & Sol-fa)' },
  { value: 'Reviewer / Viewer', label: 'Reviewer / Viewer (Read-only)' },
];

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
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
    padding: '10px 14px',
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
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--text-primary, #0f172a)',
    fontWeight: 500,
  }),
};

function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return 'Just now';
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  return past.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LOCAL_STORAGE_KEY = 'pcg_team_members';

const UsersPage = ({ session }) => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCloudSync, setIsCloudSync] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Form Drawer state (for direct Add & Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    role: 'Liturgy Director',
    department: '',
  });

  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRefs = useRef({});

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

  // Load real team members & real audit logs
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Real Team Members from Supabase
      const { data: dbMembers, error: memberErr } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: true });

      let membersList = [];
      if (!memberErr && Array.isArray(dbMembers)) {
        setIsCloudSync(true);
        membersList = dbMembers;
      } else {
        // Fallback to localStorage if table is not yet created in Supabase
        setIsCloudSync(false);
        try {
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          membersList = stored ? JSON.parse(stored) : [];
        } catch {
          membersList = [];
        }
      }

      // Ensure current authenticated user is included in the team list
      if (session?.user) {
        const currentEmail = session.user.email?.toLowerCase();
        const existingCurrent = membersList.find(
          (m) => m.email?.toLowerCase() === currentEmail || m.id === session.user.id
        );

        if (!existingCurrent) {
          const currentAdmin = {
            id: session.user.id,
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0] ||
              'Presbytery Administrator',
            email: session.user.email,
            role: session.user.user_metadata?.role || 'Super Admin',
            department: session.user.user_metadata?.department || 'Church Secretariat & IT',
            status: 'Active',
            last_active: 'Active now (Current Session)',
            created_at: session.user.created_at || new Date().toISOString(),
            isCurrent: true,
          };
          membersList = [currentAdmin, ...membersList];
        } else {
          // Mark as current
          existingCurrent.isCurrent = true;
          existingCurrent.status = 'Active';
          existingCurrent.last_active = 'Active now (Current Session)';
        }
      }

      setTeamMembers(membersList);

      // 2. Fetch Real Audit Logs from Supabase (actual modifications in hymns and categories)
      const [hymnsRes, catRes] = await Promise.all([
        supabase
          .from('hymns')
          .select('id, hymn_number, title_en, title_twi, audio_url, updated_at, is_published')
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('categories')
          .select('id, name_en, name_twi, updated_at')
          .order('updated_at', { ascending: false })
          .limit(4),
      ]);

      const realLogs = [];

      if (hymnsRes.data) {
        hymnsRes.data.forEach((h) => {
          let actionText = `Updated Hymn #${h.hymn_number} (${h.title_en || 'Untitled'})`;
          if (h.audio_url) {
            actionText += ' • Audio accompaniment attached';
          } else if (h.title_twi) {
            actionText += ` • Twi text synchronized (${h.title_twi})`;
          }
          realLogs.push({
            id: `hymn_${h.id}`,
            action: actionText,
            user: session?.user?.email?.split('@')[0] || 'Church Admin',
            time: formatRelativeTime(h.updated_at),
            timestamp: new Date(h.updated_at).getTime(),
            type: h.audio_url ? 'audio' : 'edit',
          });
        });
      }

      if (catRes.data) {
        catRes.data.forEach((c) => {
          realLogs.push({
            id: `cat_${c.id}`,
            action: `Updated Category / Theme "${c.name_en}"${c.name_twi ? ` (${c.name_twi})` : ''}`,
            user: session?.user?.email?.split('@')[0] || 'Church Admin',
            time: formatRelativeTime(c.updated_at),
            timestamp: new Date(c.updated_at).getTime(),
            type: 'collection',
          });
        });
      }

      // Sort real activity by time descending
      realLogs.sort((a, b) => b.timestamp - a.timestamp);
      setAuditLogs(realLogs);
    } catch (err) {
      console.error('Error fetching real data:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setTimeout(() => setRefreshing(false), 400);
  };

  // Open direct Add Modal
  const handleOpenAdd = () => {
    setEditingMember(null);
    setMemberForm({
      name: '',
      email: '',
      role: 'Liturgy Director',
      department: 'Committee on Liturgy & Worship',
    });
    setIsModalOpen(true);
  };

  // Open direct Edit Modal
  const handleOpenEdit = (member) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name || '',
      email: member.email || '',
      role: member.role || 'Liturgy Director',
      department: member.department || '',
    });
    setIsModalOpen(true);
  };

  // Direct Add or Save (NO INVITE REQUIRED)
  const handleSaveMember = async (e) => {
    e.preventDefault();
    const cleanEmail = memberForm.email.trim().toLowerCase();
    const cleanName = memberForm.name.trim();

    if (!cleanEmail || !cleanName) {
      Swal.fire('Required Fields', 'Please provide both member name and email address.', 'warning');
      return;
    }

    // Check duplicate email when adding new
    if (!editingMember) {
      const exists = teamMembers.some((m) => m.email?.toLowerCase() === cleanEmail);
      if (exists) {
        Swal.fire('Already Exists', `A team member with email ${cleanEmail} is already registered.`, 'warning');
        return;
      }
    }

    const memberPayload = {
      name: cleanName,
      email: cleanEmail,
      role: memberForm.role,
      department: memberForm.department.trim() || 'General Worship Committee',
      status: 'Active', // Direct Active status (no invite wait)
      last_active: editingMember?.last_active || 'Added recently',
      updated_at: new Date().toISOString(),
    };

    if (editingMember) {
      // Update existing member
      if (isCloudSync) {
        await supabase.from('team_members').update(memberPayload).eq('id', editingMember.id);
      }
      const updated = teamMembers.map((m) => (m.id === editingMember.id ? { ...m, ...memberPayload } : m));
      setTeamMembers(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.filter((m) => !m.isCurrent)));
      setIsModalOpen(false);
      Swal.fire('Updated', `${cleanName}'s details and permissions were updated.`, 'success');
    } else {
      // Add directly
      const newId = `u_${Date.now()}`;
      const newMember = {
        ...memberPayload,
        id: newId,
        created_at: new Date().toISOString(),
      };

      if (isCloudSync) {
        await supabase.from('team_members').insert([
          {
            name: newMember.name,
            email: newMember.email,
            role: newMember.role,
            department: newMember.department,
            status: 'Active',
          },
        ]);
      }

      const updated = [...teamMembers, newMember];
      setTeamMembers(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.filter((m) => !m.isCurrent)));
      setIsModalOpen(false);

      Swal.fire({
        title: 'Team Member Added',
        text: `${cleanName} has been directly added as ${memberPayload.role}.`,
        icon: 'success',
      });
    }
  };

  // Direct Removal
  const handleRemoveMember = async (id, name) => {
    const result = await Swal.fire({
      title: 'Remove Team Member?',
      text: `Are you sure you want to revoke system access for ${name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Remove Member',
      confirmButtonColor: '#e02424',
      cancelButtonText: 'Cancel',
    });

    if (result.isConfirmed) {
      if (isCloudSync) {
        await supabase.from('team_members').delete().eq('id', id);
      }
      const updated = teamMembers.filter((m) => m.id !== id);
      setTeamMembers(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.filter((m) => !m.isCurrent)));
      Swal.fire('Member Removed', `${name} has been removed from the team.`, 'info');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Church Team & Role Permissions</h1>
          <p>Authorize editors, translators, music directors, and review live audit activity</p>
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
            <AddIcon /> Add Team Member
          </button>
        </div>
      </div>

      {/* Cloud Sync Status Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: isCloudSync ? '#e6f4ea' : '#f0f4ff',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${isCloudSync ? '#a8dab5' : '#c3d9ff'}`,
          marginBottom: 20,
          fontSize: 13,
          color: isCloudSync ? '#137333' : '#1a56db',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isCloudSync ? '#137333' : '#1a56db',
              display: 'inline-block',
            }}
          />
          <span>
            {isCloudSync
              ? 'Connected to Supabase Cloud: Team members and live changes are synchronized directly to your church database.'
              : 'Active Mode: Storing authorized team members locally. Run the SQL schema once in your Supabase SQL Editor to sync to cloud.'}
          </span>
        </div>
        {!isCloudSync && (
          <button
            type="button"
            onClick={() => setIsSqlModalOpen(true)}
            style={{
              background: '#1a56db',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            View SQL Setup
          </button>
        )}
      </div>

      {/* Role Definitions Breakdown */}
      <div className="dashboard-stats-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card-modern stat-card-blue">
          <div className="stat-icon-wrapper stat-icon-blue">
            <ShieldIcon />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Super Admin</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Full database access, user authorization, backups & publishing.
            </div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-purple">
          <div className="stat-icon-wrapper stat-icon-purple">
            <SparkleIcon />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Translator (Twi)</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Edit and align Twi lyrics, titles, and linguistic diacritics (ɛ, ɔ).
            </div>
          </div>
        </div>

        <div className="stat-card-modern stat-card-gold">
          <div className="stat-icon-wrapper stat-icon-gold">
            <UserIcon />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Music Director</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
              Upload organ accompaniment audio and maintain tonic sol-fa.
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="card-container" style={{ marginBottom: 28 }}>
        <div className="card-header-row">
          <h3>Authorized Church Administrators</h3>
          <span className="badge badge-green">{teamMembers.length} Members</span>
        </div>

        <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
          {loading ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading authorized church personnel...
            </div>
          ) : teamMembers.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <UserIcon size={36} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div style={{ fontSize: 15, fontWeight: 600 }}>No team members added yet</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>Add church musicians, liturges, and editors to manage hymnal content.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={handleOpenAdd}>
                <AddIcon /> Add First Team Member
              </button>
            </div>
          ) : (
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Email Address</th>
                  <th>Assigned Role</th>
                  <th>Church Department</th>
                  <th>Status</th>
                  <th>Activity</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--pcg-blue-dark)' }}>
                        {user.name}
                        {user.isCurrent && (
                          <span
                            className="badge badge-green"
                            style={{ marginLeft: 8, fontSize: 10.5, padding: '2px 6px' }}
                          >
                            You (Current)
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`badge ${
                          user.role === 'Super Admin'
                            ? 'badge-blue'
                            : user.role.includes('Translator')
                            ? 'badge-purple'
                            : 'badge-gold'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{user.department || '—'}</td>
                    <td>
                      <span className="badge badge-green">
                        <CheckIcon size={12} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        {user.status || 'Active'}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {user.last_active || (user.created_at ? formatRelativeTime(user.created_at) : 'Active')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        className="action-menu-wrapper"
                        ref={(el) => {
                          menuRefs.current[user.id] = el;
                        }}
                      >
                        <button
                          type="button"
                          className={`ellipsis-btn ${openMenuId === user.id ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === user.id ? null : user.id);
                          }}
                          title="Actions"
                        >
                          <MoreIcon />
                        </button>

                        {openMenuId === user.id && (
                          <div className="dropdown-menu">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleOpenEdit(user);
                              }}
                            >
                              <EditIcon /> Edit Details & Role
                            </button>
                            {!user.isCurrent && (
                              <button
                                type="button"
                                className="dropdown-item dropdown-item-danger"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleRemoveMember(user.id, user.name);
                                }}
                              >
                                <DeleteIcon /> Revoke Access
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Live Audit Log / Activity Timeline (Fetched Directly from Supabase) */}
      <div className="card-container">
        <div className="card-header-row">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HistoryIcon /> Live Database Modification Audit Trail
          </h3>
          <span className="badge badge-blue">Live Database Feed</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {auditLogs.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No recent database modifications logged yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="sync-dot" />
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{log.action}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  by <strong>{log.user}</strong> • {log.time}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Direct Add/Edit Modal (NO INVITE SENDER) */}
      {isModalOpen && (
        <div className="drawer-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="drawer-container" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                  {editingMember ? 'Edit Team Member' : 'Add Team Member'}
                </h2>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                  {editingMember
                    ? 'Update role permissions and departmental assignment'
                    : 'Add an authorized administrator directly to the church portal'}
                </p>
              </div>
              <button className="page-btn" onClick={() => setIsModalOpen(false)} style={{ border: 'none' }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMember} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                    placeholder="e.g. Rev. Kwaku Boateng"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={memberForm.email}
                    onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                    placeholder="e.g. k.boateng@pcg.org"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Assigned Role *</label>
                  <Select
                    options={ROLE_OPTIONS}
                    value={ROLE_OPTIONS.find((opt) => opt.value === memberForm.role) || ROLE_OPTIONS[0]}
                    onChange={(selected) =>
                      setMemberForm({ ...memberForm, role: selected ? selected.value : 'Liturgy Director' })
                    }
                    styles={selectStyles}
                    menuPortalTarget={document.body}
                    isSearchable={true}
                    placeholder="Select a role..."
                  />
                </div>

                <div className="form-group">
                  <label>Department / Committee</label>
                  <input
                    type="text"
                    className="form-input"
                    value={memberForm.department}
                    onChange={(e) => setMemberForm({ ...memberForm, department: e.target.value })}
                    placeholder="e.g. Music & Sol-fa Committee"
                  />
                </div>
              </div>

              <div className="drawer-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <SingleCheckIcon /> {editingMember ? 'Save Changes' : 'Add Team Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase SQL Migration Modal Helper */}
      {isSqlModalOpen && (
        <div className="drawer-overlay" onClick={() => setIsSqlModalOpen(false)}>
          <div className="drawer-container" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Supabase Cloud Table Setup</h2>
              <button className="page-btn" onClick={() => setIsSqlModalOpen(false)} style={{ border: 'none' }}>
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="drawer-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 12 }}>
                To persist team members in your Supabase cloud database across multiple computers, run this SQL script in your{' '}
                <strong>Supabase SQL Editor</strong>:
              </p>

              <pre
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  padding: 14,
                  borderRadius: 6,
                  fontSize: 12,
                  overflowX: 'auto',
                  lineHeight: 1.5,
                }}
              >
{`CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Reviewer / Viewer',
  department TEXT DEFAULT 'General Worship Committee',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Allow read & write access
CREATE POLICY "Allow team_members access" ON public.team_members
  FOR ALL USING (true) WITH CHECK (true);`}
              </pre>

              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 12 }}>
                Once executed, click <strong>Refresh</strong> in the header and the portal will immediately sync with Supabase cloud.
              </p>
            </div>

            <div className="drawer-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Reviewer / Viewer',
  department TEXT DEFAULT 'General Worship Committee',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow team_members access" ON public.team_members
  FOR ALL USING (true) WITH CHECK (true);`);
                  Swal.fire('Copied', 'SQL script copied to clipboard.', 'success');
                }}
              >
                Copy SQL
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setIsSqlModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
