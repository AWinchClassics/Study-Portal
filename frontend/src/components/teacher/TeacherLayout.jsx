import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/teacher',            label: 'Dashboard',  icon: '⊞', end: true },
  { to: '/teacher/courses',    label: 'Courses',    icon: '📚' },
  { to: '/teacher/resources',  label: 'Resources',  icon: '📦' },
  { to: '/teacher/glossary',   label: 'Glossary',   icon: '🃏' },
  { to: '/teacher/timelines',  label: 'Timelines',  icon: '📅' },
  { to: '/teacher/sources',    label: 'Sources',    icon: '📜' },
  { to: '/teacher/randomiser', label: 'Randomiser', icon: '🎲' },
]

export default function TeacherLayout({ children, title, actions }) {
  const { signOut } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleLogout() { signOut(); navigate('/teacher') }

  return (
    <div className="tl-shell">
      <button className="t-sidebar-hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
        <span /><span /><span />
      </button>
      {open && <div className="t-sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`tl-sidebar ${open ? 'tl-sidebar-open' : ''}`}>
        <div className="tl-sidebar-top">
          <div className="tl-brand">
            <span className="navbar-logo-mark">SP</span>
            <span className="tl-brand-label">Teacher</span>
            <button className="t-sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">✕</button>
          </div>
          <nav className="tl-nav">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) => `tl-nav-item ${isActive ? 'tl-nav-item-active' : ''}`}>
                <span className="tl-nav-icon">{item.icon}</span>{item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="tl-sidebar-bottom">
          <NavLink to="/" className="tl-nav-item tl-nav-item-muted"><span className="tl-nav-icon">←</span>Student view</NavLink>
          <button className="tl-nav-item tl-nav-item-muted tl-logout-btn" onClick={handleLogout}><span className="tl-nav-icon">⏻</span>Sign out</button>
        </div>
      </aside>
      <div className="tl-main">
        {(title || actions) && (
          <div className="tl-topbar">
            {title && <h1 className="tl-page-title">{title}</h1>}
            {actions && <div className="tl-topbar-actions">{actions}</div>}
          </div>
        )}
        <div className="tl-content">{children}</div>
      </div>
    </div>
  )
}
