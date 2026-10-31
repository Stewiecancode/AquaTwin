import { Object3D, Vector3 } from "three";
import type { TwinState } from "../../shared/twin";

// Metadata is exported from the real pipe endpoints into glTF's Y-up coordinates.
export function createTownshipMotion(scene: Object3D) {
  const flows: {
    object: Object3D;
    start: Vector3;
    direction: Vector3;
    length: number;
    phase: number;
    affected: boolean;
  }[] = [];
  const leaks: Object3D[] = [];
  const sprays: Object3D[] = [];
  const halos: Object3D[] = [];
  scene.traverse((object) => {
    const data = object.userData;
    if (
      data.twinRole === "flow" &&
      Array.isArray(data.flowStart) &&
      Array.isArray(data.flowEnd)
    ) {
      const start = new Vector3().fromArray(data.flowStart),
        end = new Vector3().fromArray(data.flowEnd);
      const direction = end.sub(start),
        length = direction.length();
      if (length > 0)
        flows.push({
          object,
          start,
          direction: direction.normalize(),
          length,
          phase: Number(data.flowPhase) || 0,
          affected: !!data.flowAffected,
        });
    }
    if (["leak", "spray", "halo"].includes(data.twinRole)) {
      leaks.push(object);
      object.visible = false;
    }
    if (data.twinRole === "spray") sprays.push(object);
    if (data.twinRole === "halo") halos.push(object);
  });
  let upstream = 0,
    downstream = 0,
    elapsed = 0;
  return {
    flowCount: flows.length,
    update(delta: number, state: TwinState | null, running: boolean) {
      // Offline means the entire last visual pose freezes, including spray/halo.
      if (!state || !running) return;
      const dt = Math.min(Math.max(delta, 0), 0.1);
      elapsed += dt;
      upstream += 2.2 * dt;
      downstream += 2.2 * state.flowMultiplier * dt;
      for (const f of flows)
        f.object.position
          .copy(f.start)
          .addScaledVector(
            f.direction,
            (f.phase + (f.affected ? downstream : upstream)) % f.length,
          );
      for (const o of leaks) o.visible = state.leak.active;
      for (const o of sprays) {
        const k = Number(o.userData.sprayIndex) || 0,
          t = (elapsed + (k / 22) * 0.85) % 0.85;
        o.position.set(
          -9 + Math.sin(k * 2.4) * 0.7 * t,
          1.2 + 4.8 * t - 5 * t * t,
          0.15 + 2 * t,
        );
      }
      for (const o of halos) {
        const pulse = 1 + 0.15 * Math.sin(elapsed * 5);
        o.scale.set(pulse, 1, pulse);
      }
    },
  };
}
