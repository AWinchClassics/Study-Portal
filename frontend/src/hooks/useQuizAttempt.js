import { useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

/**
 * useQuizAttempt
 *
 * Returns a saveAttempt(resourceId, score, total) function.
 * Writes to quiz_attempts only when a user is signed in.
 * Silently no-ops when logged out.
 */
export function useQuizAttempt() {
  const { user } = useAuth()

  const saveAttempt = useCallback(async (resourceId, score, total) => {
    if (!user || !resourceId) return

    const percent = total > 0 ? Math.round((score / total) * 100) : 0

    const { error } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id:      user.id,
        resource_id:  resourceId,
        score,
        total,
        percent,
        attempted_at: new Date().toISOString(),
      })

    if (error) {
      console.warn('Failed to save quiz attempt:', error.message)
    }
  }, [user])

  return { saveAttempt }
}
