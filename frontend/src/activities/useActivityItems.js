import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'

/** Loads all tasks (with options) for an activity resource, in order. */
export function useActivityItems(resourceId) {
  const [items, setItems]   = useState(null)
  const [error, setError]   = useState(null)

  const reload = useCallback(async () => {
    if (!resourceId) return
    const { data, error } = await supabase
      .from('activity_items')
      .select('*, mc_options(*)')
      .eq('resource_id', resourceId)
      .order('order_index')
    if (error) { setError(error.message); return }
    const sorted = (data ?? []).map(it => ({
      ...it,
      mc_options: [...(it.mc_options ?? [])].sort((a, b) => a.order_index - b.order_index),
    }))
    setItems(sorted)
  }, [resourceId])

  useEffect(() => { reload() }, [reload])

  return { items, error, reload }
}
