import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import FlashcardViewer from './FlashcardViewer'

/**
 * FlashcardTabContent
 *
 * Fetches glossary terms for a set of chunk IDs from all three levels:
 *   - chunk_glossary  — terms assigned to a specific chunk
 *   - unit_glossary   — terms assigned to a unit (shown for all its chunks)
 *   - module_glossary — terms assigned to a module (shown for all its chunks)
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
      // 1. Resolve unit IDs from chunk IDs
      const { data: chunkData } = await supabase
        .from('chunks')
        .select('id, unit_id')
        .in('id', chunkIds)

      const unitIds = [...new Set((chunkData ?? []).map(c => c.unit_id).filter(Boolean))]

      // 2. Resolve module IDs from unit IDs
      const { data: unitData } = unitIds.length > 0
        ? await supabase.from('units').select('id, module_id').in('id', unitIds)
        : { data: [] }

      const moduleIds = [...new Set((unitData ?? []).map(u => u.module_id).filter(Boolean))]

      // 3. Query all three glossary tables in parallel
      const [{ data: chunkCG }, { data: unitCG }, { data: moduleCG }] = await Promise.all([
        supabase.from('chunk_glossary')
          .select('priority, glossary_terms(id, term, definition, category, date)')
          .in('chunk_id', chunkIds),
        unitIds.length > 0
          ? supabase.from('unit_glossary')
              .select('priority, glossary_terms(id, term, definition, category, date)')
              .in('unit_id', unitIds)
          : { data: [] },
        moduleIds.length > 0
          ? supabase.from('module_glossary')
              .select('priority, glossary_terms(id, term, definition, category, date)')
              .in('module_id', moduleIds)
          : { data: [] },
      ])

      // 4. Merge and deduplicate — more specific level wins on priority
      const priorityRank = { core: 0, useful: 1, stretch: 2 }
      const byId = {}

      // Module is least specific → chunk is most specific, so add in that order
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
