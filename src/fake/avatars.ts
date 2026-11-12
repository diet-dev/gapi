import {avatarPhotos} from "./avatar-photos.ts";

export type AvatarGender = "male" | "female";

/**
 * Синтетические портреты предназначены только для fake SDK.
 * SVG задаёт размер отображения встроенного портрета WebP 256×256.
 */
export function avatarDataUri(seed: string, pixels: number, gender?: AvatarGender, index?: number): string {
  const hash = [...seed].reduce((sum, ch) => sum + (ch.codePointAt(0) ?? 0), 0);
  const photos = gender ? avatarPhotos.filter(photo => photo.gender === gender) : avatarPhotos;
  const photo = photos[(index ?? hash) % photos.length].uri;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 256 256"><image width="256" height="256" href="${photo}" /></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
