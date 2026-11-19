# G'MIC 2.0 — design

Anthony's brief (2026-11-16): settings in Preferences; preview in Develop,
automatically and lazily; behave like the other panels (preview eye, reset to
defaults, reorderable filters); export applies them to the exported image;
G'MIC-Qt's interactive preview components (points) work on the canvas. Then:
an extension store for filters and scripts, opened from a top-bar button, each
installed one a Develop panel of its own; the store is a pop-up window like
Extensions (core `registerWindow`), not a dock panel.

## Model

- Settings `installed`: `Item[]`, `{ id, kind: "filter", name, command }` or
  `{ id, kind: "script", name, source }`. The list's order is the order they
  apply in (the store's Installed tab reorders it).
- Each item is a panel `gmic.f.<id>`, registered as it is installed and
  unregistered (core `unregisterPanel`) as it is removed. `ownsBag:
  ["gmic.f.<id>"]` makes its eye hold off that item only.
- A photo's use of an item is in its bag under the same key:
  `{ on, values }`. Unknown keys survive normalizeParamBag, so undo, history
  and Copy/Paste carry it. Presets don't (they collect descriptor keys only).
- Reset: `{ on: false, values: {} }`, one undo step. A setting moved while
  off switches the item on.

## Running

All of a photo's switched-on items run in one gmic call: each becomes
`_sl_step_<n>` (a script defining commands gets `_sl_main_<n>`), followed by
`k[0]`. Pixels cross as `.cimg` float32 on G'MIC's 0–255 scale. The run sets
the variables G'MIC-Qt sets (`_preview_width` etc., `_host=safelight`).
Filters run their main command for preview and export alike.

## Live preview

- Stage `gmic`: view-only, `output-encode`, last, `space` perceptual Rec.709.
  `mode` (0 off, 1 exact, 2 approximate), `area` (the frame window the textures
  cover), `place` (where a resized result sits). Textures `gmicOut`, `gmicIn`,
  dynamic rgba16f, sampled at `viewUv` (top-left origin, the cropped frame,
  absolute when zoomed). `dormantWhen: { mode: 0 }`.
- Approximate: while the edit upstream has changed since the result, `c +=
  out − in`, so other sliders still move the image.
- Driver: the `develop-canvas-overlay` component. Input: `captureFloatFrame`
  at `pre-output` in the stage's space, the view's window (G'MIC-Qt previews
  the zoomed region too). Points move from frame % to window %. Debounced
  120 ms; one run at a time; latest wins. Panels held off (`bypassedPanels`)
  are left out.
- Filters whose `preview(factor)` has no `+`/`*` are true at one zoom only;
  their panel says which (factor 0: 100 %; else: whole photo in view).

## Export

`processPixels` reads the photo's saved bag at its cursor
(`catalog.getEditState`), runs the switched-on items at the frame's size,
returns the result (its size may change). An error fails the photo. Setting
`enabled` (default on) leaves G'MIC off for an export. The frame is in the
export's colour space; G'MIC's filters see those values.

## Core seams (3.2.6)

`registerTopBarButton` / `unregisterTopBarButton`, `registerWindow` /
`api.windows`, `unregisterPanel`,
`PanelContribution.ownsBag`, `DevelopState.bypassedPanels` for extensions.

## Since (2026-11-16, later)

- The store is a window (core `registerWindow`, maximizable), with a left rail:
  Filters and their categories, Scripts, Installed.
- Results are kept: the last four on the GPU as texture variants (`r1`, `r2`
  …), picked by view values `gmic.gmicOut`/`gmic.gmicIn`. A request whose key
  matches one is shown at once with no run, so a panel's eye held and let go,
  or a slider moved back, costs nothing. Another photo or framing drops them.
  Fewer are kept when they are big: core holds 64 MB a texture and 256 MB an
  extension (16 bytes a pixel as floats), so the oldest go before a new one is
  uploaded, the capture's long edge is capped to fit one texture
  (`textureEdge`), and a result past that is an error, not an upload core
  would refuse.
- Never black: every picture uploaded has alpha 2 (`READY_ALPHA`); core draws
  a variant it holds no data for as opaque black (alpha 1), and the stage then
  leaves the live colour alone. While a run is in flight the canvas shows
  Develop's thin top bar with a "G'MIC" tag (`Working` in Overlay.tsx).
- Interactive filters (definition starts `gui_check_x11_gdi32 0`: Curves,
  Colorize, Warp, Morph, Color Mask, Extract Foreground) open G'MIC's own
  window in their main command. Stacks run their preview command instead,
  which replays what was drawn (kept in quoted `value()` settings, as
  G'MIC-Qt passes them). Those with `gui_no_preview` (Color Mask, Extract
  Foreground) can't be installed. Drawing them isn't supported yet.

## Interactive editors (2026-11-16, later)

Curves, Warp and Colorize are drawn in Develop (`src/interactive/`). What is
drawn is the item's `data` in the bag: `{ curves: Curve[5] }` (x,y in 0–100,
G'MIC's `function1d 1` Hermite), `{ points: [dx,dy,sx,sy][] }` and
`{ points: [x,y,r,g,b][] }` (positions in % of the frame). Each runs as a
script job: the final pass of x_color_curves / x_warp / x_colorize
(`snippets.ts`, checked on gmic 4.0.7) then a call. Warp always passes the
four corner anchors. Points map to a zoomed preview's window. The panel shows
only the settings the editor lists. The preview commands were not used: Warp's
draws markers and Colorize's shows nothing.
