import { describe, expect, it } from "vitest";
import { sniffPhotoType } from "@/lib/image-type";
import { JPEG_BYTES, PNG_BYTES, WEBP_BYTES } from "../helpers/fake-s3";

describe("sniffPhotoType (real file type from the first bytes)", () => {
  it("recognises JPEG", () => {
    expect(sniffPhotoType(JPEG_BYTES)).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });

  it("recognises PNG", () => {
    expect(sniffPhotoType(PNG_BYTES)).toEqual({ mime: "image/png", ext: "png" });
  });

  it("recognises WebP", () => {
    expect(sniffPhotoType(WEBP_BYTES)).toEqual({ mime: "image/webp", ext: "webp" });
  });

  it("rejects GIF, SVG, HTML and plain text", () => {
    const bytes = (s: string) => new TextEncoder().encode(s);
    expect(sniffPhotoType(bytes("GIF89a......"))).toBeNull();
    expect(sniffPhotoType(bytes("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniffPhotoType(bytes("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(sniffPhotoType(bytes("just some text"))).toBeNull();
  });

  it("rejects empty and truncated input", () => {
    expect(sniffPhotoType(new Uint8Array([]))).toBeNull();
    expect(sniffPhotoType(new Uint8Array([0xff, 0xd8]))).toBeNull(); // JPEG needs 3 bytes
    expect(sniffPhotoType(PNG_BYTES.slice(0, 7))).toBeNull(); // PNG needs 8
    expect(sniffPhotoType(WEBP_BYTES.slice(0, 11))).toBeNull(); // WebP needs 12
  });

  it("rejects a RIFF file that is not WebP (e.g. WAV)", () => {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffPhotoType(wav)).toBeNull();
  });
});
