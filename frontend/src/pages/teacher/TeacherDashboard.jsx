import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import TeacherLayout from '../../components/teacher/TeacherLayout'

export default function TeacherDashboard() {
  const [counts, setCounts] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchCounts() {
      const [courses, modules, units, chunks, resources] = await Promise.all([
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('modules').select('id', { count: 'exact', head: true }),
        supabase.from('units').select('id', { count: 'exact', head: true }),
        supabase.from('chunks').select('id', { count: 'exact', head: true }),
        supabase.from('resources').select('id', { count: 'exact', head: true }),
      ])
      setCounts({
        courses:   courses.count  ?? 0,
        modules:   modules.count  ?? 0,
        units:     units.count    ?? 0,
        chunks:    chunks.count   ?? 0,
        resources: resources.count ?? 0,
      })
    }
    fetchCounts()
  }, [])

  const stats = [
    { label: 'Courses',   value: counts?.courses,   to: '/teacher/courses',   icon: '📚' },
    { label: 'Modules',   value: counts?.modules,   to: '/teacher/courses',   icon: '📂' },
    { label: 'Units',     value: counts?.units,     to: '/teacher/courses',   icon: '📄' },
    { label: 'Chunks',    value: counts?.chunks,    to: '/teacher/courses',   icon: '🧩' },
    { label: 'Resources', value: counts?.resources, to: '/teacher/resources', icon: '📦' },
  ]

  return (
    <TeacherLayout title="Dashboard">
      <div className="t-dashboard">
        <p className="t-dashboard-intro">
          Welcome to the teacher dashboard. Use the sidebar to manage your curriculum structure and resource library.
        </p>

        <div className="t-stat-grid">
          {stats.map(s => (
            <button
              key={s.label}
              className="t-stat-card"
              onClick={() => navigate(s.to)}
            >
              <span className="t-stat-icon">{s.icon}</span>
              <span className="t-stat-value">
                {counts === null ? '—' : s.value}
              </span>
              <span className="t-stat-label">{s.label}</span>
            </button>
          ))}
        </div>

        <div className="t-quick-links">
          <h2 className="t-section-title">Quick actions</h2>
          <div className="t-quick-grid">
            <button className="t-quick-card" onClick={() => navigate('/teacher/courses')}>
              <span className="t-quick-icon">＋</span>
              <div>
                <div className="t-quick-title">Add a course</div>
                <div className="t-quick-sub">Create a new course and start building its modules</div>
              </div>
            </button>
            <button className="t-quick-card" onClick={() => navigate('/teacher/resources')}>
              <span className="t-quick-icon">＋</span>
              <div>
                <div className="t-quick-title">Add a resource</div>
                <div className="t-quick-sub">Upload a link, video, quiz or PDF to the resource library</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </TeacherLayout>
  )
}
