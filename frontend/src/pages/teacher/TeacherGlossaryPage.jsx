import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { StatusMessage, Modal, FormField, ConfirmButton } from '../../components/teacher/TeacherUI'
import CategorySelect, { CategoryBadge, buildColourMap } from '../../components/teacher/CategorySelect'

// ── Term form modal ───────────────────────────────────────────────
function TermFormModal({ title, initial, categories, onSave, onCategoryAdded, onClose }) {
  const [form, setForm] = useState({
    term:       initial?.term       ?? '',
    definition: initial?.definition ?? '',
    category:   initial?.category   ?? (categories[0]?.name ?? 'concept'),
  })
  const [errors, setErrors] = useState({})

  function set(field, value) {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: null }))
  }

  function handleSave() {
    const e = {}
    if (!form.term.trim())       e.term       = 'Term is required'
    if (!form.definition.trim()) e.definition = 'Definition is required'
    if (Object.keys(e).length) { setErrors(e); return }
    onSave({ term: form.term.trim(), definition: form.definition.trim(), category: form.category })
  }

  return (
    <Modal title={title} onClose={onClose} width={580}>
      <div className="t-form">
        <FormField label="Term" error={errors.term}>
          <input className="t-input" autoFocus value={form.term}
            onChange={e => set('term', e.target.value)} placeholder="e.g. Cleisthenes" />
        </FormField>
        <FormField label="Definition" error={errors.definition}>
          <textarea className="t-input gl-textarea" rows={4} value={form.definition}
            onChange={e => set('definition', e.target.value)}
            placeholder="The definition or explanation…" />
        </FormField>
        <FormField label="Category">
          <CategorySelect
            categories={categories}
            value={form.category}
            onChange={v => set('category', v)}
            onCategoryAdded={onCategoryAdded}
          />
        </FormField>
        <div className="t-modal-footer">
          <button className="t-btn t-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="t-btn t-btn-primary" onClick={handleSave}>
            {initial ? 'Save changes' : 'Create term'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function TeacherGlossaryPage() {
  const [terms, setTerms]             = useState([])
  const [categories, setCategories]   = useState([])
  const [chunkCounts, setChunkCounts] = useState({})
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterCat, setFilterCat]     = useState('all')
  const [status, setStatus]           = useState(null)
  const [editTerm, setEditTerm]       = useState(null)
  const [showCreate, setShowCreate]   = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: termsData }, { data: cgData }, { data: catData }] = await Promise.all([
      supabase.from('glossary_terms').select('*').order('term'),
      supabase.from('chunk_glossary').select('glossary_id'),
      supabase.from('glossary_categories').select('*').order('name'),
    ])
    if (termsData) setTerms(termsData)
    if (cgData) {
      const counts = {}
      cgData.forEach(r => { counts[r.glossary_id] = (counts[r.glossary_id] || 0) + 1 })
      setChunkCounts(counts)
    }
    if (catData) setCategories(catData)
    setLoading(false)
  }

  const colourMap = useMemo(() => buildColourMap(categories), [categories])

  // Filter options: all from table + any category in terms not in table
  const filterOptions = useMemo(() => {
    const fromTable = categories.map(c => c.name)
    const fromTerms = [...new Set(terms.map(t => t.category).filter(Boolean))]
    return [...new Set([...fromTable, ...fromTerms])].sort()
  }, [categories, terms])

  function handleCategoryAdded(newCat) {
    setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleCreate(form) {
    const { data, error } = await supabase.from('glossary_terms').insert(form).select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTerms(prev => [...prev, data].sort((a, b) => a.term.localeCompare(b.term)))
    setShowCreate(false)
    setStatus({ type: 'success', msg: 'Term created.' })
  }

  async function handleUpdate(id, form) {
    const { error } = await supabase.from('glossary_terms').update(form).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTerms(prev => prev.map(t => t.id === id ? { ...t, ...form } : t))
    setEditTerm(null)
    setStatus({ type: 'success', msg: 'Term updated.' })
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('glossary_terms').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setTerms(prev => prev.filter(t => t.id !== id))
    setStatus({ type: 'success', msg: 'Term deleted.' })
  }

  const filtered = terms.filter(t => {
    const matchSearch = t.term.toLowerCase().includes(search.toLowerCase()) ||
                        t.definition.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || t.category === filterCat
    return matchSearch && matchCat
  })

  return (
    <TeacherLayout
      title="Glossary"
      actions={
        <button className="t-btn t-btn-primary" onClick={() => setShowCreate(true)}>
          + New term
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      <div className="t-filter-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input className="t-search-input" placeholder="Search terms or definitions…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="t-filter-select" value={filterCat}
          onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All categories</option>
          {filterOptions.map(name => (
            <option key={name} value={name}>
              {name.charAt(0).toUpperCase() + name.slice(1)}
            </option>
          ))}
        </select>
        <span className="t-filter-count">{filtered.length} terms</span>
      </div>

      {loading ? (
        <div className="loading-pulse">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="t-empty">
          <p>{search || filterCat !== 'all' ? 'No terms match your search.' : 'No glossary terms yet.'}</p>
        </div>
      ) : (
        <div className="t-list">
          {filtered.map(term => (
            <div key={term.id} className="t-list-row gl-term-row">
              <div className="t-list-row-main">
                <CategoryBadge category={term.category} colourMap={colourMap} />
                <div className="gl-term-info">
                  <span className="t-list-title">{term.term}</span>
                  <span className="t-list-meta gl-definition-preview">{term.definition}</span>
                </div>
                {(chunkCounts[term.id] ?? 0) > 0 && (
                  <span className="gl-chunk-count">
                    {chunkCounts[term.id]} {chunkCounts[term.id] === 1 ? 'chunk' : 'chunks'}
                  </span>
                )}
              </div>
              <div className="t-list-row-actions">
                <button className="t-btn t-btn-ghost" onClick={() => setEditTerm(term)}>Edit</button>
                <ConfirmButton className="t-btn t-btn-danger-ghost"
                  onConfirm={() => handleDelete(term.id)} confirmLabel="Delete?">
                  Delete
                </ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <TermFormModal title="New glossary term" categories={categories}
          onSave={handleCreate} onCategoryAdded={handleCategoryAdded}
          onClose={() => setShowCreate(false)} />
      )}
      {editTerm && (
        <TermFormModal title="Edit term" initial={editTerm} categories={categories}
          onSave={form => handleUpdate(editTerm.id, form)}
          onCategoryAdded={handleCategoryAdded}
          onClose={() => setEditTerm(null)} />
      )}
    </TeacherLayout>
  )
}
