import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)   // Supabase auth user
  const [profile, setProfile] = useState(null)   // profiles row: { id, username, role }
  const [loading, setLoading] = useState(true)

  // Load profile for a given auth user
  async function loadProfile(authUser) {
    if (!authUser) { setProfile(null); return }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, role')
      .eq('id', authUser.id)
      .single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      loadProfile(u).finally(() => setLoading(false))
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      loadProfile(u)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Auth actions ─────────────────────────────────────────

  async function signUp(email, password, username) {
    // Check username is not already taken before creating auth user
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) throw new Error('That username is already taken.')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) throw error
    return data
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // ── Helpers ──────────────────────────────────────────────

  const isTeacher = profile?.role === 'teacher'

  // Teacher-only: promote or demote another user's role
  async function setUserRole(userId, role) {
    if (!isTeacher) throw new Error('Only teachers can change roles.')
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
    if (error) throw error
  }

  // Fetch all profiles (for teacher account management)
  async function fetchAllProfiles() {
    if (!isTeacher) throw new Error('Only teachers can view all accounts.')
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isTeacher,
      signUp,
      signIn,
      signOut,
      setUserRole,
      fetchAllProfiles,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
