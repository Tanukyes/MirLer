import goldImage from '../../gold.png'
import './GoldDivider.css'

export default function GoldDivider() {
  return (
    <section className="gold-divider" aria-hidden>
      <img
        src={goldImage}
        alt=""
        className="gold-divider__img"
      />
    </section>
  )
}
