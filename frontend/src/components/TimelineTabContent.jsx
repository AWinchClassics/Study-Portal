import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import TimelineShell from './TimelineShell'

const PRIORITY_RANK = { core: 0, useful: 1, stretch: 2 }

function dedupeGlossaryRows(rows) {
  const byId = {}
  rows.forEach(row => {
    const t = row.glossary_terms
    if (!t || !t.date) return
    const existing = byId[t.id]
    const rank = PRIORITY_RANK[row.priority] ?? 99
    if (!existing || rank < (PRIORITY_RANK[existing._rank] ?? 99)) {
      byId[t.id] = { id: t.id, label: t.term, date: t.date, definition: t.definition, _rank: row.priority }
    }
  })
  return Object.values(byId).map(({ _rank, ...e }) => e)
}

export default function TimelineTabContent({ chunkIds = [], unitIds = [], moduleIds = [] }) {
  const [masterEvents, setMasterEvents]       = useState([])
  const [customTimelines, setCustomTimelines] = useState([])
  const [selected, setSelected]               = useState('master')
  const [loading, setLoading]                 = useState(true)

  const key = [chunkIds, unitIds, moduleIds].map(a => a.slice().sort().join(',')).join('|')

  useEffect(() => {
    setLoading(true)
    setSelected('master')

    async function load() {
      const [{ data: chunkCG }, { data: unitCG }, { data: moduleCG }] = await Promise.all([
        chunkIds.length > 0
          ? supabase.from('chunk_glossary').select('priority, glossary_terms(id, term, definition, date)').in('chunk_id', chunkIds)
          : { data: [] },
        unitIds.length > 0
          ? supabase.from('unit_glossary').select('priority, glossary_terms(id, term, definition, date)').in('unit_id', unitIds)
          : { data: [] },
        moduleIds.length > 0
          ? supabase.from('module_glossary').select('priority, glossary_terms(id, term, definition, date)').in('module_id', moduleIds)
          : { data: [] },
      ])

      setMasterEvents(dedupeGlossaryRows([...(moduleCG ?? []), ...(unitCG ?? []), ...(chunkCG ?? [])]))

      const [{ data: ctChunk }, { data: ctUnit }, { data: ctModule }] = await Promise.all([
        chunkIds.length > 0   ? supabase.from('chunk_timelines').select('timeline_id').in('chunk_id', chunkIds)     : { data: [] },
        unitIds.length > 0    ? supabase.from('unit_timelines').select('timeline_id').in('unit_id', unitIds)        : { data: [] },
        moduleIds.length > 0  ? supabase.from('module_timelines').select('timeline_id').in('module_id', moduleIds)  : { data: [] },
      ])

      const tlIds = [...new Set([
        ...(ctModule ?? []), ...(ctUnit ?? []), ...(ctChunk ?? [])
      ].map(r => r.timeline_id))]

      if (tlIds.length > 0) {
        const [{ data: tlData }, { data: evData }] = await Promise.all([
          supabase.from('timelines').select('id, title').in('id', tlIds),
          supabase.from('timeline_events').select('id, timeline_id, label, date').in('timeline_id', tlIds).order('order_index'),
        ])
        setCustomTimelines((tlData ?? []).map(tl => ({
          ...tl,
          events: (evData ?? []).filter(e => e.timeline_id === tl.id).map(e => ({ id: e.id, label: e.label, date: e.date })),
        })))
      } else {
        setCustomTimelines([])
      }

      setLoading(false)
    }

    load()
  }, [key])

  if (loading) return <div className="loading-pulse" style={{ padding: '24px 0' }}>Loading timeline…</div>

  const allTimelines = [{ id: 'master', title: 'Master Timeline', events: masterEvents }, ...customTimelines]
  const activeTimeline = allTimelines.find(t => t.id === selected) ?? allTimelines[0]

  return (
    <div className="tl-tab-content">
      {customTimelines.length > 0 && (
        <div className="tl-selector">
          {allTimelines.map(tl => (
            <button key={tl.id}
              className={`tl-selector-btn ${selected === tl.id ? 'tl-selector-active' : ''}`}
              onClick={() => setSelected(tl.id)}>
              {tl.title}
              <span className="tl-selector-count">{tl.events.length}</span>
            </button>
          ))}
        </div>
      )}
      <TimelineShell key={activeTimeline.id} events={activeTimeline.events} title={activeTimeline.title} />
    </div>
  )
}
