import { lessonById, REAL_CRAFT, PLAYABLE_LESSONS, evaluate, briefById, applyFixes } from '../eng';
import type { RealCraft } from '../eng';
import { useGame } from '../store';
import { href } from '../router';
import { kg, watts, prettyDate } from '../format';

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
  const compare: RealCraft | null = briefCraft ?? lessonCraft?.[1] ?? null;

  return (
    <article className="page casefile">
      <header className="case-head">
        <p className="eyebrow">
          Case file &middot; {lesson.agency} &middot; {lesson.year}
          {lesson.llis_id && <> &middot; LLIS {lesson.llis_id}</>}
        </p>
        <h1 className="case-title">{lesson.mission}</h1>
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

      <div className="case-body">
        <div className="case-text">
          <section>
            <h2 className="case-h">What happened</h2>
            <p>{lesson.what_happened}</p>
          </section>
          <section>
            <h2 className="case-h">Root cause</h2>
            <p>{lesson.root_cause}</p>
          </section>
          <section>
            <h2 className="case-h">What NASA did</h2>
            <p>{lesson.what_nasa_did}</p>
          </section>
          <section className="case-lesson">
            <h2 className="case-h">The lesson</h2>
            <blockquote>{lesson.lesson}</blockquote>
          </section>
          <section>
            <h2 className="case-h">When it strikes in Flown</h2>
            <p>{lesson.design_trigger}</p>
          </section>
          <section>
            <h2 className="case-h">Sources</h2>
            <ul className="source-list">
              {lesson.llis_id && (
                <li><a href={llisUrl(lesson.llis_id)} target="_blank" rel="noreferrer">NASA LLIS lesson {lesson.llis_id}</a></li>
              )}
              {lesson.sources.map((s) => (
                <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="vs">
          <p className="mono-label">Your craft vs the real one</p>
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
                <td>{brief ? `limit ${kg(brief.launchMassLimitKg)}` : ''}</td>
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
          {lessonCraft && briefCraft && lessonCraft[1] !== briefCraft && (
            <p className="vs-note">
              This case happened to {lessonCraft[1].name}: {lessonCraft[1].mass_kg != null ? kg(lessonCraft[1].mass_kg) : 'mass not listed'},
              launched {lessonCraft[1].launch_date ? prettyDate(lessonCraft[1].launch_date) : 'on a date not listed'} on {lessonCraft[1].launch_vehicle ?? 'a rocket not listed'}.{' '}
              <a href={lessonCraft[1].source} target="_blank" rel="noreferrer">NSSDCA</a>
            </p>
          )}
          <div className="cta-col">
            {mission?.run?.done && (
              <a className="btn btn-primary" href={href('/flight')}>Back to the flight</a>
            )}
            <a className="btn btn-ghost" href={href('/sky')}>Lesson sky</a>
          </div>
        </aside>
      </div>
    </article>
  );
}
