import { LESSONS, PLAYABLE_LESSONS, MAX_PINS, calibration } from '../eng';
import { href } from '../router';
import { kg, n0 } from '../format';
import { llisUrl } from './CaseFile';

const IG_URL = 'https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf';

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export default function Proof() {
  const cal = calibration();
  const errs = cal.filter((c) => c.errPct !== null).map((c) => Math.abs(c.errPct!));
  const med = median(errs);
  const playable = LESSONS.filter((l) => PLAYABLE_LESSONS.includes(l.id));
  const library = LESSONS.filter((l) => !PLAYABLE_LESSONS.includes(l.id));

  return (
    <div className="page proof">
      <header className="page-head">
        <p className="eyebrow">Proof</p>
        <h1 className="page-title">Where every number comes from.</h1>
        <p className="page-lede">
          Flown is a game, but its failures are not made up. Each one is a real lesson with a public source. Spacecraft facts come from NASA&rsquo;s
          NSSDCA catalog. Part values are simplified teaching values, checked against real craft below.
        </p>
      </header>

      <section className="proof-sec">
        <header className="sec-head"><span className="sec-no">01</span><h2>How the catch rate works</h2></header>
        <div className="formula">
          <span className="f-top">caught</span>
          <span className="f-bar" />
          <span className="f-bot">caught + missed + wrong pins</span>
        </div>
        <p className="proof-p">
          On every flight the engine decides, from the seed and your design, which real failures would strike. A failure you pinned at the pre launch
          review counts as caught. One you did not pin counts as missed. You get {MAX_PINS} pins per review, and a pin on something that carries no
          real risk for your craft is a wrong pin: it counts against you, so pinning everything never pays. The rate on your lesson sky adds up every
          flight you have flown on this device. Crew and friend scores use the same idea: science percent, plus 10 for each failure caught, minus 5
          for each one missed, minus 5 for each wrong pin.
        </p>
      </section>

      <section className="proof-sec">
        <header className="sec-head"><span className="sec-no">02</span><h2>Sizing check against real spacecraft</h2></header>
        <p className="proof-p">
          For each brief, a Flown design built like the real craft is weighed by the same rules you play with, then compared with the listed mass in
          NSSDCA. That listed figure is not always the same kind of mass: for some craft it is the dry mass, for others the launch or landed mass.
          The limit you build against in Flown is a simplified dry mass limit for the rocket you pick, not a real rocket&rsquo;s capacity. {med !== null && <>Median error: <b>{n0(med)}%</b> across {errs.length} craft.</>} Every row is shown, misses included.
        </p>
        <div className="table-scroll">
          <table className="proof-table">
            <thead>
              <tr><th>Real craft</th><th>NSSDCA listed mass</th><th>Flown mass</th><th>Error</th><th>Source</th></tr>
            </thead>
            <tbody>
              {cal.map((c) => (
                <tr key={c.brief}>
                  <td>{c.craft}</td>
                  <td>{c.realMassKg != null ? kg(c.realMassKg) : 'Not listed'}</td>
                  <td>{kg(c.flownMassKg)}</td>
                  <td className={c.errPct !== null && med !== null && Math.abs(c.errPct) > med ? 'err-hi' : ''}>
                    {c.errPct === null ? 'n/a' : `${c.errPct > 0 ? 'over by ' : c.errPct < 0 ? 'under by ' : ''}${Math.abs(c.errPct)}%`}
                  </td>
                  <td>{c.source ? <a href={c.source} target="_blank" rel="noreferrer">NSSDCA</a> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="proof-sec">
        <header className="sec-head"><span className="sec-no">03</span><h2>{LESSONS.length} lessons and their sources</h2></header>
        <p className="proof-p">{playable.length} can strike in play. {library.length} are library lessons you can read from the sky.</p>
        <LessonTable title="In play" list={playable} />
        <LessonTable title="Library" list={library} />
      </section>

      <section className="proof-sec">
        <header className="sec-head"><span className="sec-no">04</span><h2>Credits</h2></header>
        <ul className="credits">
          <li>Spacecraft mass, power, launch vehicle and dates: <a href="https://nssdc.gsfc.nasa.gov/nmc/" target="_blank" rel="noreferrer">NASA Space Science Data Coordinated Archive (NSSDCA)</a>.</li>
          <li>Lessons: <a href="https://llis.nasa.gov/" target="_blank" rel="noreferrer">NASA Lessons Learned Information System (LLIS)</a> and the mishap reports and articles linked on each lesson.</li>
          <li>The 57% figure (16 of 28 surveyed project managers): <a href={IG_URL} target="_blank" rel="noreferrer">NASA Office of Inspector General, report IG 12 012 (2012)</a>.</li>
          <li>Spacecraft visuals are drawn in code from simple shapes. No generated images, no NASA logos or insignia.</li>
          <li>Built with help from Claude Code, an AI coding assistant, for code, tests and gathering the public sources. Every lesson keeps its links so each fact can be checked.</li>
          <li>Type: Instrument Serif, Martian Mono and Schibsted Grotesk, via Google Fonts, under the SIL Open Font License 1.1.</li>
          <li>
            Code: <a href="https://react.dev/" target="_blank" rel="noreferrer">React</a> (MIT),{' '}
            <a href="https://threejs.org/" target="_blank" rel="noreferrer">three.js</a> (MIT),{' '}
            <a href="https://github.com/pmndrs/react-three-fiber" target="_blank" rel="noreferrer">@react-three/fiber</a> (MIT),{' '}
            <a href="https://github.com/pmndrs/drei" target="_blank" rel="noreferrer">drei</a> (MIT) and{' '}
            <a href="https://github.com/pmndrs/zustand" target="_blank" rel="noreferrer">zustand</a> (MIT).
          </li>
          <li>Not a NASA product. Built for NASA Space Apps 2026.</li>
        </ul>
      </section>
    </div>
  );
}

function LessonTable({ title, list }: { title: string; list: typeof LESSONS }) {
  return (
    <>
      <p className="mono-label">{title}</p>
      <ol className="lesson-list">
        {list.map((l) => (
          <li key={l.id}>
            <a className="ll-name" href={href('/case/' + l.id)}>{l.mission}</a>
            <span className="ll-meta">{l.year} &middot; {l.subsystem.replace(/_/g, ' ')}</span>
            <span className="ll-src">
              {l.llis_id && <a href={llisUrl(l.llis_id)} target="_blank" rel="noreferrer">LLIS {l.llis_id}</a>}
              {l.sources.map((s, i) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" title={s.title}>Source {i + 1}</a>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
