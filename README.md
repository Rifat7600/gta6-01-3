# Dustline — Open-World Crime Game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Rifat7600/gta6-01-3/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Rifat7600/gta6-01-3/reward.svg)](https://make.fun/bounty/gta6-01)

**Dustline** is a 2D top-down open-world crime game set in a dusty desert-edge
city at midday. You are Rae, a wheelwoman fresh out of the county lockup,
working four jobs for the fixer who owns this town — before the heat owns you.

[Play it in the make.fun bounty — Make GTA 6](https://make.fun/bounty/gta6-01)

## What is in the game

- **A living city**: a road grid with traffic, sidewalks full of pedestrians,
  parks, a lake, and districts with their own names — Kestrel Flats, Old Mill
  Row, Cactus Gardens, The Yards, Harborlight and South Dock.
- **On foot and by car**: walk up to any car, press E to steal it, drive it,
  press E again to step out. Traffic follows the roads; pedestrians wander
  and flee speeding cars.
- **Wanted level**: stealing cars, hitting pedestrians and shooting at the
  police raise 1–5 stars. Dustline PD cars spawn and chase you; stay out of
  sight and the heat decays, or lay low near the Cactus Safehouse.
- **Four story missions**: Hot Start (steal a car and deliver it), The Courier
  (pick up and deliver a package), Tail the Runner (chase a fleeing car down),
  and Heat Escape (lose a three-star wanted level at the safehouse). Objective
  markers, a beacon and a compass arrow guide you; each job pays out.
- **Combat**: punch up close, or fire a pistol with limited ammo (F or mouse
  click). Ammo and health pickups are scattered around the city.
- **HUD**: health, money, ammo, wanted stars, a live minimap with police and
  mission markers, mission objective, speed and the in-game clock.
- **Feel**: smooth follow camera, engine hum, police sirens and pickup blips
  synthesized with WebAudio (M mutes), a start screen, pause, and progress
  (money and finished missions) saved in the browser.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| E | Steal / enter a car, exit a car |
| Mouse click or F | Punch / shoot toward the mouse |
| Space | Handbrake |
| P | Pause |
| R | Restart the current mission |
| M | Mute / unmute |
| Enter / click | Start from the title screen |

## Run it

Serve `game/` with any static file server and open `index.html`:

```sh
cd game && python3 -m http.server 8123
```

No build step, no libraries, no network requests — every file the game
loads lives under `game/`.

Scene presets for screenshots: `index.html?scene=cover|chase|mission|foot`.

## Layout

- `game/js/city.js` — the generated city: roads, buildings, parks, water
- `game/js/player.js` — on-foot movement, driving, stealing, combat
- `game/js/traffic.js` — traffic cars, pedestrians, parked cars
- `game/js/police.js` — wanted level and police chases
- `game/js/missions.js` — the four story missions
- `game/js/hud.js` — HUD, minimap, menus
- `game/js/audio.js` — synthesized WebAudio sound
- `game/js/scenes.js` — deterministic scene presets for screenshots
- `game/js/main.js` — game loop, input, camera, save/load
- `main.ts` — copies `game/` and `screenshots/` to the output directory
  and writes `dossier.json` with the kit's `buildDossier`

## License

MIT — see `LICENSE`.
