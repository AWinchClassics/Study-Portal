import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import TeacherRoute from './components/teacher/TeacherRoute'
import CoursesPage         from './pages/CoursesPage'
import ModulePage          from './pages/ModulePage'
import UnitPage            from './pages/UnitPage'
import ChunkPage           from './pages/ChunkPage'
import QuizPage            from './pages/QuizPage'
import RandomiserPage      from './pages/RandomiserPage'
import FlashcardsPage      from './pages/FlashcardsPage'
import GlossaryPage        from './pages/GlossaryPage'
import TimelinesPage       from './pages/TimelinesPage'
import ResourcesPage       from './pages/ResourcesPage'
import SourcesPage         from './pages/SourcesPage'
import TeacherDashboard    from './pages/teacher/TeacherDashboard'
import TeacherCoursesPage  from './pages/teacher/TeacherCoursesPage'
import TeacherCoursePage   from './pages/teacher/TeacherCoursePage'
import TeacherModulePage   from './pages/teacher/TeacherModulePage'
import TeacherUnitPage     from './pages/teacher/TeacherUnitPage'
import TeacherChunkPage    from './pages/teacher/TeacherChunkPage'
import TeacherResourcesPage from './pages/teacher/TeacherResourcesPage'
import TeacherRandomiserPage from './pages/teacher/TeacherRandomiserPage'
import TeacherGlossaryPage  from './pages/teacher/TeacherGlossaryPage'
import TeacherTimelinesPage from './pages/teacher/TeacherTimelinesPage'
import TeacherSourcesPage  from './pages/teacher/TeacherSourcesPage'

function StudentLayout({ children }) {
  return (
    <div className="student-layout">
      <Sidebar /><main className="student-main">{children}</main>
    </div>
  )
}

function TeacherSection() {
  return (
    <TeacherRoute>
      <Routes>
        <Route path="/"                  element={<TeacherDashboard />} />
        <Route path="/courses"           element={<TeacherCoursesPage />} />
        <Route path="/courses/:courseId" element={<TeacherCoursePage />} />
        <Route path="/modules/:moduleId" element={<TeacherModulePage />} />
        <Route path="/units/:unitId"     element={<TeacherUnitPage />} />
        <Route path="/chunks/:chunkId"   element={<TeacherChunkPage />} />
        <Route path="/resources"         element={<TeacherResourcesPage />} />
        <Route path="/randomiser"        element={<TeacherRandomiserPage />} />
        <Route path="/glossary"          element={<TeacherGlossaryPage />} />
        <Route path="/timelines"         element={<TeacherTimelinesPage />} />
        <Route path="/sources"           element={<TeacherSourcesPage />} />
      </Routes>
    </TeacherRoute>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/"                  element={<StudentLayout><CoursesPage /></StudentLayout>} />
        <Route path="/modules/:courseId" element={<StudentLayout><ModulePage /></StudentLayout>} />
        <Route path="/units/:moduleId"   element={<StudentLayout><UnitPage /></StudentLayout>} />
        <Route path="/chunks/:unitId"    element={<StudentLayout><ChunkPage /></StudentLayout>} />
        <Route path="/quiz/:resourceId"  element={<StudentLayout><QuizPage /></StudentLayout>} />
        <Route path="/randomiser"        element={<StudentLayout><RandomiserPage /></StudentLayout>} />
        <Route path="/flashcards"        element={<StudentLayout><FlashcardsPage /></StudentLayout>} />
        <Route path="/glossary"          element={<StudentLayout><GlossaryPage /></StudentLayout>} />
        <Route path="/timelines"         element={<StudentLayout><TimelinesPage /></StudentLayout>} />
        <Route path="/resources"         element={<StudentLayout><ResourcesPage /></StudentLayout>} />
        <Route path="/sources"           element={<StudentLayout><SourcesPage /></StudentLayout>} />
        <Route path="/teacher/*"         element={<TeacherSection />} />
      </Routes>
    </AuthProvider>
  )
}
export default App
