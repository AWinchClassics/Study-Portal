import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import CoursesPage from './pages/CoursesPage'
import ModulePage from './pages/ModulePage'
import UnitPage from './pages/UnitPage'
import ChunkPage from './pages/ChunkPage'
import QuizPage from './pages/QuizPage'

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/"                    element={<CoursesPage />} />
        <Route path="/modules/:courseId"   element={<ModulePage />} />
        <Route path="/units/:moduleId"     element={<UnitPage />} />
        <Route path="/chunks/:unitId"      element={<ChunkPage />} />
        <Route path="/quiz/:resourceId"    element={<QuizPage />} />
      </Routes>
    </>
  )
}

export default App
