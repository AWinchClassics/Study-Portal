import { useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useQuizAttempt } from '../hooks/useQuizAttempt'

/**
 * Saves a finished activity run:
 *  1. detailed row -> activity_attempts
 *  2. summary row  -> quiz_attempts (via the existing hook) so mastery
 *     badges, pips and My Progress work with no changes.
 * Silently no-ops when logged out, like the existing quiz flow.
 */
export function useActivityAttempt() {
  const { user } = useAuth()
  const { saveAttempt } = useQuizAttempt()

  const saveActivityAttempt = useCallback(async (resourceId, result) => {
    if (!user || !resourceId) return
    const { score, total, percent, responses } = result

    const { error } = await supabase.from('activity_attempts').insert({
      user_id: user.id,
      resource_id: resourceId,
      score, total, percent,
      responses,
      attempted_at: new Date().toISOString(),
    })
    if (error) console.warn('Failed to save activity attempt detail:', error.message)

    await saveAttempt(resourceId, score, total)
  }, [user, saveAttempt])

  return { saveActivityAttempt }
}
