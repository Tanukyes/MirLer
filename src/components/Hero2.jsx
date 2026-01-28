import hero2Image from '../assets/images/ggpep.png'
import flowerWithNote from '../assets/images/55727.png'
import polaroidLeft from '../assets/images/55728.png'
import polaroidRight from '../assets/images/55729.png'
import photoLeft from '../assets/images/photo.png'
import photoRight from '../assets/images/secphoto.png'
import stars from '../assets/images/stars.png'
import './Hero2.css'

export default function Hero2() {
  return (
    <header className="hero2">
      <div
        className="hero2__bg"
        style={{ backgroundImage: `url(${hero2Image})` }}
        aria-hidden
      />
      <div className="hero2__content">
        {/* Left polaroid frame with photo */}
        <div className="hero2__polaroid hero2__polaroid--left">
          <img src={polaroidLeft} alt="" className="hero2__frame" />
          <img src={photoLeft} alt="" className="hero2__photo hero2__photo--left" />
        </div>
        
        {/* Right polaroid frame with photo */}
        <div className="hero2__polaroid hero2__polaroid--right">
          <img src={polaroidRight} alt="" className="hero2__frame" />
          <img src={photoRight} alt="" className="hero2__photo hero2__photo--right" />
        </div>
        
        {/* Stars decoration */}
        <img src={stars} alt="" className="hero2__stars" />
        
        {/* Dried flower with note at bottom left */}
        <img src={flowerWithNote} alt="" className="hero2__flower-note" />
      </div>
    </header>
  )
}
