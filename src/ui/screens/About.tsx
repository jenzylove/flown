import { LESSONS, PLAYABLE_LESSONS, BRIEFS } from '../eng';
import { href } from '../router';

const IG_URL = 'https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf';
const REPO_URL = 'https://github.com/jenzylove/flown';

export default function About() {
  return (
    <div className="page proof trust">
      <header className="page-head">
        <p className="eyebrow">About</p>
        <h1 className="page-title">A flight review board you can play.</h1>
        <p className="page-lede">
          Flown is a free browser game. You design a spacecraft for one of {BRIEFS.length} real mission briefs, pin the risks you see at a pre launch
          review, then fly into failures that really happened. {PLAYABLE_LESSONS.length} of its {LESSONS.length} lessons can strike in play, and every
          one links to its public record.
        </p>
      </header>

      <section className="proof-sec">
        <header className="sec-head"><span className="sec-no">01</span><h2>Who built it</h2></header>
        <p className="proof-p">
          Team JDollar built Flown during NASA Space Apps 2026, November 14 to 15, for the Space Mission Design Game challenge. The code is open on{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">GitHub</a> under the MIT license.
        </p>
        <p className="proof-p">
          <b>Flown is not a NASA product.</b> It is not made or endorsed by NASA, and it uses no NASA logos or insignia.
        </p>
      </section>

      <section className="proof-sec">
        <header className="sec-head"><span className="sec-no">02</span><h2>Where the data comes from</h2></header>
        <ul className="credits">
          <li>
            Spacecraft facts: the <a href="https://nssdc.gsfc.nasa.gov/nmc/" target="_blank" rel="noreferrer">NASA Space Science Data Coordinated Archive</a> (NSSDCA).
          </li>
          <li>
            Lessons: the <a href="https://llis.nasa.gov/" target="_blank" rel="noreferrer">NASA Lessons Learned Information System</a> (LLIS), mishap board
            reports and the articles linked on each case file.
          </li>
          <li>
            The 57% figure: <a href={IG_URL} target="_blank" rel="noreferrer">NASA Office of Inspector General, report IG 12 012</a> (2012).
          </li>
          <li>Part values, failure chances and dry mass limits are simplified for play. The <a href={href('/proof')}>proof page</a> shows how far off they are.</li>
        </ul>
      </section>

      <div className="cta-row">
        <a className="btn btn-primary" href={href('/play')}>Play free</a>
        <a className="btn btn-ghost" href={href('/proof')}>See the proof</a>
      </div>
    </div>
  );
}
