# Doctor portrait update

Source: user-supplied Dr. James.jpg, Dr. Emerlinda.jpg, Dr. Christian.jpg and Dr. Mae.jpg.
Edited with the built-in image_gen tool. Each image used its corresponding supplied photo as the edit target.

Prompt set: preserve the original face, hair, expression, skin and clothing without beautification; change only the background to pale off-white with a subtle teal (#087f8c) wash; use consistent 4:5 framing; remove the existing poster lettering through cropping; no text, logos or specialty props. Specialty is accessible HTML text beside the portrait.

Final assets:
- images/doctors/james-estrada.png
- images/doctors/emerlinda-dijamco.png
- images/doctors/christian-cheng.png
- images/doctors/mae-tapispisan.png

The former images/james-raphael.jpg was removed. physician-profiles.json contains the supplied names and specialties. Startup updates matching legacy records while retaining their IDs, appointments and existing schedules; missing physicians are created without invented schedules. Inactive existing physicians remain inactive.

These changes are local until committed, pushed and successfully deployed to the authorized Railway service. The live database was not accessed or modified during preparation.
