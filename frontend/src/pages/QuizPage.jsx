import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import QuizRunner from '../components/QuizRunner'
import Breadcrumb from '../components/Breadcrumb'
import { useQuizAttempt } from '../hooks/useQuizAttempt'
import ActivityRunner from '../activities/ActivityRunner'
import { useActivityAttempt } from '../activities/useActivityAttempt'
import { isActivityResource } from '../activities/types'

export default function QuizPage() {
  const { resourceId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { saveAttempt } = useQuizAttempt()
  const { saveActivityAttempt } = useActivityAttempt()

  const [resource, setResource] = useState(null)
  const [questions, setQuestions] = useState(null)
  const [activityItems, setActivityItems] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [completed, setCompleted] = useState(false)
  const [lastScore, setLastScore] = useState(null)

  // The chunk page passes back navigation context via location.state
  // so the breadcrumb can show the full trail back
  const navState = location.state ?? {}
  const { unitId, unitTitle, moduleId, moduleTitle, courseId, courseTitle } = navState

  useEffect(() => {
    async function load() {
      // 1. Fetch the resource record from Supabase
      const { data: resourceData, error: resourceError } = await supabase
        .from('resources')
        .select('*')
        .eq('id', resourceId)
        .single()

      if (resourceError || !resourceData) {
        setLoadError('Could not load quiz resource.')
        return
      }

      setResource(resourceData)

      // 2a. Activity-backed quiz (tasks stored in Supabase tables)
      if (isActivityResource(resourceData)) {
        const { data: items, error: itemsError } = await supabase
          .from('activity_items')
          .select('*, mc_options(*)')
          .eq('resource_id', resourceId)
          .order('order_index')

        if (itemsError) {
          setLoadError(`Could not load quiz: ${itemsError.message}`)
          return
        }
        if (!items?.length) {
          setLoadError('This quiz has no questions yet.')
          return
        }
        setActivityItems(items.map(it => ({
          ...it,
          mc_options: [...(it.mc_options ?? [])].sort((a, b) => a.order_index - b.order_index),
        })))
        return
      }

      // 2b. Legacy: fetch the quiz JSON from the resource's url field

      try {
        const base = import.meta.env.PROD ? '/Study-Portal' : ''
		const res = await fetch(`${base}${resourceData.url}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        if (!data.questions || !data.questions.length) {
          setLoadError('This quiz file contains no questions.')
          return
        }

        setQuestions(data.questions)
      } catch (err) {
        setLoadError(`Could not load quiz file: ${err.message}`)
      }
    }

    load()
  }, [resourceId])

  async function handleComplete(score, total) {
    setLastScore({ score, total })
    setCompleted(true)
    await saveAttempt(resourceId, score, total)
  }

  async function handleActivityComplete(result) {
    setLastScore({ score: result.score, total: result.total })
    setCompleted(true)
    await saveActivityAttempt(resourceId, result)
  }

  function handleExit() {
    if (unitId) {
      navigate(`/chunks/${unitId}`)
    } else {
      navigate(-1)
    }
  }

  // ── Loading / error states ────────────────────────────────────
  if (loadError) {
    return (
      <div className="page">
        <p className="page-error">{loadError}</p>
        <button className="qr-btn qr-btn-secondary" onClick={handleExit}>
          ← Go back
        </button>
      </div>
    )
  }

  if (!questions && !activityItems) {
    return (
      <div className="page">
        <div className="loading-pulse">Loading quiz…</div>
      </div>
    )
  }

  // ── Breadcrumb items ─────────────────────────────────────────
  const breadcrumbItems = [
    { label: 'Courses', to: '/' },
    courseTitle  && { label: courseTitle,  to: `/modules/${courseId}` },
    moduleTitle  && { label: moduleTitle,  to: `/units/${moduleId}` },
    unitTitle    && { label: unitTitle,    to: `/chunks/${unitId}` },
    resource     && { label: resource.title },
  ].filter(Boolean)

  return (
    <div className="page quiz-page">
      <Breadcrumb items={breadcrumbItems} />

      {activityItems ? (
        <ActivityRunner
          items={activityItems}
          title={resource?.title ?? 'Quiz'}
          onComplete={handleActivityComplete}
          onExit={handleExit}
        />
      ) : (
        <QuizRunner
          questions={questions}
          title={resource?.title ?? 'Quiz'}
          onComplete={handleComplete}
          onExit={handleExit}
        />
      )}
    </div>
  )
}
