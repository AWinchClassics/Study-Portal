import { useState } from 'react'
import { useTeacherAuth } from '../../context/TeacherAuthContext'

export default function TeacherRoute({ children }) {
  const { authed, login } = useTeacherAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const ok = login(password)
    if (!ok) {
      setError(true)
      setShaking(true)
      setPassword('')
      setTimeout(() => setShaking(false), 500)
    }
  }

  if (authed) return children

  return (
    <div className="teacher-login-shell">
      <form
        className={`teacher-login-card ${shaking ? 'teacher-login-shake' : ''}`}
        onSubmit={handleSubmit}
      >
        <div className="teacher-login-logo">
          <span className="navbar-logo-mark">SP</span>
        </div>
        <h1 className="teacher-login-heading">Teacher Access</h1>
        <p className="teacher-login-sub">Enter your password to continue</p>

        <input
          className={`teacher-login-input ${error ? 'teacher-login-input-error' : ''}`}
          type="password"
          placeholder="Password"
          value={password}
          autoFocus
          onChange={e => { setPassword(e.target.value); setError(false) }}
        />

        {error && (
          <p className="teacher-login-error">Incorrect password</p>
        )}

        <button className="teacher-login-btn" type="submit">
          Sign in →
        </button>
      </form>
    </div>
  )
}
