# G'MIC for Safelight

Runs [G'MIC](https://gmic.eu)'s filters and your own G'MIC scripts on photos, from a panel in Develop, from the **Terminal** extension's console and from the `safelight` command line. Each result is saved as a new photo beside its original, named `IMG_0001-gmic.png`, in 16 bits a channel.

G'MIC itself is a separate program, the command-line `gmic` from gmic.eu: this extension runs it. The panel walks you through getting it.

Needs Safelight 3.2.6.

## Set up

Open a photo in Develop and open the **G'MIC** panel.

- **Windows**: **Download G'MIC** downloads the newest command-line zip from gmic.eu in your browser. Unzip it into a folder you keep, then **Choose…** `gmic.exe` in it.
- **macOS**: install it with Homebrew (`brew install gmic`, which the panel copies for you), then **Find G'MIC**.
- **Linux**: install your distribution's `gmic` package, then **Find G'MIC**.

**Find G'MIC** looks where programs usually are; **Choose…** points at the program yourself. Safelight asks once whether this extension may run it.

The first time, the panel offers **Download filters**: G'MIC keeps its list of filters, the ones G'MIC-Qt shows, in an update it downloads from gmic.eu. **Update** fetches the newest one later.

## The panel

- **Filters**: search G'MIC's filters, pick one, and set it with its own controls. **Preview** runs it on a 1024-pixel version of the photo and shows the result in the panel; **Apply** runs it at the size chosen under **Apply at** (full size by default) and saves the result beside the photo.
- **Scripts**: write and keep your own G'MIC scripts, with the same Preview and Apply.

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

Scripts are kept in the extension's settings, so a script saved in the panel also runs as `gmic script <name>` in the Terminal and at the command line.

## The gmic command

The same words in the Terminal and after `safelight`:

| | |
|---|---|
| `gmic <G'MIC words…>` | Run G'MIC words on the photos: `gmic blur 3 sharpen 50` |
| `gmic filters [search]` | List the filters, or those matching every word |
| `gmic filter <name> [Name=value…]` | Run a filter by its name or command, its other settings at their defaults: `gmic filter "Sharpen [Unsharp Mask]" radius=2` |
| `gmic script <name> [Name=value…]` | Run a saved script |
| `gmic scripts` | List the saved scripts and their settings |
| `gmic run <words…>` | Run G'MIC words that start like one of these subcommands |
| `gmic help <command>` | G'MIC's own help for one of its commands |
| `gmic status` | Which gmic runs, and its version |
| `gmic update` | Download G'MIC's newest filters |

A setting's name can be shortened to the start of any of its words (`radius` for "Spatial Radius"), as long as only one setting matches. A choice takes its label or its number.

In the Terminal, the photos are the one open in Develop, or the Library's selection. At the command line they come after `--`: `safelight gmic blur 3 -- IMG_0001.NEF`, `safelight gmic filter "Black & White" -- @all`. With none named, the current photo.

At the command line, the extension uses the program and the scripts as Safelight last saved them, so set G'MIC up in the app first.

## Develop

```bash
npm install
npm run check    # typecheck, build, then test
```

The tests run against a fake API (`test/support/fake-api.ts`) and a fake gmic, so they need no G'MIC installed.

`test/real-gmic.test.ts` runs the same engine against a real gmic, and is skipped unless `GMIC_EXE` names it. It downloads G'MIC's filters the first time.

```bash
GMIC_EXE=/path/to/gmic npx vitest run test/real-gmic.test.ts --environment node
```

## Licence

GPL-3.0-or-later. G'MIC is a separate program, licensed CeCILL; this extension doesn't include it.
