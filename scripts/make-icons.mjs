// Generates simple PNG icons (no deps) — a brand-blue square with white "TB" text via raw PNG encoding is
// non-trivial; instead we emit valid 1x1 PNGs colored brand-blue, browsers will still install the PWA.
// For production, replace these with proper-resolution assets.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import zlib from "node:zlib";

function makeSolidPng(width, height, r, g, b, a = 255) {
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(6, 9); // 8-bit RGBA
  ihdr.writeUInt8(0, 10); ihdr.writeUInt8(0, 11); ihdr.writeUInt8(0, 12);
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) {
    row[1 + x * 4 + 0] = r;
    row[1 + x * 4 + 1] = g;
    row[1 + x * 4 + 2] = b;
    row[1 + x * 4 + 3] = a;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = resolve(process.cwd(), "public/icons");
mkdirSync(outDir, { recursive: true });
const blue = [37, 99, 235];
writeFileSync(resolve(outDir, "icon-192.png"), makeSolidPng(192, 192, ...blue));
writeFileSync(resolve(outDir, "icon-512.png"), makeSolidPng(512, 512, ...blue));
writeFileSync(resolve(outDir, "icon-maskable.png"), makeSolidPng(512, 512, ...blue));
console.log("Wrote PWA icons (placeholder solid blue).");
