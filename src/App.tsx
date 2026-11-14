import { useRoute } from './ui/router';
import { Shell } from './ui/Shell';
import ColdOpen from './ui/screens/ColdOpen';
import Landing from './ui/screens/Landing';
import Brief from './ui/screens/Brief';
import Hangar from './ui/screens/Hangar';
import Review from './ui/screens/Review';
import Flight from './ui/screens/Flight';
import CaseFile from './ui/screens/CaseFile';
import Sky from './ui/screens/Sky';
import Proof from './ui/screens/Proof';
import Lab from './ui/screens/Lab';
import Crew from './ui/screens/Crew';
import Challenge from './ui/screens/Challenge';
import About from './ui/screens/About';
import Privacy from './ui/screens/Privacy';

function Screen({ route }: { route: string }) {
  const [, rawHead, arg] = route.split('/');
  const head = rawHead?.split('?')[0];
  switch (head) {
    case '':
    case undefined:
      return <Landing />;
    case 'juno':
      return <ColdOpen />;
    case 'play':
    case 'brief':
      return <Brief />;
    case 'hangar':
      return <Hangar />;
    case 'refly':
      return <Hangar refly />;
    case 'review':
      return <Review />;
    case 'flight':
      return <Flight />;
    case 'case':
      return <CaseFile key={arg} id={decodeURIComponent(arg ?? '')} />;
    case 'sky':
      return <Sky />;
    case 'proof':
      return <Proof />;
    case 'crew':
      return <Crew view={arg ?? ''} />;
    case 'fly':
      return <Challenge rest={route.slice('/fly/'.length)} />;
    case 'lab':
      return <Lab />;
    case 'about':
      return <About />;
    case 'privacy':
      return <Privacy />;
    default:
      return <Landing />;
  }
}

export default function App() {
  const route = useRoute();
  return (
    <Shell route={route}>
      <div className="screen" key={route}>
        <Screen route={route} />
      </div>
    </Shell>
  );
}
