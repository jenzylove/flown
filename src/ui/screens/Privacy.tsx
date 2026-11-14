import { href } from '../router';

export default function Privacy() {
  return (
    <div className="page proof trust">
      <header className="page-head">
        <p className="eyebrow">Privacy</p>
        <h1 className="page-title">Nothing about you leaves your browser.</h1>
        <p className="page-lede">Flown has no accounts and no tracking. Here is everything it keeps, and where.</p>
      </header>

      <section className="proof-sec">
        <ul className="credits">
          <li><b>No accounts.</b> There is no sign up, no email and no password.</li>
          <li><b>No tracking.</b> No analytics, no ads and no cookies.</li>
          <li>
            <b>Progress stays on your device.</b> Your lesson sky, streak, best flights and theme are saved in this browser&rsquo;s local storage. Clear your
            site data and they are gone. We never see them.
          </li>
          <li>
            <b>Share links hold only the design and seed.</b> A challenge link carries your craft&rsquo;s parts, choices and the flight seed. No name, no
            score history, nothing else.
          </li>
          <li><b>Fonts</b> load from Google Fonts, so your browser asks Google&rsquo;s servers for them like it does on most sites.</li>
        </ul>
      </section>

      <div className="cta-row">
        <a className="btn btn-primary" href={href('/play')}>Play free</a>
        <a className="btn btn-ghost" href={href('/about')}>About Flown</a>
      </div>
    </div>
  );
}
