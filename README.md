# Storm Shift

A first-person 3D web game built with **Three.js** and the **Rapier** physics engine for CSCI 310. Project 2 was the single-player game. Project 3 adds **Crew Shift**, an online co-op mode for 2-6 players running on a Node.js + **Socket.IO** server.

**▶ Play solo: https://utuub.github.io/storm-shift/** (runs in the browser, nothing to install)

**▶ Play online (Crew Shift):** run the server below, then open http://localhost:3000.

## Quick start (multiplayer)

With Docker (recommended):

```
docker compose up --build
```

Without Docker (Node.js 18 or newer):

```
npm install
npm start
```

Then open **http://localhost:3000** and click **Crew Shift**. To try it alone with two players, open the page in two browser windows side by side, give each a different name, and type the same crew code. Players on other computers on the same network open `http://<server computer's IP>:3000`. Three.js (r169) and Rapier (0.14) are bundled in `vendor/`, so the game runs without any CDN. Only the Google fonts need internet; without it the text falls back to a system font.

## Crew Shift (Project 3 multiplayer)

The same tornado hits the same store for everyone, and the whole crew restocks it together. Each worker earns their own credits and buys their own upgrades from Dale, and a live leaderboard tracks who's shelving the most.

| Project 3 requirement | How Storm Shift does it |
|---|---|
| Real-time message library + server-side JavaScript | `server/server.js` (Express + Socket.IO). The server owns the "who has which item" state, so two players can't grab the same can. Clients send their position 15 times a second and every grab, stock, throw, and hand-off as an event |
| Docker | `Dockerfile` + `docker-compose.yml`: `docker compose up --build` serves the game and the socket server on port 3000 |
| Interactions between players | **Bonk:** throw an item at a coworker and it knocks them dizzy for 1.6 s (stars over their head, screen shake) and knocks the item out of their hands. **Hand-off:** look at a coworker and press E to hand them the item you're holding. Thrown items physically bounce off other players. Racing for the same item: the server gives it to whoever grabbed first |
| See other players' location and action | Each player is a 3D worker with their name tag, apron color, and a drawn face. You see them walk (leg swing), crouch, carry their stack of items, throw (overhand arm swing), push their cart, and get stunned |
| Uploaded custom texture / avatar | `assets/corner-fresh-badge.png`, a custom Corner Fresh Market store badge image, is loaded as a texture onto every crew member's apron (`src/avatars.js`), so each player's avatar wears the store's uniform. |
| Game flow / rules updated for multiple players | Lobby with a crew code and host. The host picks the **shift size** (Rush 2 sections, Quick 5, Half 10, Full store 20) so the tornado only wrecks part of the store for shorter games. The shift ends when the crew has shelved every item (server-checked). End screen with awards: Employee of the Shift, Sharpshooter (trick shots), Team Player (hand-offs), Workplace Hazard (most bonks). Players can join a shift already in progress and get the current store state. Jess the hired coworker is turned off online since your coworkers are real. The pause menu doesn't stop the shift. When a player leaves, whatever they held drops where they stood, and the host role passes to the next player |

### How the store stays in sync

- **Same pile everywhere.** The host sends a random seed. Every client runs the same seeded tornado, so all 1,500 item flight paths and landing spots match. The host then reports where the pile actually settled after physics, and everyone snaps to it.
- **Whoever moves it reports it.** When you throw an item, knock items loose by pulling one out of the pile, or plow through items with your cart, your client reports where they come to rest and the others snap to the same spot.
- **Server is the referee.** Items are loose, shelved, or owned by one player. A grab that loses a race is denied and the item leaves your hands. The server also counts shelved items for the leaderboard and decides when the shift is done.

## Story

It's the closing shift at Corner Fresh Market when the tornado sirens go off. Dale, the general manager, locks the doors. Then the tornado touches down right in the middle of the store and sucks every one of the 1,500 items off the shelves into one giant pile in the main aisle. Dale's rule: nobody clocks out until the store is back in order.

## Features (specification)

| Requirement | How the game does it |
|---|---|
| 3D scene, camera, renderer | Three.js scene, first-person perspective camera (adjustable FOV), WebGL renderer with shadows |
| Lighting | Hemisphere light, a shadow-casting directional light, emissive ceiling fixtures, lightning flashes through the front windows during the storm |
| Player / environment / interactive objects | First-person worker; a store laid out like a real grocery: a glass-door cooler wall (dairy, frozen, drinks), open meat & deli cases on the back wall, wooden produce and bakery displays, 4 double-sided center gondolas for dry goods, checkouts, Dale's back office (its own room with a door, window, desk, and corkboard), locked doors. 1,500 grocery items (240 products, 3-10 of each); Dale the GM; Jess the coworker; a shopping cart |
| Materials & textures | Fresh food is just the food (bread loaves, buns, croissants, muffins, rotisserie chicken, steaks, deli slices); packaged goods are just the package. Every product has a procedural 3D model (apples, bananas, milk jugs, gable-top cartons, cans, jars, bottles, chip bags, bread loaves, egg cartons, meat trays, rotisserie chicken, muffins…) plus its own package label with a picture of what's inside (a tomato on the tomato soup, sugar cubes on the sugar) |
| Player input | WASD + mouse look, Shift sprint, Space jump, C crouch, mouse wheel or 1-9 to pick which held item is selected, **left click** to grab items and stock shelves, right click / Q to drop, E to talk to Dale or unload into the cart, F to push the cart, Tab checklist, Esc pause. Every key can be rebound |
| Object manipulation | Pick items up, carry a stack and cycle through it, place them on shelves, throw them (farther with upgrades, and with Trick Shot a throw into the right spot stocks it), push a cart that plows through the pile |
| Movement logic | Kinematic character controller with gravity, jumping, crouching, and a sprint stamina bar that locks out when empty. Dropped and falling items are live physics bodies. The tornado flight is a scripted arc with a swirl around the funnel. Jess walks routes around the gondolas |
| Collision detection & response | Rapier colliders for walls, shelves, items, the cart, and the GM. Raycasts pick the aimed item or shelf spot. The player walks through products on the floor; pulling an item out of the pile makes the ones on top of it fall |
| Game loop | `requestAnimationFrame` loop with a fixed 60 Hz physics step and an interpolated camera and cart |
| Reset | "Restart Shift" in the pause menu (click twice to confirm) or "Work Another Shift" on the end screen restocks the store and replays the tornado |
| Start / end states | Title screen (New Shift / Continue / Settings), story card, tornado cutscene, then play. The game ends when all 1,500 items are shelved, with a stats screen |
| Scoring & feedback | Credits per item with a combo multiplier, plus bonuses for each finished product and section. Floating +credits popups, "WRONG SPOT!", section-complete banners, sounds, live shelf tags (e.g. 4/7), and Dale's dialogue box |
| Upgrades | Dale's shop: carry size, walk speed, unlimited sprint, shopping cart (plus bigger carts), price scanner, section radar, longer reach, "The Scoop" multi-grab, throwing (Strong Arm, Trick Shot, Cannon Arm), and a coworker (Jess) who shelves items for you, carrying 1, then 2, then 3 per trip |
| Pause menu | Resume, Settings (mouse sensitivity, invert Y, FOV, render scale, shadows, FPS counter, fullscreen, master/effects/ambient volume), Controls (rebind any key), Save Game, Restart, Save & Quit. In fullscreen, Esc pauses and Esc again goes straight back in. Progress autosaves every 60 s |

## Look and sound

- Image-based reflections (Three.js `RoomEnvironment`) on the glossy floor, cans, bottles and cooler glass; tiled drop ceiling; hanging aisle signs; a soft vignette
- Head bob, footsteps, sprint FOV kick, and held items that sway while you walk
- A slow camera flyover behind the title screen
- An original soundtrack synthesized live with WebAudio (electric piano chords, bass, melody, drums). It ducks in menus and stops for the tornado. Volume is in Settings

## Performance

1,500 live Rapier bodies cost about 30-70 ms per physics step on a laptop. So:

- The tornado flight is scripted, not simulated. When items land, real physics settles the pile (sticky, high-damping bodies), and they freeze as soon as they stop.
- An item at rest becomes a **fixed** collider: still aimable, nearly free to simulate.
- Only dropped/falling items and items the pushed cart plows into become real dynamic bodies.
- Each product is a single `InstancedMesh`, and all static store geometry is merged into one mesh.
- The shadow map is drawn once, since nothing that casts a shadow moves.

Physics went from ~70 ms to under 1 ms per step.

## Run locally

Multiplayer: see Quick start above. Solo only: any static server works. `serve.py` is one that turns off caching so edits show up on a normal reload:

```
python serve.py 8310
```

Then open http://localhost:8310. Add `?debug` for test keys: F9 shelves everything but 5 items, and `=` adds 500 credits.

## Files

- `src/main.js` sets things up and handles the game loop, game states, the pause/settings screens, and input
- `src/catalog.js` holds all 240 products and their sizes
- `src/models.js` builds the procedural 3D model for each product
- `src/store.js` handles the store layout, shelf bays, slots, signs, lights, and the tornado pile grid
- `src/items.js` handles instanced rendering plus active/resting physics for items
- `src/storm.js` is the tornado cutscene
- `src/player.js` is the first-person character controller
- `src/carry.js` covers aiming, pickup, stocking, dropping, the cart, scanner, and radar
- `src/cart.js` is the shopping cart
- `src/gm.js` + `src/upgrades.js` are Dale and his upgrade shop
- `src/coworker.js` is Jess, the hired coworker
- `vendor/` holds Three.js r169 (core + the addons the game uses) and Rapier 0.14, with their licenses
- `src/art.js` draws the picture for every product (package labels and HUD icons)
- `src/settings.js` + `src/save.js` handle settings and key binds, and save games (localStorage)
- `src/physics.js` handles the Rapier setup, collision groups, and raycasts
- `src/hud.js`, `src/audio.js`, and `src/textures.js` handle the HUD, synthesized sounds, and canvas textures
- `src/online.js` is Crew Shift: the lobby, the Socket.IO connection, syncing items and players, bonks, hand-offs, and the leaderboard
- `src/avatars.js` draws the other players (drawn face, name tag, apron, held items, cart, animations)
- `server/server.js` is the Node.js game server (Express for files, Socket.IO for the game)
- `assets/corner-fresh-badge.png` is the store badge texture on the crew aprons
