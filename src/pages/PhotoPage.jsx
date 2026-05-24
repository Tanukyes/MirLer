import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PhotoSection from './PhotoSection'
import './PhotoPage.css'

export default function PhotoPage() {
  const navigate = useNavigate()

  // Сбрасываем скролл при входе на страницу
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="photo-page">
      <button
        className="photo-page__back"
        onClick={() => navigate('/')}
        aria-label="Назад на главную"
      >
        ← На главную
      </button>

      <PhotoSection />
    </div>
  )
}
