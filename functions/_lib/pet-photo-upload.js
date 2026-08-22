/** Shared pet-photo upload limits (booking form + /upload). */
export const PET_PHOTO_MAX_BYTES = 150 * 1024 * 1024;
/** Multipart proxy through Pages Functions — stay below Cloudflare's ~100 MB body cap. */
export const PET_PHOTO_PROXY_MAX_BYTES = 90 * 1024 * 1024;
export const PET_PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png'];
export const PET_PHOTO_MAX_MB = 150;

export function isAllowedPetPhotoType(mimeType) {
  return PET_PHOTO_ALLOWED_TYPES.includes(String(mimeType || '').toLowerCase());
}

export async function hasValidPetPhotoSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = pngSignature.every((value, index) => bytes[index] === value);
  return isJpeg || isPng;
}

export function petPhotoTooLarge(size) {
  return Number(size) > PET_PHOTO_MAX_BYTES;
}

export function petPhotoNeedsDirectUpload(size) {
  return Number(size) > PET_PHOTO_PROXY_MAX_BYTES;
}
