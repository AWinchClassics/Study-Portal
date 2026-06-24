import { useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

/**
 * useTimelineAttempt
 *
 * Returns a saveAttempt({ timelineId, parents, mode, score, total }) function.
 *
 * For the master timeline, pass:
 *   timelineId: null
 *   parents: [{ type: 'chunk', id: '...' }, { type: 'unit', id: '...' }, ...]
 *
 * For custom timelines, pass:
 *   timelineId: '...'
 *   parents: [] (or omit)
 *
 * Saves one row per parent level so mastery shows correctly at every level.
 */
export function useTimelineAttempt() {
  const { user } = useAuth()

  const saveAttempt = useCallback(async ({ timelineId, parents = [], mode, score, total }) => {
    if (!user) return

    const percent = total > 0 ? Math.round((score / total) * 100) : 0
    const attempted_at = new Date().toISOString()

    if (timelineId) {
      // Custom timeline — save one row with timeline_id
      const { error } = await supabase
        .from('timeline_attempts')
        .insert({
          user_id:     user.id,
          timeline_id: timelineId,
          parent_type: null,
          parent_id:   null,
          mode, score, total, percent, attempted_at,
        })
      if (error) console.warn('Failed to save timeline attempt:', error.message)
    } else {
      // Master timeline — save one row per parent level
      const rows = parents.map(p => ({
        user_id:     user.id,
        timeline_id: null,
        parent_type: p.type,
        parent_id:   p.id,
        mode, score, total, percent, attempted_at,
      }))
      if (rows.length === 0) return
      const { error } = await supabase.from('timeline_attempts').insert(rows)
      if (error) console.warn('Failed to save timeline attempts:', error.message)
    }
  }, [user])

  return { saveAttempt }
}
