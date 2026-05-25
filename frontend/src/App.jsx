import { Routes, Route } from 'react-router-dom'
import CoursesPage from './pages/CoursesPage'
import ModulePage from './pages/ModulePage'
import UnitPage from './pages/UnitPage'
import ChunkPage from './pages/ChunkPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<CoursesPage />} />
      <Route path="/modules/:courseId" element={<ModulePage />} />
      <Route path="/units/:moduleId" element={<UnitPage />} />
      <Route path="/chunks/:unitId" element={<ChunkPage />} />
    </Routes>
  )
}

export default App
