/** Official HUNDESALON NIKA profiles — sameAs + citation links (JSON-LD, llms.txt). */
export const BRAND_PROFILES = {
  website: 'https://hundesalon-nika.com/',
  // Address pin Leipzig (no GBP place yet). Replace with claimed Business Profile URL after verify.
  googleMaps:
    'https://www.google.com/maps/search/?api=1&query=HUNDESALON_NIKA%2C+Walter-Markov-Ring+1%2C+04288+Leipzig',
  instagram: 'https://www.instagram.com/hundesalon_nika',
  tiktok: 'https://www.tiktok.com/@hundesalon_nika',
  youtube: 'https://www.youtube.com/@hundesalon_nika',
  telegram: 'https://t.me/hundesalon_nika_support_bot',
  facebook: 'https://www.facebook.com/profile.php?id=61584574431839',
  whatsapp: 'https://wa.me/4915172450988',
};

/** Deduplicated list for schema.org sameAs */
export const SAME_AS = [
  BRAND_PROFILES.website,
  BRAND_PROFILES.googleMaps,
  BRAND_PROFILES.instagram,
  BRAND_PROFILES.tiktok,
  BRAND_PROFILES.youtube,
  BRAND_PROFILES.telegram,
  BRAND_PROFILES.facebook,
];

export const NAP = {
  name: 'HUNDESALON_NIKA',
  street: 'Walter-Markov-Ring 1',
  postalCode: '04288',
  locality: 'Leipzig',
  region: 'Sachsen',
  country: 'DE',
  phone: '+49 151 72450988',
  email: 'info@hundesalon-nika.com',
  supportEmail: 'info@hundesalon-nika.com',
  url: 'https://hundesalon-nika.com/',
};
