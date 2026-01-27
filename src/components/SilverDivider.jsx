import silverImage from '../../silver.png'
import './SilverDivider.css'

export default function SilverDivider() {
  return (
    <section className="silver-divider" aria-hidden>
      <img
        src={silverImage}
        alt=""
        className="silver-divider__img"
      />
    </section>
  )
}
