import { Link, useLocation } from 'react-router-dom'

export default function NavBar() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="navbar-logo-mark">SP</span>
          <span className="navbar-logo-text">Study Portal</span>
        </Link>

        <div className="navbar-right">
          {!isHome && (
            <Link to="/" className="navbar-home-link">
              ← All Courses
            </Link>
          )}
          <Link to="/teacher" className="navbar-teacher-link">
            Teacher ↗
          </Link>
        </div>
      </div>
    </header>
  )
}
