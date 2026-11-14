import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { FailureAnim, PartLook, SlotId, Instrument } from '../engine/types';
import type { Palette } from './palette';

/* ------------------------------------------------------------------ */
/* context                                                             */
/* ------------------------------------------------------------------ */

type Zone = SlotId | 'bus' | 'instruments';
type ZoneState = 'normal' | 'hl' | 'alarm';

interface Ctx {
  pal: Palette;
  lite: boolean;
  anim: React.MutableRefObject<{ id: FailureAnim; t0: number }>;
  zoneState: (z: Zone) => ZoneState;
}
const CraftCtx = createContext<Ctx>(null!);
const ZoneCtx = createContext<Zone>('bus');

const useCraft = () => useContext(CraftCtx);

export const ANIM_ZONE: Record<FailureAnim, Zone[]> = {
  antenna_jam: ['antenna'],
  signal_lost: ['antenna'],
  panel_stuck: ['power'],
  wheel_fail: ['attitude'],
  tumble: ['attitude'],
  battery_drain: ['battery'],
  engine_cutoff: ['propulsion'],
  valve_stick: ['propulsion'],
  overheat: ['thermal', 'bus'],
  crash: ['computer'],
  none: [],
};

/** Where a pin sits for each slot, in craft space. */
export const PIN_ANCHOR: Record<SlotId, [number, number, number]> = {
  power: [1.55, 0.06, 0.2],
  battery: [-0.3, -0.25, -0.75],
  antenna: [0.15, 1.45, 0],
  attitude: [0.74, 0.32, -0.12],
  propulsion: [0, -0.95, 0.15],
  computer: [0.34, -0.3, -0.7],
  thermal: [-0.64, -0.3, 0.3],
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const backOut = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = clamp01(x) - 1;
  return 1 + c3 * t * t * t + c1 * t * t;
};

function animT(ctx: Ctx, id: FailureAnim, now: number): number | null {
  const a = ctx.anim.current;
  if (a.id !== id) return null;
  return now - a.t0;
}

type MatKind = 'bus' | 'foil' | 'metal' | 'panel' | 'dish' | 'dark' | 'white';

function Mat({ kind, map, side, opacity }: { kind: MatKind; map?: THREE.Texture; side?: THREE.Side; opacity?: number }) {
  const { pal, lite, zoneState } = useCraft();
  const zone = useContext(ZoneCtx);
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  const alarm = useMemo(() => new THREE.Color(pal.alarm), [pal.alarm]);
  const hl = useMemo(() => new THREE.Color(pal.ink), [pal.ink]);
  const color =
    kind === 'bus' ? pal.bus
    : kind === 'foil' ? pal.foil
    : kind === 'metal' ? pal.metal
    : kind === 'panel' ? (map ? '#ffffff' : pal.panel)
    : kind === 'dish' ? pal.dish
    : kind === 'white' ? pal.dish
    : pal.dark ? '#14171b' : '#9aa6b4';
  const metal = kind === 'metal' ? 0.7 : kind === 'panel' ? 0.35 : kind === 'foil' ? 0.45 : 0.15;
  const rough = kind === 'metal' ? 0.35 : kind === 'panel' ? 0.4 : 0.7;

  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const st = zoneState(zone);
    const t = clock.elapsedTime;
    if (st === 'alarm') {
      m.emissive.copy(alarm);
      m.emissiveIntensity = 0.55 + 0.35 * Math.sin(t * 6);
    } else if (st === 'hl') {
      m.emissive.copy(hl);
      m.emissiveIntensity = 0.04 + 0.03 * Math.sin(t * 3);
    } else {
      m.emissiveIntensity = 0;
    }
  });

  if (lite) {
    return (
      <meshLambertMaterial
        ref={ref as never}
        color={color}
        map={map}
        side={side}
        transparent={opacity !== undefined}
        opacity={opacity ?? 1}
      />
    );
  }
  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      map={map}
      metalness={metal}
      roughness={rough}
      side={side}
      transparent={opacity !== undefined}
      opacity={opacity ?? 1}
    />
  );
}

function Ed() {
  const { pal, lite } = useCraft();
  if (lite) return null;
  return <Edges threshold={25} color={pal.edge} transparent opacity={pal.edgeAlpha} lineWidth={1} />;
}

function Box({ args, position, rotation, kind = 'bus', map, edges = true }: {
  args: [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  kind?: MatKind;
  map?: THREE.Texture;
  edges?: boolean;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <Mat kind={kind} map={map} />
      {edges && <Ed />}
    </mesh>
  );
}

function Cyl({ r, h, position, rotation, kind = 'metal', seg = 20, rTop }: {
  r: number;
  h: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  kind?: MatKind;
  seg?: number;
  rTop?: number;
}) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[rTop ?? r, r, h, seg]} />
      <Mat kind={kind} />
      <Ed />
    </mesh>
  );
}

/** Animates a part into place the first time it mounts. Remount (new key) to replay. */
function Snap({ from = [0, 0, 0], delay = 0, children }: { from?: [number, number, number]; delay?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const done = useRef(false);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g || done.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime + delay;
    const p = (clock.elapsedTime - t0.current) / 0.65;
    const e = backOut(p);
    g.position.set(from[0] * (1 - e), from[1] * (1 - e), from[2] * (1 - e));
    g.scale.setScalar(Math.max(0.0001, Math.min(1, easeOut(p * 1.6))));
    if (p >= 1) {
      g.position.set(0, 0, 0);
      g.scale.setScalar(1);
      done.current = true;
    }
  });
  return (
    <group ref={ref} scale={0.0001}>
      {children}
    </group>
  );
}

function Zone({ zone, children, onPick }: { zone: Zone; children: ReactNode; onPick?: (s: SlotId) => void }) {
  const pickable = onPick && zone !== 'bus' && zone !== 'instruments';
  return (
    <ZoneCtx.Provider value={zone}>
      <group
        onClick={pickable ? (e) => { e.stopPropagation(); onPick!(zone as SlotId); } : undefined}
        onPointerOver={pickable ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; } : undefined}
        onPointerOut={pickable ? () => { document.body.style.cursor = ''; } : undefined}
      >
        {children}
      </group>
    </ZoneCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */

function useCellTexture(pal: Palette) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = pal.panel;
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = pal.panelLine;
    g.globalAlpha = 0.75;
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke();
    }
    for (let y = 0; y <= 128; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke();
    }
    g.globalAlpha = 0.25;
    g.lineWidth = 1;
    for (let x = 16; x <= 256; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [pal.panel, pal.panelLine]);
}

function useShadowTexture(dark: boolean) {
  return useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 4;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 256, 0);
    const col = dark ? '0,0,0' : '12,26,52';
    grd.addColorStop(0, `rgba(${col},0.92)`);
    grd.addColorStop(0.6, `rgba(${col},0.85)`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 4);
    const t = new THREE.CanvasTexture(c);
    return t;
  }, [dark]);
}

/* ------------------------------------------------------------------ */
/* parts                                                               */
/* ------------------------------------------------------------------ */

const BUS: [number, number, number] = [1.2, 1.0, 1.2];

function Bus({ thermalFull }: { thermalFull: boolean }) {
  return (
    <Zone zone="bus">
      <Box args={BUS} kind={thermalFull ? 'foil' : 'bus'} />
      {/* deck plates */}
      <Box args={[1.26, 0.04, 1.26]} position={[0, 0.52, 0]} kind="metal" />
      <Box args={[1.26, 0.04, 1.26]} position={[0, -0.52, 0]} kind="metal" />
    </Zone>
  );
}

/* solar wing: accordion of hinged segments that unfold after snapping on */
function Wing({ angle, segs, segLen, width, stuck, tex }: {
  angle: number; segs: number; segLen: number; width: number; stuck: boolean; tex: THREE.Texture;
}) {
  const ctx = useCraft();
  const hinges = useRef<(THREE.Group | null)[]>([]);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    if (born.current === null) born.current = now;
    let p = easeOut((now - born.current - 0.5) / 1.6);
    let stuckP = p;
    const t = animT(ctx, 'panel_stuck', now);
    if (t !== null && stuck) {
      p = easeOut((t - 0.3) / 1.6);
      stuckP = Math.min(p, 0.38);
    }
    hinges.current.forEach((h, i) => {
      if (!h) return;
      const folded = i === 0 ? Math.PI / 2 : (i % 2 ? -1 : 1) * Math.PI * 0.95;
      const prog = stuck && i > 0 && t !== null ? stuckP : p;
      h.rotation.z = folded * (1 - prog);
    });
  });
  const chain = (i: number): ReactNode => {
    if (i >= segs) return null;
    return (
      <group ref={(g) => { hinges.current[i] = g; }} position={[i === 0 ? 0.68 : segLen, 0, 0]}>
        <mesh position={[segLen / 2, 0, 0]}>
          <boxGeometry args={[segLen * 0.97, 0.025, width]} />
          <Mat kind="panel" map={tex} />
          <Ed />
        </mesh>
        {chain(i + 1)}
      </group>
    );
  };
  return (
    <group rotation={[0, angle, 0]}>
      {/* yoke */}
      <mesh position={[0.64, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.12, 8]} />
        <Mat kind="metal" />
      </mesh>
      {chain(0)}
    </group>
  );
}

function Power({ look, stuckSet }: { look: PartLook; stuckSet: boolean }) {
  const { pal } = useCraft();
  const tex = useCellTexture(pal);
  if (look === 'rtg') {
    return (
      <group position={[-0.6, -0.15, 0]} rotation={[0, 0, Math.PI * 0.08]}>
        <Cyl r={0.02} h={0.9} position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]} kind="metal" seg={8} />
        <group position={[-1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <Cyl r={0.14} h={0.62} kind="dark" />
          {Array.from({ length: 6 }, (_, i) => (
            <Box key={i} args={[0.02, 0.58, 0.16]} kind="metal"
              position={[Math.cos((i / 6) * Math.PI * 2) * 0.2, 0, Math.sin((i / 6) * Math.PI * 2) * 0.2]}
              rotation={[0, -(i / 6) * Math.PI * 2, 0]} />
          ))}
        </group>
      </group>
    );
  }
  const cfg =
    look === 'panel_small' ? { angles: [0, Math.PI], segs: 1, len: 0.7, w: 0.6 }
    : look === 'panel_large' ? { angles: [0, Math.PI], segs: 2, len: 0.85, w: 0.8 }
    : { angles: [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3], segs: 3, len: 0.85, w: 0.7 };
  return (
    <group>
      {cfg.angles.map((a, i) => (
        <Wing key={i} angle={a} segs={cfg.segs} segLen={cfg.len} width={cfg.w} stuck={stuckSet && i === 0} tex={tex} />
      ))}
    </group>
  );
}

function Battery({ look }: { look: PartLook }) {
  const s = look === 'battery_s' ? [0.26, 0.2, 0.1] : look === 'battery_m' ? [0.36, 0.26, 0.13] : [0.46, 0.32, 0.16];
  return (
    <group position={[-0.3, -0.25, -0.6 - s[2] / 2]}>
      <Box args={s as [number, number, number]} kind="dark" />
      {[-1, 0, 1].map((i) => (
        <Box key={i} args={[0.015, s[1] * 0.8, 0.02]} position={[(i * s[0]) / 4, 0, -s[2] / 2 - 0.01]} kind="metal" edges={false} />
      ))}
    </group>
  );
}

function Wheels({ look }: { look: PartLook }) {
  const n = look === 'wheels_3' ? 3 : 4;
  const zs = n === 3 ? [-0.26, 0, 0.26] : [-0.36, -0.12, 0.12, 0.36];
  return (
    <group>
      {zs.map((z, i) => (
        <ZoneCtx.Provider key={i} value={i === 0 ? 'attitude' : 'instruments'}>
          <Wheel index={i} position={[0.64, 0.3, z]} />
        </ZoneCtx.Provider>
      ))}
      {look === 'wheels_hybrid' &&
        [[-0.6, 0.48, -0.6], [0.6, 0.48, -0.6], [-0.6, 0.48, 0.6], [0.6, 0.48, 0.6]].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <Box args={[0.09, 0.07, 0.09]} kind="metal" />
            <Cyl r={0.03} rTop={0.012} h={0.08} position={[0, 0.07, 0]} kind="dark" seg={10} />
          </group>
        ))}
    </group>
  );
}

function Wheel({ index, position }: { index: number; position: [number, number, number] }) {
  const ctx = useCraft();
  const spin = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const speed = useRef(9);
  useFrame(({ clock }, dt) => {
    const t = animT(ctx, 'wheel_fail', clock.elapsedTime);
    const failing = t !== null && index === 0;
    const target = failing ? Math.max(0, 9 * (1 - t! / 2.4)) : 9;
    speed.current += (target - speed.current) * Math.min(1, dt * 4);
    if (spin.current) spin.current.rotation.y += speed.current * dt;
    if (glow.current) glow.current.opacity = failing ? clamp01(t! / 1.2) * (0.6 + 0.3 * Math.sin(clock.elapsedTime * 8)) : 0;
  });
  return (
    <group position={position} rotation={[0, 0, Math.PI / 2]}>
      <Cyl r={0.11} h={0.07} kind="metal" seg={24} />
      <group ref={spin} position={[0, -0.04, 0]}>
        <Box args={[0.2, 0.012, 0.03]} kind="dark" edges={false} />
        <Box args={[0.03, 0.012, 0.2]} kind="dark" edges={false} />
      </group>
      <mesh position={[0, -0.05, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.135, 0.135, 0.01, 24]} />
        <meshBasicMaterial ref={glow} color={ctx.pal.alarm} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* antennas */
function dishGeometry(R: number, depth: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) {
    const r = (i / 16) * R;
    pts.push(new THREE.Vector2(r, (depth * r * r) / (R * R)));
  }
  return new THREE.LatheGeometry(pts, 40);
}

function FixedDish() {
  const geo = useMemo(() => dishGeometry(0.85, 0.28), []);
  return (
    <group position={[0, 0.62, 0]}>
      <Cyl r={0.08} h={0.2} position={[0, 0.06, 0]} kind="metal" seg={12} />
      <mesh geometry={geo} position={[0, 0.16, 0]}>
        <Mat kind="dish" side={THREE.DoubleSide} />
        <Ed />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.32, 0.42, Math.sin(a) * 0.32]} rotation={[Math.sin(a) * 0.62, 0, -Math.cos(a) * 0.62]}>
            <cylinderGeometry args={[0.01, 0.01, 0.62, 6]} />
            <Mat kind="metal" />
          </mesh>
        );
      })}
      <Cyl r={0.06} rTop={0.03} h={0.12} position={[0, 0.7, 0]} kind="dark" seg={12} />
    </group>
  );
}

const RIBS = 18;
const JAMMED = new Set([2, 3, 4, 5, 6, 7]);

function UmbrellaDish() {
  const ctx = useCraft();
  const ribs = useRef<(THREE.Group | null)[]>([]);
  const born = useRef<number | null>(null);
  const L = 0.95;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIBS * 9), 3));
    return g;
  }, []);
  const thetas = useRef(new Array(RIBS).fill(0.08));
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    if (born.current === null) born.current = now;
    const jamT = animT(ctx, 'antenna_jam', now);
    const closed = 0.08;
    const open = 1.18;
    for (let i = 0; i < RIBS; i++) {
      let p: number;
      if (jamT !== null) {
        p = easeOut((jamT - 0.4) / 2.2);
        if (JAMMED.has(i)) p = Math.min(p, 0.32 + (i % 2) * 0.08);
        else if (jamT < 0.4) p = 0;
      } else {
        p = easeOut((now - born.current - 0.7) / 2.0);
      }
      const th = closed + (open - closed) * p;
      thetas.current[i] = th;
      const r = ribs.current[i];
      if (r) r.rotation.z = -th;
    }
    // membrane: fan of triangles hub > tip i > tip i+1
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < RIBS; i++) {
      const j = (i + 1) % RIBS;
      const tip = (k: number) => {
        const phi = (k / RIBS) * Math.PI * 2;
        const th = thetas.current[k];
        return [Math.sin(th) * Math.cos(phi) * L, Math.cos(th) * L, -Math.sin(th) * Math.sin(phi) * L];
      };
      const a = tip(i);
      const b = tip(j);
      arr.set([0, 0, 0, ...a, ...b], i * 9);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return (
    <group position={[0, 0.62, 0]}>
      <Cyl r={0.05} h={0.36} position={[0, 0.16, 0]} kind="metal" seg={10} />
      <group position={[0, 0.36, 0]}>
        <Cyl r={0.08} h={0.1} kind="dark" seg={12} />
        {Array.from({ length: RIBS }, (_, i) => (
          <group key={i} rotation={[0, (i / RIBS) * Math.PI * 2, 0]}>
            <group ref={(g) => { ribs.current[i] = g; }}>
              <ZoneCtx.Provider value={JAMMED.has(i) ? 'antenna' : 'instruments'}>
                <mesh position={[0, L / 2, 0]}>
                  <cylinderGeometry args={[0.008, 0.012, L, 5]} />
                  <Mat kind="metal" />
                </mesh>
              </ZoneCtx.Provider>
            </group>
          </group>
        ))}
        <mesh geometry={geo}>
          <Mat kind="dish" side={THREE.DoubleSide} opacity={0.82} />
        </mesh>
      </group>
    </group>
  );
}

function LowGain() {
  return (
    <group position={[0.25, 0.62, 0.25]}>
      <Cyl r={0.018} h={0.4} position={[0, 0.2, 0]} kind="metal" seg={8} />
      <Cyl r={0.1} rTop={0.03} h={0.16} position={[0, 0.46, 0]} kind="white" seg={16} />
    </group>
  );
}

function Antenna({ look }: { look: PartLook }) {
  if (look === 'hga_deployable') return <UmbrellaDish />;
  if (look === 'hga_fixed') return <FixedDish />;
  return <LowGain />;
}

function Beam({ on, look }: { on: boolean; look: PartLook }) {
  const ctx = useCraft();
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    const t = animT(ctx, 'signal_lost', clock.elapsedTime);
    let o = on ? (ctx.pal.dark ? 0.035 : 0.06) : 0;
    if (t !== null) {
      if (t > 1.8) o = 0;
      else o *= Math.random() > 0.45 ? 1 : 0.05;
    }
    mat.current.opacity += (o - mat.current.opacity) * 0.5;
  });
  const y = look === 'lga' ? 1.3 : 1.45;
  return (
    <mesh position={[0, y + 2.2, 0]}>
      <cylinderGeometry args={[0.55, 0.1, 4.4, 32, 1, true]} />
      <meshBasicMaterial ref={mat} color={ctx.pal.ink} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* propulsion */
function Bell({ y, scale = 1 }: { y: number; scale?: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(0.06 + 0.22 * t * t, -t * 0.42));
    }
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  return (
    <mesh geometry={geo} position={[0, y, 0]} scale={scale}>
      <Mat kind="metal" side={THREE.DoubleSide} />
      <Ed />
    </mesh>
  );
}

function Plume({ y, ion }: { y: number; ion?: boolean }) {
  const ctx = useCraft();
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = animT(ctx, 'engine_cutoff', clock.elapsedTime);
    if (!ref.current || !mat.current) return;
    let s = 0;
    if (t !== null) {
      if (t < 1.1) s = easeOut(t / 0.3) * (0.9 + Math.random() * 0.15);
      else if (t < 1.6) s = (1 - (t - 1.1) / 0.5) * (Math.random() > 0.5 ? 1 : 0.3);
    }
    ref.current.scale.set(Math.max(s, 0.0001), Math.max(s, 0.0001), Math.max(s, 0.0001));
    mat.current.opacity = s * (ion ? 0.35 : 0.6);
  });
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.22, 1.2, 20, 1, true]} />
      <meshBasicMaterial ref={mat} color={ctx.pal.ink} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Vent() {
  const ctx = useCraft();
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = animT(ctx, 'valve_stick', clock.elapsedTime);
    if (!g.current) return;
    g.current.visible = t !== null;
    if (t === null) return;
    g.current.children.forEach((c, i) => {
      const k = ((t * 0.9 + i / 6) % 1);
      c.position.set(Math.cos(i * 1.7) * k * 0.6, -0.1 - k * 0.5, Math.sin(i * 1.7) * k * 0.6);
      c.scale.setScalar(0.02 + k * 0.08);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
    });
  });
  return (
    <group ref={g} position={[0.3, -0.75, 0]} visible={false}>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color={ctx.pal.alarm} transparent opacity={0} depthWrite={false} blending={ctx.pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending} />
        </mesh>
      ))}
    </group>
  );
}

function Tank({ r, position }: { r: number; position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[r, 20, 14]} />
      <Mat kind="metal" />
      <Ed />
    </mesh>
  );
}

function Propulsion({ look }: { look: PartLook }) {
  const nozzles = (
    <>
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
        <Cyl key={i} r={0.045} rTop={0.02} h={0.1} position={[x, -0.6, z]} kind="dark" seg={10} />
      ))}
    </>
  );
  if (look === 'mono_small') {
    return (
      <group>
        <Tank r={0.2} position={[0, -0.6, 0]} />
        {nozzles}
        <Vent />
      </group>
    );
  }
  if (look === 'mono_large') {
    return (
      <group>
        <Tank r={0.24} position={[-0.26, -0.62, 0]} />
        <Tank r={0.24} position={[0.26, -0.62, 0]} />
        {nozzles}
        <Vent />
      </group>
    );
  }
  if (look === 'ion') {
    return (
      <group>
        <Tank r={0.18} position={[0.3, -0.62, 0.3]} />
        <Cyl r={0.2} h={0.16} position={[0, -0.62, 0]} kind="dark" seg={24} />
        <mesh position={[0, -0.71, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.18, 24, 3]} />
          <Mat kind="metal" side={THREE.DoubleSide} />
        </mesh>
        <Plume y={-1.3} ion />
        <Vent />
      </group>
    );
  }
  // biprop
  return (
    <group>
      <Tank r={0.2} position={[-0.32, -0.6, 0.18]} />
      <Tank r={0.2} position={[0.32, -0.6, 0.18]} />
      <Cyl r={0.06} h={0.42} position={[0, -0.62, -0.32]} kind="metal" seg={12} />
      <Cyl r={0.12} rTop={0.08} h={0.12} position={[0, -0.58, 0]} kind="dark" seg={16} />
      <Bell y={-0.64} />
      <Plume y={-1.66} />
      <Vent />
    </group>
  );
}

function Computer({ look }: { look: PartLook }) {
  const n = look === 'cpu_dual' ? 2 : 1;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[0.32 + i * 0.0, -0.22 - i * 0.2, -0.66]}>
          <Box args={[0.3, 0.14, 0.1]} kind="metal" />
          <Led position={[0.1, 0.02, -0.055]} />
        </group>
      ))}
    </group>
  );
}

function Led({ position }: { position: [number, number, number] }) {
  const ctx = useCraft();
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = 0.35 + 0.65 * (Math.sin(clock.elapsedTime * 2.2) > 0 ? 1 : 0);
  });
  return (
    <mesh position={position}>
      <boxGeometry args={[0.03, 0.03, 0.01]} />
      <meshBasicMaterial ref={mat} color={ctx.pal.ink} transparent />
    </mesh>
  );
}

function Thermal({ look }: { look: PartLook }) {
  const full = look === 'thermal_full';
  const h = full ? 0.38 : 0.24;
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.615, -0.27, 0.15]}>
          <Box args={[0.02, h, 0.6]} kind="white" />
          {Array.from({ length: full ? 5 : 3 }, (_, i) => (
            <Box key={i} args={[0.03, 0.012, 0.56]} position={[s * 0.015, -h / 2 + ((i + 1) * h) / ((full ? 5 : 3) + 1), 0]} kind="metal" edges={false} />
          ))}
        </group>
      ))}
      {full && (
        <group position={[0, 0.12, 0.62]}>
          {Array.from({ length: 6 }, (_, i) => (
            <Box key={i} args={[0.5, 0.025, 0.04]} position={[-0.25, 0.3 - i * 0.05, 0]} rotation={[0.5, 0, 0]} kind="metal" edges={false} />
          ))}
        </group>
      )}
    </group>
  );
}

/* instruments on the +z science deck */
const DECK: [number, number][] = [[0.28, 0.24], [-0.28, -0.22], [0.28, -0.22], [-0.28, 0.24], [0, 0]];

function InstrumentPart({ look, index }: { look: Instrument['look']; index: number }) {
  const [x, y] = DECK[index % DECK.length];
  const z = 0.6;
  switch (look) {
    case 'camera':
      return (
        <group position={[x, y, z]}>
          <Box args={[0.16, 0.16, 0.08]} position={[0, 0, 0.04]} kind="dark" />
          <Cyl r={0.06} h={0.18} position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]} kind="metal" seg={16} />
        </group>
      );
    case 'spectrometer':
      return (
        <group position={[x, y, z]}>
          <Box args={[0.22, 0.14, 0.16]} position={[0, 0, 0.08]} kind="white" />
          <Box args={[0.14, 0.02, 0.02]} position={[0, 0.03, 0.17]} kind="dark" edges={false} />
        </group>
      );
    case 'magnetometer':
      return (
        <group position={[x, y, z]} rotation={[0.5, 0.6, 0]}>
          <Cyl r={0.012} h={1.5} position={[0, 0, 0.75]} rotation={[Math.PI / 2, 0, 0]} kind="metal" seg={6} />
          <Box args={[0.07, 0.07, 0.07]} position={[0, 0, 1.52]} kind="white" />
        </group>
      );
    case 'radar':
      return (
        <group position={[0, -0.05, z + 0.04]}>
          <Box args={[1.0, 0.36, 0.04]} kind="dark" />
          {Array.from({ length: 6 }, (_, i) => (
            <Box key={i} args={[0.008, 0.3, 0.05]} position={[-0.42 + i * 0.17, 0, 0.005]} kind="metal" edges={false} />
          ))}
        </group>
      );
    case 'telescope':
      return (
        <group position={[0, 0, z]}>
          <Cyl r={0.36} h={1.1} position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]} kind="white" seg={32} />
          <mesh position={[0, 0, 1.12]} rotation={[Math.PI / 2 - 0.5, 0, 0]}>
            <circleGeometry args={[0.38, 32]} />
            <Mat kind="metal" side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    default:
      return (
        <group position={[x, y, z]}>
          <Box args={[0.14, 0.12, 0.1]} position={[0, 0, 0.05]} kind="metal" />
          <Cyl r={0.05} rTop={0.02} h={0.1} position={[0, 0, 0.14]} rotation={[-Math.PI / 2, 0, 0]} kind="dark" seg={12} />
        </group>
      );
  }
}

function Legs() {
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <Cyl r={0.03} h={0.75} position={[0.72, -0.78, 0]} rotation={[0, 0, 0.45]} kind="metal" seg={8} />
            <Cyl r={0.12} h={0.03} position={[0.88, -1.12, 0]} kind="metal" seg={16} />
          </group>
        );
      })}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* failure effects that act on the whole craft                         */
/* ------------------------------------------------------------------ */

function Motion({ children }: { children: ReactNode }) {
  const ctx = useCraft();
  const g = useRef<THREE.Group>(null);
  const axis = useMemo(() => new THREE.Vector3(1, 0.35, 0.6).normalize(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const spin = useRef(0);
  useFrame(({ clock }, dt) => {
    const grp = g.current;
    if (!grp) return;
    const now = clock.elapsedTime;
    const tt = animT(ctx, 'tumble', now);
    const tc = animT(ctx, 'crash', now);
    if (tt !== null) {
      const w = Math.min(5, 0.4 + tt * 1.6);
      spin.current += w * dt;
      q.setFromAxisAngle(axis, spin.current);
      grp.quaternion.copy(q);
      grp.position.set(0, 0, 0);
    } else if (tc !== null) {
      const fall = Math.min(1, tc / 1.1);
      grp.position.set(0, -1.1 * fall * fall, 0);
      grp.rotation.set(0.5 * fall, 0, 0.35 * fall);
      const squash = tc > 1.1 ? 1 - Math.min(0.25, (tc - 1.1) * 1.5) : 1;
      grp.scale.set(1, squash, 1);
    } else {
      spin.current = 0;
      grp.quaternion.identity();
      grp.position.set(0, 0, 0);
      grp.scale.set(1, 1, 1);
    }
  });
  return <group ref={g}>{children}</group>;
}

function ImpactRing() {
  const ctx = useCraft();
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    const t = animT(ctx, 'crash', clock.elapsedTime);
    if (!ref.current || !mat.current) return;
    if (t === null || t < 1.1) {
      mat.current.opacity = 0;
      return;
    }
    const k = (t - 1.1) / 1.4;
    ref.current.scale.setScalar(0.3 + k * 4);
    mat.current.opacity = Math.max(0, 0.9 * (1 - k));
  });
  return (
    <mesh ref={ref} position={[0, -2.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1, 64]} />
      <meshBasicMaterial ref={mat} color={ctx.pal.alarm} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ShadowSweep() {
  const ctx = useCraft();
  const tex = useShadowTexture(ctx.pal.dark);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = animT(ctx, 'battery_drain', clock.elapsedTime);
    if (!ref.current) return;
    ref.current.visible = t !== null;
    if (t === null) return;
    const k = easeOut(t / 3);
    ref.current.position.x = -9 + k * 9.5;
  });
  return (
    <Billboard>
      <mesh ref={ref} position={[-9, 0, 2.4]} visible={false} renderOrder={10}>
        <planeGeometry args={[9, 7]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} depthTest={false} />
      </mesh>
    </Billboard>
  );
}

function Lights() {
  const ctx = useCraft();
  const key = useRef<THREE.DirectionalLight>(null);
  useFrame(({ clock }) => {
    if (!key.current) return;
    const t = animT(ctx, 'battery_drain', clock.elapsedTime);
    const target = t === null ? ctx.pal.light : ctx.pal.light * (1 - 0.8 * easeOut(t / 3));
    key.current.intensity += (target - key.current.intensity) * 0.1;
  });
  return (
    <>
      <ambientLight intensity={ctx.pal.ambient} />
      <hemisphereLight args={[ctx.pal.dark ? '#c9d4e3' : '#ffffff', ctx.pal.dark ? '#14161a' : '#c4ccd6', 0.5]} />
      <directionalLight ref={key} position={[5, 7, 4]} intensity={ctx.pal.light} />
      <directionalLight position={[-5, -2, -4]} intensity={0.35} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* pins                                                                */
/* ------------------------------------------------------------------ */

function Pin({ slot, label, onPick }: { slot: SlotId; label: string; onPick?: (s: SlotId) => void }) {
  const ctx = useCraft();
  const g = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (born.current === null) born.current = clock.elapsedTime;
    g.current.scale.setScalar(backOut((clock.elapsedTime - born.current) / 0.45) || 0.0001);
  });
  const a = PIN_ANCHOR[slot];
  return (
    <group position={a}>
      <group ref={g} scale={0.0001}>
        <mesh>
          <sphereGeometry args={[0.055, 16, 12]} />
          <meshBasicMaterial color={ctx.pal.alarm} depthTest={false} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.4, 6]} />
          <meshBasicMaterial color={ctx.pal.alarm} depthTest={false} />
        </mesh>
      </group>
      <Html position={[0, 0.4, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <button className="pin-tag" style={{ pointerEvents: 'auto' }} onClick={() => onPick?.(slot)}>
          <svg width="34" height="22" aria-hidden="true"><path d="M0 22 L18 2 L34 2" /></svg>
          <span>{label}</span>
        </button>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* the craft                                                           */
/* ------------------------------------------------------------------ */

export interface CraftProps {
  pal: Palette;
  lite: boolean;
  looks: Partial<Record<SlotId, PartLook>>;
  instruments: Instrument['look'][];
  lander?: boolean;
  anim?: FailureAnim;
  animKey?: number | string;
  highlight?: SlotId | null;
  glow?: SlotId[];
  pins?: { slot: SlotId; label: string }[];
  onPick?: (slot: SlotId) => void;
  beam?: boolean;
}

export function Craft(props: CraftProps) {
  const { pal, lite, looks, instruments, anim = 'none', animKey, highlight, glow = [], pins = [], onPick, beam, lander } = props;
  const animRef = useRef<{ id: FailureAnim; t0: number }>({ id: 'none', t0: 0 });
  const clock = useThree((s) => s.clock);
  const [, force] = useState(0);

  useEffect(() => {
    animRef.current = { id: anim, t0: clock.elapsedTime };
    force((x) => x + 1);
  }, [anim, animKey, clock]);

  const glowKey = glow.join(',');
  const ctx = useMemo<Ctx>(() => {
    const glowSet = new Set<string>(glowKey ? glowKey.split(',') : []);
    return {
      pal,
      lite,
      anim: animRef,
      zoneState: (z) => {
        const a = animRef.current.id;
        if (a !== 'none' && ANIM_ZONE[a].includes(z)) return 'alarm';
        if (glowSet.has(z)) return 'alarm';
        if (highlight && highlight === z) return 'hl';
        return 'normal';
      },
    };
  }, [pal, lite, highlight, glowKey]);

  const L = looks;
  return (
    <CraftCtx.Provider value={ctx}>
      <Lights />
      <Motion>
        <group scale={0.82}>
          <Bus thermalFull={L.thermal === 'thermal_full'} />
          {L.power && (
            <Zone zone="power" onPick={onPick}>
              <Snap key={L.power} from={[0, 0, 0]}>
                <Power look={L.power} stuckSet={anim === 'panel_stuck'} />
              </Snap>
            </Zone>
          )}
          {L.battery && (
            <Zone zone="battery" onPick={onPick}>
              <Snap key={L.battery} from={[0, 0, -1.2]}>
                <Battery look={L.battery} />
              </Snap>
            </Zone>
          )}
          {L.antenna && (
            <Zone zone="antenna" onPick={onPick}>
              <Snap key={L.antenna} from={[0, 1.4, 0]}>
                <Antenna look={L.antenna} />
              </Snap>
              <Beam on={!!beam} look={L.antenna} />
            </Zone>
          )}
          {L.attitude && (
            <Zone zone="attitude" onPick={onPick}>
              <Snap key={L.attitude} from={[0, 0, -1.2]}>
                <Wheels look={L.attitude} />
              </Snap>
            </Zone>
          )}
          {L.propulsion && (
            <Zone zone="propulsion" onPick={onPick}>
              <Snap key={L.propulsion} from={[0, -1.4, 0]}>
                <Propulsion look={L.propulsion} />
              </Snap>
            </Zone>
          )}
          {L.computer && (
            <Zone zone="computer" onPick={onPick}>
              <Snap key={L.computer} from={[1, 0, -1]}>
                <Computer look={L.computer} />
              </Snap>
            </Zone>
          )}
          {L.thermal && (
            <Zone zone="thermal" onPick={onPick}>
              <Snap key={L.thermal} from={[0, 0, 1]}>
                <Thermal look={L.thermal} />
              </Snap>
            </Zone>
          )}
          <Zone zone="instruments">
            {instruments.map((look, i) => (
              <Snap key={look + i} from={[0, 0, 1.2]} delay={i * 0.06}>
                <InstrumentPart look={look} index={i} />
              </Snap>
            ))}
          </Zone>
          {lander && <Legs />}
          {pins.map((p) => (
            <Pin key={p.slot} slot={p.slot} label={p.label} onPick={onPick} />
          ))}
        </group>
      </Motion>
      <ImpactRing />
      <ShadowSweep />
    </CraftCtx.Provider>
  );
}
