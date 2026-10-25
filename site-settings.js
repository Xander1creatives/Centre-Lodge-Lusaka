/* =====================================================================
   CENTER LODGE - SITE SETTINGS   <-- edit this file for everything except Supabase
   =====================================================================
   Leave any value empty ('') to hide that item on the website.
   (Supabase URL and key live in supabase-config.js.)
   ===================================================================== */
window.CL_SITE = {

  /* Shown in "Contact us today", the footer, the map and on printed/PNG bookings */
  CONTACT: {
    phone:    '',     // e.g. '+260 97 123 4567'
    whatsapp: '',     // digits only with country code, e.g. '260971234567'
    email:    '',     // e.g. 'info@centerlodge.com'
    address:  '',     // e.g. 'Plot 12, Great East Road, Lusaka'
    mapQuery: ''      // optional: what to search on the map. Empty = use the address above.
  },

  /* Full web addresses (https://...). Only the ones you fill in get an icon. */
  SOCIAL: {
    facebook:  '',    // e.g. 'https://facebook.com/centerlodge'
    instagram: '',
    tiktok:    '',
    x:         '',
    youtube:   '',
    linkedin:  ''
  },

  /* Web3Forms: sends booking, payment and enquiry emails to the address you
     registered at web3forms.com. Paste your ACCESS KEY here (it is designed to be public). */
  WEB3FORMS_ACCESS_KEY: '',

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
