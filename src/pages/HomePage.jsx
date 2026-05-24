import Hero from '../components/Hero'
import GoldDivider from '../components/GoldDivider'
import Hero2 from '../components/Hero2'
import SilverDivider from '../components/SilverDivider'
import CalendarSection from '../components/CalendarSection'
import VenueSection from '../components/VenueSection'
import ProgramSection from '../components/ProgramSection'
import DressCodeSection from '../components/DressCodeSection'
import GuestFormSection from '../components/GuestFormSection'
import PhotoTeaser from '../components/PhotoTeaser'
import ContactsSection from '../components/ContactsSection'
import Footer from '../components/Footer'

export default function HomePage() {
  return (
    <>
      <Hero />
      <GoldDivider />
      <Hero2 />
      <SilverDivider />
      <CalendarSection />
      <VenueSection />
      <ProgramSection />
      <DressCodeSection />
      <GuestFormSection />
      <SilverDivider />
      <PhotoTeaser />
      <ContactsSection />
      <Footer />
    </>
  )
}
