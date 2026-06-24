import { useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

/**
 * useTimelineAttempt
 *
 * Returns a saveAttempt({ timelineId, parentType, parentId, mode, score, total }) function.
 * Writes to timeline_attempts only when a user is signed in.
 *
 * For the master timeline, pass timelineId=null and parentType+parentId to identify the scope.
 * For custom timelines, pass the timelineId.
 */
export function useTimelineAttempt() {
  const { user } = useAuth()

  const saveAttempt = useCallback(async ({ timelineId, parentType, parentId, mode, score, total }) => {
    if (!user) return

    const percent = total > 0 ? Math.round((score / total) * 100) : 0

    const { error } = await supabase
      .from('timeline_attempts')
      .insert({
        user_id:      user.id,
        timeline_id:  timelineId ?? null,
        parent_type:  parentType ?? null,
        parent_id:    parentId ?? null,
        mode,
        score,
        total,
        percent,
        attempted_at: new Date().toISOString(),
      })

    if (error) {
      console.warn('Failed to save timeline attempt:', error.message)
    }
  }, [user])

  return { saveAttempt }
}
