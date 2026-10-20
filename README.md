# Storm Shift

A first-person, single-player 3D web game built with **Three.js** and the **Rapier** physics engine for CSCI 310 (Project 2).

## Story

It's the closing shift at Corner Fresh Market when the tornado sirens go off. Dale, the general manager, locks the doors to keep everyone inside and safe. Then the storm hits the building. When it passes, every one of the store's 1,500 items is on the floor, and Dale has one rule: nobody clocks out until the store is back in order.

## Features (specification)

| Requirement | How the game does it |
|---|---|
| 3D scene, camera, renderer | Three.js scene with a first-person perspective camera and a WebGL renderer with soft shadows |
| Lighting | Hemisphere light, a shadow-casting directional light, emissive ceiling fixtures, and lightning flashes through the front windows |
| Player / environment / interactive objects | First-person worker; store with 10 double-sided shelving units, checkouts, office, locked doors; 1,500 grocery items (240 products across 20 sections, 3-10 of each); the GM (Dale); a shopping cart |
| Materials & textures | Every product gets its own procedurally drawn package label (canvas texture). Shelf tags, aisle signs, and the floor tiles are drawn the same way |
| Player input | WASD + mouse look (pointer lock), Shift sprint, click to grab, E to stock / talk / unload, Q or right-click to drop, F to push the cart, Tab for the checklist |
| Object manipulation | Pick items up, carry a stack, place them on shelves, throw them, push a cart that plows items aside |
| Movement logic | Kinematic character controller with gravity and sliding; items move by physics (velocity, impulses) and a scripted storm flight |
| Collision detection & response | Rapier colliders for walls, shelves, items, the cart, and the GM. Walking into items kicks them around, and walls and shelves block the player. Raycasts pick the aimed item or shelf slot |
| Game loop | `requestAnimationFrame` loop with a fixed 60 Hz physics step and interpolated camera |
| Reset | Press R twice (or "Work Another Shift") to restock the store and replay the storm |
| Start / end states | Title screen, story card, storm cutscene, then play. The game ends when all 1,500 items are shelved, with a stats screen |
| Scoring & feedback | Credits per item with a combo multiplier, bonuses for finished products and sections. Green/red screen flash, sounds, live shelf tags (e.g. 4/7), toasts, and a progress bar |
| Upgrades | Dale's upgrade tree: carry capacity, walk speed, unlimited sprint, shopping cart (+ bigger carts), price scanner, section radar, longer reach, and "The Scoop" multi-grab |

## Performance

Keeping 1,500 live rigid bodies in Rapier cost about 30-70 ms per physics step on a laptop. So:

- The storm flight is a cheap scripted fall (gravity, bounces, tumbling, settling onto a face).
- An item at rest becomes a **fixed** collider (still aimable, nearly free to simulate).
- Items within about 1 m of the player or the pushed cart are woken into real dynamic bodies, so they can still be kicked around.
- Each product is a single `InstancedMesh`, so there are about 240 draw calls, not 1,500.

Result: physics went from ~70 ms to under 1 ms per step.

## Run locally

Any static server works, for example:

```
python -m http.server 8310
```

Then open http://localhost:8310. Add `?debug` for test keys: F9 shelves everything but 5 items, and `=` adds 500 credits.

## Files

- `src/main.js` sets things up, runs the game loop, and handles input and game states
- `src/catalog.js` holds all 240 products and the item shapes
- `src/store.js` handles the store layout, shelf packing, slots, signs, and lights
- `src/items.js` handles instanced rendering plus active/resting physics for items
- `src/storm.js` is the opening storm cutscene
- `src/player.js` is the first-person character controller
- `src/carry.js` covers aiming, pickup, stocking, dropping, the cart, scanner, and radar
- `src/cart.js` is the shopping cart
- `src/gm.js` + `src/upgrades.js` are Dale and the upgrade tree
- `src/hud.js`, `src/audio.js`, and `src/textures.js` handle the HUD, synthesized sounds, and canvas textures
