import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * AuthModal
 *
 * Props:
 *   open      — boolean
 *   onClose   — () => void
 */
export default function AuthModal({ open, onClose }) {
  const { user, profile, signIn, signUp, signOut, isTeacher, fetchAllProfiles, setUserRole } = useAuth()

  const [tab, setTab]           = useState('login')   // 'login' | 'signup'
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [message, setMessage]   = useState(null)
  const [busy, setBusy]         = useState(false)

  // Teacher account management
  const [accounts, setAccounts]       = useState(null)
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [managingTab, setManagingTab] = useState('accounts') // 'accounts' | 'manage'

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setError(null); setMessage(null)
      setUsername(''); setEmail(''); setPassword('')
      setTab('login')
    }
  }, [open])

  // Load accounts when teacher opens manage tab
  useEffect(() => {
    if (open && isTeacher && managingTab === 'manage') {
      setAccountsLoading(true)
      fetchAllProfiles()
        .then(data => setAccounts(data))
        .catch(e => setError(e.message))
        .finally(() => setAccountsLoading(false))
    }
  }, [open, isTeacher, managingTab])

  if (!open) return null

  async function handleLogin(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      await signIn(email, password)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError(null); setBusy(true)
    if (!username.trim()) { setError('Please enter a username.'); setBusy(false); return }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); setBusy(false); return }
    try {
      await signUp(email, password, username.trim())
      setMessage('Account created! You are now logged in.')
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    onClose()
  }

  async function handleRoleChange(userId, newRole) {
    try {
      await setUserRole(userId, newRole)
      setAccounts(prev => prev.map(a => a.id === userId ? { ...a, role: newRole } : a))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* ── Logged in ─────────────────────────────────── */}
        {user ? (
          <>
            <div className="auth-modal-header">
              <div className="auth-avatar">{profile?.username?.[0]?.toUpperCase() ?? '?'}</div>
              <div>
                <div className="auth-modal-username">{profile?.username}</div>
                <div className="auth-modal-role-badge auth-role-{profile?.role}">
                  {profile?.role === 'teacher' ? '🎓 Teacher' : '📚 Student'}
                </div>
              </div>
            </div>

            {isTeacher && (
              <div className="auth-manage-tabs">
                <button
                  className={`auth-manage-tab ${managingTab === 'accounts' ? 'active' : ''}`}
                  onClick={() => setManagingTab('accounts')}
                >Account</button>
                <button
                  className={`auth-manage-tab ${managingTab === 'manage' ? 'active' : ''}`}
                  onClick={() => setManagingTab('manage')}
                >Manage Users</button>
              </div>
            )}

            {(!isTeacher || managingTab === 'accounts') && (
              <div className="auth-logged-in-body">
                <p className="auth-info-text">Signed in as <strong>{user.email}</strong></p>
                <p className="auth-info-text" style={{ marginTop: 4 }}>
                  Your quiz and timeline scores are saved automatically.
                </p>
                <button className="auth-btn auth-btn-ghost" onClick={handleSignOut} style={{ marginTop: 16 }}>
                  Sign out
                </button>
              </div>
            )}

            {isTeacher && managingTab === 'manage' && (
              <div className="auth-manage-body">
                {error && <p className="auth-error">{error}</p>}
                {accountsLoading ? (
                  <div className="auth-loading">Loading accounts…</div>
                ) : (
                  <div className="auth-accounts-list">
                    {(accounts ?? []).map(a => (
                      <div key={a.id} className="auth-account-row">
                        <div className="auth-account-info">
                          <span className="auth-account-username">{a.username}</span>
                          <span className="auth-account-email-hint">
                            {a.role === 'teacher' ? '🎓' : '📚'} {a.role}
                          </span>
                        </div>
                        {a.id !== user.id && (
                          <div className="auth-account-actions">
                            {a.role === 'student' ? (
                              <button
                                className="auth-role-btn auth-role-promote"
                                onClick={() => handleRoleChange(a.id, 'teacher')}
                              >
                                Make teacher
                              </button>
                            ) : (
                              <button
                                className="auth-role-btn auth-role-demote"
                                onClick={() => handleRoleChange(a.id, 'student')}
                              >
                                Make student
                              </button>
                            )}
                          </div>
                        )}
                        {a.id === user.id && (
                          <span className="auth-you-badge">You</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ── Logged out ────────────────────────────────── */
          <>
            <div className="auth-modal-header auth-modal-header-guest">
              <h2 className="auth-modal-title">Study Portal</h2>
              <p className="auth-modal-subtitle">Sign in to track your progress</p>
            </div>

            <div className="auth-tabs">
              <button
                className={`auth-tab ${tab === 'login' ? 'auth-tab-active' : ''}`}
                onClick={() => { setTab('login'); setError(null); setMessage(null) }}
              >Log in</button>
              <button
                className={`auth-tab ${tab === 'signup' ? 'auth-tab-active' : ''}`}
                onClick={() => { setTab('signup'); setError(null); setMessage(null) }}
              >Create account</button>
            </div>

            {error   && <p className="auth-error">{error}</p>}
            {message && <p className="auth-success">{message}</p>}

            {tab === 'login' ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="auth-label">Email</label>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <label className="auth-label">Password</label>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button className="auth-btn auth-btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Signing in…' : 'Log in'}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleSignup}>
                <label className="auth-label">Username</label>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="e.g. alex123"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  minLength={3}
                />
                <label className="auth-label">Email</label>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <label className="auth-label">Password</label>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button className="auth-btn auth-btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Creating…' : 'Create account'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
