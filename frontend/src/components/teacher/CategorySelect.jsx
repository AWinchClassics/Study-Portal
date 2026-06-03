/**
 * CategorySelect
 *
 * Shared component for both TeacherGlossaryPage and TeacherChunkPage.
 * Renders a category dropdown + live badge preview + inline "Add new category"
 * form with colour pickers. Saves new categories to the glossary_categories table.
 */
import { useState, useMemo } from 'react'
import { supabase } from '../../supabase'
import { FormField } from './TeacherUI'

const FALLBACK = { bg: '#f3f4f6', text: '#4b5563' }

/** Small badge using the live colour map. */
export function CategoryBadge({ category, colourMap }) {
  const c = (colourMap ?? {})[category] ?? FALLBACK
  return (
    <span className="gl-category-badge" style={{ background: c.bg, color: c.text }}>
      {category}
    </span>
  )
}

/** Build a { name → {bg, text} } map from the categories array. */
export function buildColourMap(categories) {
  const m = {}
  ;(categories ?? []).forEach(c => { m[c.name] = { bg: c.bg_colour, text: c.text_colour } })
  return m
}

/**
 * Props:
 *   categories      – array of { name, bg_colour, text_colour }
 *   value           – current selected category name (string)
 *   onChange        – (name: string) => void
 *   onCategoryAdded – (newCategory: object) => void  — called after DB insert
 */
export default function CategorySelect({ categories, value, onChange, onCategoryAdded }) {
  const [adding, setAdding]     = useState(false)
  const [newCat, setNewCat]     = useState({ name: '', bg: '#e0f2fe', text: '#0369a1' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const colourMap = useMemo(() => buildColourMap(categories), [categories])

  async function handleAdd() {
    const name = newCat.name.trim().toLowerCase()
    if (!name) { setError('Name is required'); return }
    if ((categories ?? []).some(c => c.name === name)) { setError('Category already exists'); return }
    setSaving(true)
    const { data, error: err } = await supabase
      .from('glossary_categories')
      .insert({ name, bg_colour: newCat.bg, text_colour: newCat.text })
      .select().single()
    setSaving(false)
    if (err) { setError(err.message); return }
    onCategoryAdded?.(data)
    onChange(name)
    setAdding(false)
    setNewCat({ name: '', bg: '#e0f2fe', text: '#0369a1' })
    setError('')
  }

  return (
    <div>
      {/* Row: dropdown + badge preview + toggle button */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select className="t-input" value={value} onChange={e => onChange(e.target.value)}
          style={{ flex: 1 }}>
          {(categories ?? []).map(c => (
            <option key={c.name} value={c.name}>
              {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
            </option>
          ))}
        </select>
        <CategoryBadge category={value} colourMap={colourMap} />
        <button type="button" className="t-btn t-btn-secondary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => { setAdding(o => !o); setError('') }}>
          {adding ? 'Cancel' : '+ New'}
        </button>
      </div>

      {/* Inline new-category form */}
      {adding && (
        <div className="gl-new-cat-form" style={{ marginTop: 8 }}>
          <p className="gl-new-cat-title">New category</p>

          <FormField label="Name" error={error}>
            <input className="t-input" placeholder="e.g. battle"
              value={newCat.name}
              onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} />
          </FormField>

          <div style={{ display: 'flex', gap: 16 }}>
            <FormField label="Background">
              <div className="gl-colour-row">
                <input type="color" className="gl-colour-input" value={newCat.bg}
                  onChange={e => setNewCat(p => ({ ...p, bg: e.target.value }))} />
                <code className="gl-colour-hex">{newCat.bg}</code>
              </div>
            </FormField>
            <FormField label="Text">
              <div className="gl-colour-row">
                <input type="color" className="gl-colour-input" value={newCat.text}
                  onChange={e => setNewCat(p => ({ ...p, text: e.target.value }))} />
                <code className="gl-colour-hex">{newCat.text}</code>
              </div>
            </FormField>
            <FormField label="Preview">
              <div style={{ paddingTop: 4 }}>
                <span className="gl-category-badge"
                  style={{ background: newCat.bg, color: newCat.text }}>
                  {newCat.name || 'preview'}
                </span>
              </div>
            </FormField>
          </div>

          <button className="t-btn t-btn-primary" onClick={handleAdd}
            disabled={saving || !newCat.name.trim()}>
            {saving ? 'Adding…' : 'Add category'}
          </button>
        </div>
      )}
    </div>
  )
}
