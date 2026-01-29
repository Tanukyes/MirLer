import pion from '../assets/images/pion.png'
import liliya from '../assets/images/liliya.png'
import mask from '../assets/images/mask.png'
import maskk from '../assets/images/maskk.png'
import maskkk from '../assets/images/maskkk.png'
import maskkkk from '../assets/images/maskkkk.png'
import './DressCodeSection.css'

const SWATCHES = [maskk, mask, maskkkk, maskkk]

export default function DressCodeSection() {
  return (
    <section className="dresscode-section">
      <h2 className="dresscode-section__title">Дресс-код</h2>
      <div className="dresscode-section__content">
        <img src={pion} alt="" className="dresscode-section__flower dresscode-section__flower--left" aria-hidden loading="lazy" decoding="async" />
        <div className="dresscode-section__text-block">
          <p className="dresscode-section__text">
            Нам будет очень приятно, если вы поддержите нашу цветовую палитру. Но помните, что для нас главное — ваше присутствие, поэтому ограничений нет.
            <br />
            Только маленькая просьбочка — давайте белый цвет оставим для невесты;)
          </p>
          <div className="dresscode-section__swatches">
            {SWATCHES.map((src, i) => (
              <div key={i} className="dresscode-section__swatch-wrap">
                <img src={src} alt="" className="dresscode-section__swatch" aria-hidden loading="lazy" decoding="async" />
              </div>
            ))}
          </div>
        </div>
        <img src={liliya} alt="" className="dresscode-section__flower dresscode-section__flower--right" aria-hidden loading="lazy" decoding="async" />
      </div>
    </section>
  )
}
