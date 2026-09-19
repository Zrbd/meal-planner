// Your own photos of finished dishes. Everything is downscaled in the browser before it is
// stored: a phone photo is 4 MB and IndexedDB on iOS is not the place for that.
import { db, type RecipePhoto } from '../db/schema';

const THUMB_PX = 240;
const FULL_PX = 1000;

async function load(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("That file isn't an image."));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Square centre crop, scaled to `size`, as a JPEG data URL. */
function square(img: HTMLImageElement, size: number, quality: number): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize images.');
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function savePhoto(recipeId: string, file: Blob): Promise<void> {
  const img = await load(file);
  const photo: RecipePhoto = {
    recipeId,
    thumb: square(img, THUMB_PX, 0.6),
    full: square(img, Math.min(FULL_PX, Math.max(img.naturalWidth, img.naturalHeight)), 0.75),
    at: Date.now(),
  };
  await db.photos.put(photo);
}

export async function removePhoto(recipeId: string): Promise<void> {
  await db.photos.delete(recipeId);
}
