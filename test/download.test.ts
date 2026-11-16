import { describe, expect, it, vi } from "vitest";
import { DOWNLOAD_PAGE, cliZipUrl, platformOf, windowsDownload } from "../src/download";

const PAGE = `
  <a href="get_file.php?file=windows/gmic_4.0.7_cli_win64.zip">CLI</a>
  <a href="get_file.php?file=windows/gmic_4.0.7_qt_win64.zip">Qt</a>
  <a href="get_file.php?file=prerelease/gmic_cli_win64.zip">dev</a>
  <a href="get_file.php?file=windows/gmic_4.0.10_cli_win64.zip">CLI</a>
`;

describe("cliZipUrl", () => {
  it("links the newest stable command-line zip for Windows on the download page", () => {
    expect(cliZipUrl(PAGE)).toBe("https://gmic.eu/get_file.php?file=windows/gmic_4.0.10_cli_win64.zip");
  });

  it("finds none on a page without one", () => {
    expect(cliZipUrl("<html>moved</html>")).toBeNull();
  });
});

describe("windowsDownload", () => {
  it("asks gmic.eu's download page for the newest zip", async () => {
    const fetch = vi.fn(async () => new Response(PAGE, { status: 200 }));
    expect(await windowsDownload(fetch)).toBe("https://gmic.eu/get_file.php?file=windows/gmic_4.0.10_cli_win64.zip");
    expect(fetch).toHaveBeenCalledWith(DOWNLOAD_PAGE);
  });

  it("falls back to the download page when it can't tell", async () => {
    expect(await windowsDownload(async () => new Response("nope", { status: 500 }))).toBe(DOWNLOAD_PAGE);
    expect(await windowsDownload(async () => Promise.reject(new Error("offline")))).toBe(DOWNLOAD_PAGE);
    expect(await windowsDownload(async () => new Response("<html></html>", { status: 200 }))).toBe(DOWNLOAD_PAGE);
  });
});

describe("platformOf", () => {
  it("takes the desktop app's platform, else reads the browser's", () => {
    expect(platformOf("win32", "")).toBe("windows");
    expect(platformOf("darwin", "")).toBe("mac");
    expect(platformOf("linux", "")).toBe("linux");
    expect(platformOf(undefined, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(platformOf(undefined, "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("mac");
    expect(platformOf(undefined, "Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
  });
});
