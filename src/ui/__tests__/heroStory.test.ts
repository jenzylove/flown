import { describe, expect, it } from 'vitest';
import { findHeroStory, STORY_LESSON } from '../heroStory';

describe('landing hero story', () => {
  it('is a real engine run: the dish jams unfixed and the fix holds on the same seed', () => {
    const s = findHeroStory();
    expect(s).toBeTruthy();
    const last = s!.failEvents[s!.failEvents.length - 1];
    expect(last.lessonId).toBe(STORY_LESSON);
    expect(last.anim).toBe('antenna_jam');
    expect(s!.fixEvents.some((e) => e.kind === 'save' && e.lessonId === STORY_LESSON)).toBe(true);
    expect(s!.caught).toBe(true);
    expect(s!.skipDays).toBeGreaterThan(0);
  });
});
