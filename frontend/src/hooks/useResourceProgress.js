import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

/**
 * useResourceProgress
 *
 * Fetches and manages completion state for a set of resource IDs.
 *
 * Returns:
 *   completed:     { [resourceId]: true }  — only contains completed resources
 *   toggleComplete: (resourceId) => void   — toggles completion on/off
 *   isCompleted:   (resourceId) => boolean
 */
export function useResourceProgress(resourceIds = []) {
  const { user } = useAuth()
  const [completed, setCompleted] = useState({})
  const key = resourceIds.slice().sort().join(',')

  useEffect(() => {
    if (!user || resourceIds.length === 0) { setCompleted({}); return }

    supabase
      .from('resource_progress')
      .select('resource_id, completed')
      .eq('user_id', user.id)
      .eq('completed', true)
      .in('resource_id', resourceIds)
      .then(({ data }) => {
        const map = {}
        ;(data ?? []).forEach(row => { map[row.resource_id] = true })
        setCompleted(map)
      })
  }, [user, key])

  const toggleComplete = useCallback(async (resourceId, forceTrue = false) => {
    if (!user) return

    const isNowComplete = forceTrue ? true : !completed[resourceId]
    const completed_at  = isNowComplete ? new Date().toISOString() : null

    // Optimistic update
    setCompleted(prev => {
      const next = { ...prev }
      if (isNowComplete) next[resourceId] = true
      else delete next[resourceId]
      return next
    })

    const { error } = await supabase
      .from('resource_progress')
      .upsert({
        user_id:      user.id,
        resource_id:  resourceId,
        completed:    isNowComplete,
        completed_at,
      }, { onConflict: 'user_id,resource_id' })

    if (error) {
      console.warn('Failed to save resource progress:', error.message)
      // Revert on error
      setCompleted(prev => {
        const next = { ...prev }
        if (isNowComplete) delete next[resourceId]
        else next[resourceId] = true
        return next
      })
    }
  }, [user, completed])

  const isCompleted = useCallback((resourceId) => !!completed[resourceId], [completed])

  return { completed, toggleComplete, isCompleted }
}
