import { readFile } from "fs/promises";
import path from "path";

type SocialCardFont = {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 600 | 700;
  style: "normal";
};

let fontPromise: Promise<SocialCardFont[]> | null = null;

function readFont(fileName: string) {
  const filePath = path.join(process.cwd(), "public", "fonts", fileName);
  return readFile(filePath).then(
    (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  );
}

export function getSocialCardFonts(): Promise<SocialCardFont[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      readFont("clash-display-700.ttf"),
      readFont("inter-500.ttf"),
      readFont("inter-600.ttf"),
    ]).then(([clash700, inter500, inter600]) => [
      { name: "Clash Display", data: clash700, weight: 700, style: "normal" as const },
      { name: "Inter", data: inter500, weight: 500, style: "normal" as const },
      { name: "Inter", data: inter600, weight: 600, style: "normal" as const },
    ]);
  }

  return fontPromise;
}
