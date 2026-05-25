import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { InlineEdit, ConfirmButton, StatusMessage, FormField } from '../../components/teacher/TeacherUI'

export default function TeacherCoursePage() {
  const { courseId } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)

  useEffect(() => { fetchData() }, [courseId])

  async function fetchData() {
    const [{ data: courseData }, { data: modulesData }] = await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).single(),
      supabase.from('modules').select('*').eq('course_id', courseId).order('order_index'),
    ])
    if (courseData) setCourse(courseData)
    if (modulesData) setModules(modulesData)
    setLoading(false)
  }

  async function handleCourseUpdate(field, value) {
    const { error } = await supabase.from('courses').update({ [field]: value }).eq('id', courseId)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setCourse(prev => ({ ...prev, [field]: value }))
  }

  async function handleAddModule() {
    const nextOrder = modules.length
    const { data, error } = await supabase
      .from('modules')
      .insert({ course_id: courseId, title: 'New Module', order_index: nextOrder })
      .select()
      .single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setModules(prev => [...prev, data])
  }

  async function handleRenameModule(id, title) {
    const { error } = await supabase.from('modules').update({ title }).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setModules(prev => prev.map(m => m.id === id ? { ...m, title } : m))
  }

  async function handleDeleteModule(id) {
    const { error } = await supabase.from('modules').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setModules(prev => prev.filter(m => m.id !== id))
  }

  async function handleMoveModule(id, direction) {
    const idx = modules.findIndex(m => m.id === id)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= modules.length) return

    const updated = [...modules]
    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    updated.forEach((m, i) => { m.order_index = i })
    setModules(updated)

    await Promise.all(
      updated.map(m => supabase.from('modules').update({ order_index: m.order_index }).eq('id', m.id))
    )
  }

  if (loading) return <div className="page"><div className="loading-pulse">Loading…</div></div>

  return (
    <TeacherLayout
      title={course?.title ?? 'Course'}
      actions={
        <button className="t-btn t-btn-ghost" onClick={() => navigate('/teacher/courses')}>
          ← All courses
        </button>
      }
    >
      <StatusMessage type={status?.type} onDismiss={() => setStatus(null)}>
        {status?.msg}
      </StatusMessage>

      {/* Course details */}
      <div className="t-section">
        <h2 className="t-section-title">Course details</h2>
        <div className="t-detail-grid">
          <FormField label="Title">
            <InlineEdit
              value={course?.title ?? ''}
              onSave={v => handleCourseUpdate('title', v)}
              className="t-detail-inline"
            />
          </FormField>
          <FormField label="Description">
            <InlineEdit
              value={course?.description ?? ''}
              onSave={v => handleCourseUpdate('description', v)}
              placeholder="Add a description…"
              className="t-detail-inline"
            />
          </FormField>
        </div>
      </div>

      {/* Modules */}
      <div className="t-section">
        <div className="t-section-header">
          <h2 className="t-section-title">Modules</h2>
          <button className="t-btn t-btn-primary" onClick={handleAddModule}>
            + Add module
          </button>
        </div>

        {modules.length === 0 ? (
          <div className="t-empty">
            <p>No modules yet. Add one to start building the curriculum.</p>
          </div>
        ) : (
          <div className="t-list">
            {modules.map((mod, idx) => (
              <div key={mod.id} className="t-list-row">
                <div className="t-list-row-order">
                  <button
                    className="t-order-btn"
                    onClick={() => handleMoveModule(mod.id, -1)}
                    disabled={idx === 0}
                  >↑</button>
                  <button
                    className="t-order-btn"
                    onClick={() => handleMoveModule(mod.id, 1)}
                    disabled={idx === modules.length - 1}
                  >↓</button>
                </div>
                <div className="t-list-row-main">
                  <InlineEdit
                    value={mod.title}
                    onSave={title => handleRenameModule(mod.id, title)}
                    className="t-list-title"
                  />
                </div>
                <div className="t-list-row-actions">
                  <button
                    className="t-btn t-btn-ghost"
                    onClick={() => navigate(`/teacher/modules/${mod.id}`)}
                  >
                    Manage →
                  </button>
                  <ConfirmButton
                    className="t-btn t-btn-danger-ghost"
                    onConfirm={() => handleDeleteModule(mod.id)}
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
    </TeacherLayout>
  )
}
