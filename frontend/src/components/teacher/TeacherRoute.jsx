import { useAuth } from '../../context/AuthContext'

/**
 * TeacherRoute
 *
 * Guards teacher pages. Requires the user to be logged in AND have role='teacher'.
 * - Not logged in at all → prompt to log in via the sidebar account button
 * - Logged in but student role → "not authorised" message
 * - Logged in as teacher → renders children
 */
export default function TeacherRoute({ children }) {
  const { user, profile, loading, isTeacher } = useAuth()

  if (loading) {
    return (
      <div className="teacher-login-shell">
        <div className="teacher-login-card">
          <div className="loading-pulse">Loading…</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="teacher-login-shell">
        <div className="teacher-login-card">
          <div className="teacher-login-logo">
            <span className="navbar-logo-mark">SP</span>
          </div>
          <h1 className="teacher-login-heading">Teacher Access</h1>
          <p className="teacher-login-sub">
            Please log in with a teacher account to access this area.
            Use the <strong>Account</strong> button in the sidebar to sign in.
          </p>
        </div>
      </div>
    )
  }

  if (!isTeacher) {
    return (
      <div className="teacher-login-shell">
        <div className="teacher-login-card">
          <div className="teacher-login-logo">
            <span className="navbar-logo-mark">SP</span>
          </div>
          <h1 className="teacher-login-heading">Access Denied</h1>
          <p className="teacher-login-sub">
            Your account (<strong>{profile?.username}</strong>) does not have teacher permissions.
            Please ask a teacher to upgrade your account.
          </p>
        </div>
      </div>
    )
  }

  return children
}
