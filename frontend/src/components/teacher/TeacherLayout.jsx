import { NavLink, useNavigate } from 'react-router-dom'
import { useTeacherAuth } from '../../context/TeacherAuthContext'

const NAV_ITEMS = [
  { to: '/teacher',           label: 'Dashboard',  icon: '⊞',  end: true },
  { to: '/teacher/courses',   label: 'Courses',    icon: '📚' },
  { to: '/teacher/resources', label: 'Resources',  icon: '📦' },
]

export default function TeacherLayout({ children, title, actions }) {
  const { logout } = useTeacherAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/teacher')
  }

  return (
    <div className="tl-shell">
      {/* Sidebar */}
      <aside className="tl-sidebar">
        <div className="tl-sidebar-top">
          <div className="tl-brand">
            <span className="navbar-logo-mark">SP</span>
            <span className="tl-brand-label">Teacher</span>
          </div>

          <nav className="tl-nav">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `tl-nav-item ${isActive ? 'tl-nav-item-active' : ''}`
                }
              >
                <span className="tl-nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="tl-sidebar-bottom">
          <NavLink to="/" className="tl-nav-item tl-nav-item-muted">
            <span className="tl-nav-icon">←</span>
            Student view
          </NavLink>
          <button className="tl-nav-item tl-nav-item-muted tl-logout-btn" onClick={handleLogout}>
            <span className="tl-nav-icon">⏻</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="tl-main">
        {(title || actions) && (
          <div className="tl-topbar">
            {title && <h1 className="tl-page-title">{title}</h1>}
            {actions && <div className="tl-topbar-actions">{actions}</div>}
          </div>
        )}
        <div className="tl-content">
          {children}
        </div>
      </div>
    </div>
  )
}
