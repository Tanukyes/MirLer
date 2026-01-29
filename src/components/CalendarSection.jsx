import calendarImage from '../assets/images/cal.png'
import heartIcon from '../assets/images/icon.png'
import './CalendarSection.css'

export default function CalendarSection() {
  return (
    <section className="calendar-section">
      <div className="calendar-section__container">
        <div className="calendar-section__header">
          <h2 className="calendar-section__title">Дата бракосочетания</h2>
        </div>
        <div className="calendar-section__calendar">
          <img src={calendarImage} alt="Календарь" className="calendar-section__calendar-img" loading="lazy" decoding="async" />
          <img src={heartIcon} alt="" className="calendar-section__heart" loading="lazy" decoding="async" />
        </div>
      </div>
    </section>
  )
}
