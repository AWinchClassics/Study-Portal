import { createContext, useContext, useState, useEffect } from 'react'

// Change this password to whatever you want
const TEACHER_PASSWORD = 'teacher123'
const SESSION_KEY = 'sp_teacher_auth'

const TeacherAuthContext = createContext(null)

export function TeacherAuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  })

  function login(password) {
    if (password === TEACHER_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'true')
      setAuthed(true)
      return true
    }
    return false
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
  }

  return (
    <TeacherAuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </TeacherAuthContext.Provider>
  )
}

export function useTeacherAuth() {
  return useContext(TeacherAuthContext)
}
