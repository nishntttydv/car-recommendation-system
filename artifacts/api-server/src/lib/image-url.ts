import { existsSync } from "fs";
import path from "path";

const publicImagesDir = path.resolve(
  process.cwd(),
  "..",
  "automind",
  "public",
  "images",
);

function toPublicImagePath(brand: string, filename: string): string {
  return `/images/${encodeURIComponent(brand)}/${encodeURIComponent(filename)}`;
}

export function getCarImageUrl(brand: string, model: string): string | undefined {
  const candidates = [
    `${model}.png`,
    `${model.toLowerCase()}.png`,
    `${model}.jpg`,
    `${model.toLowerCase()}.jpg`,
    `${model}.jpeg`,
    `${model.toLowerCase()}.jpeg`,
    `${model}.webp`,
    `${model.toLowerCase()}.webp`,
  ];

  for (const filename of candidates) {
    const absolutePath = path.join(publicImagesDir, brand, filename);
    if (existsSync(absolutePath)) {
      return toPublicImagePath(brand, filename);
    }
  }

  return undefined;
}
