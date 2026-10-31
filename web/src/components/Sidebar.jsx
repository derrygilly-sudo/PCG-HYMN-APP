// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import {
  DashboardIcon,
  HymnIcon,
  TotalIcon,
  LiturgyIcon,
  MediaIcon,
  CollectionIcon,
  PresenterIcon,
  UploadCloudIcon,
  UserIcon,
  CollapseIcon,
  ExpandIcon,
} from '../config/icons';
import { RiLogoutBoxRLine } from 'react-icons/ri';

const Sidebar = ({ collapsed, setCollapsed, mobileOpen, setMobileOpen, session, stats }) => {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    navigate('/');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <DashboardIcon className="nav-icon" />, count: null, exact: true },
    { to: '/hymns', label: 'Hymns Library', icon: <HymnIcon className="nav-icon" />, count: stats?.hymns || null },
    { to: '/categories', label: 'Categories', icon: <TotalIcon className="nav-icon" />, count: stats?.categories || null },
    { to: '/liturgies', label: 'Liturgies & Creeds', icon: <LiturgyIcon className="nav-icon" />, count: stats?.liturgies || 7 },
    { to: '/media', label: 'Audio & Media', icon: <MediaIcon className="nav-icon" />, count: stats?.withAudio || null },
    { to: '/collections', label: 'Church Seasons', icon: <CollectionIcon className="nav-icon" />, count: 6 },
    { to: '/presenter', label: 'Presenter Mode', icon: <PresenterIcon className="nav-icon" />, count: 'Live', isSpecial: true },
    { to: '/import-export', label: 'Import & Backup', icon: <UploadCloudIcon className="nav-icon" />, count: null },
    { to: '/users', label: 'Team & Roles', icon: <UserIcon className="nav-icon" />, count: null },
  ];

  return (
    <>
      {mobileOpen && (
        <div className="drawer-overlay" onClick={() => setMobileOpen(false)} style={{ zIndex: 85 }} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-brand" onClick={() => setMobileOpen(false)}>
            <img src="/pcg-logo.png" alt="PCG" className="sidebar-logo" onError={(e) => { e.target.style.display = 'none'; }} />
            {!collapsed && (
              <div className="sidebar-brand-text">
                <h2>PCG Hymnal</h2>
                <span>Admin & Worship</span>
              </div>
            )}
          </NavLink>

          <button
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
          </button>
        </div>

        {/* Nav Links */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">{!collapsed ? "Worship Management" : "•••"}</div>

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && (
                <>
                  <span className="nav-label">{item.label}</span>
                  {/* {item.count !== null && item.count !== undefined && (
                    <span className={`nav-badge ${item.isSpecial ? 'nav-badge-gold' : ''}`}>
                      {item.count}
                    </span>
                  )} */}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sync-status-indicator">
              <span className="sync-dot"></span>
              <span>Live Sync Active</span>
            </div>
          )}

          <div className="user-profile-row">
            <div className="user-avatar-info">
              <div className="user-avatar">
                {session?.user?.email?.charAt(0).toUpperCase() || 'P'}
              </div>
              {!collapsed && (
                <div style={{ overflow: 'hidden' }}>
                  <div className="user-email-text">{session?.user?.email || 'admin@pcg.org'}</div>
                  <div className="user-role-badge">Super Admin</div>
                </div>
              )}
            </div>

            <button
              className="logout-icon-btn"
              onClick={handleLogout}
              title="Logout"
              disabled={loggingOut}
            >
              <RiLogoutBoxRLine size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
