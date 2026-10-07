# Low Tolerance Zoo

A ZZT or MegaZeux-inspired, tile-based game maker and player built with vanilla JavaScript and HTML5 Canvas. A built in sprite editor that creates reusable sprites with a light and dark color inspired by text-mode (codepage 437) graphics. A modern reinterpretation.

---

## Screenshot

> 📸 
![low tolerance editor](https://github.com/ArtofLimitations/LowToleranceZoo/blob/new-main/Screenshot%202026-08-04%20222125.png)
---

[Try Editor Demo](https://lowtolerance.app/) -
[Player Demo Here](https://lowtolerance.app/player.html)

<a href="https://discord.gg/rcgEt8jY"><img src="https://github.com/ArtofLimitations/LowToleranceZoo/blob/e2f9bd4095b6a3e696786a6ea104764fd8d049e5/discord-logo-1.svg" align="left" height="24"></a>  <br><br>

[Download Test World](https://github.com/ArtofLimitations/LowToleranceZoo/blob/new-main/testing-world.ltz)

## Features

- Tile-based world editor with multi-layer support (floor, default, ceiling)
- Built-in sprite editor and color palette
- Object scripting system with a ZZT-style scripting language
- Multi-board worlds with board linking (north/south/east/west)
- Passage/portal system for board transitions
- Weapon and bullet system
- Per-board and world-level settings (dark mode, night mode, player lock, etc.)
- Save and load worlds as JSON files
- Separate editor (`index.html`) and player (`player.html`) views

---

## Getting Started

### Requirements

- [Node.js](https://nodejs.org/)
- [http-server](https://www.npmjs.com/package/http-server) (installed globally or via npm)

### Install dependencies

```bash
npm install
```

### Run the editor

```bash
npm start
```

Then open `http://localhost:8080` in your browser.

### Run the player directly

```bash
npm run start-player
```

---

## Editor Overview

| Key | Action | Key | Action |
|-----|--------|-----|--------|
| `E` | Open Sprite Editor | `PageUp` | Switch to next board |
| `C` | Open Color Palette | `PageDown` | Switch to previous board |
| Arrow keys | Move cursor | `Ctrl-Enter`| Grab color only |
| Left click | Place tile | `Z` | Move player |
| Right click | Grab tile | `V`| Sprite gallery |
| `Ctrl-Right` Click | Grab Tile Color | `X` | Swap colors |
| `Ctrl+Z` | Undo | `+` | Next sprite |
| `Ctrl+R` | Redo | `-` | Previous sprite |
| `Ctrl+S` | Save Board with Spritesheet | `B` | Board selector |
| `F1` | Save World | `I` | Open board info |
| `F3` | Load World | | |
| `D` | Draw Mode | `Space` | Plot |
| `F` | Fill Mode | `M` | Audio import| 
| `Tab` | Paint Mode | | |
| `/` | Lighten Mode | `F9` | Terrain types |
| `*` | Darken Mode | `F10` | Item types |
| `O` | Place Object | `.` | Place Sign | 
| `1` | Switch to layer 1 | `Delete` | Delete all sprites on current layer |
| `2` | Switch to layer 2 | `H` | Hide current layer |
| `3` | Switch to layer 3 |  `R` | Reset board |

Tile types that can be placed: `wall`, `object`, `sign`, `passage`, `coin`, `ammo`, `invisible` wall, `break`able, `empty`, `push`, `step`, more to come

Layers: **1** = Floor, **2** = Default, **3** = Ceiling

---

## Object Scripting

Objects placed with type `object` can have a script attached to them. Scripts are written in a simple line-based language. Each object runs its script once per tick.

### Script Structure

```
@MyObjectName

:touch
Hello there!
#give health 10
#end

:thud
#move opp flow
```

### Special Prefixes

| Prefix | Purpose |
|--------|---------|
| `@Name` | Set the object's name |
| `:label` | Define a label (jump target) |
| `*message text` | Show a status message on screen |
| `Text with no prefix` | Show dialog text (paginated, pauses the game) |
| `-- comment` | Comment (ignored) |

### Event Labels

These labels are triggered automatically by the engine:

| Label | Triggered when... |
|-------|-------------------|
| `:touch` | The player walks into the object |
| `:thud` | The object bumps into a wall or blocked tile |
| `:shot` | The object is hit by a bullet |
| `:click` | The player clicks the object |
| `:bump` | The object bumps into the player |
| `:collect` | Like :touch but executes following code in one tick |

---

### Command Reference

#### Movement

| Command | Description |
|---------|-------------|
| `#move [dir]` | Move object one half-step in a direction |
| `#step [dir]` | Move object one full tile in a direction |
| `#push [dir]` | Move in a direction, pushing objects in the way |
| `#try [dir] [:fallback]` | Attempt to move; jump to label if blocked |
| `#moveto x y` | Teleport object to tile coordinates |
| `#moveto x y force` | Teleport, destroying whatever is at the target |

**Direction values:** `n` / `north` / `up`, `s` / `south` / `down`, `e` / `east` / `right`, `w` / `west` / `left`

**Direction modifiers:**

| Modifier | Meaning |
|----------|---------|
| `seek` | Toward the player |
| `flow` | Object's current facing direction |
| `opp [dir]` | Opposite of the given direction |
| `rndany` / `random` | A random direction |

**Slash path notation** — move along a path in one line:

```
/n/n/e/e/i/s
```

`i` = pause one tick. Uppercase letter (e.g. `/N`) = full-tile step.

---

#### Timing & Flow

| Command | Description |
|---------|-------------|
| `#wait n` | Pause for `n × 50 ms` |
| `#sleep n` / `#idle` | Pause for `n × 1000 ms` (seconds) |
| `#cycle n` | Set the object's tick speed (in frames) |
| `#end` | Stop the script (object goes idle) |
| `#loop` | Jump to `:loop` label (must exist) |
| `#restart` | Restart script from the top |
| `#send :label` | Jump to a label in this object |
| `#send @Name :label` | Send a label trigger to a named object |

---

#### Conditionals & Variables

| Command | Description |
|---------|-------------|
| `#if condition then :label` | Jump to label if condition is true |
| `#if condition then #command` | Execute a command if condition is true |
| `#set flagname` | Set a boolean flag |
| `#clear flagname` | Clear a boolean flag |
| `#let $var = value` | Set a global variable |
| `#maybe :label` | 50% chance to jump to label |
| `#maybe #command` | 50% chance to run a command |

**`#if` condition syntax:**

```
#if flag then :label
#if $var = 5 then :label
#if $a + $b >= 10 then :win
#if p.ammo < 1 then :warning
#if rnd(5) = 3 then :lucky
```

**Comparison operators:** `=` / `==`, `!=` / `<>`, `<`, `>`, `<=`, `>=`

**Value types:**
- `flagname` — truthy flag check
- `$varname` — global variable
- `p.statname` — player stat (e.g. `p.health`, `p.ammo`, `p.coins`)
- `rnd(n)` — random integer from 0 to n
- `rnd(n,m)` — random integer from n to m

---

#### Player Stats

| Command | Description |
|---------|-------------|
| `#give item [amount]` | Give the player an item/stat (default: 1) |
| `#take item [amount]` | Take from player stat (default: 1) |
| `#take item all` | Take all of a stat |
| `#take item half` | Take half of a stat |
| `#take item n :label` | Take n, jump to label if player can't afford it |
| `#hurt` | Flash the player red |

**Stat names:** `health`, `ammo`, `coins` (and any custom stats defined in world settings)

---

#### Appearance

| Command | Description |
|---------|-------------|
| `#change n dark light` | Change sprite and both colors (named or RGB) |
| `#changesprite n` / `#sprite n` | Change the sprite number only |
| `#changecolor color` / `#color color` | Change the object's color |
| `#hidelayer n` | Hide canvas layer 1, 2, or 3 |
| `#showlayer n` | Show canvas layer 1, 2, or 3 |
| `#nightmode` | Toggle night mode on/off |

---

#### Combat

| Command | Description |
|---------|-------------|
| `#shoot [dir]` | Fire a bullet in a direction |
| `#die` | Remove this object from the board |

Direction values and modifiers (`seek`, `flow`, `opp`) work the same as movement.

---

#### Audio

Playback is handled by [Howler.js](https://howlerjs.com/) (vendored at
`js/modules/howler.js`, wrapped by `js/audio.js`). Audio files are imported
in the editor (`M`), stored in the project, and streamed from memory in the
player — nothing is fetched at runtime.

| Command | Description |
|---------|-------------|
| `#music name` | Play a track from the **music** category. Starts a new track and stops the current one. |
| `#play name` | Alias for `#music` |
| `#sfx name` | Play a sound effect. Plays *over* music without interrupting it. |
| `#sound name` | Alias for `#sfx` |
| `#pause` | Pause the current music track (resumes where it left off) |
| `#resume` | Resume paused music. `#unpause` is an alias |
| `#musicpause` | Toggle pause / resume |
| `#stop [fade ms]` | Stop the current music, optionally fading out first |
| `#volume n` | Set global output level, `0`–`100` |
| `#mute` / `#unmute` | Silence or restore all output (independent of `#volume`) |
| `#audiostatus` | Log the current audio state to the console |

**Optional arguments** on `#music` / `#play` / `#sfx`:

| Modifier | Example | Description |
|----------|---------|-------------|
| `loop` | `#music theme loop` | Loop the track (music only) |
| `fade n` / `fadein n` | `#music theme fade 500` | Fade in over `n` ms |
| `fadeout n` | `#music theme fadeout 800` | Fade out the *outgoing* track over `n` ms |
| `volume n` / `vol n` | `#sfx coin volume 80` | Track volume, `0`–`100` |

A track may be named by bare filename (`theme.ogg`) or full store key
(`audio/music/theme.ogg`); both work.

Only one music track plays at a time — starting a new one stops the previous.
SFX overlap freely (up to 12 at once). The editor accepts `.ogg`, `.oga`,
`.opus`, `.mp3`, `.wav`, `.flac`, `.m4a`, `.aac` and `.webm`.

Browsers block audio until the user interacts with the page, so the player
wakes the audio context on the first keypress or click. A track started before
that point is skipped rather than silently failing later.

---

#### Messaging & Dialog

| Command | Description |
|---------|-------------|
| `*Text` (no command) | Show a status message using the current style |
| `Plain text` (no prefix) | Show dialog box (pauses game, paginated with `<page>`) |
| `#text message` | Show dialog (legacy single-line form) |
| `#message preset name` | Apply a named message style preset |
| `#message reset` | Reset message style to default |
| `#message x n` | Set message X position |
| `#message y n` | Set message Y position |
| `#message duration ms` | Set message display duration |
| `#message color #hex` | Set message text color |
| `#message bgcolor #hex` | Set message background color |
| `#message font "..."` | Set message font string |
| `#message style "..."` | Apply raw CSS to the message element |
| `#dialog style "..."` | Apply raw CSS to the dialog box |
| `#dialog mergestyle "..."` | Merge CSS into the dialog box defaults |
| `#dialog default` | Reset dialog style to default |

**Message style presets:** `alert`, `info`, `warning`, `success`, `error`, `tip`, `subtle`, `big`, `centered`

```
@MyObjectName

:touch
Hello there! I Have a lot to say! <page> Which is why I will paginate this text!
#end
```

---

#### Script Control

| Command | Description |
|---------|-------------|
| `#lock` | Lock object (ignores player touch, bullets, and `#send`) |
| `#unlock` | Unlock object |
| `#zap :label` | Disable one instance of a label |
| `#restore :label` | Re-enable a zapped label |
| `#zapall` | Disable all labels on this object |
| `#bind @Name` | Copy script and labels from another named object |
| `#use mixinName` | Inline-expand a previously defined mixin |
| `#debug` | Log script state to the browser console |

---

### Mixins

Reusable script blocks that can be defined at the top of a script and called with `#use`:

```
@mixin patrol
#move seek
#sleep 1
@endmixin

:loop
#use patrol
#loop
```

---

## World & Board Settings

Configured through the Object Editor or programmatically in world save data.

**World settings:**
- Starting stats (health, ammo, coins)
- Death board
- Global scripts

**Per-board settings:**
- Player start position
- Linked boards (north/south/east/west)
- Dark mode, night mode
- Layer opacity (1–3)
- Player locked, player can attack
- Bullet limit
- Board script

---

## File Format

Worlds are saved as `.ltz` files: a **ZIP archive with a renamed extension**.

```
project.ltz
├── manifest.json          version, project name, file index, audio manifest
├── world.json             sprite sheet, boards, world data, world + board settings
└── audio/
    ├── music/*.ogg|.mp3|.wav|...
    └── sfx/*.ogg|.mp3|.wav|...
```

Plain `.json` world files from earlier versions are still accepted on load
(the dialog offers both) and are detected by extension.

Use **F1** to save and **F3** to load in the editor. In the player, **F3** loads
a `.ltz` and **`L`** loads a legacy single-board `.json`.

See `js/ltz.js` for the read/write implementation — it is the smallest,
best-documented module in the project. `ltzSelfTest()` is runnable from the
browser console as a round-trip smoke test.

---

## Tests

```bash
npm test
```

Covers the audio subsystem: the ES-module interop on the vendored Howler
build, codec-table agreement with the format map, track lookup, format
sniffing and volume clamping. Playback itself needs a real browser audio
backend and is not covered — those tests assert the pure logic around it.

---

## Planned / Future Features

> This section is a placeholder for roadmap items.

- [x] Sound / music support
- [ ] Audio preview in the editor's audio importer
- [ ] More built-in weapon types
- [ ] Additional board transition effects
- [ ] Expanded scripting commands
- [ ] Packaging / export for distribution

---

## License

ISC — see `package.json`

**Author:** Dustin Davidson
