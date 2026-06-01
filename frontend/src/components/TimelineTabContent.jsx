import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import TimelineShell, { sortByDate, pickRandom } from './TimelineShell'

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
 * Owns mode + session state so the mode bar renders at the very top,
 * above the master/custom timeline selector.
 *
 * Props: chunkIds, unitIds, moduleIds — same as FlashcardTabContent
 */
export default function TimelineTabContent({ chunkIds = [], unitIds = [], moduleIds = [] }) {
  const [masterEvents, setMasterEvents]       = useState([])
  const [customTimelines, setCustomTimelines] = useState([])
  const [selectedTimeline, setSelectedTimeline] = useState('master')
  const [loading, setLoading]                 = useState(true)
  const [masterHidden, setMasterHidden]         = useState(false)

  // Mode and session state — owned here so mode bar is always at top
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
      // Master timeline — dated glossary terms, filter-up, include sort_order
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

      // Custom timelines — filter-up from all three attachment tables
      const [{ data: ctChunk }, { data: ctUnit }, { data: ctModule }] = await Promise.all([
        chunkIds.length > 0   ? supabase.from('chunk_timelines').select('timeline_id').in('chunk_id', chunkIds)    : { data: [] },
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
      } else {
        setCustomTimelines([])
      }

      // Check if master timeline is hidden at the current level.
      // Only check the primary level (module > unit > chunk).
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

  function changeMode(newMode) {
    setMode(newMode)
    setSession(null)
  }

  const handleStartSession = useCallback((size) => {
    const events = activeTimeline?.events ?? []
    setSession(pickRandom(sortByDate(events), size))
  }, [selectedTimeline, masterEvents, customTimelines])

  const handleResetSession = useCallback(() => {
    setSession(null)
  }, [])

  if (loading) return <div className="loading-pulse" style={{ padding: '24px 0' }}>Loading timeline…</div>

  // Only include master if it has events and is not hidden by teacher
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

  // Ensure selected timeline is valid
  const activeId = allTimelines.find(t => t.id === selectedTimeline) ? selectedTimeline : allTimelines[0].id
  const activeTimeline = allTimelines.find(t => t.id === activeId)

  return (
    <div className="tl-tab-content">

      {/* Mode selector — always at the very top */}
      <div className="tl-mode-bar">
        <button className={`tl-mode-btn ${mode === 'view'       ? 'tl-mode-active' : ''}`} onClick={() => changeMode('view')}>
          📅 Timeline
        </button>
        <button className={`tl-mode-btn ${mode === 'date-test'  ? 'tl-mode-active' : ''}`} onClick={() => changeMode('date-test')}>
          🎯 Date Test
        </button>
        <button className={`tl-mode-btn ${mode === 'match-test' ? 'tl-mode-active' : ''}`} onClick={() => changeMode('match-test')}>
          🔗 Match Test
        </button>
        <span className="tl-event-count">{activeTimeline?.events.length ?? 0} events</span>
      </div>

      {/* Timeline selector — only shown if multiple timelines exist */}
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
      />
    </div>
  )
}
