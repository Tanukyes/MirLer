import heart from '../assets/images/heart.png'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__initials-wrap">
          <p className="footer__initials">М&В</p>
        </div>
        <div className="footer__divider">
          <img src={heart} alt="" className="footer__heart" aria-hidden />
        </div>
        <div className="footer__text-wrap">
          <p className="footer__welcome">Очень ждем вас!</p>
          <p className="footer__date">08.07.2026</p>
        </div>
      </div>
    </footer>
  )
}
