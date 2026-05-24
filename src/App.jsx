import { Routes, Route } from 'react-router-dom'

import HomePage from './pages/HomePage'
import PhotoPage from './pages/PhotoPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/photos" element={<PhotoPage />} />
    </Routes>
  )
}
