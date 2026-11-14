import { useCallback, useState } from 'react';
import { COLD_OPENS, REAL_CRAFT, REFERENCE_DESIGNS, LESSONS, PLAYABLE_LESSONS, BRIEFS, lessonById } from '../eng';
import { Craft3D } from '../Shell';
import { Typed } from '../parts/Typed';
import { looksOf, instrumentLooks } from '../craftLooks';
import { href } from '../router';
import { kg, prettyDate } from '../format';
import { useNarrow } from '../../three/palette';

const IG_URL = 'https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf';

export default function ColdOpen() {
  const co = COLD_OPENS[0];
  const narrow = useNarrow();
  const craft = REAL_CRAFT[co.craft];
  const lesson = lessonById(co.lessonId);
  const ref = REFERENCE_DESIGNS['jupiter'];
  const [typed, setTyped] = useState(false);
  const [skip, setSkip] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const onDone = useCallback(() => setTyped(true), []);
  const chosen = co.options.find((o) => o.id === pick);
  const nasa = co.options.find((o) => o.id === co.nasaChoice);
  const sameAsNasa = pick === co.nasaChoice;

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
          <div className="cold-tele" onClick={() => setSkip(true)}>
            <Typed lines={co.setup} onDone={onDone} skip={skip} />
            {!typed && (
              <button className="link-quiet" onClick={() => setSkip(true)}>Show all</button>
            )}
          </div>

          <div className={'cold-decide ' + (typed ? 'in' : '')} aria-hidden={!typed}>
            <p className="cold-prompt">{co.prompt}</p>
            <div className="choice-list" role="group" aria-label="Your decision">
              {co.options.map((o, i) => (
                <button
                  key={o.id}
                  className={'choice ' + (pick === o.id ? 'picked' : '') + (pick && pick !== o.id ? ' faded' : '')}
                  onClick={() => setPick(o.id)}
                  disabled={!typed || !!pick}
                >
                  <span className="choice-key">{String.fromCharCode(65 + i)}</span>
                  <span className="choice-label">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {chosen && (
            <div className="cold-reveal">
              <p className="reveal-line">
                <span className="mono-label">Your call</span>
                {chosen.consequence}
              </p>
              <div className="nasa-chose">
                <p className="mono-label">{sameAsNasa ? 'NASA made the same call' : 'NASA chose otherwise'}</p>
                <p className="nasa-choice">{nasa?.label}</p>
                <p className="nasa-why">{co.nasaWhy}</p>
                <ul className="source-list">
                  {co.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="cta-row">
                <a className="btn btn-primary" href={href('/brief')}>Build your own</a>
                {lesson && <a className="btn btn-ghost" href={href('/case/' + lesson.id)}>Read the case file</a>}
              </div>
            </div>
          )}
          {!chosen && (
            <a className="skip-cta" href={href('/brief')}>Skip to building your own craft</a>
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
            Only 57% of NASA flight project managers used NASA&rsquo;s own lessons database. Flown puts those lessons in your hands before launch.{' '}
            <a href={IG_URL} target="_blank" rel="noreferrer">NASA OIG, IG 12 012, 2012</a>
          </span>
        </p>
      </section>

      <section className="problem">
        <div className="problem-num" aria-hidden="true">57%</div>
        <p className="problem-text">
          NASA&rsquo;s Inspector General found that only 57% of flight project managers used NASA&rsquo;s own lessons
          database. The lessons exist. They are not reaching the people designing the next craft.
          <a className="cite" href={IG_URL} target="_blank" rel="noreferrer">NASA OIG report IG 12 012, 2012</a>
        </p>
      </section>

      <section className="how">
        <header className="sec-head">
          <span className="sec-no">01</span>
          <h2>How a flight works</h2>
        </header>
        <ol className="how-steps">
          <li>
            <span className="how-no">01</span>
            <h3>Build to a real brief</h3>
            <p>Pick one of {BRIEFS.length} missions modeled on real ones. Snap on power, antenna, engine and instruments inside the real budget and the rocket&rsquo;s mass limit.</p>
          </li>
          <li>
            <span className="how-no">02</span>
            <h3>Pin what worries you</h3>
            <p>At the pre launch review, tap the parts and choices you think will fail. Pay to fix the ones you believe in.</p>
          </li>
          <li>
            <span className="how-no">03</span>
            <h3>Fly into real failures</h3>
            <p>{PLAYABLE_LESSONS.length} failures that really happened can strike your craft in flight. Each one plays out on your model, with the choices the real team had.</p>
          </li>
          <li>
            <span className="how-no">04</span>
            <h3>Read the case. Fly again.</h3>
            <p>Every failure opens the real case file. Fix it and refly the same seed to prove the lesson stuck. {LESSONS.length} lessons light up your sky.</p>
          </li>
        </ol>
        <div className="cta-row center">
          <a className="btn btn-primary" href={href('/brief')}>Start a mission</a>
          <a className="btn btn-ghost" href={href('/sky')}>See the lesson sky</a>
        </div>
      </section>
    </div>
  );
}
