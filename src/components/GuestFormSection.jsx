import { useState, useEffect, useRef } from 'react'
import cvet from '../assets/images/cvet.png'
import cvett from '../assets/images/cvett.png'
import bant from '../assets/images/bant.png'
import liliya from '../assets/images/liliya.png'
import './GuestFormSection.css'

const DRINKS = [
  'Красное сухое вино',
  'Красное полусладкое вино',
  'Белое сухое вино',
  'Белое полусладкое вино',
  'Вино игристое полусладкое',
  'Вино игристое полусухое',
  'Вино игристое брют',
  'Виски',
  'Коньяк',
  'Водка'
]

// URL веб-приложения Google Apps Script (см. инструкцию в GOOGLE_SHEET_SETUP.md)
const GOOGLE_SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_URL || ''

export default function GuestFormSection() {
  const [modalOpen, setModalOpen] = useState(false)
  const savedScrollY = useRef(0)
  const [name, setName] = useState('')
  const [attendance, setAttendance] = useState('')
  const [drinks, setDrinks] = useState([])
  const [submitStatus, setSubmitStatus] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openModal = () => {
    savedScrollY.current = window.scrollY
    setSubmitStatus(null)
    setName('')
    setAttendance('')
    setDrinks([])
    setModalOpen(true)
  }

  const toggleDrink = (drink) => {
    setDrinks((prev) =>
      prev.includes(drink) ? prev.filter((d) => d !== drink) : [...prev, drink]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!GOOGLE_SHEET_URL) {
      setSubmitStatus('error')
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(true)
    setSubmitStatus(null)
    try {
      const payload = JSON.stringify({
        name,
        attendance: attendance === 'yes' ? 'С радостью приду/придем!' : attendance === 'no' ? 'К сожалению не смогу быть' : '',
        drinks: drinks.join(', ')
      })
      // Content-Type: text/plain — без preflight (OPTIONS), иначе CORS блокирует запрос к Apps Script
      const res = await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
      })
      const ok = res.ok
      setSubmitStatus(ok ? 'success' : 'error')
      if (ok) setTimeout(() => setModalOpen(false), 1500)
    } catch (err) {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    if (modalOpen) {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${savedScrollY.current}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
    } else {
      const scrollY = savedScrollY.current
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, scrollY)
    }
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, savedScrollY.current)
    }
  }, [modalOpen])

  return (
    <section className="guestform-section">
      <div className="guestform-section__container">
        <div className="guestform-section__bg" aria-hidden />
        <img src={cvet} alt="" className="guestform-section__flower guestform-section__flower--left" aria-hidden />
        <img src={cvett} alt="" className="guestform-section__flower guestform-section__flower--right" aria-hidden />
        <div className="guestform-section__content">
          <div className="guestform-section__header">
            <h2 className="guestform-section__title">Анкета гостя</h2>
          </div>
          <div className="guestform-section__text-block">
            <p className="guestform-section__text">
              Пожалуйста, подтвердите свое присутствие и ответьте на несколько
              <br />
              важных вопросов
            </p>
          </div>
          <div className="guestform-section__action">
            <button
              type="button"
              className="guestform-section__btn"
              onClick={openModal}
            >
              Открыть опрос
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div
          className="guestform-modal-overlay"
          onClick={() => setModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Анкета гостя"
        >
          <div
            className="guestform-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="guestform-modal__bg" />
            <img src={bant} alt="" className="guestform-modal__bant" aria-hidden />
            <img src={liliya} alt="" className="guestform-modal__liliya" aria-hidden />

            <form id="guestform-form" className="guestform-modal__panel" onSubmit={handleSubmit}>
              <div className="guestform-modal__field">
                <label className="guestform-modal__label">Имя и фамилия:</label>
                <input
                  type="text"
                  className="guestform-modal__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="guestform-modal__field">
                <span className="guestform-modal__label">Подтвердите присутствие:</span>
                <label className="guestform-modal__checkbox-row">
                  <input
                    type="radio"
                    name="attendance"
                    value="yes"
                    className="guestform-modal__checkbox"
                    checked={attendance === 'yes'}
                    onChange={() => setAttendance('yes')}
                  />
                  <span>С радостью приду/придем!</span>
                </label>
                <label className="guestform-modal__checkbox-row">
                  <input
                    type="radio"
                    name="attendance"
                    value="no"
                    className="guestform-modal__checkbox"
                    checked={attendance === 'no'}
                    onChange={() => setAttendance('no')}
                  />
                  <span>К сожалению не смогу быть</span>
                </label>
              </div>
              <div className="guestform-modal__field">
                <span className="guestform-modal__label guestform-modal__label--drinks">Ваши предпочтения по напиткам:</span>
                <div className="guestform-modal__drinks-grid">
                  {DRINKS.map((drink) => (
                    <label key={drink} className="guestform-modal__checkbox-row">
                      <input
                        type="checkbox"
                        name="drink"
                        value={drink}
                        className="guestform-modal__checkbox"
                        checked={drinks.includes(drink)}
                        onChange={() => toggleDrink(drink)}
                      />
                      <span>{drink}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="guestform-modal__thanks">Спасибо!</p>
              {submitStatus === 'success' && (
                <p className="guestform-modal__status guestform-modal__status--success">Анкета отправлена!</p>
              )}
              {submitStatus === 'error' && (
                <p className="guestform-modal__status guestform-modal__status--error">
                  Не удалось отправить. Проверьте настройку Google Таблицы (см. GOOGLE_SHEET_SETUP.md).
                </p>
              )}
            </form>

            <button
              type="submit"
              form="guestform-form"
              className="guestform-modal__submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Отправка…' : 'Отправить'}
            </button>
            <p className="guestform-modal__footer-text">Очень ждем вас!</p>
            <p className="guestform-modal__footer-sign">С любовью М & В</p>

            <button
              type="button"
              className="guestform-modal__close"
              onClick={() => setModalOpen(false)}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
