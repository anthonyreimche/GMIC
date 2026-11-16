// Where to get the gmic program. gmic.eu offers a command-line zip for
// Windows only; macOS has it in Homebrew and Linux in its distributions.

export const DOWNLOAD_PAGE = "https://gmic.eu/download.html";
export const HOMEBREW_COMMAND = "brew install gmic";

export type Platform = "windows" | "mac" | "linux";

/** The platform, from the desktop app's answer, else the browser's. */
export function platformOf(native: string | undefined, userAgent: string): Platform {
  const key = native ?? "";
  if (key === "win32" || (!key && /Windows/i.test(userAgent))) return "windows";
  if (key === "darwin" || (!key && /Mac OS X|Macintosh/i.test(userAgent))) return "mac";
  return "linux";
}

export function currentPlatform(): Platform {
  return platformOf(window.safelightNative?.platform, navigator.userAgent);
}

const versionParts = (v: string) => v.split(".").map(Number);
function newer(a: string, b: string): boolean {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
}

/** The newest stable command-line zip for Windows that the download page
 *  links, or null. */
export function cliZipUrl(page: string): string | null {
  let best: string | null = null;
  for (const m of page.matchAll(/windows\/gmic_(\d+(?:\.\d+)+)_cli_win64\.zip/g)) if (!best || newer(m[1], best)) best = m[1];
  return best ? `https://gmic.eu/get_file.php?file=windows/gmic_${best}_cli_win64.zip` : null;
}

/** What the Download button opens on Windows: the newest zip itself, or the
 *  download page when gmic.eu can't be read. */
export async function windowsDownload(fetch: (url: string) => Promise<Response>): Promise<string> {
  try {
    const response = await fetch(DOWNLOAD_PAGE);
    if (!response.ok) return DOWNLOAD_PAGE;
    return cliZipUrl(await response.text()) ?? DOWNLOAD_PAGE;
  } catch {
    return DOWNLOAD_PAGE;
  }
}
