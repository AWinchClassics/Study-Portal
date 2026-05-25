import { useCallback } from 'react'
import { supabase } from '../supabase'

/**
 * useQuizAttempt
 *
 * Returns a saveAttempt(resourceId, score, total) function.
 * Writes to the quiz_attempts table in Supabase.
 * Silently fails if Supabase is unavailable — never blocks the UI.
 */
export function useQuizAttempt() {
  const saveAttempt = useCallback(async (resourceId, score, total) => {
    if (!resourceId) return

    const percent = total > 0 ? Math.round((score / total) * 100) : 0

    const { error } = await supabase
      .from('quiz_attempts')
      .insert({
        resource_id:  resourceId,
        score,
        total,
        percent,
        attempted_at: new Date().toISOString(),
      })

    if (error) {
      console.warn('Failed to save quiz attempt:', error.message)
    }
  }, [])

  return { saveAttempt }
}
