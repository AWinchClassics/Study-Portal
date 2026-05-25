import { Routes, Route } from 'react-router-dom'
import { TeacherAuthProvider } from './context/TeacherAuthContext'
import NavBar from './components/NavBar'
import TeacherRoute from './components/teacher/TeacherRoute'

// Student pages
import CoursesPage   from './pages/CoursesPage'
import ModulePage    from './pages/ModulePage'
import UnitPage      from './pages/UnitPage'
import ChunkPage     from './pages/ChunkPage'
import QuizPage      from './pages/QuizPage'

// Teacher pages
import TeacherDashboard     from './pages/teacher/TeacherDashboard'
import TeacherCoursesPage   from './pages/teacher/TeacherCoursesPage'
import TeacherCoursePage    from './pages/teacher/TeacherCoursePage'
import TeacherModulePage    from './pages/teacher/TeacherModulePage'
import TeacherUnitPage      from './pages/teacher/TeacherUnitPage'
import TeacherChunkPage     from './pages/teacher/TeacherChunkPage'
import TeacherResourcesPage from './pages/teacher/TeacherResourcesPage'

// Shared layout wrapper for all student pages (adds NavBar)
function StudentLayout({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
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
      </Routes>
    </TeacherRoute>
  )
}

function App() {
  return (
    <TeacherAuthProvider>
      <Routes>
        {/* Student routes */}
        <Route path="/" element={<StudentLayout><CoursesPage /></StudentLayout>} />
        <Route path="/modules/:courseId" element={<StudentLayout><ModulePage /></StudentLayout>} />
        <Route path="/units/:moduleId"   element={<StudentLayout><UnitPage /></StudentLayout>} />
        <Route path="/chunks/:unitId"    element={<StudentLayout><ChunkPage /></StudentLayout>} />
        <Route path="/quiz/:resourceId"  element={<StudentLayout><QuizPage /></StudentLayout>} />

        {/* Teacher routes */}
        <Route path="/teacher/*" element={<TeacherSection />} />
      </Routes>
    </TeacherAuthProvider>
  )
}

export default App
