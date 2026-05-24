import { useNavigate } from 'react-router-dom'
import './PhotoTeaser.css'

export default function PhotoTeaser() {
  const navigate = useNavigate()

  return (
    <section className="phototeaser-section">
      <div className="phototeaser-section__container">
        <div className="phototeaser-section__bg" aria-hidden />

        <div className="phototeaser-section__content">
          <div className="phototeaser-section__header">
            <h2 className="phototeaser-section__title">Наши моменты</h2>
          </div>

          <div className="phototeaser-section__text-block">
            <p className="phototeaser-section__text">
              Хотим увидеть нашу свадьбу вашими глазами! ❤️
            </p>
          </div>

          <div className="phototeaser-section__action">
            <button
              type="button"
              className="phototeaser-section__btn"
              onClick={() => navigate('/photos')}
            >
              Добавить свое фото
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
