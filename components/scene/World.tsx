"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { Atmosphere } from "@/lib/types";
import { PROP_MESSAGES } from "@/lib/items";

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ---- Ground & background ----------------------------------------------
const PINES: [number, number, number][] = [
  [-10, -9, 1.3], [-6, -12, 1.6], [0, -13, 1.4], [7, -11, 1.7], [11, -7, 1.2],
  [13, 1, 1.5], [-13, -2, 1.5], [-12, 6, 1.1], [10, 8, 1.2], [-3, -10, 1.0],
];

export function Ground() {
  return (
    <group>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[16, 16, 0.4, 28]} />
        <meshStandardMaterial color="#f2f7ff" flatShading roughness={1} />
      </mesh>
      {[[2.5, 0.0, -2, 1.4], [-3, 0, -3, 1.8], [5, 0, 3, 1.1], [-5, 0, 4, 1.3]].map(
        ([x, , z, s], i) => (
          <mesh key={i} position={[x, 0, z]} scale={[s, 0.35, s]}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        ),
      )}
      {PINES.map(([x, z, s], i) => (
        <group key={i} position={[x, 0, z]} scale={s}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.15, 0.2, 0.8, 6]} />
            <meshStandardMaterial color="#5a3a1e" flatShading />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, 1.1 + k * 0.7, 0]}>
              <coneGeometry args={[1.1 - k * 0.3, 1.2, 7]} />
              <meshStandardMaterial color="#1b5e3b" flatShading />
            </mesh>
          ))}
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[0.45, 0.4, 7]} />
            <meshStandardMaterial color="#ffffff" flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---- Falling snow / confetti ------------------------------------------
export function Falling({
  count,
  size,
  speed,
  colored = false,
}: {
  count: number;
  size: number;
  speed: number;
  colored?: boolean;
}) {
  const geo = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array(count * 3), [count]);
  const colors = useMemo(() => new Float32Array(count * 3), [count]);
  const phase = useMemo(() => new Float32Array(count), [count]);

  useEffect(() => {
    const g = geo.current;
    if (!g) return;
    const pos = g.attributes.position.array as Float32Array;
    const col = g.attributes.color?.array as Float32Array | undefined;
    const ph = g.userData.phase as Float32Array;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 16;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      ph[i] = Math.random() * Math.PI * 2;
      if (col) {
        c.setHSL(Math.random(), 0.85, 0.6);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
    }
    g.attributes.position.needsUpdate = true;
    if (g.attributes.color) g.attributes.color.needsUpdate = true;
  }, [count]);

  useFrame(({ clock }, dt) => {
    const g = geo.current;
    if (!g) return;
    const pos = g.attributes.position.array as Float32Array;
    const ph = g.userData.phase as Float32Array;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] -= speed * dt * (0.6 + (i % 5) * 0.12);
      pos[i * 3] += Math.sin(t + ph[i]) * dt * 0.35;
      if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 16;
    }
    g.attributes.position.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geo} userData={{ phase }}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        {colored && <bufferAttribute attach="attributes-color" args={[colors, 3]} />}
      </bufferGeometry>
      <pointsMaterial
        size={size}
        sizeAttenuation
        color={colored ? "#ffffff" : "#ffffff"}
        vertexColors={colored}
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}

// ---- Atmosphere (sky, fog, lights) ------------------------------------
function Aurora() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const cols = ["#3dffb0", "#7a5cff", "#35d6ff"];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.position.x = Math.sin(t * 0.15 + i) * 4;
      m.scale.y = 1 + Math.sin(t * 0.6 + i * 2) * 0.25;
      (m.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(t * 0.8 + i) * 0.08;
    });
  });
  return (
    <group position={[0, 11, -22]}>
      {cols.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[0, i * 1.8, i * -1.5]}
        >
          <planeGeometry args={[46, 7, 1, 1]} />
          <meshBasicMaterial
            color={c}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function AtmosphereRig({ mode }: { mode: Atmosphere }) {
  const cfg = {
    day: { bg: "#bfe3ff", fog: 26, amb: 1.0, ambC: "#ffffff", dir: 1.6, dirC: "#fff1d6" },
    night: { bg: "#150f2e", fog: 22, amb: 0.45, ambC: "#8a8fe8", dir: 0.5, dirC: "#9bb0ff" },
    aurora: { bg: "#040b1f", fog: 30, amb: 0.4, ambC: "#6fe0d0", dir: 0.45, dirC: "#a9c4ff" },
  }[mode];
  return (
    <>
      <color attach="background" args={[cfg.bg]} />
      <fog attach="fog" args={[cfg.bg, 12, cfg.fog + 12]} />
      <ambientLight intensity={cfg.amb} color={cfg.ambC} />
      <directionalLight position={[6, 12, 8]} intensity={cfg.dir} color={cfg.dirC} />
      {mode !== "day" && (
        <>
          <Stars radius={70} depth={30} count={1800} factor={4} fade speed={1} />
          <pointLight position={[0, 3, 3]} intensity={28} color="#ffb36b" distance={9} />
        </>
      )}
      {mode === "aurora" && <Aurora />}
    </>
  );
}

// ---- Interactive props -------------------------------------------------
function Interactive({
  position,
  sparkle = "#ffd166",
  onActivate,
  children,
}: {
  position: [number, number, number];
  sparkle?: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  const bounce = useRef<THREE.Group>(null);
  const spark = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current = Math.max(0, t.current - dt * 1.3);
    const k = t.current;
    if (bounce.current) {
      bounce.current.position.y = Math.abs(Math.sin((1 - k) * Math.PI * 3)) * 0.45 * k;
      const sq = 1 + Math.sin((1 - k) * Math.PI * 6) * 0.1 * k;
      bounce.current.scale.set(sq, 2 - sq, sq);
    }
    if (spark.current) spark.current.visible = k > 0.05;
  });
  return (
    <group position={position}>
      <group
        ref={bounce}
        onClick={(e) => {
          e.stopPropagation();
          t.current = 1;
          onActivate();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        {children}
      </group>
      <group ref={spark} visible={false} position={[0, 0.8, 0]}>
        <Sparkles count={24} scale={[1.8, 1.8, 1.8]} size={7} speed={1.8} color={sparkle} />
      </group>
    </group>
  );
}

function GiftBox({ color, ribbon, s = 1 }: { color: string; ribbon: string; s?: number }) {
  return (
    <group scale={s}>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.64, 0.1, 0.64]} />
        <meshStandardMaterial color={ribbon} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.1, 0.64, 0.64]} />
        <meshStandardMaterial color={ribbon} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <octahedronGeometry args={[0.12]} />
        <meshStandardMaterial color={ribbon} />
      </mesh>
    </group>
  );
}

function Snowman() {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.55, 12, 10]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <sphereGeometry args={[0.4, 12, 10]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.28, 12, 10]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
      <mesh position={[0, 1.8, 0.27]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.3, 6]} />
        <meshStandardMaterial color="#ff8c1a" />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.88, 0.24]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      <mesh position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.28, 10]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 1.93, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.04, 10]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <torusGeometry args={[0.3, 0.06, 6, 14]} />
        <meshStandardMaterial color="#d62828" />
      </mesh>
    </group>
  );
}

function Campfire() {
  const flames = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    flames.current.forEach((m, i) => {
      if (!m) return;
      const s = 0.85 + Math.sin(t * 9 + i * 2) * 0.2;
      m.scale.set(s, 0.9 + Math.sin(t * 7 + i) * 0.3, s);
    });
    if (light.current) light.current.intensity = 9 + Math.sin(t * 11) * 2;
  });
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 1.57) * 0.28, 0.1, Math.sin(i * 1.57) * 0.28]}
          rotation={[Math.PI / 2, 0, i * 1.57]}
        >
          <cylinderGeometry args={[0.07, 0.07, 0.6, 6]} />
          <meshStandardMaterial color="#5a3a1e" flatShading />
        </mesh>
      ))}
      {[["#ff7a00", 0.22, 0.6], ["#ffc300", 0.15, 0.45]].map(([c, r, h], i) => (
        <mesh
          key={i}
          ref={(el) => {
            flames.current[i] = el;
          }}
          position={[0, Number(h) / 2 + 0.1, 0]}
        >
          <coneGeometry args={[Number(r), Number(h), 7]} />
          <meshBasicMaterial color={String(c)} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 0.7, 0]} color="#ff9a3c" intensity={9} distance={7} />
    </group>
  );
}

function Mantel() {
  return (
    <group>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]}>
          <boxGeometry args={[0.16, 2.2, 0.16]} />
          <meshStandardMaterial color="#7a4b25" flatShading />
        </mesh>
      ))}
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[2.8, 0.16, 0.24]} />
        <meshStandardMaterial color="#8a5630" flatShading />
      </mesh>
      {[
        [-0.7, "#d62828"],
        [0, "#2a9d8f"],
        [0.7, "#3a86ff"],
      ].map(([x, c]) => (
        <group key={String(x)} position={[Number(x), 2.1, 0.05]}>
          <mesh position={[0, -0.3, 0]}>
            <boxGeometry args={[0.26, 0.6, 0.12]} />
            <meshStandardMaterial color={String(c)} flatShading />
          </mesh>
          <mesh position={[0.1, -0.62, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.12]} />
            <meshStandardMaterial color={String(c)} flatShading />
          </mesh>
          <mesh position={[0, -0.02, 0]}>
            <boxGeometry args={[0.32, 0.12, 0.16]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function SceneProps({
  onMessage,
  onOpenWishes,
}: {
  onMessage: (m: string) => void;
  onOpenWishes: () => void;
}) {
  return (
    <>
      <Interactive position={[1.9, 0, 2.2]} sparkle="#ff7eb6" onActivate={() => onMessage(pick(PROP_MESSAGES.gift))}>
        <GiftBox color="#d62828" ribbon="#ffd166" />
      </Interactive>
      <Interactive position={[1.2, 0, 2.9]} sparkle="#4cc9f0" onActivate={() => onMessage(pick(PROP_MESSAGES.gift))}>
        <GiftBox color="#2a9d8f" ribbon="#ffffff" s={0.75} />
      </Interactive>
      <Interactive position={[-1.8, 0, 2.5]} sparkle="#ffd166" onActivate={() => onMessage(pick(PROP_MESSAGES.gift))}>
        <GiftBox color="#3a86ff" ribbon="#ff7eb6" s={0.9} />
      </Interactive>
      <Interactive position={[4.6, 0, 0.5]} sparkle="#ffffff" onActivate={() => onMessage(pick(PROP_MESSAGES.snowman))}>
        <Snowman />
      </Interactive>
      <Interactive position={[-3.6, 0, 2.6]} sparkle="#ff9a3c" onActivate={() => onMessage(pick(PROP_MESSAGES.fire))}>
        <Campfire />
      </Interactive>
      <group position={[-6.5, 0, 2.5]}>
        <Interactive position={[0, 0, 0]} sparkle="#ffffff" onActivate={onOpenWishes}>
          <Mantel />
        </Interactive>
      </group>
    </>
  );
}
