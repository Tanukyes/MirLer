import { useState } from 'react'
import placeImage from '../assets/images/place.png'
import './VenueSection.css'

const ADDRESS = 'Московская область, Видное, Школьная улица, 79А'
const encodedAddress = encodeURIComponent(ADDRESS)

const MAP_LINKS = {
  yandex: `https://yandex.ru/maps/213/moscow/?ll=37.652214%2C55.769688&mode=routes&rtext=~55.551975%2C37.692645&rtt=auto&ruri=~ymapsbm1%3A%2F%2Fgeo%3Fdata%3DCgg1NjYyMzk3MhKUAdCg0L7RgdGB0LjRjywg0JzQvtGB0LrQvtCy0YHQutCw0Y8g0L7QsdC70LDRgdGC0YwsINCb0LXQvdC40L3RgdC60LjQuSDQs9C-0YDQvtC00YHQutC-0Lkg0L7QutGA0YPQsywg0JLQuNC00L3QvtC1LCDQqNC60L7Qu9GM0L3QsNGPINGD0LvQuNGG0LAsIDc50JAiCg1FxRZCFTk1XkI%2C&z=14`,
  google: `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
  apple: `http://maps.apple.com/?q=${encodedAddress}&daddr=${encodedAddress}`,
  '2gis': `https://2gis.ru/search/${encodedAddress}`
}

const MAP_APPS = [
  { id: 'yandex', name: 'Яндекс Карты', url: MAP_LINKS.yandex, icon: 'Я', color: '#fc3f1d' },
  { id: 'google', name: 'Google Maps', url: MAP_LINKS.google, icon: 'G', color: '#4285F4' },
  { id: '2gis', name: '2GIS', url: MAP_LINKS['2gis'], icon: '2', color: '#2e7cf6' },
  { id: 'apple', name: 'Apple Maps', url: MAP_LINKS.apple, icon: 'M', color: '#555' }
]

export default function VenueSection() {
  const [showMapPanel, setShowMapPanel] = useState(false)

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 768

  const handleRouteClick = (e) => {
    e.preventDefault()
    if (isMobile()) {
      setShowMapPanel(true)
    } else {
      window.open(MAP_LINKS.yandex, '_blank')
    }
  }

  const handleMapAppClick = (url) => {
    window.open(url, '_blank')
    setShowMapPanel(false)
  }

  return (
    <section className="venue-section">
      <div className="venue-section__container">
        <div className="venue-section__header">
          <h2 className="venue-section__title">Место проведения</h2>
          <div className="venue-section__restaurant-wrap">
            <a
              href="https://palmira-garden.com/banquet/"
              target="_blank"
              rel="noopener noreferrer"
              className="venue-section__restaurant"
              aria-label='Открыть сайт ресторана "Семейные традиции" (откроется в новой вкладке)'
            >
              <span className="venue-section__restaurant-label">Ресторан "Семейные традиции"</span>
              <span className="venue-section__restaurant-icon" aria-hidden>
                ↗
              </span>
            </a>
            <div className="venue-section__restaurant-hint">Нажмите, чтобы открыть сайт</div>
          </div>
        </div>
        <div className="venue-section__image-wrapper">
          <img
            src={placeImage}
            alt="Ресторан Семейные традиции"
            className="venue-section__image"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="venue-section__address">
          <p className="venue-section__address-text">
            Будем ждать вас по адресу: Видное, Школьная улица, 79А.
          </p>
        </div>
        <div className="venue-section__link">
          <button 
            onClick={handleRouteClick}
            className="venue-section__link-text"
          >
            Построить маршрут
          </button>
        </div>
      </div>

      {showMapPanel && (
        <div 
          className="venue-section__map-overlay"
          onClick={() => setShowMapPanel(false)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setShowMapPanel(false)}
          aria-label="Закрыть выбор карты"
        >
          <div 
            className="venue-section__map-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="venue-section__map-panel-title">Построить маршрут</h3>
            <p className="venue-section__map-panel-address">{ADDRESS}</p>
            <div className="venue-section__map-apps">
              {MAP_APPS.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  className="venue-section__map-app-btn"
                  onClick={() => handleMapAppClick(app.url)}
                  style={{ '--app-color': app.color }}
                >
                  <span className="venue-section__map-app-icon">{app.icon}</span>
                  <span className="venue-section__map-app-name">{app.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="venue-section__map-panel-close"
              onClick={() => setShowMapPanel(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
