import ramoch from '../assets/images/ramoch.png'
import bant from '../assets/images/bant.png'
import './ProgramSection.css'

const PROGRAM_ITEMS = [
  {
    time: '11:00',
    title: 'ЦЕРЕМОНИЯ',
    description: 'Регистрация брака в кругу родственников',
    showSeparator: true
  },
  {
    time: '16:00',
    title: 'СБОР ГОСТЕЙ',
    description: 'Фуршет',
    showSeparator: true
  },
  {
    time: '17:00',
    title: 'БАНКЕТ',
    description: 'Поздравления и танцы!',
    showSeparator: true
  },
  {
    time: '22:00',
    title: 'ЗАВЕРШЕНИЕ ВЕЧЕРА',
    description: null,
    showSeparator: false
  }
]

export default function ProgramSection() {
  return (
    <section className="program-section">
      <div className="program-section__frame" style={{ backgroundImage: `url(${ramoch})` }}>
        <img src={bant} alt="" className="program-section__ribbon" aria-hidden />
        <div className="program-section__inner">
          <h2 className="program-section__title">Программа</h2>
          {PROGRAM_ITEMS.map((item) => (
            <div
              key={item.time}
              className={`program-section__item ${item.showSeparator ? 'program-section__item--border' : ''} ${item.time === '22:00' ? 'program-section__bakal-bg' : ''}`}
            >
              <div className="program-section__time">{item.time}</div>
              <div className="program-section__event-title">{item.title}</div>
              {item.description && (
                <div className="program-section__description">{item.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
