import { lessonById, REAL_CRAFT, PLAYABLE_LESSONS, evaluate, briefById, applyFixes, launchOf } from '../eng';
import type { RealCraft } from '../eng';
import { useGame } from '../store';
import { href } from '../router';
import { kg, watts, prettyDate } from '../format';
import { More, splitFirst } from '../parts/Bits';

export function llisUrl(id: string) {
  const n = parseInt(id, 10);
  return `https://llis.nasa.gov/lesson/${Number.isFinite(n) ? n : id}`;
}

function findCraft(mission: string): [string, RealCraft] | null {
  const m = mission.toLowerCase();
  for (const [k, v] of Object.entries(REAL_CRAFT)) {
    const name = v.name.toLowerCase();
    if (m.startsWith(name) || name.startsWith(m) || m.includes(name.split(' (')[0].split('/')[0])) return [k, v];
  }
  return null;
}

export default function CaseFile({ id }: { id: string }) {
  const lesson = lessonById(id);
  const mission = useGame((s) => s.mission);
  const state = useGame((s) => s.lessons[id]);
  if (!lesson) {
    return (
      <div className="page empty-page">
        <h1 className="page-title">No case file by that name.</h1>
        <a className="btn btn-ghost" href={href('/sky')}>Back to the sky</a>
      </div>
    );
  }
  const playable = PLAYABLE_LESSONS.includes(lesson.id);
  const lessonCraft = findCraft(lesson.mission);

  let brief = null as ReturnType<typeof briefById> | null;
  try {
    brief = mission ? briefById(mission.briefId) : null;
  } catch {
    brief = null;
  }
  const yours = mission ? evaluate(applyFixes(mission.design, mission.fixed)) : null;
  const briefCraft = brief ? REAL_CRAFT[brief.realCraft] : null;
  // Compare with the craft this case happened to when the archive has it; otherwise the real craft behind your brief.
  const compare: RealCraft | null = lessonCraft?.[1] ?? briefCraft ?? null;
  const compareIsCase = !!lessonCraft;

  const [whyHead, whyRest] = splitFirst(lesson.root_cause);
  const [didHead, didRest] = splitFirst(lesson.what_nasa_did);
  const llisNo = lesson.llis_id ? parseInt(lesson.llis_id, 10) : NaN;
  const seen = new Set<string>();
  const sources = lesson.sources.filter((src) => {
    const m = /llis\.nasa\.gov\/lesson\/0*(\d+)/i.exec(src.url);
    if (m && Number(m[1]) === llisNo) return false;
    const k = src.url.replace(/\/+$/, '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const nSources = sources.length + (lesson.llis_id ? 1 : 0);
  const yourRocket = mission ? launchOf(mission.design) : null;

  return (
    <article className="page casefile">
      <header className="case-head">
        <div className="case-head-top">
          <p className="eyebrow">
            Case file &middot; {lesson.agency}
            {lesson.llis_id && <> &middot; LLIS {lesson.llis_id}</>}
          </p>
          <div className="case-nav">
            {mission?.run?.done && <a className="btn btn-primary btn-small" href={href('/flight')}>Back to the flight</a>}
            <a className="btn btn-ghost btn-small" href={href('/sky')}>Lesson sky</a>
          </div>
        </div>
        <h1 className="case-title">{lesson.mission} <span className="case-year">{lesson.year}</span></h1>
        <p className="case-what">{lesson.what_happened}</p>
        <div className="case-tags">
          <span>{lesson.subsystem.replace(/_/g, ' ')}</span>
          <span>{lesson.phase.replace(/_/g, ' ')}</span>
          <span className={'outcome-' + lesson.outcome}>{lesson.outcome.replace(/_/g, ' ')}</span>
          <span>{playable ? 'Can strike in play' : 'Library lesson'}</span>
          {state && state.status !== 'unseen' && (
            <span className={'st-' + state.status}>{state.status === 'caught' ? 'You caught it' : 'It hit you'}</span>
          )}
        </div>
      </header>

      <div className="case-blocks">
        <section className="case-block">
          <h2 className="case-h">Why</h2>
          <p>{whyHead}</p>
        </section>
        <section className="case-block">
          <h2 className="case-h">What NASA did</h2>
          <p>{didHead}</p>
          {didRest && <More label="more" className="why">{didRest}</More>}
        </section>
        <section className="case-lesson">
          <h2 className="case-h">The lesson</h2>
          <blockquote>{lesson.lesson}</blockquote>
        </section>
      </div>

      <div className="case-more">
        {whyRest && (
          <More label="Root cause in full">
            <p>{lesson.root_cause}</p>
          </More>
        )}
        <More label="When it strikes in Flown">
          <p>{lesson.design_trigger}</p>
        </More>
        <More label={compare ? (compareIsCase ? `Your craft vs ${compare.name}, the craft in this case` : `Your craft vs the real craft for this mission (${compare.name})`) : 'Your craft vs the real one'}>
          <table className="vs-table">
            <thead>
              <tr>
                <th />
                <th>Yours{brief ? ` (${brief.title})` : ''}</th>
                <th>{compare ? compare.name : 'Real craft'}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Mass<small> (NSSDCA listed)</small></th>
                <td>{yours ? kg(yours.massKg) : 'No craft yet'}</td>
                <td>{compare?.mass_kg != null ? kg(compare.mass_kg) : 'Not listed'}</td>
              </tr>
              <tr>
                <th>Power</th>
                <td>{yours ? `${watts(yours.powerGenW)} at target` : ''}</td>
                <td>{compare?.power_w != null ? watts(compare.power_w) : 'Not listed'}</td>
              </tr>
              <tr>
                <th>Rocket</th>
                <td>{yourRocket ? yourRocket.name : 'No craft yet'}{yours && <span className="cell-note">allows {kg(yours.massLimitKg)} dry, a simplified game limit</span>}</td>
                <td>{compare?.launch_vehicle ?? 'Not listed'}</td>
              </tr>
              <tr>
                <th>Launched</th>
                <td>{mission?.run?.done ? `seed ${mission.seed}` : 'Not yet'}</td>
                <td>{compare?.launch_date ? prettyDate(compare.launch_date) : 'Not listed'}</td>
              </tr>
            </tbody>
          </table>
          {compare && (
            <a className="cite" href={compare.source} target="_blank" rel="noreferrer">NSSDCA record</a>
          )}
        </More>
        <More label="Sources" count={nSources}>
          <ul className="source-list">
            {lesson.llis_id && (
              <li><a href={llisUrl(lesson.llis_id)} target="_blank" rel="noreferrer">NASA LLIS lesson {lesson.llis_id}</a></li>
            )}
            {sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>
            ))}
          </ul>
        </More>
      </div>
    </article>
  );
}
