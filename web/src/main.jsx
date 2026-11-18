import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { captureDriveReturn } from './lib/driveLink'

// Before the router reads the address: if Google has just sent the user back
// from connecting Drive, take its one-time code out of the address bar and
// open Settings, where the result is shown.
captureDriveReturn()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
