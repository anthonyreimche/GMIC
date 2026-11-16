// A photo as the PNG G'MIC reads, through Safelight's own render.

import type { CatalogPhoto, SafelightAPI } from "./safelight";

type Settings = Pick<SafelightAPI["settings"], "get" | "set">;

export const SIZES: readonly { value: string; label: string }[] = [
  { value: "full", label: "Full size" },
  { value: "4096", label: "4096 px" },
  { value: "2048", label: "2048 px" },
  { value: "1024", label: "1024 px" },
];

/** The long edge results are rendered at, or null for the photo's own size. */
export function renderSize(settings: Settings): number | null {
  const stored = settings.get<unknown>("size", null);
  return typeof stored === "number" && stored > 0 ? stored : null;
}

export function setRenderSize(settings: Settings, value: string): void {
  settings.set("size", value === "full" ? null : Number(value));
}

export const PREVIEW_SIZE = 1024;

export async function renderPng(
  api: Pick<SafelightAPI, "export">,
  photo: CatalogPhoto,
  options: { longEdge: number | null; bits: 8 | 16; signal?: AbortSignal },
): Promise<Uint8Array> {
  const [rendered] = await api.export.renderPhotos(
    [photo],
    {
      format: "image/png",
      pngBitDepth: options.bits,
      colorSpace: "srgb",
      includeMetadata: false,
      sharpenAmount: 0,
      longEdge: options.longEdge,
    },
    undefined,
    { processors: false, signal: options.signal },
  );
  options.signal?.throwIfAborted();
  if (!rendered?.blob) throw new Error("Safelight couldn't render the photo.");
  return new Uint8Array(await rendered.blob.arrayBuffer());
}
