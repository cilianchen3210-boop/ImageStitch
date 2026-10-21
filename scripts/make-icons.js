// 生成 PWA 图标（纯色底 + 2x2 白色圆角方块，象征拼图），无第三方依赖
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function makePng(size) {
  const pad = size * 0.2;
  const gap = size * 0.06;
  const cell = (size - 2 * pad - gap) / 2;
  const r = cell * 0.18;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let white = false;
      for (let i = 0; i < 2 && !white; i++) {
        for (let j = 0; j < 2 && !white; j++) {
          const x0 = pad + i * (cell + gap);
          const y0 = pad + j * (cell + gap);
          white = inRoundRect(x, y, x0, y0, x0 + cell, y0 + cell, r);
        }
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      const [R, G, B] = white ? [255, 255, 255] : [37, 99, 235];
      raw[o] = R; raw[o + 1] = G; raw[o + 2] = B;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, '..', 'icons');
fs.mkdirSync(out, { recursive: true });
for (const s of [180, 192, 512]) {
  fs.writeFileSync(path.join(out, `icon-${s}.png`), makePng(s));
}
