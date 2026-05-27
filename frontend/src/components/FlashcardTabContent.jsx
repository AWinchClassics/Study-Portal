import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import FlashcardViewer from './FlashcardViewer'

/**
 * FlashcardTabContent
 *
 * Fetches glossary terms and renders FlashcardViewer.
 * Terms filter UP — lower levels include terms from below, not above:
 *
 *   Chunk view  (chunkIds only)              → chunk_glossary only
 *   Unit view   (chunkIds + unitIds)          → chunk_glossary + unit_glossary
 *   Module view (chunkIds + unitIds + moduleIds) → all three tables
 *
 * The calling component decides the level by choosing which props to pass.
 *
 * Props:
 *   chunkIds  — chunk UUIDs to include (always required)
 *   unitIds   — unit UUIDs (pass for unit-level and above views)
 *   moduleIds — module UUIDs (pass for module-level views only)
 */
export default function FlashcardTabContent({
  chunkIds  = [],
  unitIds   = [],
  moduleIds = [],
}) {
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)

  const key = [
    chunkIds.slice().sort().join(','),
    unitIds.slice().sort().join(','),
    moduleIds.slice().sort().join(','),
  ].join('|')

  useEffect(() => {
    if (chunkIds.length === 0 && unitIds.length === 0 && moduleIds.length === 0) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    async function fetchTerms() {
      // Query only the tables appropriate for this level
      const queries = [
        chunkIds.length > 0
          ? supabase.from('chunk_glossary')
              .select('priority, glossary_terms(id, term, definition, category, date)')
              .in('chunk_id', chunkIds)
          : Promise.resolve({ data: [] }),

        unitIds.length > 0
          ? supabase.from('unit_glossary')
              .select('priority, glossary_terms(id, term, definition, category, date)')
              .in('unit_id', unitIds)
          : Promise.resolve({ data: [] }),

        moduleIds.length > 0
          ? supabase.from('module_glossary')
              .select('priority, glossary_terms(id, term, definition, category, date)')
              .in('module_id', moduleIds)
          : Promise.resolve({ data: [] }),
      ]

      const [{ data: chunkCG }, { data: unitCG }, { data: moduleCG }] =
        await Promise.all(queries)

      // Merge and deduplicate — chunk-level priority wins (most specific)
      const priorityRank  = { core: 0, useful: 1, stretch: 2 }
      const byId = {}

      // Add least-specific first so more-specific can override
      const allRows = [...(moduleCG ?? []), ...(unitCG ?? []), ...(chunkCG ?? [])]
      allRows.forEach(row => {
        const t = row.glossary_terms
        if (!t) return
        const existing = byId[t.id]
        const rank = priorityRank[row.priority] ?? 99
        if (!existing || rank < (priorityRank[existing.priority] ?? 99)) {
          byId[t.id] = { ...t, priority: row.priority }
        }
      })

      setCards(Object.values(byId))
      setLoading(false)
    }

    fetchTerms()
  }, [key])

  if (loading) return (
    <div className="loading-pulse" style={{ padding: '32px 0' }}>Loading flashcards…</div>
  )

  return <FlashcardViewer cards={cards} />
}
