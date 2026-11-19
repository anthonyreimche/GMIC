import { describe, expect, it } from "vitest";
import { decodeCimg, encodeCimg, fromRgba, toRgba } from "../src/gmic/cimg";

const close = (actual: ArrayLike<number>, expected: number[]) => {
  expect(actual.length).toBe(expected.length);
  expected.forEach((v, i) => expect(actual[i]).toBeCloseTo(v, 5));
};
const ascii = (bytes: Uint8Array, end: number) => new TextDecoder().decode(bytes.subarray(0, end));

describe("CImg files", () => {
  it("writes one float image: a header line, the image's size line, then planar little-endian floats", () => {
    const image = { width: 2, height: 1, channels: 3, data: new Float32Array([1, 2, 3, 4, 5, 6]) };
    const bytes = encodeCimg(image);
    const header = "1 float little_endian\n2 1 1 3\n";
    expect(ascii(bytes, header.length)).toBe(header);
    const floats = new Float32Array(bytes.slice(header.length).buffer);
    expect([...floats]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("reads every image of a file back, in order", () => {
    const enc = new TextEncoder();
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([7, 8, 9, 10, 11, 12]);
    const parts = [enc.encode("2 float little_endian\n2 1 1 1\n"), new Uint8Array(a.buffer), enc.encode("1 2 1 3\n"), new Uint8Array(b.buffer)];
    const file = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      file.set(p, at);
      at += p.length;
    }
    const images = decodeCimg(file);
    expect(images.map((i) => [i.width, i.height, i.channels])).toEqual([
      [2, 1, 1],
      [1, 2, 3],
    ]);
    expect([...images[1].data]).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("reads other value types and big-endian files", () => {
    const enc = new TextEncoder();
    const head = enc.encode("1 uchar little_endian\n2 1 1 1\n");
    const file = new Uint8Array([...head, 10, 250]);
    expect([...decodeCimg(file)[0].data]).toEqual([10, 250]);

    const be = new DataView(new ArrayBuffer(8));
    be.setFloat32(0, 1.5, false);
    be.setFloat32(4, -2, false);
    const head2 = enc.encode("1 float big_endian\n2 1 1 1\n");
    expect([...decodeCimg(new Uint8Array([...head2, ...new Uint8Array(be.buffer)]))[0].data]).toEqual([1.5, -2]);
  });

  it("refuses what it can't read", () => {
    expect(() => decodeCimg(new TextEncoder().encode("hello"))).toThrow(/G'MIC/);
    expect(() => decodeCimg(new TextEncoder().encode("1 float little_endian\n2 1 1 1 #12\n"))).toThrow(/compressed/);
  });

  it("turns RGBA pixels into planar RGB on G'MIC's 0-255 scale and back", () => {
    const rgba = new Float32Array([0, 0.5, 1, 1, 1, 0, 0.25, 1]);
    const planar = fromRgba(rgba, 2, 1, 255);
    close(planar.data, [0, 255, 127.5, 0, 255, 63.75]);
    expect(planar.channels).toBe(3);
    close(toRgba(planar, 1 / 255), [0, 0.5, 1, 1, 1, 0, 0.25, 1]);
  });

  it("makes RGBA from grey, grey with alpha, and RGBA results", () => {
    const grey = { width: 2, height: 1, channels: 1, data: new Float32Array([0, 255]) };
    close(toRgba(grey, 1 / 255), [0, 0, 0, 1, 1, 1, 1, 1]);
    const greyAlpha = { width: 1, height: 1, channels: 2, data: new Float32Array([255, 127.5]) };
    close(toRgba(greyAlpha, 1 / 255), [1, 1, 1, 0.5]);
    const rgba = { width: 1, height: 1, channels: 4, data: new Float32Array([255, 0, 0, 51]) };
    close(toRgba(rgba, 1 / 255), [1, 0, 0, 0.2]);
  });
});
