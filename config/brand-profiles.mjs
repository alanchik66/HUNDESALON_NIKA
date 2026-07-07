/** Official HUNDESALON NIKA profiles — sameAs + citation links (JSON-LD, llms.txt). */
export const BRAND_PROFILES = {
  website: 'https://hundesalon-nika.com/',
  googleMaps:
    'https://www.google.com/maps/place/St%C5%99%C3%ADh%C3%A1n%C3%AD+ps%C5%AF+a+ko%C4%8Dek+PetGrooming+Leipzig/@50.6413683,13.8410258,17z/data=!3m1!4b1!4m6!3m5!1s0x47098f181a16e7e9:0x1e5103069a50da9e!8m2!3d50.6413683!4d13.8410258!16s%2Fg%2F11ksntmkjr',
  instagram: 'https://www.instagram.com/hundesalon_nika',
  tiktok: 'https://www.tiktok.com/@hundesalon_nika',
  youtube: 'https://www.youtube.com/@hundesalon_nika',
  telegram: 'https://t.me/hundesalon_nika',
  facebook: 'https://www.facebook.com/share/17SVsvkZEo/?mibextid=wwXIfr',
  whatsapp: 'https://wa.me/4915151708888',
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
  phone: '+49 1515 1708888',
  email: 'info@hundesalon-nika.com',
  url: 'https://hundesalon-nika.com/de/',
};
