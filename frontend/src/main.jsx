import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './quiz.css'
import './teacher.css'
import App from './App.jsx'

// In production (GitHub Pages) React Router needs to know the app
// is mounted at /Study-Portal/ so it strips that prefix before matching routes.
// In development there is no prefix so basename is just '/'.
const basename = import.meta.env.PROD ? '/Study-Portal' : '/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
