"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";
import type { DbDeco, Fx, LightMode } from "@/lib/types";

// ---- Tree profile (local units, before growth scaling) -----------------
const MAX_TIERS = 7;
const TIER_H = 1.3;
const tierY = (i: number) => 0.9 + i * 0.62;
const tierR = (i: number) => 1.5 - i * 0.2;
export const topYFor = (tiers: number) => tierY(tiers - 1) + TIER_H;

function surfaceRadius(y: number, tiers: number) {
  let r = 0;
  for (let i = 0; i < tiers; i++) {
    const t = (y - tierY(i)) / TIER_H;
    if (t >= 0 && t <= 1) r = Math.max(r, tierR(i) * (1 - t));
  }
  return r;
}

const TIER_COLORS = ["#1f7a4d", "#27905a", "#1c6b45", "#2a9a62"];

function makeStarGeometry(outer: number, inner: number, depth: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ---- Ornament ----------------------------------------------------------
function Ornament({
  deco,
  selected,
  onSelect,
}: {
  deco: DbDeco;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const starGeo = useMemo(() => makeStarGeometry(0.16, 0.07, 0.05), []);
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = selected ? 1.3 + Math.sin(clock.elapsedTime * 6) * 0.08 : 1;
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 10, dt));
  });
  const c = deco.color;
  return (
    <group position={[deco.pos_x, deco.pos_y, deco.pos_z]}>
      <group ref={ref}>
        {deco.item_type === "bauble" && (
          <>
            <mesh>
              <sphereGeometry args={[0.13, 16, 12]} />
              <meshStandardMaterial color={c} metalness={0.6} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.04, 8]} />
              <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} />
            </mesh>
          </>
        )}
        {deco.item_type === "candy_cane" && (
          <>
            <mesh position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.34, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.07, 0.12, 0]}>
              <torusGeometry args={[0.07, 0.03, 8, 12, Math.PI]} />
              <meshStandardMaterial color={c} />
            </mesh>
          </>
        )}
        {deco.item_type === "star" && (
          <mesh geometry={starGeo}>
            <meshStandardMaterial
              color={c}
              emissive={c}
              emissiveIntensity={0.5}
              metalness={0.4}
              roughness={0.3}
            />
          </mesh>
        )}
        {deco.item_type === "gift" && (
          <>
            <mesh>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial color={c} />
            </mesh>
            <mesh>
              <boxGeometry args={[0.215, 0.04, 0.215]} />
              <meshStandardMaterial color="#fff6d6" />
            </mesh>
            <mesh>
              <boxGeometry args={[0.04, 0.215, 0.215]} />
              <meshStandardMaterial color="#fff6d6" />
            </mesh>
          </>
        )}
        {deco.item_type === "bell" && (
          <>
            <mesh>
              <sphereGeometry args={[0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
              <meshStandardMaterial
                color={c}
                metalness={0.8}
                roughness={0.25}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh position={[0, -0.1, 0]}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshStandardMaterial color="#d4af37" metalness={0.8} />
            </mesh>
          </>
        )}
        {selected && (
          <mesh>
            <sphereGeometry args={[0.24, 12, 10]} />
            <meshBasicMaterial color="#fff6a8" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        )}
        {/* generous invisible hit target */}
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelect(deco.id);
          }}
        >
          <sphereGeometry args={[0.22, 8, 6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

// ---- Fairy lights ------------------------------------------------------
const BULBS = 56;
function FairyLights({ tiers, mode }: { tiers: number; mode: LightMode }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const color = useMemo(() => new THREE.Color(), []);
  const positions = useMemo(() => {
    const top = topYFor(tiers) - 0.25;
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < BULBS; i++) {
      const y = 1.0 + (i / BULBS) * (top - 1.0);
      const r = surfaceRadius(y, tiers) * 1.03 + 0.02;
      const a = i * 0.95;
      out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    return out;
  }, [tiers]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    positions.forEach((p, i) => m.setMatrixAt(i, mat.setPosition(p)));
    m.instanceMatrix.needsUpdate = true;
  }, [positions]);

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    m.visible = mode !== "off";
    if (mode === "off") return;
    const t = clock.elapsedTime;
    for (let i = 0; i < BULBS; i++) {
      if (mode === "warm") {
        color.set("#ffd27a").multiplyScalar(0.85 + Math.sin(t * 2 + i) * 0.15);
      } else if (mode === "blink") {
        const on = Math.floor(t * 1.6 + (i % 3)) % 3 === 0;
        color.set(on ? "#fff4c2" : "#4a3a18");
      } else {
        color.setHSL((t * 0.15 + i / BULBS) % 1, 0.9, 0.6);
      }
      m.setColorAt(i, color);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BULBS]}>
      <sphereGeometry args={[0.045, 8, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ---- Tree --------------------------------------------------------------
export interface TreeProps {
  growth: number; // 0..1
  christmas: boolean;
  decos: DbDeco[];
  lightMode: LightMode;
  shakeNonce: number;
  fx: Fx;
  placing: boolean; // a tool is armed or an ornament is being moved
  selectedId: string | null;
  onTreeClick: (localPoint: [number, number, number]) => void;
  onSelectDeco: (id: string) => void;
}

export function ChristmasTree({
  growth,
  christmas,
  decos,
  lightMode,
  shakeNonce,
  fx,
  placing,
  selectedId,
  onTreeClick,
  onSelectDeco,
}: TreeProps) {
  const group = useRef<THREE.Group>(null);
  const shakeSparks = useRef<THREE.Group>(null);
  const waterSparks = useRef<THREE.Group>(null);
  const feedSparks = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const shakeT = useRef(0);
  const fxT = useRef(0);

  const tiers = growth >= 1 ? MAX_TIERS : Math.min(6, Math.max(3, 3 + Math.floor(growth * 4.99)));
  const topY = topYFor(tiers);
  const scale = 0.3 + 0.7 * growth;
  const bigStar = useMemo(() => makeStarGeometry(0.42, 0.18, 0.12), []);

  useEffect(() => {
    if (shakeNonce > 0) shakeT.current = 1;
  }, [shakeNonce]);
  useEffect(() => {
    if (fx.nonce > 0) fxT.current = 1;
  }, [fx.nonce]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, scale, 2.5, dt));
    shakeT.current = Math.max(0, shakeT.current - dt * 0.7);
    fxT.current = Math.max(0, fxT.current - dt * 0.6);
    const s = shakeT.current;
    g.rotation.z = Math.sin(clock.elapsedTime * 30) * 0.07 * s * s;
    g.rotation.x = Math.cos(clock.elapsedTime * 26) * 0.04 * s * s;
    if (shakeSparks.current) shakeSparks.current.visible = s > 0.05;
    if (waterSparks.current)
      waterSparks.current.visible = fxT.current > 0.05 && fx.kind === "water";
    if (feedSparks.current)
      feedSparks.current.visible = fxT.current > 0.05 && fx.kind === "fertilize";
    if (starRef.current) {
      const p = 1 + Math.sin(clock.elapsedTime * 3) * 0.08;
      starRef.current.scale.setScalar(p);
      starRef.current.rotation.y += dt * 0.8;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placing || !group.current) return;
    e.stopPropagation();
    const p = group.current.worldToLocal(e.point.clone());
    // nudge slightly outward so the ornament sits on the needles
    p.x *= 1.04;
    p.z *= 1.04;
    onTreeClick([p.x, p.y, p.z]);
  };

  return (
    <group ref={group} scale={0.3}>
      {/* trunk */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.22, 0.3, 1.1, 8]} />
        <meshStandardMaterial color="#6b4423" flatShading />
      </mesh>

      {/* foliage tiers */}
      {Array.from({ length: tiers }, (_, i) => (
        <mesh
          key={i}
          position={[0, tierY(i) + TIER_H / 2, 0]}
          onClick={handleClick}
          onPointerOver={() => placing && (document.body.style.cursor = "crosshair")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <coneGeometry args={[tierR(i), TIER_H, 10]} />
          <meshStandardMaterial
            color={TIER_COLORS[i % TIER_COLORS.length]}
            flatShading
            roughness={0.9}
          />
        </mesh>
      ))}

      <FairyLights tiers={tiers} mode={lightMode} />

      {decos
        .filter((d) => d.pos_y < topY)
        .map((d) => (
          <Ornament
            key={d.id}
            deco={d}
            selected={d.id === selectedId}
            onSelect={onSelectDeco}
          />
        ))}

      {/* golden star — Christmas Day only */}
      {christmas && (
        <group position={[0, topY + 0.3, 0]}>
          <mesh ref={starRef} geometry={bigStar}>
            <meshStandardMaterial
              color="#ffd23f"
              emissive="#ffb703"
              emissiveIntensity={1.4}
              metalness={0.5}
              roughness={0.25}
            />
          </mesh>
          <pointLight color="#ffd23f" intensity={6} distance={7} />
          <Sparkles count={25} scale={1.8} size={6} speed={0.6} color="#ffe27a" />
        </group>
      )}

      {/* effects */}
      <group ref={shakeSparks} visible={false} position={[0, 3, 0]}>
        <Sparkles count={70} scale={[3.2, 5, 3.2]} size={7} speed={2.5} color="#ffffff" />
      </group>
      <group ref={waterSparks} visible={false} position={[0, 2.5, 0]}>
        <Sparkles count={50} scale={[3, 5, 3]} size={6} speed={2} color="#6fc3ff" />
      </group>
      <group ref={feedSparks} visible={false} position={[0, 2.5, 0]}>
        <Sparkles count={50} scale={[3, 5, 3]} size={6} speed={1.2} color="#b6ff6a" />
      </group>
    </group>
  );
}
