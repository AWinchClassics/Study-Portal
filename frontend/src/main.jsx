import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './quiz.css'
import './teacher.css'
import './sidebar-randomiser.css'
import App from './App.jsx'

const basename = import.meta.env.PROD ? '/Study-Portal' : '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
