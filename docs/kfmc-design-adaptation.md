# Patient-first public-site redesign

Kingston Foreshore Medical Centre is an information-hierarchy reference only. The redesign prioritizes booking access, physician information, services, opening hours, directions and practical visit preparation without reusing KFMC's branding, text, code or imagery.

The homepage now moves from a concise appointment-led hero and patient-action links through clinical services, an image-led BHCOPC introduction, named physicians, facility photography, visit preparation, appointment assistance and contact details. Existing BHCOPC logo and brand colors are retained; real clinic/building photographs and each physician's distinct approved portrait are used. Physician images keep a 4:5 crop with individual positioning. Missing or duplicate directory photos fall back to branded initials.

The booking workflow remains closed until clinic staff confirm schedules. Appointment links lead to the existing telephone-assistance page rather than suggesting that online booking is available. Hours, service descriptions, physician specialties and location/contact links use the information already held by the site.

Public pages share the refined production stylesheet and a small IntersectionObserver reveal script. Reveals run once, use native scrolling and are disabled for users who prefer reduced motion. The staff portal and booking/API behavior are unchanged.

Verification: `npm test` passes all 35 tests. `npm run test:browser` passes 54 responsive checks across 320–1920px widths, plus existing booking-state, directory-photo, laboratory search, navigation, keyboard, and reduced-motion checks. Official logo assets are unchanged.
