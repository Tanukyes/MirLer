import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PhotoSection from './PhotoSection'
import './PhotoPage.css'

export default function PhotoPage() {
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo(0, 0)

    // Главная страница принудительно использует width=1440,
    // поэтому при входе на /photos переключаем на мобильный viewport,
    // а при уходе — возвращаем обратно.
    const meta = document.querySelector('meta[name="viewport"]')
    const prev = meta ? meta.getAttribute('content') : null
    if (meta) {
      meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover')
    }
    return () => {
      if (meta && prev !== null) meta.setAttribute('content', prev)
    }
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
