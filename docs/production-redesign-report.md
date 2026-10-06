# Production audit and redesign

Audit baseline: commit 21a91a7, 6 October 2026. Technology: static HTML/CSS/JavaScript, Express 4, PostgreSQL/Supabase, Railway, Cloudflare. Work branch: professional-ui-redesign.

## Issues recorded before implementation

Critical: no confirmed unauthenticated patient-data exposure. Live protected reads returned 401; all production public pages and database-aware health endpoint returned 200.

High:
- Current portrait PNGs are AI-edited derivatives. Original supplied photographs exist and must be used for identity fidelity.
- Every public page embeds a hidden appointment form, stale provider example and retired sections; unrelated pages fetch the physician API.
- Startup resets physician biography/name/photo on every restart, overriding staff edits.
- Doctor creation/update acquire a connection outside Express 4 error handling; a rejected connection can escape request handling.
- Asynchronous slot requests can finish out of order, exposing times belonging to an earlier physician/date selection.
- Portal sample button invents qualifications and assigns James the wrong specialty.
- UI promises SMS delivery without checking whether the provider is configured.
- PostgreSQL SSL verification is disabled when DATABASE_CA_CERT is absent. Do not change production credentials or break connectivity; obtain the project CA certificate to enable verification.

Medium:
- Booking is intentionally hidden by launch CSS. Live James schedules originated in an old seed; three other physicians have no published hours. Require staff confirmation before opening booking.
- Raw startup/scheduler error messages can expose operational connection/provider details.
- Nine overlapping public stylesheets, tiny metadata, large photographic hero, inconsistent palette overrides, and large PNG portraits.
- Unknown providers receive a generic doctor face, and known portraits are selected by fuzzy name matching.
- Hidden unverifiable testimonials and stock/synthetic staff imagery remain in public HTML.
- Booking date limits use UTC rather than Philippine clinic time; selected calendar/time states rely too heavily on color.
- Staff photo URL field rejects the local /images paths used by the application.

Low/UI/UX:
- Same generic meta description on every page; no Open Graph/favicons on public pages.
- Duplicated preparation/CTA sections, provider mosaic hero, unnecessary hover movement and excessive spacing.
- Administrative screens have small labels and a decorative blocking loading overlay.

## Live comparison

Live HTML differs from source because Cloudflare rewrites email links and injects its email-protection script. Portal source matches after newline normalization. Re-check actual content and assets after deployment; a hash difference alone is not evidence of stale deployment.

## Preserved constraints

Official logo files unchanged. Existing brand colors: #008ba3, #55a546, #173f43; existing accessible shade #006f83. Canonical hostname remains bhcopc.com. Do not reattach www.bhcopc.com. No framework migration, secrets, patient records, schedule invention or clinical claims. Test booking/admin workflows using isolated fixtures only.

## Implemented results (27 requested categories)

1. **Critical:** npm audit identified a critical proxy-addr advisory. Compatible dependency updates resolved it; no forced major upgrade. No unauthenticated patient-data exposure was observed in the read-only live checks.
2. **High priority:** Original portrait fidelity, startup overwrites, unhandled doctor connection failures, stale time-slot responses, invented portal template credentials and misleading SMS promises were corrected. Database TLS certificate verification still requires the correct project certificate.
3. **Functional:** Booking requests abort obsolete slot loads, reject malformed schedules, show persistent validation/status messages and recover from failures. Admin photo input accepts existing local paths; logout clears displayed appointment/staff data. Connection failures remain handled by Express.
4. **Deployment:** Exact Railway project/service is used, canonical URLs use bhcopc.com and www remains removed. Cloudflare email rewriting explains source/live HTML differences. No hosting/framework migration.
5. **Security:** Patched production dependencies, redacted operational error logging, retained session authentication, CSRF, permissions, request limits and protected static-file allowlist. Booking closure is enforced server-side. Verified logo hashes match the baseline.
6. **UI/UX:** Consistent navigation, concise headings, readable body text, restrained borders, shared spacing, clear clinic telephone actions and simpler staff forms.
7. **Template elements removed:** Hidden demo testimonials, duplicated appointment forms, synthetic staff imagery, decorative motion, oversized hero, overlapping public CSS imports and fabricated physician template.
8. **Homepage:** Authentic facility photograph, concise introduction, dialysis/laboratory links, compact categories, approved featured doctors, preparation and contact sections.
9. **Doctors:** Three-column desktop directory, readable names/specialties, accessible profile details and telephone availability. Unconfirmed seeded schedules are not presented as verified clinic hours.
10. **Duplicate images:** No shared image identity among the four approved physicians. Dynamic rendering rejects another approved physician's portrait for an unrelated name. James Raphael is a legacy alias of James Estrada, not a fifth provider.
11. **Missing photographs:** None among the four supplied physicians. Unknown/missing images use branded initials rather than a fictional face.
12. **Exact paths:** James Estrada: /images/doctors/james-estrada.jpg (Diabetologist); Emerlinda Dijamco: /images/doctors/emerlinda-dijamco.jpg (General Physician); Christian Cheng: /images/doctors/christian-cheng.jpg (Nephrologist); Mae Tapispisan: /images/doctors/mae-tapispisan.jpg (Nephrologist).
13. **Optimization:** Original photographs cropped above poster lettering, resized to 640x800 and JPEG compressed. Total production portrait bytes: 189378. Originals retained privately in assets/physicians/originals; no AI face edits. Old PNG derivatives are unused archives.
14. **Manual replacement:** None required for the four approved photographs. Future physicians require their own approved image or initials placeholder.
15. **Appointment flow:** Owner confirmed booking must remain closed until schedules are verified. API and UI enforce closure; existing field names and pending-confirmation process remain. Isolated tests exercise doctor/service/date/time, consent, submission, duplicate prevention, failure recovery and delayed slot responses.
16. **Accessibility:** Visible focus, skip link, keyboard navigation, dialog focus trapping/restoration, labelled controls, inline errors, live status, disabled/unavailable text and selected state indicators. This is functional verification, not a formal accessibility certification.
17. **Responsive:** 42 page checks across 320, 375, 430, 768, 1024, 1280 and 1440 pixels passed. Mobile navigation, readable forms and directory grids verified without horizontal overflow. Logged-in portal visual review remains a manual check; API role tests passed.
18. **Performance:** One public stylesheet, no external font dependency, lazy directory photographs, 36-57 KB production portraits and removed unused page markup. No invented Lighthouse score or production load-time measurement.
19. **SEO:** Individual titles/descriptions, apex canonical URLs, Open Graph facility image, official favicon and semantic content. Portal noindex retained.
20. **Exact files:** See the file inventory below.
21. **Backend:** server.js, database.js and sms-reminders.js; compatible runtime dependency lock updates. Existing Express/PostgreSQL architecture retained.
22. **API:** Additive GET /api/booking-status exposes only enabled/smsEnabled booleans. POST /api/appointments returns 503 while closed. Existing payload contracts retained. Successful booking text correctly describes pending clinic confirmation instead of promising SMS.
23. **Database:** No schema migration or destructive data operation. Startup upgrades recognized legacy PNG paths and legacy James name while retaining IDs, schedules, appointments, inactive state and staff-edited profile fields. Missing known providers are created without invented hours.
24. **Environment:** Keep PUBLIC_BOOKING_ENABLED=false (literal string; default false). Only change to true after staff approval, then redeploy. DATABASE_CA_CERT accepts the correct Supabase project CA PEM, with real newlines or literal \n; obtain it from the project's database SSL configuration or Supabase support, set it in this Railway service and redeploy to enable certificate verification. Do not substitute a guessed certificate. Existing DATABASE_URL, SECURITY_PEPPER and admin credentials remain private. SEMAPHORE_API_KEY and optional approved SEMAPHORE_SENDER_NAME come from the clinic's Semaphore account; redeploy after changes. Do not put credentials in GitHub.
25. **Railway/Cloudflare manual changes:** None needed for the existing apex domain. Keep www detached as requested. Configure the correct database CA certificate when available. No DNS or proxy changes should be guessed.
26. **Known issues:** Clinic hours require confirmation; missing credentials must be verified, not invented. TLS verification without CA remains a documented gap. SMS delivery and advisory-lock behavior with transaction pooling need an isolated provider/database review before relying on exactly-once reminders. Existing service catalogue and contact/hours are preserved, not independently clinically certified.
27. **Manual verification:** Staff should verify all physician schedules/credentials, laboratory preparation instructions, real location/contact/hours, privacy retention policy, logged-in portal usability and optional SMS delivery. No real patient submission, authenticated live patient record read or live SMS was used during testing.

## Before -> after

| Area | Before | After |
| --- | --- | --- |
| Homepage | Tall hero and duplicated template sections | Compact facility hero and ordered clinic information |
| Navigation | Layered styling and competing actions | Consistent clinic links and telephone action |
| Doctors | Large derivative portraits and fuzzy matching | Original approved JPEGs, exact identity mapping, clear specialties |
| Appointments | CSS-hidden form and stale asynchronous slots | Server-enforced closure, preserved tested workflow for later reopening |
| Admin | Invented physician template and tiny labels | Verified-only guidance, readable controls and cleared logout state |
| Mobile | Inconsistent layouts | Seven widths tested, stable menu and single-column cards |

## Validation

32 automated tests passed; 42 responsive browser page checks passed, alongside directory error/retry/empty/malformed/timeout, modal focus, navigation and fixture-only booking scenarios. Logo SHA-256 hashes unchanged. Screenshots were reviewed locally. Live checks are limited to public content, health, booking closure and unauthenticated protected-route rejection; they do not certify every production staff operation.

## File inventory
- .env.example
- admin.css
- appointments.html
- assets/physicians/originals/christian-cheng.jpg
- assets/physicians/originals/emerlinda-dijamco.jpg
- assets/physicians/originals/james-estrada.jpg
- assets/physicians/originals/mae-tapispisan.jpg
- booking.js
- database.js
- docs/production-redesign-report.md
- doctors.html
- doctors-directory.js
- images/doctors/christian-cheng.jpg
- images/doctors/emerlinda-dijamco.jpg
- images/doctors/james-estrada.jpg
- images/doctors/mae-tapispisan.jpg
- images/doctors/README.md
- index.html
- package-lock.json
- patient-information.html
- physician-profiles.json
- portal.html
- portal.js
- privacy.html
- production.css
- README.md
- script.js
- scripts/verify-public-browser.js
- server.js
- services.html
- sms-reminders.js
- tests/fixtures/operational-server.js
- tests/fixtures/public-server.js
- tests/operational-http.test.js
- tests/physician-refresh.test.js
- tests/public-http.test.js
- tests/public-site.test.js
