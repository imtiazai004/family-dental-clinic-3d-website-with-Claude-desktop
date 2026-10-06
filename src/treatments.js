// Content for the treatment pages. One entry = one page, built from the same template
// (tools/treatment-page.mjs). To add a treatment page, add an entry here and rebuild.
//
// Fields marked `confirm: true` list things the clinic should confirm before launch
// (for example which types of a treatment it offers). Medical wording should be checked
// by Dr. Tabassum before the site goes live.

export const TX_GROUPS = {
  pain: 'Pain or damage',
  missing: 'Missing teeth',
  smile: 'Smile makeover',
};

export const TREATMENTS = [
  {
    id: 'implant',
    slug: 'dental-implants',
    tagline: 'Replace a missing tooth',
    name: 'Dental implants',
    group: 'missing',
    scene: 'implant',
    seoTitle: 'Dental implants in Peshawar | Family Dental & Aesthetic Clinic',
    description: 'Replace a missing tooth with a dental implant at Family Dental & Aesthetic Clinic, Nasir Bagh Road, Peshawar. See how an implant works, step by step, and book on WhatsApp.',
    lead: 'An implant replaces the root of a missing tooth with a small titanium post. Once the bone has healed around it, a crown made for your mouth is fixed on top, so the new tooth looks and works like your own.',
    // Its own seven-step 3D story (src/three/implant-story.js), deeper than the home page's four steps.
    story3d: 'implant',
    story: {
      title: 'Your implant, step by step',
      length: '760vh',
      marks: [0, 0.143, 0.286, 0.429, 0.571, 0.714, 0.857],
      steps: [
        { title: 'Check-up and X-ray', text: 'The dentist examines the gap and takes an X-ray to see how much bone there is, and where nerves and sinuses lie.' },
        { title: 'Planning the implant', text: "The implant's position, angle and size are planned on the X-ray, so it sits safely in the bone and lines up with your bite." },
        { title: 'Placing the implant', text: 'With the area numbed, the titanium implant is placed in the jawbone. Most people feel pressure rather than pain.' },
        { title: 'Healing', text: "Over roughly three to six months, the bone grows tightly around the implant's threads. This bond is what makes it strong." },
        { title: 'The abutment', text: 'A small connector is fitted on top of the implant. It rises through the gum to hold the new tooth.' },
        { title: 'A crown that matches', text: 'The crown is made in a shade chosen to match your own teeth, then fixed onto the abutment.' },
        { title: 'Bite check and follow-up', text: 'The dentist checks how your teeth meet and fine-tunes the crown if needed. Regular check-ups keep the implant healthy.' },
      ],
    },
    // Each type opens into a 3D model that comes apart (src/three/implant-types.js).
    options: {
      title: 'Ways an implant can replace teeth',
      items: [
        {
          name: 'Single-tooth implant', model: 'single',
          text: 'One implant and one crown replace a single missing tooth, without filing down the teeth on either side.',
          parts: ['Crown', 'Abutment', 'Implant'],
          detail: {
            what: 'An implant takes the place of the root, and a crown made for your mouth sits on top. The teeth next to the gap are left untouched.',
            bestFor: ['One missing tooth', 'Healthy neighbouring teeth you would rather not file down for a bridge'],
            involves: 'Placing the implant, a few months of healing, then the abutment and crown.',
          },
        },
        {
          name: 'Implant bridge', model: 'bridge',
          text: 'When several teeth in a row are missing, two implants can hold a bridge of three or more new teeth.',
          parts: ['Bridge of three teeth', 'Abutments', 'Two implants'],
          detail: {
            what: 'Instead of one implant for every missing tooth, two implants hold a fixed bridge. The tooth in the middle rests on the gum between them.',
            bestFor: ['Three or more missing teeth in a row', 'Fewer implants than one per tooth'],
            involves: 'Placing two implants, healing, then fitting the bridge.',
          },
        },
        {
          name: 'Implant-supported denture', model: 'overdenture',
          text: 'For a jaw with no teeth, a few implants hold a full denture firmly, so it does not slip when you eat or speak.',
          parts: ['Removable denture', 'Clip-on attachments', 'Implants'],
          detail: {
            what: 'A full denture clips onto two to four implants. It stays firmly in place when you eat and speak, and you can still take it out to clean it.',
            bestFor: ['No teeth in a jaw', 'A denture that is loose or slips'],
            involves: 'Placing the implants, healing, then a denture made with clips that fit the attachments.',
          },
        },
        {
          name: 'All-on-X full arch', model: 'allonx',
          text: 'A full arch of fixed teeth held by four to six implants. Only the dentist removes it.',
          parts: ['Fixed full-arch bridge', 'Back implants angled', 'Four to six implants'],
          detail: {
            what: 'A complete arch of teeth is fixed onto four to six implants. The back implants are often angled to make the most of the bone, so a bone graft may not be needed.',
            bestFor: ['No teeth, or failing teeth, across a whole jaw', 'Wanting fixed teeth rather than a denture you take out'],
            involves: 'Placing the implants, healing, then the final fixed bridge. The dentist will tell you whether a temporary bridge can be fitted while you heal.',
          },
        },
      ],
    },
    fit: {
      title: 'Is an implant right for you?',
      items: [
        'You are missing one or more teeth, from decay, gum disease or an injury.',
        'Your gums are healthy, or can be treated first.',
        'There is enough bone in your jaw to hold the implant. An X-ray shows this.',
        'You would like a fixed tooth rather than one you take out.',
      ],
      note: 'Smoking and uncontrolled diabetes can slow healing. Tell the dentist about your health and any medicines at your check-up.',
    },
    care: {
      title: 'Looking after your implant',
      items: [
        'Eat soft food on that side for the first few days.',
        'Brush and floss around the implant every day, just like a natural tooth.',
        'If you smoke, stopping helps the implant heal and last longer.',
        'Keep your follow-up visits so the dentist can check the gum and bone around it.',
      ],
    },
    faq: [
      { q: 'How long does the whole treatment take?', a: 'It usually happens in stages over a few months: placing the implant, letting the bone heal around it, then fitting the crown. The dentist will give you a timeline after checking your bone.' },
      { q: 'Does getting an implant hurt?', a: 'The area is numbed first, so you should feel pressure rather than pain. Some soreness and swelling for a few days afterwards is normal.' },
      { q: 'How long does an implant last?', a: 'With good cleaning and regular check-ups, an implant can last for many years. The crown on top may need replacing one day because of normal wear.' },
      { q: "What if I don't have enough bone?", a: 'The dentist checks the bone on an X-ray. If there is not enough, a bone graft may be needed first. You will be told if this applies to you.' },
      { q: 'Why is the price not listed?', a: 'The cost depends on how many teeth are replaced, the type of crown, and whether extra steps such as a bone graft are needed. The dentist explains your options and what each costs after your check-up, before anything starts.' },
    ],
    review: null,
    related: ['crown', 'denture', 'partial'],
  },
  {
    id: 'rct',
    slug: 'root-canal-treatment',
    tagline: 'Save an infected, painful tooth',
    name: 'Root canal treatment',
    group: 'pain',
    scene: 'rct',
    seoTitle: 'Root canal treatment in Peshawar | Family Dental & Aesthetic Clinic',
    description: 'Save an infected, painful tooth with root canal treatment at Family Dental & Aesthetic Clinic, Nasir Bagh Road, Peshawar. See each step in 3D and book on WhatsApp.',
    lead: 'When decay or a crack lets bacteria into the soft pulp inside a tooth, it can become infected and very painful. Root canal treatment removes the infection and seals the tooth, so you keep it instead of losing it.',
    story: {
      title: 'How root canal treatment saves a tooth',
      length: '430vh',
      marks: [0, 0.26, 0.52, 0.78],
      steps: [
        { title: 'Infection reaches the pulp', text: 'Deep decay or a crack lets bacteria into the pulp. This is what causes the throbbing pain.' },
        { title: 'The canals are cleaned', text: 'With the tooth numbed, the dentist removes the infected pulp through a small opening and cleans each canal with fine files.' },
        { title: 'Filled and sealed', text: 'The clean canals are filled with a rubber-like material and sealed so bacteria cannot get back in.' },
        { title: 'Your own tooth, kept', text: 'The tooth stays in place and works normally. Your dentist may recommend a crown to protect it.' },
      ],
    },
    options: {
      title: 'After the canals are sealed',
      items: [
        { name: 'A filling on top', text: 'The opening in the tooth is closed with a tooth-coloured filling. This is often enough for a front tooth.' },
        { name: 'A crown to protect it', text: 'Back teeth take the most force when you chew, so a crown is often advised to stop the treated tooth from cracking.', book: 'crown' },
      ],
    },
    fit: {
      title: 'Signs you may need it',
      items: [
        'Toothache that throbs or wakes you at night.',
        'Pain that lingers after hot or cold food and drinks.',
        'A swollen gum, or a small pimple-like bump near a tooth.',
        'A tooth that has turned darker after a knock.',
      ],
      note: 'Only an examination, and usually an X-ray, can tell for sure. If swelling spreads to your eye or neck, or you have trouble swallowing or breathing, go to the nearest emergency department.',
    },
    care: {
      title: 'After your root canal',
      items: [
        'The tooth may feel tender for a few days. Painkillers the dentist recommends usually help.',
        'Avoid biting hard food on that tooth until the final filling or crown is in place.',
        'Brush and floss as normal.',
        'Come back for the final filling or crown, so the tooth is protected for the long term.',
      ],
    },
    faq: [
      { q: 'Does root canal treatment hurt?', a: 'The tooth is numbed with local anaesthetic first, so most patients feel pressure rather than pain. It can feel tender for a few days afterwards.' },
      { q: 'How many visits will I need?', a: 'Often one or two, depending on the tooth and how much infection there is. The dentist tells you after examining it.' },
      { q: "Wouldn't it be simpler to pull the tooth out?", a: 'Keeping your own tooth is usually better for chewing and for the teeth around it. A gap often needs an implant, bridge or denture later. The dentist will explain both choices.' },
      { q: 'Will I need a crown afterwards?', a: 'Back teeth usually do, because they take the most force when you chew and can crack after treatment. A front tooth may only need a filling.' },
    ],
    review: 0,
    related: ['crown', 'filling', 'extraction'],
  },
  {
    id: 'braces',
    slug: 'braces',
    tagline: 'Straighten crooked teeth',
    name: 'Braces',
    group: 'smile',
    scene: 'braces',
    seoTitle: 'Braces in Peshawar | Family Dental & Aesthetic Clinic',
    description: 'Straighten crowded or crooked teeth with braces at Family Dental & Aesthetic Clinic, Nasir Bagh Road, Peshawar, for children, teens and adults. Book on WhatsApp.',
    lead: 'Braces move crowded or crooked teeth into line with small brackets and a thin wire. Straighter teeth are easier to clean, and the bite works better too.',
    story: {
      title: 'How braces straighten teeth',
      length: '400vh',
      marks: [0, 0.22, 0.78],
      steps: [
        { title: 'Brackets and a wire are fitted', text: 'Small brackets are bonded to the front of each tooth and joined by a thin wire. No injection is needed to fit them.' },
        { title: 'Teeth move, little by little', text: 'The wire applies gentle, steady pressure. At visits every few weeks, the dentist adjusts it as the teeth move into line.' },
        { title: 'Brackets off, retainer on', text: 'When the teeth are straight, the brackets come off. A retainer, worn as advised, keeps them from drifting back.' },
      ],
    },
    options: {
      title: 'Types of braces',
      confirm: true,
      items: [
        { name: 'Metal braces', text: 'Strong, reliable and suited to most cases, from mild crowding to bigger bite problems.' },
        { name: 'Tooth-coloured braces', text: 'Ceramic brackets that blend in with your teeth, so they are less noticeable.' },
        { name: 'Clear aligners', text: 'A series of thin, clear trays you can take out to eat and brush. Suited to milder cases.' },
      ],
    },
    fit: {
      title: 'Who braces can help',
      items: [
        'Crowded, overlapping or crooked teeth.',
        'Gaps between teeth.',
        'A bite where the top and bottom teeth do not meet well.',
        'Children, teens and adults. Children are often treated while the jaw is still growing.',
      ],
      note: 'Teeth and gums need to be healthy before braces go on, so any fillings or gum treatment are done first.',
    },
    care: {
      title: 'Living with braces',
      items: [
        'Brush carefully after meals, around every bracket.',
        'Avoid hard and sticky food that can break a bracket, such as hard sweets, nuts and chewing gum.',
        'If a bracket or wire rubs, a little orthodontic wax helps until your next visit.',
        'Wear your retainer as advised once the braces come off.',
      ],
    },
    faq: [
      { q: 'How long will I wear braces?', a: 'Most people wear them for one to two years. It depends on how much the teeth need to move. You get an estimate after the check-up.' },
      { q: 'Do braces hurt?', a: 'Teeth can feel sore for a few days after the braces go on and after each adjustment. This settles, and ordinary painkillers help.' },
      { q: 'Am I too old for braces?', a: 'No. Adults can have braces too, as long as their teeth and gums are healthy.' },
      { q: 'How often do I need to visit?', a: 'Usually every few weeks, so the dentist can adjust the wire and check progress.' },
      { q: 'What happens when the braces come off?', a: 'You wear a retainer, as advised, to stop the teeth from moving back.' },
    ],
    review: null,
    related: ['whitening', 'veneer', 'filling'],
  },
];
