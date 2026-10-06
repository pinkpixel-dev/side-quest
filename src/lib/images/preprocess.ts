export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Fits width x height inside a max x max box, never upscaling. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Downscales a phone photo before it goes anywhere near the model. Decoding with
 * `imageOrientation: 'from-image'` bakes in the EXIF rotation, and re-encoding through a
 * canvas drops all metadata, so GPS tags never get stored or analyzed.
 */
export async function preparePhoto(file: Blob, max = 1280, quality = 0.8): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob, width, height };
}
