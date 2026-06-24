import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

/**
 * useMastery
 *
 * Fetches best quiz and timeline attempt percentages for the current user.
 *
 * Usage:
 *   const { quizBest, timelineBest } = useMastery({
 *     resourceIds: ['uuid1', 'uuid2'],          // for quiz mastery badges
 *     timelineIds: ['uuid3', 'uuid4'],          // for custom timeline badges
 *     masterTimelineKeys: ['chunk:uuid5'],      // 'chunk:id' | 'unit:id' | 'module:id'
 *   })
 *
 * Returns:
 *   quizBest:     { [resourceId]: { bestPercent, attempts } }
 *   timelineBest: { [timelineId | masterKey]: { date: bestPercent, match: bestPercent } }
 */
export function useMastery({ resourceIds = [], timelineIds = [], masterTimelineKeys = [] } = {}) {
  const { user } = useAuth()
  const [quizBest, setQuizBest]         = useState({})
  const [timelineBest, setTimelineBest] = useState({})
  const [refreshKey, setRefreshKey]     = useState(0)

  function refresh() { setRefreshKey(k => k + 1) }

  const rKey = resourceIds.slice().sort().join(',')
  const tKey = timelineIds.slice().sort().join(',')
  const mKey = masterTimelineKeys.slice().sort().join(',')

  useEffect(() => {
    if (!user) { setQuizBest({}); setTimelineBest({}); return }

    async function load() {
      // ── Quiz attempts ──────────────────────────────────
      if (resourceIds.length > 0) {
        const { data } = await supabase
          .from('quiz_attempts')
          .select('resource_id, percent')
          .eq('user_id', user.id)
          .in('resource_id', resourceIds)

        const best = {}
        ;(data ?? []).forEach(row => {
          const prev = best[row.resource_id]
          if (!prev || row.percent > prev.bestPercent) {
            best[row.resource_id] = {
              bestPercent: row.percent,
              attempts: (prev?.attempts ?? 0) + 1,
            }
          } else {
            best[row.resource_id].attempts = (prev.attempts ?? 0) + 1
          }
        })
        // Second pass to get correct attempt counts
        const counts = {}
        ;(data ?? []).forEach(row => {
          counts[row.resource_id] = (counts[row.resource_id] ?? 0) + 1
        })
        Object.keys(best).forEach(id => { best[id].attempts = counts[id] ?? 0 })
        setQuizBest(best)
      } else {
        setQuizBest({})
      }

      // ── Timeline attempts ──────────────────────────────
      const hasTimelines = timelineIds.length > 0 || masterTimelineKeys.length > 0
      if (hasTimelines) {
        // Build timeline_ids list (custom) and parent filters (master)
        const orFilters = []

        if (timelineIds.length > 0) {
          // Custom timelines: filter by timeline_id
          const ids = timelineIds.map(id => `"${id}"`).join(',')
          orFilters.push(`timeline_id.in.(${ids})`)
        }

        // We fetch all timeline attempts for this user and filter client-side
        // (simpler than complex OR queries for master timeline parent_type+parent_id)
        const { data } = await supabase
          .from('timeline_attempts')
          .select('timeline_id, parent_type, parent_id, mode, percent')
          .eq('user_id', user.id)

        const best = {}

        function recordBest(key, mode, percent) {
          if (!best[key]) best[key] = {}
          if (!best[key][mode] || percent > best[key][mode]) {
            best[key][mode] = percent
          }
        }

        ;(data ?? []).forEach(row => {
          if (row.timeline_id && timelineIds.includes(row.timeline_id)) {
            recordBest(row.timeline_id, row.mode, row.percent)
          }
          // Master timeline: key = 'chunk:uuid' | 'unit:uuid' | 'module:uuid'
          if (!row.timeline_id && row.parent_type && row.parent_id) {
            const masterKey = `${row.parent_type}:${row.parent_id}`
            if (masterTimelineKeys.includes(masterKey)) {
              recordBest(masterKey, row.mode, row.percent)
            }
          }
        })

        setTimelineBest(best)
      } else {
        setTimelineBest({})
      }
    }

    load()
  }, [user, rKey, tKey, mKey, refreshKey])

  return { quizBest, timelineBest, refresh }
}

/**
 * getMasteryClass
 * Returns a CSS class suffix based on a percentage.
 *   'high' ≥ 80%, 'mid' ≥ 50%, 'low' < 50%, '' for null/unattempted
 */
export function getMasteryClass(percent) {
  if (percent == null) return ''
  if (percent >= 80) return 'high'
  if (percent >= 50) return 'mid'
  return 'low'
}

/**
 * MasteryBadge
 * Small inline badge showing a percentage with colour coding.
 */
export function MasteryBadge({ percent, label }) {
  if (percent == null) return null
  const cls = getMasteryClass(percent)
  return (
    <span className={`mastery-badge mastery-${cls}`} title={label ?? `Best score: ${percent}%`}>
      {percent}%
    </span>
  )
}

/**
 * MasteryPip
 * Single dot used in pip rows on unit/module cards.
 * percent=null → unattempted (grey)
 */
export function MasteryPip({ percent, title }) {
  const cls = percent == null ? 'unattempted' : getMasteryClass(percent)
  return <span className={`mastery-pip mastery-pip-${cls}`} title={title} />
}

/**
 * MasteryPipRow
 * A labelled row of pips — one per item in the `items` array.
 * items: [{ id, label, percent }]
 */
export function MasteryPipRow({ label, items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="mastery-pip-row">
      <span className="mastery-pip-label">{label}</span>
      <div className="mastery-pips">
        {items.map(item => (
          <MasteryPip key={item.id} percent={item.percent} title={`${item.label}: ${item.percent != null ? item.percent + '%' : 'Not attempted'}`} />
        ))}
      </div>
    </div>
  )
}
