# KFMC design adaptation

Reference reviewed on 6 October 2026: https://kfmc.com.au/ (live browser screenshot and computed typography).

The frontend adapts the reference's full-width photographic hero, inset dark navigation, colored headline panel, overlapping introduction, alternating image/text composition, solid service tiles and broad appointment banner. Brilliant Healthcare's existing logo, teal/green palette, original clinic photo, company statements and contact content are retained. KFMC photographs, logo, clinical claims and appointment functionality were not imported.

Scope: index.html layout; production.css shared public-page presentation; stylesheet cache version in index.html, doctors.html, services.html, patient-information.html, appointments.html and privacy.html. No JavaScript, backend, API, database, credentials, environment or appointment behavior changed. The staff portal retains its current interface. The homepage medical-team section remains removed and the company logo watermark remains in supporting sections. Booking remains closed pending schedule confirmation.

Verification: 32 automated tests and 54 responsive browser checks across 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px. Existing directory, service search/dialog, booking fixture, keyboard, native-scroll and reduced-motion checks passed. Desktop and mobile screenshots reviewed. Official logo hashes unchanged.
