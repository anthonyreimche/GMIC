// CImg files, G'MIC's own image format: a line naming the image count, value
// type and byte order, then each image's `width height depth channels` line
// and its values, channel by channel (all of red, then all of green …). Pixels
// cross to and from gmic as floats this way: nothing is quantized, and no
// image codec runs in the window.

/** One planar image: `channels` planes of `width × height` values (depth 1). */
export interface Planar {
  width: number;
  height: number;
  channels: number;
  data: Float32Array;
}

const TYPES: Record<string, { bytes: number; read(view: DataView, at: number, little: boolean): number }> = {
  bool: { bytes: 1, read: (v, at) => v.getUint8(at) },
  uchar: { bytes: 1, read: (v, at) => v.getUint8(at) },
  "unsigned char": { bytes: 1, read: (v, at) => v.getUint8(at) },
  char: { bytes: 1, read: (v, at) => v.getInt8(at) },
  ushort: { bytes: 2, read: (v, at, le) => v.getUint16(at, le) },
  short: { bytes: 2, read: (v, at, le) => v.getInt16(at, le) },
  uint: { bytes: 4, read: (v, at, le) => v.getUint32(at, le) },
  int: { bytes: 4, read: (v, at, le) => v.getInt32(at, le) },
  uint64: { bytes: 8, read: (v, at, le) => Number(v.getBigUint64(at, le)) },
  ulong: { bytes: 8, read: (v, at, le) => Number(v.getBigUint64(at, le)) },
  int64: { bytes: 8, read: (v, at, le) => Number(v.getBigInt64(at, le)) },
  long: { bytes: 8, read: (v, at, le) => Number(v.getBigInt64(at, le)) },
  float: { bytes: 4, read: (v, at, le) => v.getFloat32(at, le) },
  double: { bytes: 8, read: (v, at, le) => v.getFloat64(at, le) },
};
// The names G'MIC 4 writes.
TYPES.uint8 = TYPES.uchar;
TYPES.int8 = TYPES.char;
TYPES.uint16 = TYPES.ushort;
TYPES.int16 = TYPES.short;
TYPES.uint32 = TYPES.uint;
TYPES.int32 = TYPES.int;
TYPES.float32 = TYPES.float;
TYPES.float64 = TYPES.double;

const NEWLINE = 10;

function line(bytes: Uint8Array, from: number): { text: string; next: number } {
  const end = bytes.indexOf(NEWLINE, from);
  if (end < 0) throw new Error("G'MIC's image file ends early.");
  return { text: new TextDecoder().decode(bytes.subarray(from, end)).trim(), next: end + 1 };
}

export function encodeCimg(image: Planar): Uint8Array {
  const head = new TextEncoder().encode(`1 float little_endian\n${image.width} ${image.height} 1 ${image.channels}\n`);
  const out = new Uint8Array(head.length + image.data.length * 4);
  out.set(head, 0);
  const view = new DataView(out.buffer, head.length);
  for (let i = 0; i < image.data.length; i++) view.setFloat32(i * 4, image.data[i], true);
  return out;
}

export function decodeCimg(bytes: Uint8Array): Planar[] {
  const first = line(bytes, 0);
  const head = /^(\d+)\s+(unsigned char|[a-z0-9_]+)\s+(little_endian|big_endian)/.exec(first.text);
  if (!head) throw new Error("G'MIC's result isn't an image file Safelight can read.");
  const count = Number(head[1]);
  const type = TYPES[head[2]];
  if (!type) throw new Error(`G'MIC's result holds ${head[2]} values, which Safelight can't read.`);
  const little = head[3] === "little_endian";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const images: Planar[] = [];
  let at = first.next;
  for (let n = 0; n < count; n++) {
    const sizes = line(bytes, at);
    if (sizes.text.includes("#")) throw new Error("G'MIC's result is compressed, which Safelight can't read.");
    const [width, height, depth, channels] = sizes.text.split(/\s+/).map(Number);
    at = sizes.next;
    const values = width * height * depth * channels;
    if (!(values >= 0) || at + values * type.bytes > bytes.length) throw new Error("G'MIC's image file ends early.");
    const data = new Float32Array(width * height * channels);
    const planeIn = width * height * depth;
    const plane = width * height;
    for (let c = 0; c < channels; c++) {
      for (let i = 0; i < plane; i++) data[c * plane + i] = type.read(view, at + (c * planeIn + i) * type.bytes, little);
    }
    at += values * type.bytes;
    images.push({ width, height, channels, data });
  }
  return images;
}

/** RGBA rows (alpha ignored) as planar RGB, each value times `scale`. */
export function fromRgba(rgba: ArrayLike<number>, width: number, height: number, scale: number): Planar {
  const plane = width * height;
  const data = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++) {
    data[i] = rgba[i * 4] * scale;
    data[plane + i] = rgba[i * 4 + 1] * scale;
    data[2 * plane + i] = rgba[i * 4 + 2] * scale;
  }
  return { width, height, channels: 3, data };
}

/** A planar image as RGBA rows, each value times `scale`: grey spreads to
 *  red, green and blue; an image without alpha is opaque. */
export function toRgba(image: Planar, scale: number): Float32Array {
  const plane = image.width * image.height;
  const out = new Float32Array(plane * 4);
  const ch = image.channels;
  const colour = ch >= 3 ? [0, 1, 2] : [0, 0, 0];
  const alpha = ch === 2 ? 1 : ch >= 4 ? 3 : -1;
  for (let i = 0; i < plane; i++) {
    out[i * 4] = image.data[colour[0] * plane + i] * scale;
    out[i * 4 + 1] = image.data[colour[1] * plane + i] * scale;
    out[i * 4 + 2] = image.data[colour[2] * plane + i] * scale;
    out[i * 4 + 3] = alpha < 0 ? 1 : image.data[alpha * plane + i] * scale;
  }
  return out;
}
