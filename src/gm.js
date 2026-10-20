import * as THREE from 'three';
import { RAPIER, world, groups, G } from './physics.js';
import { textTexture } from './textures.js';

// Dale, the general manager. Stands behind the office desk and sells upgrades.
export class GM {
  constructor(scene, office) {
    const g = new THREE.Group();
    const m = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const part = (geo, mat, x, y, z) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      g.add(mesh);
      return mesh;
    };
    const pants = m(0x2b2f3a);
    part(new THREE.BoxGeometry(0.17, 0.85, 0.2), pants, -0.11, 0.425, 0);
    part(new THREE.BoxGeometry(0.17, 0.85, 0.2), pants, 0.11, 0.425, 0);
    part(new THREE.BoxGeometry(0.5, 0.65, 0.28), m(0xf2f2f0), 0, 1.18, 0);   // shirt
    part(new THREE.BoxGeometry(0.07, 0.42, 0.02), m(0x9b1c1c), 0, 1.2, 0.15); // tie
    part(new THREE.BoxGeometry(0.12, 0.6, 0.14), m(0xf2f2f0), -0.32, 1.18, 0);
    part(new THREE.BoxGeometry(0.12, 0.6, 0.14), m(0xf2f2f0), 0.32, 1.18, 0);
    part(new THREE.SphereGeometry(0.16, 16, 12), m(0xd9a77c), 0, 1.68, 0);   // head
    part(new THREE.BoxGeometry(0.3, 0.08, 0.3), m(0x6b6b6b), 0, 1.82, -0.02); // hair
    part(new THREE.BoxGeometry(0.1, 0.05, 0.01), m(0x2e7d4f), 0.13, 1.38, 0.145); // name badge

    const tag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTexture('DALE · GM', { w: 256, h: 64, bg: 'rgba(46,125,79,0.9)' }),
    }));
    tag.scale.set(0.8, 0.2, 1);
    tag.position.set(0, 2.15, 0);
    g.add(tag);

    this.alert = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTexture('$', { w: 64, h: 64, bg: 'rgba(243,156,18,0.95)', font: 'bold 44px Arial' }), depthTest: false,
    }));
    this.alert.scale.set(0.3, 0.3, 1);
    this.alert.position.set(0, 2.5, 0);
    this.alert.visible = false;
    g.add(this.alert);

    g.position.set(office.x, 0, office.z - 0.9);
    scene.add(g);
    this.group = g;
    this.pos = g.position;

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(g.position.x, 0.95, g.position.z));
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.42, 0.95, 0.2).setCollisionGroups(groups(G.NPC)),
      body,
    );
  }

  update(t, canAfford, playerPos) {
    this.alert.visible = canAfford;
    this.alert.position.y = 2.5 + Math.sin(t * 4) * 0.06;
    // turn to face the player
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }
}
