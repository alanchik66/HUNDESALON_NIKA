/** Shared pet-photo upload limits (booking form + /upload). */
export const PET_PHOTO_MAX_BYTES = 150 * 1024 * 1024;
/** Multipart proxy through Pages Functions — stay below Cloudflare's ~100 MB body cap. */
export const PET_PHOTO_PROXY_MAX_BYTES = 90 * 1024 * 1024;
export const PET_PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png'];
export const PET_PHOTO_MAX_MB = 150;

export function isAllowedPetPhotoType(mimeType) {
  return PET_PHOTO_ALLOWED_TYPES.includes(String(mimeType || '').toLowerCase());
}

export function petPhotoTooLarge(size) {
  return Number(size) > PET_PHOTO_MAX_BYTES;
}

export function petPhotoNeedsDirectUpload(size) {
  return Number(size) > PET_PHOTO_PROXY_MAX_BYTES;
}
