import { useState } from 'react';
import type { FailureAnim, PartLook, SlotId } from '../eng';
import { Craft3D } from '../Shell';

const ANIMS: FailureAnim[] = ['antenna_jam', 'panel_stuck', 'wheel_fail', 'tumble', 'battery_drain', 'engine_cutoff', 'signal_lost', 'valve_stick', 'overheat', 'crash'];
const LOOKS: Partial<Record<SlotId, PartLook>> = {
  power: 'panel_wings', battery: 'battery_l', antenna: 'hga_deployable', attitude: 'wheels_4',
  propulsion: 'biprop', computer: 'cpu_dual', thermal: 'thermal_full',
};

/** Unlinked page that plays every failure on one craft, for checking the motion. */
export default function Lab() {
  const initial = (new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('anim') as FailureAnim) || 'none';
  const [anim, setAnim] = useState<FailureAnim>(initial);
  const [k, setK] = useState(0);
  return (
    <div className="page">
      <p className="eyebrow">Failure lab</p>
      <h1 className="app-title">Every failure, on one craft.</h1>
      <div className="cta-row" style={{ marginTop: 12 }}>
        {ANIMS.map((a) => (
          <button key={a} className={'btn btn-small ' + (a === anim ? 'btn-on' : 'btn-ghost')} onClick={() => { setAnim(a); setK((x) => x + 1); }}>
            {a.replace(/_/g, ' ')}
          </button>
        ))}
      </div>
      <div className="craft-frame" style={{ marginTop: 20 }}>
        <Craft3D looks={LOOKS} instruments={['camera', 'magnetometer']} anim={anim} animKey={k} beam autoRotate={false} />
      </div>
    </div>
  );
}
