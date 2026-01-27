import hero2Image from '../../ggpep.png'
import './Hero2.css'

export default function Hero2() {
  return (
    <header className="hero2">
      <div
        className="hero2__bg"
        style={{ backgroundImage: `url(${hero2Image})` }}
        aria-hidden
      />
    </header>
  )
}
