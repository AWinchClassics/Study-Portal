import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthModal from './AuthModal'

const NAV_ITEMS = [
  { to: '/',           label: 'Courses',             icon: '📚', end: true },
  { to: '/glossary',   label: 'Glossary',            icon: '📖' },
  { to: '/flashcards', label: 'Flashcards',          icon: '🃏' },
  { to: '/timelines',  label: 'Timelines',           icon: '📅' },
  { to: '/resources',  label: 'Resources',           icon: '📦' },
  { to: '/sources',    label: 'Sources',             icon: '📜' },
  { to: '/randomiser', label: 'Revision Randomiser', icon: '🎲' },
]

export default function Sidebar() {
  const [open, setOpen]           = useState(false)
  const [authOpen, setAuthOpen]   = useState(false)
  const location                  = useLocation()
  const { user, profile, loading } = useAuth()

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = (open || authOpen) ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open, authOpen])

  return (
    <>
      <button className="sidebar-hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
        <span /><span /><span />
      </button>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="navbar-logo-mark">SP</span>
            <span className="sidebar-brand-text">Study Portal</span>
          </div>
          <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
          <nav className="sidebar-nav">
            <p className="sidebar-nav-label">Navigation</p>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `sidebar-nav-item ${isActive ? 'sidebar-nav-active' : ''}`}>
                <span className="sidebar-nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          {/* Account button */}
          <button
            className="sidebar-nav-item sidebar-account-btn"
            onClick={() => setAuthOpen(true)}
          >
            <span className="sidebar-nav-icon">
              {!loading && user ? (
                <span className="sidebar-account-avatar">
                  {profile?.username?.[0]?.toUpperCase() ?? '?'}
                </span>
              ) : '👤'}
            </span>
            <span className="sidebar-account-label">
              {loading ? 'Account' : user ? (profile?.username ?? 'Account') : 'Log in'}
            </span>
            {!loading && user && (
              <span className="sidebar-account-dot" title="Signed in" />
            )}
          </button>

          <NavLink to="/teacher" className="sidebar-nav-item sidebar-nav-muted">
            <span className="sidebar-nav-icon">⚙</span>Teacher
          </NavLink>
        </div>
      </aside>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
