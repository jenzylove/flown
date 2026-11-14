<div align="center">

<img src="public/favicon.svg" width="72" alt="Flown" />

# Flown

**NASA keeps a written lesson for every mission that went wrong. In 2012 its Inspector General found only 57% of its own flight project managers used them.**

[Play it free](https://flown-eight.vercel.app) · [Proof and sources](https://flown-eight.vercel.app/#/proof) · NASA Space Apps Challenge 2026 · Space Mission Design Game

![NASA data](https://img.shields.io/badge/data-NASA%20NSSDCA%20%2B%20LLIS-0b0d12) ![Real failures](https://img.shields.io/badge/real%20failures-38%20sourced-e8641b) ![Answer key](https://img.shields.io/badge/answer%20key-27%2F27-2b7a4b) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

<img src="docs/hero.png" alt="Flown landing page" width="900" />

</div>

The lessons are public, and almost nobody reads them ([NASA OIG IG 12 012](https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf)). Students meet spacecraft one subsystem at a time, so the trade offs that actually lose missions stay on paper. Of university class small satellites that reached orbit in Michael Swartwout's study, about 30% were dead on arrival and another 15% failed early ([The Space Review](https://thespacereview.com/article/3047/1)).

**Flown turns NASA's failure record into a game you lose on purpose.** You design a mission to a real brief, inside its real budget. Before launch you get four pins for what worries you. Then you fly, and the failures that strike are ones that really happened, triggered by the choices you made. Skip the end to end interface check and you can arrive far too low, like Mars Climate Orbiter. Fly an unfolding dish with no flight like test and it can jam, like Galileo. When a real crisis hits, you make the call, then see what NASA actually chose. Fix it, fly the same seed again, and watch the fix hold. Your **caught before launch** rate is the skill you build.

## Judges: start here

No account, no download, no keys.

| | What you see | Time |
| --- | --- | --- |
| **A** | The landing page plays one full loop by itself: a dish jams like Galileo's, the fix holds | 30 s |
| **B** | Make Juno's real 2016 engine call, then see NASA's decision and sources | 1 min |
| **C** | Build, review, fly, read the case, refly and catch it | 3 min |
| **D** | Two to four players on one device, same mission and same dice | 4 min |

**C, step by step**

1. Open **[flown-eight.vercel.app](https://flown-eight.vercel.app)** and press **Play free**. Pick **Orbit Jupiter**.
2. Open the **Antenna** tab and choose **Unfolding umbrella dish**. Under **Process**, choose **No deployment test**. Watch the budget rail move.
3. **Go to review.** Do not pin anything. **Launch.**
4. If the dish jams, decide the crisis, then open the **Galileo** case file: what happened, the root cause, what NASA did, the lesson, the sources, and your craft next to the real Juno.
5. Press **Fix it and refly**. Pin the antenna, pay for the fix, launch on the same seed. The fix holds and the star turns bright in your **Lesson Sky**.

**D:** on the brief screen choose **Fly as a crew**, add two names, and pass the device. The crew board ranks you and shows which real failures hit whom. After any solo flight, **Challenge a friend** copies a link that replays your exact flight next to theirs.

## Why it needs NASA data

Every failure in play is a real one, and its case file is NASA's own story. Take the data away and Flown is one more game with made up failures.

| NASA data | What it does in Flown | Where |
| --- | --- | --- |
| NASA Lessons Learned Information System and NASA mishap reports | 38 real failures, each with sources and a plain words lesson; 27 can strike your craft, triggered by your design | [`src/data/lessons.json`](src/data/lessons.json), [`src/engine/rules.ts`](src/engine/rules.ts) |
| NASA mission records (JPL, NASA, NTRS) | The real crisis decisions: what the team faced and what NASA chose | [`src/engine/rules.ts`](src/engine/rules.ts), [`src/engine/index.ts`](src/engine/index.ts) |
| NASA Space Science Data Coordinated Archive (NSSDCA) | Real spacecraft mass, power, rocket and launch date for the side by side reveal and the mass check | [`scripts/fetch_nssdca.py`](scripts/fetch_nssdca.py), [`src/data/nssdca.json`](src/data/nssdca.json) |
| NASA Office of Inspector General | The problem: lessons that exist but are not used | landing page, this README |

## Measured, not guessed

- **The answer key:** for every one of the **27 real failures in play**, a test finds a design and seed where it strikes, then proves that pinning and fixing the right part prevents it on the same seed. **27 of 27 pass.** [`answer-key.test.ts`](src/engine/__tests__/answer-key.test.ts)
- **Sources:** all 38 lessons carry public sources (98 links), checked by script. A few news sites block automated checks but open in a browser.
- **Mass check:** for each mission, a Flown design that resembles the real craft is compared with NSSDCA's listed mass. Errors run from 2% to 37% and every row is shown on the [proof page](https://flown-eight.vercel.app/#/proof).
- **The app:** 48 engine tests, plus a browser run of all six missions, crew mode and share links at desktop and phone width with zero console errors.

## Honest by design

| Part | Status |
| --- | --- |
| The 38 failures, crises and NASA's decisions | Real, each with sources |
| Spacecraft mass, power, rocket, launch date | Real, from NSSDCA, linked per craft |
| Mission budgets | About the real mission cost, labelled "not a cap" |
| Part values, failure chances, dry mass limits | Simplified game values, said so on screen |
| Firing Juno's engine anyway | A seeded gamble: nobody knows what would have happened, and the game says so |
| Flights | Deterministic: same design and seed fly the same way, so a refly proves a fix |

No accounts and no tracking. Progress lives only in your browser. Not a NASA product; no NASA logos or insignia are used.

## How it works

```
brief ─▶ hangar (parts, instruments, rocket, orbit, tests, live budget)
      ─▶ review (4 pins, pay for fixes)
      ─▶ flight (rules from real lessons fire on your design; crises pause for your call)
      ─▶ case file (real story + sources)  ─▶ refly same seed  ─▶ Lesson Sky (catch rate)
```

`src/engine` is pure TypeScript: the catalog, budget evaluation, 27 rules mapping design choices to real lessons, a seeded flight simulator with crises, catch scoring, share codes and the mass check. `src/ui` and `src/three` render it with React and three.js; the craft is built from your parts and every failure plays on the model.

## What was built during the hackathon

Everything in this repository was built during NASA Space Apps 2026 (November 14 to 15): the lesson dataset and its sourcing, the NSSDCA fetch, the engine and its tests, the 3D craft and failure animations, the landing page, the game, crew mode and share links. Libraries: React, three.js, @react-three/fiber, drei, zustand, Vite, Vitest.

## Use of AI tools

AI coding assistants helped write and review the code and helped gather and summarize sources for the lesson dataset; every lesson keeps its source links so each fact can be checked. No AI generated images, video or audio are used; all visuals are drawn in code.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npx vitest run   # engine tests and the answer key
npm run build
```

## License

[MIT](LICENSE)
