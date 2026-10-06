# Visual impact and motion refinement

6 October 2026. Baseline: 4e267b6. Branch: visual-impact-motion. Existing static HTML/CSS/JavaScript, Express and PostgreSQL architecture retained.

## Audit and implemented results

1. **Major issues:** Homepage portraits were only 96px thumbnails; sections had little variation; immediate patient shortcuts were absent; physician discovery lacked name/specialty controls. Functional regression checks found no new backend defect requiring modification.
2. **Functional fixes:** Featured profile links now target the corresponding directory card. Client-side name/specialty filtering includes an explicit empty state and reset. No invented availability filters.
3. **UI/UX:** Stronger hierarchy, photography, patient action strip, differentiated section rhythm, dark existing-brand information section and clearer directory discovery.
4. **Homepage:** Larger authentic reception photograph, 34-54px responsive heading, prominent telephone appointment action and Find a Doctor link. Four quick actions lead to doctors, appointment information, services and contact.
5. **Visual impact:** Full 4:5 featured physician portraits replace thumbnails. Photography, white space and the existing darkest brand color provide contrast without synthetic imagery or decorative shapes.
6. **Reference principles:** Reviewed St. Luke's physician discovery, Makati Medical Center patient online services, The Medical City doctor/service actions and Asian Hospital organized institutional content. These informed patient task priority and information hierarchy only; no assets, branding, copy or components were copied. Makati's direct page fetch timed out; its current indexed homepage and service page supported the review.
7. **Motion:** Native scrolling, passive header state listener, one-time IntersectionObserver reveals using Web Animations, 24px movement, 620ms duration and at most 140ms stagger. Subtle portrait hover zoom and button feedback. No animation dependency, parallax, snap or wheel interception. Content is visible by default. Reduced-motion cancels active reveals and disables transforms/transitions; unsupported browsers retain fully visible content.
8. **Doctors:** Existing 3/2/1 directory layout retained, improved title rhythm, physician name/specialty filters, unique approved portraits and direct profile anchors. A linked physician's details open after the latest directory loads. Staff confirmation remains necessary for schedules.
9. **Duplicates:** Four production paths and four distinct SHA-256 hashes. No duplicate portrait identity discovered. James Raphael remains an alias of James Estrada. Existing unrelated-identity portrait rejection and initials fallback retained.
10. **Replacement needs:** None for the four approved doctors. Unknown/new doctors require their own approved photo or the initials placeholder.
11. **Services:** Stronger two-column institutional service summary, border hierarchy and existing laboratory category links; no services, prices or preparation instructions invented. Full searchable laboratory catalogue and modal behavior retained.
12. **Appointments:** Telephone action remains primary because the owner explicitly requires booking closed until schedules are confirmed. Quick action leads to accurate appointment information, not a misleading open-booking promise. Existing tested form and server gate unchanged.
13. **Navigation:** Sticky white institutional header, subtle scrolled border and retained accessible mobile menu. No header-height animation or induced layout shift. Staff sign-in remains secondary in the footer.
14. **Accessibility:** Existing labels, focus indicators, dialog focus behavior and touch targets retained. Filters have visible labels and live status. Reduced-motion is honored; animations never hold content hidden waiting for JavaScript.
15. **Responsive:** Tested 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px: 54 page/width checks. Quick actions become two columns, physician cards one column on mobile, clinic information stacks. No observed horizontal overflow.
16. **Performance:** No new image downloads or font/motion framework. Existing optimized 36-57KB portraits and original reception photo reused; lazy portraits retained. Observer disconnects each revealed element. Only opacity/transform animate. Smooth behavior was functionally checked, not quantitatively certified as a frame-rate benchmark.
17. **Exact files:** Inventory below.
18. **Backend:** None modified in this refinement. No API contract, authentication, authorization, booking logic or Railway architecture changes.
19. **Database:** None. No migration, schedule mutation or patient-data operation.
20. **Environment:** No new variable needed. Existing PUBLIC_BOOKING_ENABLED remains false/default closed. Existing Supabase CA certificate follow-up remains documented in the earlier production audit.
21. **Manual work:** Staff must confirm physician schedules and missing credentials before reopening booking. Verify clinic contact/hours and laboratory guidance. Real patient submissions, live authenticated patient-data operations and live SMS are intentionally not used as test data. Logged-in staff visual review and formal accessibility/performance certification remain manual checks.

## Reference sources

- https://www.stlukes.com.ph/ — prominent physician discovery and institutional hierarchy.
- https://www.makatimed.net.ph/ and https://www.makatimed.net.ph/services/ — patient online services and service discovery.
- https://www.themedicalcity.com/ — direct Find a Doctor/Find a Service actions and patient assistance.
- https://www.asianhospital.com/ — organized services and institutional content.

## Physician image audit

All four are original approved user photographs cropped previously to 640x800 (4:5), JPEG compressed, with unmodified sources archived in assets/physicians/originals. No new crop, retouch, face generation or replacement in this refinement. Production records were checked in the prior deployment and are rechecked after promotion.

| Doctor | Specialty | Production URL | Dimensions | Duplicate | Replacement |
| --- | --- | --- | --- | --- | --- |
| Dr. James Estrada | Diabetologist | /images/doctors/james-estrada.jpg | 640x800, 4:5 | No | None |
| Dr. Emerlinda Dijamco | General Physician | /images/doctors/emerlinda-dijamco.jpg | 640x800, 4:5 | No | None |
| Dr. Christian Cheng | Nephrologist | /images/doctors/christian-cheng.jpg | 640x800, 4:5 | No | None |
| Dr. Mae Tapispisan | Nephrologist | /images/doctors/mae-tapispisan.jpg | 640x800, 4:5 | No | None |

SHA-256:
- James: F062D7B9E2326F0F71AAD99052AB9D50FEAD9A649075F30CAD27B30CD59152A1
- Emerlinda: DCD259CC6A3780468956AE4C021933EC9561716107F493D4152AA74A6689F062
- Christian: 0466704B4664865D5260DE9ADF181247A3A87CEA9146D77AEBC8A48AB4D28D39
- Mae: 0523D3C8096DD364E77BEDF43DBEFEF1C3F33EBB350CD398A68484FA5CE063FC

Official logo hashes unchanged; palette remains #008ba3, #55a546 and #173f43, with existing accessible teal shade #006f83.

## Before -> after

| Area | Before | After |
| --- | --- | --- |
| Homepage | Small split hero and physician thumbnails | Larger facility hero, patient shortcuts, full portraits and contrasting clinic information |
| Doctors | Readable static directory | Searchable directory with specialty filter, direct profiles and subtle motion |
| Services | Plain side-by-side summaries | Stronger editorial hierarchy and intact laboratory discovery |
| Appointment | Closed booking with telephone assistance | Same safe closure, easier discovery from hero and shortcuts |
| Navigation | Static white header | Sticky white header with restrained scrolled feedback |
| Mobile | Seven widths checked | All nine requested widths checked, stacked portraits and two-column shortcuts |

## Verification

32 automated tests passed. Browser verification covers 54 responsive checks, directory retry/empty/malformed/timeout states, laboratory search, dialog focus, menu/skip link, fixture-only booking consent/validation/success/conflict/stale slots, native scrolling, reduced-motion cancellation and physician filters. Screenshots reviewed for homepage, services, doctors and patient information. No new browser exceptions observed.

## Exact file inventory
- appointments.html
- docs/visual-impact-report.md
- doctors.html
- doctors-directory.js
- index.html
- patient-information.html
- privacy.html
- production.css
- script.js
- scripts/verify-public-browser.js
- services.html
