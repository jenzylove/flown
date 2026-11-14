import { useEffect } from 'react';
import { useGame } from '../store';
import { go } from '../router';

/** A fixed, repeatable path for judges: Orbit Jupiter on seed 2 with the unfolding dish and no deployment test,
 *  the one design where the real Galileo failure is certain to strike on this seed. */
export default function Judge() {
  useEffect(() => {
    const g = useGame.getState();
    g.startMission('jupiter', 2, false);
    g.setPart('antenna', 'hga_deployable');
    g.setProcess('deployTest', 'dt_none');
    go('/hangar');
  }, []);
  return null;
}
