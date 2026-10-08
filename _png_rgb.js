/**
 * 极简 PNG 工具（无第三方依赖）：把带 Alpha 的 PNG 转成 24 位 RGB PNG。
 *
 * 为什么需要它：浏览器 canvas.toDataURL('image/png') 即使画布设了 alpha:false，
 *   Chrome/Edge 仍会编码成颜色类型 6（RGBA）。而 App Store 宣传图规格要求 RGB，
 *   带 Alpha 的 PNG 会被部分校验器挑刺。这里自己解 PNG → 丢掉 Alpha → 重新编码。
 *
 * 只支持：位深 8、颜色类型 2(RGB) / 6(RGBA)、非隔行 —— 覆盖浏览器产物即可。
 */
const zlib = require("zlib");

/* ── CRC32 ── */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 解析 PNG → { width, height, colorType, rgba } */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG 文件");
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        bitDepth: data[8], colorType: data[9], interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (!ihdr) throw new Error("缺少 IHDR");
  if (ihdr.bitDepth !== 8) throw new Error("仅支持位深 8，实际 " + ihdr.bitDepth);
  if (ihdr.interlace !== 0) throw new Error("不支持隔行 PNG");
  const bpp = ihdr.colorType === 6 ? 4 : ihdr.colorType === 2 ? 3 : 0;
  if (!bpp) throw new Error("仅支持颜色类型 2/6，实际 " + ihdr.colorType);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { width, height } = ihdr;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, colorType: ihdr.colorType, bpp, pixels: out };
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** RGBA/RGB 像素 → 24 位 RGB PNG */
function encodePngRGB(width, height, pixels, bpp) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  let q = 0;
  for (let y = 0; y < height; y++) {
    raw[q++] = 0; // filter: None —— 平坦色块用 None 压缩率已经足够好
    const src = y * width * bpp;
    for (let x = 0; x < width; x++) {
      const i = src + x * bpp;
      raw[q++] = pixels[i];
      raw[q++] = pixels[i + 1];
      raw[q++] = pixels[i + 2];
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 读 PNG → 24 位 RGB PNG（丢掉 Alpha） */
function toRgbPng(buf) {
  const d = decodePng(buf);
  return { png: encodePngRGB(d.width, d.height, d.pixels, d.bpp), width: d.width, height: d.height, sourceColorType: d.colorType };
}

module.exports = { decodePng, encodePngRGB, toRgbPng };
