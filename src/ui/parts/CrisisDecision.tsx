import { useCallback, useState } from 'react';
import type { ColdOpen } from '../eng';
import { lessonById } from '../eng';
import { Typed } from './Typed';
import { href } from '../router';

/**
 * A real crisis, played as a decision: telemetry types in, you choose, then NASA's real call and its sources.
 * Used by the Juno cold open (#/juno) and inside the landing page.
 */
export function CrisisDecision({
  co,
  start = true,
  onTyped,
  onPick,
  buildLabel = 'Build your own',
}: {
  co: ColdOpen;
  start?: boolean;
  onTyped?: () => void;
  onPick?: (id: string) => void;
  buildLabel?: string;
}) {
  const lesson = lessonById(co.lessonId);
  const [typed, setTyped] = useState(false);
  const [skip, setSkip] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const onDone = useCallback(() => {
    setTyped(true);
    onTyped?.();
  }, [onTyped]);
  const chosen = co.options.find((o) => o.id === pick);
  const nasa = co.options.find((o) => o.id === co.nasaChoice);
  const sameAsNasa = pick === co.nasaChoice;

  return (
    <div className="crisis-decision">
      <div className="cold-tele" onClick={() => setSkip(true)}>
        {start ? (
          <Typed lines={co.setup} onDone={onDone} skip={skip} />
        ) : (
          <ol className="telemetry" aria-hidden="true">
            <li><span className="tl-no">01</span><span className="tl-text"><i className="caret" /></span></li>
          </ol>
        )}
        {!typed && start && (
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
              onClick={() => {
                setPick(o.id);
                onPick?.(o.id);
              }}
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
            <a className="btn btn-primary" href={href('/play')}>{buildLabel}</a>
            {lesson && <a className="btn btn-ghost" href={href('/case/' + lesson.id)}>Read the case file</a>}
          </div>
        </div>
      )}
    </div>
  );
}
