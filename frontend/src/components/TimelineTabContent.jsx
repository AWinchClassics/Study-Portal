import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import TimelineShell, { sortByDate, pickRandom } from './TimelineShell'
import { useTimelineAttempt } from '../hooks/useTimelineAttempt'
import { useMastery, MasteryBadge } from '../hooks/useMastery'
import { useAuth } from '../context/AuthContext'

const PRIORITY_RANK = { core: 0, useful: 1, stretch: 2 }

function dedupeGlossaryRows(rows) {
  const byId = {}
  rows.forEach(row => {
    const t = row.glossary_terms
    if (!t || !t.date) return
    const rank = PRIORITY_RANK[row.priority] ?? 99
    const existing = byId[t.id]
    if (!existing || rank < (PRIORITY_RANK[existing._rank] ?? 99)) {
      byId[t.id] = {
        id: t.id, label: t.term, date: t.date,
        definition: t.definition, sort_order: t.sort_order ?? 0,
        _rank: row.priority,
      }
    }
  })
  return Object.values(byId).map(({ _rank, ...e }) => e)
}

/**
 * TimelineTabContent
 *
 * Props:
 *   chunkIds, unitIds, moduleIds  — scope for timeline lookups
 *   parentType                    — 'chunk' | 'unit' | 'module' (primary parent, for mastery lookup)
 *   parentId                      — uuid of the primary parent
 *   allParents                    — [{ type, id }] all scope levels to save attempts against
 */
export default function TimelineTabContent({
  chunkIds = [], unitIds = [], moduleIds = [],
  parentType, parentId, allParents = [], onMasteryRefresh,
}) {
  const { user } = useAuth()
  const { saveAttempt } = useTimelineAttempt()

  const [masterEvents, setMasterEvents]       = useState([])
  const [customTimelines, setCustomTimelines] = useState([])
  const [timelineChunkMap, setTimelineChunkMap] = useState({}) // timeline_id -> chunk_id
  const [selectedTimeline, setSelectedTimeline] = useState('master')
  const [loading, setLoading]                 = useState(true)
  const [masterHidden, setMasterHidden]         = useState(false)

  const [mode, setMode]       = useState('view')
  const [session, setSession] = useState(null)

  const key = [chunkIds, unitIds, moduleIds].map(a => a.slice().sort().join(',')).join('|')

  useEffect(() => {
    setLoading(true)
    setMode('view')
    setSession(null)
    setSelectedTimeline('master')
    setMasterHidden(false)

    async function load() {
      const [{ data: chunkCG }, { data: unitCG }, { data: moduleCG }] = await Promise.all([
        chunkIds.length > 0
          ? supabase.from('chunk_glossary')
              .select('priority, glossary_terms(id, term, definition, date, sort_order)')
              .in('chunk_id', chunkIds)
          : { data: [] },
        unitIds.length > 0
          ? supabase.from('unit_glossary')
              .select('priority, glossary_terms(id, term, definition, date, sort_order)')
              .in('unit_id', unitIds)
          : { data: [] },
        moduleIds.length > 0
          ? supabase.from('module_glossary')
              .select('priority, glossary_terms(id, term, definition, date, sort_order)')
              .in('module_id', moduleIds)
          : { data: [] },
      ])

      setMasterEvents(dedupeGlossaryRows([
        ...(moduleCG ?? []), ...(unitCG ?? []), ...(chunkCG ?? []),
      ]))

      const [{ data: ctChunk }, { data: ctUnit }, { data: ctModule }] = await Promise.all([
        chunkIds.length > 0   ? supabase.from('chunk_timelines').select('timeline_id, chunk_id').in('chunk_id', chunkIds)    : { data: [] },
        unitIds.length > 0    ? supabase.from('unit_timelines').select('timeline_id').in('unit_id', unitIds)       : { data: [] },
        moduleIds.length > 0  ? supabase.from('module_timelines').select('timeline_id').in('module_id', moduleIds) : { data: [] },
      ])

      const tlIds = [...new Set([
        ...(ctModule ?? []), ...(ctUnit ?? []), ...(ctChunk ?? []),
      ].map(r => r.timeline_id))]

      if (tlIds.length > 0) {
        const [{ data: tlData }, { data: evData }] = await Promise.all([
          supabase.from('timelines').select('id, title').in('id', tlIds),
          supabase.from('timeline_events').select('id, timeline_id, label, date').in('timeline_id', tlIds).order('order_index'),
        ])
        setCustomTimelines((tlData ?? []).map(tl => ({
          ...tl,
          events: (evData ?? []).filter(e => e.timeline_id === tl.id),
        })))
        // Map timeline_id -> chunk_id for chunk-level fallback mastery
        const tlChunkMap = {}
        ;(ctChunk ?? []).forEach(r => { if (r.chunk_id) tlChunkMap[r.timeline_id] = r.chunk_id })
        setTimelineChunkMap(tlChunkMap)
      } else {
        setCustomTimelines([])
        setTimelineChunkMap({})
      }

      const hmQuery = moduleIds.length > 0
        ? supabase.from('hidden_master_timelines').select('id').eq('level','module').in('parent_id', moduleIds)
        : unitIds.length > 0
        ? supabase.from('hidden_master_timelines').select('id').eq('level','unit').in('parent_id', unitIds)
        : chunkIds.length > 0
        ? supabase.from('hidden_master_timelines').select('id').eq('level','chunk').in('parent_id', chunkIds)
        : Promise.resolve({ data: [] })
      const { data: hmData } = await hmQuery
      setMasterHidden((hmData?.length ?? 0) > 0)

      setLoading(false)
    }

    load()
  }, [key])

  // ── Mastery lookup ─────────────────────────────────────────
  const customTimelineIds = customTimelines.map(t => t.id)
  const masterKey = parentType && parentId ? `${parentType}:${parentId}` : null

  // Build mastery lookup keys:
  // - Primary masterKey (e.g. unit:uuid or chunk:uuid)
  // - For each custom timeline, also include its originating chunk key as fallback
  //   (handles cases where attempts were saved at chunk level before unit/module level saving)
  const customTimelineChunkKeys = user
    ? [...new Set(customTimelineIds.map(id => timelineChunkMap[id]).filter(Boolean).map(id => `chunk:${id}`))]
    : []
  const allLookupKeys = user
    ? [...new Set([...(masterKey ? [masterKey] : []), ...customTimelineChunkKeys])]
    : []

  const { timelineBest } = useMastery({
    timelineIds:        user && customTimelineIds.length > 0 ? customTimelineIds : [],
    masterTimelineKeys: allLookupKeys,
  })

  // ── Mode & session ─────────────────────────────────────────
  function changeMode(newMode) {
    setMode(newMode)
    setSession(null)
  }

  const handleResetSession = useCallback(() => {
    setSession(null)
  }, [])

  // Called by TimelineShell when a test finishes
  const handleTestComplete = useCallback(async (score, total, testMode) => {
    if (!user) return
    const activeId = selectedTimeline

    if (activeId === 'master') {
      // Save at ALL parent levels so mastery shows at chunk, unit, and module views
      const parents = allParents.length > 0 ? allParents
        : parentType && parentId ? [{ type: parentType, id: parentId }] : []
      await saveAttempt({ timelineId: null, parents, mode: testMode, score, total })
    } else {
      await saveAttempt({ timelineId: activeId, parents: [], mode: testMode, score, total })
    }
    onMasteryRefresh?.()
  }, [user, selectedTimeline, parentType, parentId, masterKey, allParents, saveAttempt, onMasteryRefresh])

  if (loading) return <div className="loading-pulse" style={{ padding: '24px 0' }}>Loading timeline…</div>

  const allTimelines = [
    ...(masterEvents.length > 0 && !masterHidden ? [{ id: 'master', title: 'Master Timeline', events: masterEvents }] : []),
    ...customTimelines,
  ]

  if (allTimelines.length === 0) {
    return (
      <div className="tl-empty">
        <span className="tl-empty-icon">📅</span>
        <p>No timeline events found for this content.</p>
      </div>
    )
  }

  const activeId = allTimelines.find(t => t.id === selectedTimeline) ? selectedTimeline : allTimelines[0].id
  const activeTimeline = allTimelines.find(t => t.id === activeId)

  // handleStartSession defined here so activeTimeline is never stale
  function handleStartSession(size) {
    const events = activeTimeline?.events ?? []
    setSession(pickRandom(sortByDate(events), size))
  }

  // Mastery for the active timeline:
  // - Master timeline: use primary masterKey
  // - Custom timeline: use custom timeline's own attempts, falling back to its source chunk's attempts
  const primaryMastery = masterKey ? timelineBest?.[masterKey] : null
  const customMastery  = activeId !== 'master' ? timelineBest?.[activeId] : null
  const chunkFallback  = activeId !== 'master' && timelineChunkMap[activeId]
    ? timelineBest?.[`chunk:${timelineChunkMap[activeId]}`]
    : null
  const activeMastery = {
    'date-test':  Math.max(
      primaryMastery?.['date-test']  ?? -1,
      customMastery?.['date-test']   ?? -1,
      chunkFallback?.['date-test']   ?? -1,
    ),
    'match-test': Math.max(
      primaryMastery?.['match-test'] ?? -1,
      customMastery?.['match-test']  ?? -1,
      chunkFallback?.['match-test']  ?? -1,
    ),
  }
  if (activeMastery['date-test']  < 0) activeMastery['date-test']  = null
  if (activeMastery['match-test'] < 0) activeMastery['match-test'] = null

  return (
    <div className="tl-tab-content">

      {/* Mode selector */}
      <div className="tl-mode-bar">
        <button className={`tl-mode-btn ${mode === 'view'       ? 'tl-mode-active' : ''}`} onClick={() => changeMode('view')}>
          📅 Timeline
        </button>
        <button className={`tl-mode-btn ${mode === 'date-test'  ? 'tl-mode-active' : ''}`} onClick={() => changeMode('date-test')}>
          🎯 Date Test
          {user && activeMastery?.['date-test'] != null && (
            <MasteryBadge percent={activeMastery['date-test']} label={`Best: ${activeMastery['date-test']}%`} />
          )}
        </button>
        <button className={`tl-mode-btn ${mode === 'match-test' ? 'tl-mode-active' : ''}`} onClick={() => changeMode('match-test')}>
          🔗 Match Test
          {user && activeMastery?.['match-test'] != null && (
            <MasteryBadge percent={activeMastery['match-test']} label={`Best: ${activeMastery['match-test']}%`} />
          )}
        </button>
        <span className="tl-event-count">{activeTimeline?.events.length ?? 0} events</span>
      </div>

      {/* Timeline selector */}
      {allTimelines.length > 1 && (
        <div className="tl-selector">
          {allTimelines.map(tl => (
            <button key={tl.id}
              className={`tl-selector-btn ${activeId === tl.id ? 'tl-selector-active' : ''}`}
              onClick={() => { setSelectedTimeline(tl.id); setSession(null) }}>
              {tl.title}
              <span className="tl-selector-count">{tl.events.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <TimelineShell
        key={activeId + '-' + mode}
        events={activeTimeline?.events ?? []}
        mode={mode}
        session={session}
        onStartSession={handleStartSession}
        onResetSession={handleResetSession}
        onTestComplete={handleTestComplete}
      />
    </div>
  )
}
