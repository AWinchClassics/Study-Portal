import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { InlineEdit, ConfirmButton, StatusMessage } from '../../components/teacher/TeacherUI'
import TeacherGlossarySection from '../../components/teacher/TeacherGlossarySection'

export default function TeacherModulePage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()

  const [module, setModule] = useState(null)
  const [course, setCourse] = useState(null)
  const [units, setUnits]   = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  useEffect(() => { fetchData() }, [moduleId])

  async function fetchData() {
    const { data: modData } = await supabase
      .from('modules')
      .select('*, courses(id, title)')
      .eq('id', moduleId).single()

    if (modData) { setModule(modData); setCourse(modData.courses) }

    const { data: unitsData } = await supabase
      .from('units').select('*').eq('module_id', moduleId).order('order_index')

    if (unitsData) setUnits(unitsData)
    setLoading(false)
  }

  async function handleRenameModule(title) {
    const { error } = await supabase.from('modules').update({ title }).eq('id', moduleId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setModule(prev => ({ ...prev, title }))
  }

  async function handleAddUnit() {
    const { data, error } = await supabase
      .from('units')
      .insert({ module_id: moduleId, title: 'New Unit', order_index: units.length })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setUnits(prev => [...prev, data])
  }

  async function handleRenameUnit(id, title) {
    const { error } = await supabase.from('units').update({ title }).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setUnits(prev => prev.map(u => u.id === id ? { ...u, title } : u))
  }

  async function handleDeleteUnit(id) {
    const { error } = await supabase.from('units').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setUnits(prev => prev.filter(u => u.id !== id))
  }

  async function handleMoveUnit(id, direction) {
    const idx = units.findIndex(u => u.id === id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= units.length) return
    const updated = [...units]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    updated.forEach((u, i) => { u.order_index = i })
    setUnits(updated)
    await Promise.all(updated.map(u =>
      supabase.from('units').update({ order_index: u.order_index }).eq('id', u.id)
    ))
  }

  if (loading) return <div className="page"><div className="loading-pulse">Loading…</div></div>

  return (
    <TeacherLayout
      title={module?.title ?? 'Module'}
      actions={
        <button className="t-btn t-btn-ghost"
          onClick={() => navigate(`/teacher/courses/${course?.id}`)}>
          ← {course?.title ?? 'Course'}
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      {/* Module title */}
      <div className="t-section">
        <h2 className="t-section-title">Module title</h2>
        <InlineEdit
          value={module?.title ?? ''}
          onSave={handleRenameModule}
          className="t-detail-inline t-detail-inline-lg"
        />
      </div>

      {/* Units */}
      <div className="t-section">
        <div className="t-section-header">
          <h2 className="t-section-title">Units</h2>
          <button className="t-btn t-btn-primary" onClick={handleAddUnit}>+ Add unit</button>
        </div>

        {units.length === 0 ? (
          <div className="t-empty"><p>No units yet.</p></div>
        ) : (
          <div className="t-list">
            {units.map((unit, idx) => (
              <div key={unit.id} className="t-list-row t-list-row-nav"
                onClick={() => navigate(`/teacher/units/${unit.id}`)}>
                <div className="t-list-row-order" onClick={e => e.stopPropagation()}>
                  <button className="t-order-btn" onClick={() => handleMoveUnit(unit.id, -1)} disabled={idx === 0}>↑</button>
                  <button className="t-order-btn" onClick={() => handleMoveUnit(unit.id, 1)} disabled={idx === units.length - 1}>↓</button>
                </div>
                <div className="t-list-row-main">
                  <InlineEdit
                    value={unit.title}
                    onSave={title => handleRenameUnit(unit.id, title)}
                    className="t-list-title"
                  />
                </div>
                <div className="t-list-row-actions" onClick={e => e.stopPropagation()}>
                  <ConfirmButton
                    className="t-btn t-btn-danger-ghost"
                    onConfirm={() => handleDeleteUnit(unit.id)}
                    confirmLabel="Delete?"
                  >
                    Delete
                  </ConfirmButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Module-level glossary terms */}
      <div className="t-section">
        <TeacherGlossarySection
          table="module_glossary"
          parentId={moduleId}
          parentKey="module_id"
          onStatus={(type, msg) => setStatus({ type, msg })}
        />
      </div>
    </TeacherLayout>
  )
}
