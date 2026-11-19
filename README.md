# G'MIC for Safelight

Brings [G'MIC](https://gmic.eu)'s filters, and G'MIC scripts you write, into Develop. Each one you install from the **G'MIC store** becomes a Develop panel of its own, like any other: switch it on, set it, see it on the photo as you go, hold its eye to look without it, or reset it. Every export applies it. The same G'MIC also runs from the **Terminal** extension's console and the `safelight` command line.

G'MIC itself is a separate program, the command-line `gmic` from gmic.eu: this extension runs it. The store walks you through getting it.

Needs Safelight 3.2.6.

## Set up

Click the G'MIC button in the top bar: the store opens in its own window, as Extensions does.

- **Windows**: **Download G'MIC** downloads the newest command-line zip from gmic.eu in your browser. Unzip it into a folder you keep, then **Choose…** `gmic.exe` in it.
- **macOS**: install it with Homebrew (`brew install gmic`, which the store copies for you), then **Find G'MIC**.
- **Linux**: install your distribution's `gmic` package, then **Find G'MIC**.

Safelight asks once whether this extension may run it. The first time, the store offers **Download filters**: G'MIC keeps its list of filters, the ones G'MIC-Qt shows, in an update it downloads from gmic.eu.

**Preferences ▸ G'MIC** has the same set-up, **Update filters**, the preview's size and the size the `gmic` command runs at.

## The store

- **Filters**: search G'MIC's filters, or pick a category in the sidebar, and **Install** the ones you want. Each opens as a Develop panel.
- **Scripts**: write your own. Each script is a panel too.
- **Installed**: everything installed, in the order it applies, top first. Drag to reorder; **Remove** takes a panel away.

## In Develop

A G'MIC panel is off until you switch it on or move one of its settings. Its settings are kept with the photo's edit, so undo, Copy and Paste Settings, and the history carry them.

The preview runs G'MIC on what the view shows, a moment after you stop changing things. While it runs, a thin bar along the top of the photo says G'MIC is working, other sliders still move the image, and the fresh result replaces it when G'MIC is done. Zoomed in, the preview is of the part in view at its true size, as G'MIC-Qt previews it. A filter whose preview is only true at 100 %, or only with the whole photo in view, says so in its panel.

G'MIC's interactive filters, which in G'MIC-Qt open G'MIC's own window to draw in, are drawn here in Develop instead:

- **Curves**: a curve per channel of its colour space, in its panel. Press to add a point, drag to move it, double-click to remove it.
- **Warp [Interactive]**: choose **Add keypoints on the photo**, then press on what to move and drag it where it goes.
- **Colorize [Interactive]**: pick a colour, choose **Place colours on the photo**, and press where it goes; each colour is listed in the panel to change or remove.

Double-click a point on the photo to remove it; Esc stops placing. Morph, Color Mask and Extract Foreground need G'MIC's own window and aren't available.

A setting that is a point on the photo (a centre, a position) shows on the canvas as a handle while you work in that filter's panel: drag it.

**Export** applies the photo's switched-on G'MIC panels to the exported image at its own size, in the installed order. **Apply G'MIC filters**, in the Export panel's G'MIC section, leaves them off for an export. If G'MIC fails on a photo, that photo's export fails with G'MIC's message rather than going out without its look.

Presets don't carry G'MIC panels yet.

## Scripts

A script is G'MIC words, one step a line, run on the photo in turn:

```
#@gui : Radius = float(2,0,20)
#@gui : Amount = float(40,0,200)
blur $1
sharpen $2
```

`#@gui : Name = type(…)` lines, written as G'MIC-Qt writes them, give a script its settings: `float(default,min,max)`, `int(default,min,max)`, `bool(default)`, `choice(default,"A","B")`, `color(r,g,b)`, `text("default")` and `point(x,y)`. They reach the script as `$1`, `$2` and on, in order.

A script that defines its own commands (a name and a colon at the start of a line) starts at the one called `main`:

```
main :
  my_tone $1

my_tone :
  mul $1
```

## The gmic command

The same words in the Terminal and after `safelight`. These save each result as a new photo beside its original, named `IMG_0001-gmic.png`, in 16 bits a channel:

| | |
|---|---|
| `gmic <G'MIC words…>` | Run G'MIC words on the photos: `gmic blur 3 sharpen 50` |
| `gmic filters [search]` | List the filters, or those matching every word |
| `gmic filter <name> [Name=value…]` | Run a filter by its name or command, its other settings at their defaults: `gmic filter "Sharpen [Unsharp Mask]" radius=2` |
| `gmic script <name> [Name=value…]` | Run one of your scripts |
| `gmic scripts` | List your scripts and their settings |
| `gmic run <words…>` | Run G'MIC words that start like one of these subcommands |
| `gmic help <command>` | G'MIC's own help for one of its commands |
| `gmic status` | Which gmic runs, and its version |
| `gmic update` | Download G'MIC's newest filters |

A setting's name can be shortened to the start of any of its words (`radius` for "Spatial Radius"), as long as only one setting matches. A choice takes its label or its number.

In the Terminal, the photos are the one open in Develop, or the Library's selection. At the command line they come after `--`: `safelight gmic blur 3 -- IMG_0001.NEF`. With none named, the current photo. At the command line, the extension uses the program and the scripts as Safelight last saved them, so set G'MIC up in the app first.

## Develop

```bash
npm install
npm run check    # typecheck, build, then test
```

The tests run against a fake API (`test/support/fake-api.ts`) and a fake gmic, so they need no G'MIC installed. `test/real-gmic.test.ts` runs the engine against a real gmic, and is skipped unless `GMIC_EXE` names it:

```bash
GMIC_EXE=/path/to/gmic npx vitest run test/real-gmic.test.ts --environment node
```

## Licence

GPL-3.0-or-later. G'MIC is a separate program, licensed CeCILL; this extension doesn't include it.
