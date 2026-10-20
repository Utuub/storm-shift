import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };

// Collision group bits. Every collider keeps filter 0xffff, so what a
// ray or the character controller hits is picked by membership alone.
export const G = {
  STATIC: 0x0001,
  ITEM: 0x0002,
  CART: 0x0004,
  PLAYER: 0x0008,
  SLOT: 0x0010,
  NPC: 0x0020,
  QUERY: 0x8000,
};

export const groups = (member, filter = 0xffff) => ((member & 0xffff) << 16) | (filter & 0xffff);
export const queryGroups = (mask) => groups(G.QUERY, mask);

export const STEP = 1 / 60;
export let world = null;

export async function initPhysics() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  world.integrationParameters.numSolverIterations = 2;
  return world;
}

export function addStaticBox(cx, cy, cz, hx, hy, hz, member = G.STATIC) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
  return world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz).setCollisionGroups(groups(member)).setFriction(0.8),
    body,
  );
}

// Sensor box used for aiming at shelf slots. Only scene queries see it.
export function addSensorBox(cx, cy, cz, hx, hy, hz, member) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
  return world.createCollider(
    RAPIER.ColliderDesc.cuboid(hx, hy, hz).setSensor(true).setCollisionGroups(groups(member, G.QUERY)),
    body,
  );
}

export function castRay(origin, dir, maxDist, mask, includeSensors = false) {
  const ray = new RAPIER.Ray(
    { x: origin.x, y: origin.y, z: origin.z },
    { x: dir.x, y: dir.y, z: dir.z },
  );
  const flags = includeSensors ? undefined : RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
  const hit = world.castRay(ray, maxDist, true, flags, queryGroups(mask));
  return hit ? { collider: hit.collider, dist: hit.timeOfImpact } : null;
}
