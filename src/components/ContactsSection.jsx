import './ContactsSection.css'

export default function ContactsSection() {
  return (
    <section className="contacts-section">
      <div className="contacts-section__container">
        <div className="contacts-section__header">
          <h2 className="contacts-section__title">Контакты</h2>
        </div>
        <div className="contacts-section__intro">
          <p className="contacts-section__text">
            Если у вас остались какие-то вопросы,
            <br />
            вы всегда можете нам позвонить!
          </p>
        </div>
        <div className="contacts-section__blocks">
          <div className="contacts-section__block">
            <div className="contacts-section__name">Мирослав</div>
            <a href="tel:+79154650909" className="contacts-section__phone">8 (915) 465-09-09</a>
          </div>
          <div className="contacts-section__divider" aria-hidden />
          <div className="contacts-section__block">
            <div className="contacts-section__name">Валерия</div>
            <a href="tel:+79251573566" className="contacts-section__phone">8 (925) 157-35-66</a>
          </div>
        </div>
      </div>
    </section>
  )
}
