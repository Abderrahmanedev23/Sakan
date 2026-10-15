import type { IdentityDocumentMimeType } from '@sakan/shared';

/**
 * Detects the image type from the file's first bytes. The client-sent content type and
 * file name are ignored, so a renamed file cannot slip through.
 */
export function detectImageType(bytes: Uint8Array): IdentityDocumentMimeType | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // "RIFF" <size> "WEBP"
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

export const IMAGE_EXTENSIONS: Record<IdentityDocumentMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
