import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Craft, type CraftProps } from './Craft';
import { usePalette, useNarrow } from './palette';

export type CraftViewProps = Omit<CraftProps, 'pal' | 'lite'> & {
  className?: string;
  autoRotate?: boolean;
  distance?: number;
  /** Stop rendering frames, for a canvas that has scrolled out of view. */
  paused?: boolean;
};

export default function CraftView({ className, autoRotate = true, distance = 7.2, paused = false, ...rest }: CraftViewProps) {
  const pal = usePalette();
  const narrow = useNarrow();
  const d = narrow ? distance * 1.18 : distance;
  return (
    <div className={'craft-view ' + (className ?? '')}>
      <Canvas
        frameloop={paused ? 'never' : 'always'}
        dpr={narrow ? [1, 1.25] : [1, 2]}
        camera={{ position: [d * 0.55, d * 0.36, d * 0.75], fov: 36 }}
        gl={{ antialias: !narrow, alpha: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => (document.body.style.cursor = '')}
      >
        <Suspense fallback={null}>
          <Craft pal={pal} lite={narrow} {...rest} />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
          enableDamping
          minPolarAngle={0.35}
          maxPolarAngle={2.6}
        />
      </Canvas>
    </div>
  );
}
