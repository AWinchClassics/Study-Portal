import { useEffect, useState } from 'react'

                  {course.archived && <span className="t-archived-badge">Archived</span>}
                </div>import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'
import { InlineEdit, ConfirmButton, StatusMessage } from '../../components/teacher/TeacherUI'

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { fetchCourses() }, [])

  async function fetchCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title, description')
      .order('title')
    if (!error) setCourses(data)
    setLoading(false)
  }

  async function handleCreate() {
    const { data, error } = await supabase
      .from('courses')
      .insert({ title: 'New Course', description: '' })
      .select()
      .single()
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setCourses(prev => [...prev, data])
    navigate(`/teacher/courses/${data.id}`)
  }

  async function handleRename(id, title) {
    const { error } = await supabase.from('courses').update({ title }).eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setCourses(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }

  async function handleArchive(id, archived) {
    await supabase.from('courses').update({ archived }).eq('id', id)
    setCourses(prev => prev.map(x => x.id === id ? { ...x, archived } : x))
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) { setStatus({ type: 'error', msg: error.message }); return }
    setCourses(prev => prev.filter(c => c.id !== id))
    setStatus({ type: 'success', msg: 'Course deleted.' })
  }

  return (
    <TeacherLayout
      title="Courses"
      actions={
        <button className="t-btn t-btn-primary" onClick={handleCreate}>
          + New course
        </button>
      }
    >
      <StatusMessage
        type={status?.type}
        onDismiss={() => setStatus(null)}
      >
        {status?.msg}
      </StatusMessage>

      {loading ? (
        <div className="loading-pulse">Loading…</div>
      ) : courses.length === 0 ? (
        <div className="t-empty">
          <p>No courses yet.</p>
          <button className="t-btn t-btn-primary" onClick={handleCreate}>
            Create your first course
          </button>
        </div>
      ) : (
        <div className="t-list">
          {courses.map(course => (
            <div key={course.id} className={`t-list-row t-list-row-nav ${course.archived ? "t-list-row-archived" : ""}`}
              onClick={() => navigate(`/teacher/courses/${course.id}`)}>
              <div className="t-list-row-main">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <InlineEdit
                    value={course.title}
                  onSave={title => handleRename(course.id, title)}
                  className="t-list-title"
                />
                {course.description && (
                  <span className="t-list-meta">{course.description}</span>
                )}
              </div>
              <div className="t-list-row-actions" onClick={e => e.stopPropagation()}>
                {course.archived
                  ? <button className="t-btn t-btn-ghost" onClick={() => handleArchive(course.id, false)}>↩ Restore</button>
                  : <button className="t-btn t-btn-secondary" onClick={() => handleArchive(course.id, true)}>🗄 Archive</button>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </TeacherLayout>
  )
}
