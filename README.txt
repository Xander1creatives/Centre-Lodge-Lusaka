CENTER LODGE WEBSITE  (layout after Aurum Residences)
=====================================================
Files: index.html, instyles.css, inscript.js, images/

1) Contact details: open inscript.js and fill in CONFIG at the top
   (WhatsApp number, phone, email, address). The reservation section, the
   contact form and the WhatsApp button work from those values.

2) Photos (optional). Put JPGs in the images/ folder with these names.
   Until a photo exists, a coloured scene with an animated icon shows.
   slide-1.jpg ... slide-6.jpg      wide hero photos (landscape, ~1920x900)
   service-1.jpg ... service-6.jpg  service cards (rooms, restaurant, conference, wedding, kitchen party, corporate)
   gallery-1.jpg ... gallery-6.jpg  gallery

3) Icons are inline SVG animated with CSS (see ICONS in inscript.js and
   the "ANIMATED ICONS" block in instyles.css). No emoji or icon fonts used.


------------------------------------------------------------
HOME PAGE PHOTOS NEEDED (added in this update)
------------------------------------------------------------
This update reorganised the home page (About moved up, a cover band, three narration blocks, a
gallery lightbox, and clickable Services/Rooms cards that each open a detail view with 4 photos).
No real photos came with this update's upload, so every new photo slot below is showing the usual
gradient placeholder until you add a file at that exact name in Center_Lodge/images/. Nothing breaks
in the meantime — every slot was built the same way as the existing room photos: it quietly falls
back to a plain colour panel if the file isn't there yet.

 Cover band (full-width photo behind "A Stay to Remember"):
   images/cover.jpg            ideally wide, at least 1600x700

 Story photo (next to "More Than a Place to Stay", after the gallery):
   images/story.jpg            square, at least 1200x1200

 Gallery (6 tiles, click any one to view it large with next/previous):
   images/gallery-accommodation.jpg
   images/gallery-restaurant.jpg
   images/gallery-conference.jpg
   images/gallery-wedding.jpg
   images/gallery-kitchen-party.jpg
   images/gallery-corporate.jpg

 Services - clicking a card now opens its name, description and 4 photos. Each service needs 4 files
 (square, at least 1200x1200), numbered 1 to 4, e.g. for Accommodation:
   images/service-accommodation-1.jpg
   images/service-accommodation-2.jpg
   images/service-accommodation-3.jpg
   images/service-accommodation-4.jpg
 The other five follow the same -1.jpg to -4.jpg pattern with these names:
   service-restaurant-, service-conference-, service-wedding-, service-kitchen-party-, service-corporate-events-

 Rooms - clicking a room card now opens its name, price, description and 4 photos. Same pattern, square,
 at least 1200x1200:
   images/room-standard-1.jpg  to  room-standard-4.jpg
   images/room-deluxe-1.jpg    to  room-deluxe-4.jpg
   images/room-twin-1.jpg      to  room-twin-4.jpg
   images/room-royal-1.jpg     to  room-royal-4.jpg
 (This replaces the single room-<name>.jpg used before this update - the card and the first detail
 photo now both use the -1.jpg file, so if you already added single room photos, rename them to
 add "-1" before the .jpg.)

Nothing else needs renaming. The hero slider keeps using hero-1.webp, hero-2.webp, hero-3.webp as before.


------------------------------------------------------------
CONSOLIDATED BUILD NOTES
------------------------------------------------------------
- Web3Forms key, phone, WhatsApp (260971070411), email, address and social links are all in site-settings.js.
  Replace the social URLs marked TODO with your real pages. Leave one empty to hide that icon.
- Homepage enquiry + reservation-request forms, and booking emails, all send through Web3Forms (js/mailer.js)
  and show a custom success popup (js/popup.js).
- css/extras.css + js/extras.js: contact cards, social hover effects, "More Than a Place to Stay" image viewer,
  back-to-top button. The WhatsApp pulse button is the existing #waFloat in instyles.css.
- Until you add the new .jpg photos listed above, the older .webp photos are used as fallbacks.
