// All clinic facts and copy live here, so the site can be reused for another clinic.
export const CLINIC = {
  name: 'Family Dental & Aesthetic Clinic',
  short: 'Family Dental',
  city: 'Peshawar',
  tagline: 'Smiles for every generation',
  address: ['1st Floor, Al-Sayed Tower', 'Nasir Bagh Road, near Amal Labs', 'Malakandher, Peshawar'],
  phoneDisplay: '+92 333 9202134',
  phoneIntl: '923339202134',
  rating: '5.0',
  reviews: 93,
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Family+Dental+%26+Aesthetic+Clinic+Nasir+Bagh+Road+Peshawar',
  reviewsUrl: 'https://www.google.com/search?q=Family+Dental+%26+Aesthetic+Clinic+Peshawar+reviews',
  hoursNote: "Call or WhatsApp for today's timings.",
  instagram: 'https://www.instagram.com/familydentalclinicpeshawar/',
  dentist: { name: 'Dr. Tabassum Ajmal', role: 'Dentist and prosthodontist', initials: 'TA' },
};

// Real, consented cases only. Each item: { title, before, after, note }. The section stays hidden while empty.
export const BEFORE_AFTER = [];

// Public Google reviews quoted with the reviewer's name.
export const REVIEWS = [
  {
    text: 'The procedure was completely painless and precise. The staff made me feel relaxed throughout, and my tooth is now pain-free, strong, and fully functional.',
    name: 'Habib Ul Haq',
    detail: 'Root canal treatment, Google review',
  },
];

export const JOURNEY = [
  { title: 'Book on WhatsApp', text: 'Message the clinic or use the booking assistant on this page. The clinic replies to confirm a time that suits you.' },
  { title: 'Your check-up', text: 'The dentist examines your teeth and gums and listens to what is bothering you. If an X-ray is needed, you will be told why.' },
  { title: 'Your plan, explained', text: 'You hear what the problem is, the options to fix it, how long each takes and what it costs, before anything starts.' },
  { title: 'Treatment and follow-up', text: 'Treatment goes at a pace you are comfortable with, and the clinic checks that everything has settled afterwards.' },
];

export const waLink = (text = '') =>
  `https://wa.me/${CLINIC.phoneIntl}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const SERVICES = [
  { id: 'implant', name: 'Dental implants', short: 'Implants', desc: 'A titanium root and a custom crown that replace a missing tooth for the long term.', keys: ['implant'] },
  { id: 'rct', name: 'Root canal treatment', short: 'Root canal', desc: 'Remove infection from inside a tooth and save it from extraction.', keys: ['root canal', 'rct', 'canal', 'nerve'] },
  { id: 'crown', name: 'Crowns', short: 'Crowns', desc: 'A tooth-shaped cap that protects a cracked, heavily filled or weakened tooth.', keys: ['crown', 'cap'] },
  { id: 'veneer', name: 'Veneers', short: 'Veneers', desc: 'Thin porcelain or composite shells that fix chips, gaps and discolouration on front teeth.', keys: ['veneer', 'laminate'] },
  { id: 'whitening', name: 'Teeth whitening', short: 'Whitening', desc: 'Lift tea, coffee and smoking stains with a supervised whitening treatment.', keys: ['whiten', 'white', 'bleach', 'stain', 'yellow'] },
  { id: 'braces', name: 'Braces', short: 'Braces', desc: 'Straighten crowded or crooked teeth and correct the bite, gradually and gently.', keys: ['brace', 'align', 'crooked', 'straight'] },
  { id: 'filling', name: 'Fillings', short: 'Fillings', desc: 'Repair cavities with tooth-coloured fillings that blend in with your teeth.', keys: ['filling', 'cavity', 'cavities', 'hole', 'decay'] },
  { id: 'extraction', name: 'Tooth extraction', short: 'Extraction', desc: 'Careful removal of a tooth that cannot be saved, with clear aftercare advice.', keys: ['extract', 'remove', 'pull', 'wisdom'] },
  { id: 'denture', name: 'Complete dentures', short: 'Dentures', desc: 'A removable full set of teeth for a jaw that has lost all its teeth.', keys: ['denture', 'false teeth', 'complete denture'] },
  { id: 'partial', name: 'Removable partial dentures', short: 'Partial dentures', desc: 'Replace a few missing teeth with an appliance you take out to clean.', keys: ['partial', 'rpd'] },
];

export const GENERATIONS = [
  { id: 'kids', title: 'Children', text: "Gentle first visits, check-ups and fillings for milk teeth, so children grow up unafraid of the dentist.", services: ['Consultations', 'Fillings', 'Extraction when needed'], book: 'filling' },
  { id: 'teens', title: 'Teens', text: 'Braces that straighten teeth and correct the bite while the jaw is still growing.', services: ['Braces', 'Fillings'], book: 'braces' },
  { id: 'adults', title: 'Adults', text: 'Whitening, veneers and crowns for the smile you want, and root canal treatment to save a tooth that hurts.', services: ['Whitening', 'Veneers', 'Crowns', 'Root canal'], book: 'whitening' },
  { id: 'seniors', title: 'Seniors', text: 'Implants and dentures that bring back comfortable eating and a confident smile.', services: ['Implants', 'Complete dentures', 'Partial dentures'], book: 'implant' },
];

export const FAQ_GROUPS = ['Treatment and comfort', 'Booking and costs', 'The clinic'];

export const FAQ = [
  {
    group: 0,
    q: 'Does root canal treatment hurt?',
    keys: ['hurt', 'pain', 'painful', 'dard'],
    a: 'The tooth is numbed with local anaesthetic first, so most patients feel pressure rather than pain. It can feel tender for a few days afterwards. If you have severe swelling, or trouble swallowing or breathing, go to the nearest emergency department.',
  },
  {
    group: 0,
    q: 'How long does an implant take?',
    keys: ['how long', 'duration', 'months', 'implant time'],
    a: 'It usually happens in stages over a few months: placing the implant, letting the bone heal around it, then fitting the crown. The dentist will give you a timeline after checking your bone.',
  },
  {
    group: 0,
    q: 'Is whitening safe?',
    keys: ['safe', 'side effect', 'sensitive', 'sensitivity'],
    a: "Yes, when it is done or supervised by a dentist. Some people feel short-lived sensitivity. Whitening doesn't change the colour of existing crowns, veneers or fillings.",
  },
  {
    group: 0,
    q: 'Do you treat children?',
    keys: ['child', 'children', 'kid', 'son', 'daughter', 'baby', 'bacha'],
    a: "Yes. We see patients of every age, from a child's first check-up to dentures for grandparents.",
  },
  {
    group: 2,
    q: 'Where is the clinic?',
    keys: ['where', 'location', 'address', 'map', 'direction', 'kahan'],
    a: `We're at ${CLINIC.address.join(', ')}.`,
    link: { label: 'Get directions', href: CLINIC.mapsUrl },
  },
  {
    group: 1,
    q: 'What are your timings?',
    keys: ['timing', 'time', 'hours', 'open', 'close', 'today', 'sunday', 'friday'],
    a: `Please call or WhatsApp ${CLINIC.phoneDisplay} and the clinic will tell you today's timings.`,
  },
  {
    group: 1,
    q: 'Why are prices not listed on the website?',
    keys: ['cost', 'price', 'fee', 'charges', 'rate', 'kitna', 'kitne', 'paisa', 'rs', 'rupees', 'much'],
    a: 'Every mouth is different. The cost depends on what the dentist finds at your check-up and which treatment you choose, so a fixed price list would only be a guess. After examining you, the dentist explains your options and what each costs before any treatment starts.',
  },
  {
    group: 1,
    q: 'How do I book an appointment?',
    keys: ['book', 'appointment', 'booking'],
    a: `Use the booking assistant on this page, or message ${CLINIC.phoneDisplay} on WhatsApp. The clinic replies to confirm your time.`,
  },
  {
    group: 2,
    q: 'Who is the dentist?',
    keys: ['who', 'doctor', 'dentist', 'tabassum', 'female', 'lady'],
    a: 'Dr. Tabassum Ajmal, a dentist and prosthodontist. A prosthodontist specialises in restoring and replacing teeth, including crowns, veneers, implants and dentures.',
  },
];
