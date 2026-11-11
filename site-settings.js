/* =====================================================================
   CENTER LODGE - SITE SETTINGS   <-- edit this file for everything except Supabase
   =====================================================================
   Leave any value empty ('') to hide that item on the website.
   (Supabase URL and key live in supabase-config.js.)
   ===================================================================== */
window.CL_SITE = {

  /* Shown in "Contact us today", the footer, the map and on printed/PNG bookings */
  CONTACT: {
    phone:    '+26097 7754949',
    whatsapp: '+260 977754949',   // digits only with country code
    email:    'centrelodge.reservations@gmail.com',
    address:  'Kafue Road, Opp China Mall Lusaka ZM, 10101',
    mapQuery: 'https://maps.app.goo.gl/y9Cp5nToUNUKGxBw8'      // optional: what to search on the map. Empty = use the address above.
  },

  /* Full web addresses (https://...). Only the ones you fill in get an icon. */
  SOCIAL: {
    facebook:  'https://www.facebook.com/CenterLodge',   // TODO: replace with your real page
    instagram: 'https://www.instagram.com/centrelodge',  // TODO
    tiktok:    'https://www.tiktok.com/@centrelodge',     // TODO
    x:         '',
    youtube:   '',
    linkedin:  'https://www.linkedin.com/company/centrelodge'  // TODO
  },

  /* Web3Forms: sends booking, payment and enquiry emails to the address you
     registered at web3forms.com. Paste your ACCESS KEY here (it is designed to be public). */
  WEB3FORMS_ACCESS_KEY: 'd676428b-b875-4450-9d4d-16ea93df95b4',

  /* Lenco: your PUBLIC key only (starts with pub-...). The secret key NEVER goes in the website:
     it is stored inside Supabase (see README, step "Payments"). Leave empty to switch online payment off. */
  LENCO_PUBLIC_KEY: '',

  /* Shown to guests who choose "Prepayment by bank transfer" */
  BANK: {
    bankName:      '',
    accountName:   '',
    accountNumber: '',
    branch:        '',
    note:          ''   // e.g. 'Use your booking reference as the payment reference.'
  }
};
