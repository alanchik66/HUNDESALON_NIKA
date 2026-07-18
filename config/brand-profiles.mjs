/** Official HUNDESALON NIKA profiles — sameAs + citation links (JSON-LD, llms.txt). */
export const BRAND_PROFILES = {
  website: 'https://hundesalon-nika.com/',
  // Address pin Leipzig (no GBP place yet). Replace with claimed Business Profile URL after verify.
  googleMaps:
    'https://www.google.com/maps/search/?api=1&query=HUNDESALON+NIKA%2C+Untere-Eichst%C3%A4dtstra%C3%9Fe+38%2C+04299+Leipzig',
  instagram: 'https://www.instagram.com/hundesalon_nika',
  tiktok: 'https://www.tiktok.com/@hundesalon_nika',
  youtube: 'https://www.youtube.com/@hundesalon_nika',
  telegram: 'https://t.me/hundesalon_nika',
  facebook: 'https://www.facebook.com/share/17SVsvkZEo/?mibextid=wwXIfr',
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
  name: 'HUNDESALON NIKA',
  street: 'Untere-Eichstädtstraße 38',
  postalCode: '04299',
  locality: 'Leipzig',
  region: 'Sachsen',
  country: 'DE',
  phone: '+49 151 72450988',
  email: 'info@hundesalon-nika.com',
  url: 'https://hundesalon-nika.com/de/',
};
