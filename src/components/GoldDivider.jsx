import goldImage from '../assets/images/gold.png'
import './GoldDivider.css'

export default function GoldDivider() {
  return (
    <>
      <section className="gold-divider" aria-hidden>
        <img
          src={goldImage}
          alt=""
          className="gold-divider__img"
          loading="lazy"
          decoding="async"
        />
      </section>
      <div className="gold-divider__text-container">
        <div className="gold-divider__title">Wedding day!</div>
        <div className="gold-divider__date">08.07.2026</div>
      </div>
    </>
  )
}
