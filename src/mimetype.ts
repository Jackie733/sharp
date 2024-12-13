export const AllowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
} as const;

export function getExtensionFromMime(mimetype: string, fallbackExt: string) {
  return (
    MIME_EXTENSIONS[mimetype as keyof typeof MIME_EXTENSIONS] || fallbackExt
  );
}
