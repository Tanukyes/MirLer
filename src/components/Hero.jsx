import heroImage from '../assets/images/gpep.png'
import convertImage from '../assets/images/convert.png'
import liliImage from '../assets/images/lili.png'
import pearlImage from '../assets/images/pearl.png'
import ringsImage from '../assets/images/rings.png'
import './Hero.css'

export default function Hero() {
  return (
    <header className="hero">
      <div
        className="hero__bg"
        style={{ backgroundImage: `url(${heroImage})` }}
        aria-hidden
      />
      <div className="hero__decorations">
        <img src={convertImage} alt="" className="hero__decor hero__decor--convert" />
        <img src={liliImage} alt="" className="hero__decor hero__decor--lili" />
        <img src={pearlImage} alt="" className="hero__decor hero__decor--pearl1" />
        <img src={pearlImage} alt="" className="hero__decor hero__decor--pearl3" />
        <img src={ringsImage} alt="" className="hero__decor hero__decor--rings" />
      </div>
      <img src={pearlImage} alt="" className="hero__decor hero__decor--pearl2" />
      <div className="hero__content">
        <div className="hero__name hero__name--miroslav">
          Мирослав
        </div>
        <div className="hero__ampersand">
          &amp;
        </div>
        <div className="hero__name hero__name--valeria">
          Валерия
        </div>
        <div className="hero__text-block">
          <div className="hero__text-title">Дорогие гости!</div>
          <div className="hero__text-content">
            Один день в этом году станет для нас по-настоящему особенным. Мы хотим разделить его с самыми близкими и родными людьми. <br/>
            Приглашаем вас стать частью важного события - нашей свадьбы!
          </div>
        </div>
      </div>
    </header>
  )
}
