import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import FlashcardViewer from './FlashcardViewer'

/**
 * FlashcardTabContent
 *
 * Fetches glossary terms for a set of chunk IDs and renders FlashcardViewer.
 * Queries two sources and merges them:
 *   - unit_glossary  — terms assigned at unit level (bulk import / teacher)
 *   - chunk_glossary — terms assigned to a specific chunk (teacher manual)
 *
 * Props:
 *   chunkIds — array of chunk UUIDs
 */
export default function FlashcardTabContent({ chunkIds = [] }) {
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)

  const key = chunkIds.slice().sort().join(',')

  useEffect(() => {
    if (chunkIds.length === 0) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)

    async function fetchTerms() {
      // 1. Find the unique unit IDs that own these chunks
      const { data: chunkData } = await supabase
        .from('chunks')
        .select('id, unit_id')
        .in('id', chunkIds)

      const unitIds = [...new Set((chunkData ?? []).map(c => c.unit_id).filter(Boolean))]

      // 2. Fetch unit-level terms and chunk-level terms in parallel
      const [{ data: unitCG }, { data: chunkCG }] = await Promise.all([
        unitIds.length > 0
          ? supabase.from('unit_glossary')
              .select('priority, glossary_terms(id, term, definition, category, date)')
              .in('unit_id', unitIds)
          : { data: [] },
        supabase.from('chunk_glossary')
          .select('priority, glossary_terms(id, term, definition, category, date)')
          .in('chunk_id', chunkIds),
      ])

      // 3. Merge and deduplicate — chunk-level priority wins over unit-level
      const priorityRank = { core: 0, useful: 1, stretch: 2 }
      const byId = {}

      const allRows = [...(unitCG ?? []), ...(chunkCG ?? [])]
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
