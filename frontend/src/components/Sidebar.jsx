import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',           label: 'Courses',             icon: '📚', end: true },
  { to: '/glossary',   label: 'Glossary',            icon: '📖' },
  { to: '/flashcards', label: 'Flashcards',          icon: '🃏' },
  { to: '/randomiser', label: 'Revision Randomiser', icon: '🎲' },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

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
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'sidebar-nav-active' : ''}`
                }
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <NavLink to="/teacher" className="sidebar-nav-item sidebar-nav-muted">
            <span className="sidebar-nav-icon">⚙</span>
            Teacher
          </NavLink>
        </div>
      </aside>
    </>
  )
}
