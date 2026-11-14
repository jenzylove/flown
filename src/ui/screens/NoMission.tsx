import { href } from '../router';

export function NoMission() {
  return (
    <div className="page empty-page">
      <p className="eyebrow">No craft on the stand</p>
      <h1 className="page-title">Pick a mission first.</h1>
      <p className="page-lede">The hangar opens once you have a brief.</p>
      <div className="cta-row">
        <a className="btn btn-primary" href={href('/brief')}>Choose a brief</a>
      </div>
    </div>
  );
}
