import { useCallback, useState } from 'react';
import { COLD_OPENS, REAL_CRAFT, REFERENCE_DESIGNS } from '../eng';
import { Craft3D } from '../Shell';
import { CrisisDecision } from '../parts/CrisisDecision';
import { looksOf, instrumentLooks } from '../craftLooks';
import { href } from '../router';
import { kg, prettyDate } from '../format';
import { useNarrow } from '../../three/palette';

const IG_URL = 'https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf';

/** The Juno cold open on its own route (#/juno). */
export default function ColdOpen() {
  const co = COLD_OPENS[0];
  const narrow = useNarrow();
  const craft = REAL_CRAFT[co.craft];
  const ref = REFERENCE_DESIGNS['jupiter'];
  const [typed, setTyped] = useState(false);
  const [picked, setPicked] = useState(false);
  const onTyped = useCallback(() => setTyped(true), []);
  const onPick = useCallback(() => setPicked(true), []);

  return (
    <div className="cold">
      <section className="cold-hero">
        <div className="cold-copy">
          <p className="eyebrow">
            <span className="eyebrow-dot" /> A real crisis &middot; {co.dateLabel}
          </p>
          <h1 className="cold-title">
            {craft?.name ?? 'Juno'}
            <span className="cold-title-sub">has a valve problem.</span>
          </h1>
          <CrisisDecision co={co} onTyped={onTyped} onPick={onPick} />
          {!picked && (
            <a className="skip-cta" href={href('/play')}>Skip to building your own craft</a>
          )}
        </div>

        <figure className="cold-figure">
          <Craft3D
            className="cold-craft"
            looks={looksOf(ref)}
            instruments={instrumentLooks(ref)}
            anim={typed ? 'valve_stick' : 'none'}
            beam
            distance={narrow ? 7 : 9.6}
          />
          {craft && (
            <figcaption className="spec-callouts">
              <span className="callout c1"><b>{kg(craft.mass_kg ?? 0)}</b> listed mass, NSSDCA</span>
              {craft.launch_vehicle && <span className="callout c2"><b>{craft.launch_vehicle}</b> rocket</span>}
              {craft.launch_date && <span className="callout c3">Launched <b>{prettyDate(craft.launch_date)}</b></span>}
              <a className="callout-src" href={craft.source} target="_blank" rel="noreferrer">NSSDCA record</a>
            </figcaption>
          )}
        </figure>
        <p className="hero-problem">
          <span className="hp-num">57%</span>
          <span>
            In a 2012 survey, only 57% of NASA flight project managers (16 of 28) said they used NASA&rsquo;s own lessons database. Flown puts those lessons in your hands before launch.{' '}
            <a href={IG_URL} target="_blank" rel="noreferrer">NASA OIG, IG 12 012, 2012</a>
          </span>
        </p>
      </section>
    </div>
  );
}
