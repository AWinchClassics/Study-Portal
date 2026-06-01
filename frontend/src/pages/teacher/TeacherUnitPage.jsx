import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { InlineEdit, ConfirmButton, StatusMessage } from '../../components/teacher/TeacherUI'
import TeacherGlossarySection from '../../components/teacher/TeacherGlossarySection'

export default function TeacherUnitPage() {
  const { unitId } = useParams()
  const navigate = useNavigate()

  const [unit, setUnit]     = useState(null)
  const [module, setModule] = useState(null)
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  useEffect(() => { fetchData() }, [unitId])

  async function fetchData() {
    const { data: unitData } = await supabase
      .from('units')
      .select('*, modules(id, title, course_id, courses(id, title))')
      .eq('id', unitId).single()

    if (unitData) { setUnit(unitData); setModule(unitData.modules) }

    const { data: chunksData } = await supabase
      .from('chunks').select('*').eq('unit_id', unitId).order('order_index')

    if (chunksData) setChunks(chunksData)
    setLoading(false)
  }

  async function handleRenameUnit(title) {
    const { error } = await supabase.from('units').update({ title }).eq('id', unitId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setUnit(prev => ({ ...prev, title }))
  }

  async function handleAddChunk() {
    const { data, error } = await supabase
      .from('chunks')
      .insert({ unit_id: unitId, title: 'New Chunk', order_index: chunks.length })
      .select().single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setChunks(prev => [...prev, data])
  }

  async function handleRenameChunk(id, title) {
    const { error } = await supabase.from('chunks').update({ title }).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setChunks(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }

  async function handleUpdateChunkDesc(id, description) {
    const { error } = await supabase.from('chunks').update({ description }).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setChunks(prev => prev.map(c => c.id === id ? { ...c, description } : c))
  }

  async function handleUpdateChunkTime(id, value) {
    const estimated_time = value === '' ? null : parseInt(value, 10)
    const { error } = await supabase.from('chunks').update({ estimated_time }).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setChunks(prev => prev.map(c => c.id === id ? { ...c, estimated_time } : c))
  }

  async function handleDeleteChunk(id) {
    const { error } = await supabase.from('chunks').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setChunks(prev => prev.filter(c => c.id !== id))
  }

  async function handleMoveChunk(id, direction) {
    const idx = chunks.findIndex(c => c.id === id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= chunks.length) return
    const updated = [...chunks]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    updated.forEach((c, i) => { c.order_index = i })
    setChunks(updated)
    await Promise.all(updated.map(c =>
      supabase.from('chunks').update({ order_index: c.order_index }).eq('id', c.id)
    ))
  }

  if (loading) return <div className="page"><div className="loading-pulse">Loading…</div></div>

  return (
    <TeacherLayout
      title={unit?.title ?? 'Unit'}
      actions={
        <button className="t-btn t-btn-ghost"
          onClick={() => navigate(`/teacher/modules/${module?.id}`)}>
          ← {module?.title ?? 'Module'}
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      {/* Unit title */}
      <div className="t-section">
        <h2 className="t-section-title">Unit title</h2>
        <InlineEdit
          value={unit?.title ?? ''}
          onSave={handleRenameUnit}
          className="t-detail-inline t-detail-inline-lg"
        />
      </div>

      {/* Chunks */}
      <div className="t-section">
        <div className="t-section-header">
          <h2 className="t-section-title">Chunks</h2>
          <button className="t-btn t-btn-primary" onClick={handleAddChunk}>+ Add chunk</button>
        </div>

        {chunks.length === 0 ? (
          <div className="t-empty"><p>No chunks yet.</p></div>
        ) : (
          <div className="t-chunk-list">
            {chunks.map((chunk, idx) => (
              <div key={chunk.id} className="t-chunk-row t-list-row-nav"
                onClick={() => navigate(`/teacher/chunks/${chunk.id}`)}>
                <div className="t-chunk-row-top">
                  <div className="t-list-row-order" onClick={e => e.stopPropagation()}>
                    <button className="t-order-btn" onClick={() => handleMoveChunk(chunk.id, -1)} disabled={idx === 0}>↑</button>
                    <button className="t-order-btn" onClick={() => handleMoveChunk(chunk.id, 1)} disabled={idx === chunks.length - 1}>↓</button>
                  </div>
                  <div className="t-chunk-row-title">
                    <InlineEdit
                      value={chunk.title}
                      onSave={title => handleRenameChunk(chunk.id, title)}
                      className="t-list-title"
                    />
                  </div>
                  <div className="t-list-row-actions" onClick={e => e.stopPropagation()}>
                    <ConfirmButton
                      className="t-btn t-btn-danger-ghost"
                      onConfirm={() => handleDeleteChunk(chunk.id)}
                      confirmLabel="Delete?"
                    >
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
                <div className="t-chunk-row-meta">
                  <div className="t-chunk-meta-field">
                    <span className="t-chunk-meta-label">Description</span>
                    <InlineEdit
                      value={chunk.description ?? ''}
                      onSave={v => handleUpdateChunkDesc(chunk.id, v)}
                      placeholder="Add a description…"
                      className="t-chunk-meta-edit"
                    />
                  </div>
                  <div className="t-chunk-meta-field t-chunk-meta-field-narrow">
                    <span className="t-chunk-meta-label">Est. time (min)</span>
                    <InlineEdit
                      value={chunk.estimated_time?.toString() ?? ''}
                      onSave={v => handleUpdateChunkTime(chunk.id, v)}
                      placeholder="—"
                      className="t-chunk-meta-edit"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unit-level glossary terms */}
      <div className="t-section">
        <TeacherGlossarySection
          table="unit_glossary"
          parentId={unitId}
          parentKey="unit_id"
          onStatus={(type, msg) => setStatus({ type, msg })}
        />
      </div>
    </TeacherLayout>
  )
}
