import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PANEL_ID, activate } from "../src/index";
import { fakeApi } from "./support/fake-api";

const manifest = JSON.parse(readFileSync(join(__dirname, "..", "safelight.json"), "utf8")) as {
  id: string;
  permissions: { programs?: boolean };
  commands: { name: string; summary: string; usage: string[]; examples: string[]; subcommands: { name: string; summary: string }[] }[];
};

describe("activate", () => {
  it("registers the gmic command and the panel", () => {
    const rig = fakeApi();
    activate(rig.api);
    expect(rig.commands.map((c) => c.name)).toEqual(["gmic"]);
    expect(rig.panels.map((p) => p.id)).toEqual([PANEL_ID]);
    expect(rig.panels[0].defaultDock).toEqual({ module: "develop", direction: "right" });
  });

  it("declares in safelight.json the same command it registers, for the safelight command line", () => {
    const rig = fakeApi();
    activate(rig.api);
    const [registered] = rig.commands;
    const [declared] = manifest.commands;
    expect(declared).toEqual({
      name: registered.name,
      summary: registered.summary,
      usage: registered.usage,
      examples: registered.examples,
      subcommands: registered.subcommands,
    });
  });

  it("asks for the programs permission", () => {
    expect(manifest.id).toBe("gmic");
    expect(manifest.permissions.programs).toBe(true);
  });
});
