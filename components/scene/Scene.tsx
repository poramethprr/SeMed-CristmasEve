"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { ChristmasTree } from "./Tree";
import { AtmosphereRig, Falling, Ground, SceneProps } from "./World";
import { getGrowth, type EventPhase } from "@/lib/eventTime";
import type {
  Atmosphere,
  CameraPresetName,
  DbDeco,
  DbTree,
  Fx,
  LightMode,
} from "@/lib/types";

const PRESETS: Record<CameraPresetName, { pos: [number, number, number]; look: [number, number, number] }> = {
  overview: { pos: [0, 5.5, 13], look: [0, 2.6, 0] },
  reset: { pos: [0, 5.5, 13], look: [0, 2.6, 0] },
  tree: { pos: [0, 3.6, 6], look: [0, 3, 0] },
  wishes: { pos: [-6.5, 2.4, 8.5], look: [-6.5, 1.5, 2.5] },
};

function CameraRig({ preset }: { preset: { name: CameraPresetName; nonce: number } }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const goal = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const p = PRESETS[preset.name];
    goal.current = { pos: new THREE.Vector3(...p.pos), look: new THREE.Vector3(...p.look) };
  }, [preset]);

  useFrame(({ camera }, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.exp(-4 * dt);
    camera.position.lerp(g.pos, k);
    c.target.lerp(g.look, k);
    c.update();
    if (camera.position.distanceTo(g.pos) < 0.05) goal.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={3}
      maxDistance={22}
      maxPolarAngle={Math.PI / 2.05}
      // user input cancels a running preset animation
      onStart={() => (goal.current = null)}
    />
  );
}

export interface SceneProps {
  tree: DbTree | null;
  decos: DbDeco[];
  phase: EventPhase;
  atmosphere: Atmosphere;
  lightMode: LightMode;
  preset: { name: CameraPresetName; nonce: number };
  shakeNonce: number;
  fx: Fx;
  placing: boolean;
  selectedId: string | null;
  onTreeClick: (p: [number, number, number]) => void;
  onSelectDeco: (id: string | null) => void;
  onPropMessage: (m: string) => void;
  onOpenWishes: () => void;
}

export default function Scene(props: SceneProps) {
  const christmas = props.phase === "CHRISTMAS_DAY";
  const growth = props.tree
    ? getGrowth(props.tree.water_count, props.tree.fertilizer_count)
    : 0.12;

  return (
    <Canvas
      camera={{ position: PRESETS.overview.pos, fov: 50, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      onPointerMissed={() => props.onSelectDeco(null)}
    >
      <AtmosphereRig mode={props.atmosphere} />
      <Ground />
      <Falling count={christmas ? 1100 : 650} size={0.09} speed={christmas ? 1.1 : 0.8} />
      {christmas && <Falling count={160} size={0.16} speed={1.4} colored />}
      <ChristmasTree
        growth={christmas ? 1 : growth}
        christmas={christmas}
        decos={props.decos}
        lightMode={props.lightMode}
        shakeNonce={props.shakeNonce}
        fx={props.fx}
        placing={props.placing}
        selectedId={props.selectedId}
        onTreeClick={props.onTreeClick}
        onSelectDeco={props.onSelectDeco}
      />
      <SceneProps onMessage={props.onPropMessage} onOpenWishes={props.onOpenWishes} />
      <CameraRig preset={props.preset} />
    </Canvas>
  );
}
