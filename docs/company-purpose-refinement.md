# Company purpose and frontend refinement

Source: owner-supplied mission, vision, values.jpeg (6 October 2026).

The homepage medical-team portrait section and the generic trust panel have been removed. The Doctors directory remains available. The replacement contains the supplied mission and vision, followed by Patient centered, Excellence, Innovative, Integrity and Collaborative values. Grammar and punctuation have been lightly corrected; the statements retain the source meaning and are presented as company purpose, not externally verified outcomes.

The section uses accessible HTML text, a dark existing-brand mission panel, white vision panel and numbered definition-list values. No poster image download, replacement logo, synthetic imagery, new medical service or credential was added. Footer links expose the new section from public pages.

Motion refinements: 16px one-time scroll reveals, 560ms duration, at most 100ms stagger, backwards animation fill to prevent the visible-delay/fade-start flash, requestAnimationFrame-coalesced header feedback, and immediate reveal completion when a user focuses or clicks content. Reduced-motion cancels animations. No scroll interception. Menus, service dialogs, details and controls receive restrained interaction feedback. Retired homepage component styles were removed.

No backend, API, database, authorization, appointment or environment changes. Booking remains closed until staff confirm schedules. Original logos and physician photos are unchanged.

Validation: existing unit/HTTP regression tests and the responsive browser suite; homepage assertions require no medical-team cards and all five values. Browser checks cover nine widths, physician filters, laboratory search/dialogs, booking fixtures, keyboard navigation, native scrolling and reduced motion. Screenshots reviewed before deployment. These checks do not claim a measured frame-rate benchmark.
