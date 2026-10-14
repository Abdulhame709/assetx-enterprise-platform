/** Largest side of the stored logo, in pixels. Reports never show it larger than this. */
const MAX_SIDE = 400;
const FALLBACK_SIDE = 240;
/** The server accepts up to 300 KB; stay safely below once base64-encoded. */
const MAX_DATA_URI_LENGTH = 380_000;

export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg'];

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('LOGO_INVALID')); };
    img.src = url;
  });
}

function render(img: HTMLImageElement, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('LOGO_INVALID');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Reads a PNG/JPEG file, scales it down, and returns a PNG data URI ready to upload. */
export async function prepareLogo(file: File): Promise<string> {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type)) throw new Error('LOGO_INVALID');
  const img = await load(file);
  let dataUri = render(img, MAX_SIDE);
  if (dataUri.length > MAX_DATA_URI_LENGTH) dataUri = render(img, FALLBACK_SIDE);
  if (dataUri.length > MAX_DATA_URI_LENGTH) throw new Error('LOGO_INVALID');
  return dataUri;
}
