import { Routes, Route } from 'react-router-dom'
import { TeacherAuthProvider } from './context/TeacherAuthContext'
import Sidebar from './components/Sidebar'
import TeacherRoute from './components/teacher/TeacherRoute'

// Student pages
import CoursesPage    from './pages/CoursesPage'
import ModulePage     from './pages/ModulePage'
import UnitPage       from './pages/UnitPage'
import ChunkPage      from './pages/ChunkPage'
import QuizPage       from './pages/QuizPage'
import RandomiserPage from './pages/RandomiserPage'

// Teacher pages
import TeacherDashboard         from './pages/teacher/TeacherDashboard'
import TeacherCoursesPage       from './pages/teacher/TeacherCoursesPage'
import TeacherCoursePage        from './pages/teacher/TeacherCoursePage'
import TeacherModulePage        from './pages/teacher/TeacherModulePage'
import TeacherUnitPage          from './pages/teacher/TeacherUnitPage'
import TeacherChunkPage         from './pages/teacher/TeacherChunkPage'
import TeacherResourcesPage     from './pages/teacher/TeacherResourcesPage'
import TeacherRandomiserPage    from './pages/teacher/TeacherRandomiserPage'

// Student layout — sidebar + main content
function StudentLayout({ children }) {
  return (
    <div className="student-layout">
      <Sidebar />
      <main className="student-main">
        {children}
      </main>
    </div>
  )
}

// Teacher section — password protected, own sidebar layout
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
      </Routes>
    </TeacherRoute>
  )
}

function App() {
  return (
    <TeacherAuthProvider>
      <Routes>
        {/* Student routes — all wrapped in sidebar layout */}
        <Route path="/"                  element={<StudentLayout><CoursesPage /></StudentLayout>} />
        <Route path="/modules/:courseId" element={<StudentLayout><ModulePage /></StudentLayout>} />
        <Route path="/units/:moduleId"   element={<StudentLayout><UnitPage /></StudentLayout>} />
        <Route path="/chunks/:unitId"    element={<StudentLayout><ChunkPage /></StudentLayout>} />
        <Route path="/quiz/:resourceId"  element={<StudentLayout><QuizPage /></StudentLayout>} />
        <Route path="/randomiser"        element={<StudentLayout><RandomiserPage /></StudentLayout>} />

        {/* Teacher routes — no student sidebar, own layout */}
        <Route path="/teacher/*" element={<TeacherSection />} />
      </Routes>
    </TeacherAuthProvider>
  )
}

export default App
