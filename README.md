# Storm Shift

A first-person, single-player 3D web game built with **Three.js** and the **Rapier** physics engine for CSCI 310 (Project 2).

## Story

It's the closing shift at Corner Fresh Market when the tornado sirens go off. Dale, the general manager, locks the doors. Then the tornado touches down right in the middle of the store and sucks every one of the 1,500 items off the shelves into one giant pile in the main aisle. Dale's rule: nobody clocks out until the store is back in order.

## Features (specification)

| Requirement | How the game does it |
|---|---|
| 3D scene, camera, renderer | Three.js scene, first-person perspective camera (adjustable FOV), WebGL renderer with shadows |
| Lighting | Hemisphere light, a shadow-casting directional light, emissive ceiling fixtures, lightning flashes through the front windows during the storm |
| Player / environment / interactive objects | First-person worker; store with 4 double-sided gondolas (one full bay per section, 20 sections), checkouts, office, locked doors; 1,500 grocery items (240 products, 3-10 of each); Dale the GM; a shopping cart |
| Materials & textures | Every product has a procedural 3D model (apples, bananas, milk jugs, gable-top cartons, cans, jars, bottles, chip bags, bread loaves, egg cartons, meat trays, rotisserie chicken, muffins…) plus its own canvas-drawn label |
| Player input | WASD + mouse look, Shift sprint, **left click** to grab items and stock shelves, right click / Q to drop, E to talk to Dale or unload into the cart, F to push the cart, Tab checklist, Esc pause. Every key can be rebound |
| Object manipulation | Pick items up, carry a stack, place them on shelves, throw them, push a cart that plows through the pile |
| Movement logic | Kinematic character controller with gravity and sliding. Items near the player are live physics bodies you can kick. The tornado flight is a scripted arc with a swirl around the funnel |
| Collision detection & response | Rapier colliders for walls, shelves, items, the cart, and the GM. Raycasts pick the aimed item or shelf spot. Walking into items shoves them |
| Game loop | `requestAnimationFrame` loop with a fixed 60 Hz physics step and an interpolated camera and cart |
| Reset | Press R twice (or "Work Another Shift") to restock the store and replay the tornado |
| Start / end states | Title screen (New Shift / Continue / Settings), story card, tornado cutscene, then play. The game ends when all 1,500 items are shelved, with a stats screen |
| Scoring & feedback | Credits per item with a combo multiplier, plus bonuses for each finished product and section. Floating +credits popups, "WRONG SPOT!", section-complete banners, sounds, live shelf tags (e.g. 4/7), and Dale's dialogue box |
| Upgrades | Dale's shop: carry size, walk speed, unlimited sprint, shopping cart (plus bigger carts), price scanner, section radar, longer reach, and "The Scoop" multi-grab |
| Pause menu | Resume, Settings (mouse sensitivity, invert Y, FOV, render scale, shadows, FPS counter, master/effects/ambient volume), Controls (rebind any key), Save Game, Save & Quit. Progress also autosaves every 60 s |

## Performance

1,500 live Rapier bodies cost about 30-70 ms per physics step on a laptop. So:

- The tornado flight is scripted, not simulated.
- An item at rest becomes a **fixed** collider: still aimable, nearly free to simulate.
- Only items within about 1 m of the player or the pushed cart wake up into real dynamic bodies.
- Each product is a single `InstancedMesh`, and all static store geometry is merged into one mesh.
- The shadow map is drawn once, since nothing that casts a shadow moves.

Physics went from ~70 ms to under 1 ms per step.

## Run locally

Any static server works, for example:

```
python -m http.server 8310
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
- `src/settings.js` + `src/save.js` handle settings and key binds, and save games (localStorage)
- `src/physics.js` handles the Rapier setup, collision groups, and raycasts
- `src/hud.js`, `src/audio.js`, and `src/textures.js` handle the HUD, synthesized sounds, and canvas textures
