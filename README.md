<div align="center">

<img src="public/favicon.svg" width="72" alt="Flown" />

# Flown

**Design a space mission. Survive real mission failures.**

![NASA data](https://img.shields.io/badge/data-NASA%20NSSDCA%20%2B%20LLIS-0b0d12) ![Real failures](https://img.shields.io/badge/real%20failures-38%20sourced-e8641b) ![Answer key](https://img.shields.io/badge/answer%20key-27%2F27-2b7a4b) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

<img src="docs/hero.png" alt="Flown: the landing page plays a real failure and its fix" width="900" />

</div>

Live at **[flown-eight.vercel.app](https://flown-eight.vercel.app)**. Free, no sign up. Watch the **[30 second demo](https://youtu.be/y-Rg446MdWQ)**. Built for NASA Space Apps 2026, challenge: **Space Mission Design Game**.

NASA writes down what went wrong on every mission. In 2012 its Inspector General found only **57%** of its own flight project managers used those lessons at all ([IG 12 012](https://www.oversight.gov/sites/default/files/oig-reports/IG-12-012.pdf)). Students meet spacecraft one part at a time, and the people who will build the next ones learn the hard way. Of university small satellites that reached orbit in Michael Swartwout's study, about 30% were dead on arrival and another 15% failed early ([The Space Review](https://thespacereview.com/article/3047/1)).

Flown turns that record into a game you learn by losing.

1. **Build to a real brief.** Six missions modeled on real ones, from a Mars orbiter to a Pluto flyby, inside about the real budget. Pick power, antenna, engine, computer, instruments, rocket, orbit and how much testing you can afford.
2. **Pin what worries you.** Before launch you get four pins. Pay to fix the ones you believe in. A pin on something with no real risk counts against you.
3. **Fly into real failures.** 27 failures that really happened can strike, triggered by your choices. Skip the end to end interface check and you can arrive far too low, like Mars Climate Orbiter. Fly an unfolding dish without a flight like test and it can jam, like Galileo. In a real crisis you make the call, then see what the real team chose.
4. **Read the case, fix it, fly again.** Every failure opens the real case file with its sources. Refly the same seed and watch the fix hold. Each lesson becomes a star in your Lesson Sky, and your **caught before launch** rate is the skill you build.

## Try it in two minutes

| | What you do | Time |
| --- | --- | --- |
| **1** | Open the site and watch the hero: a dish jams like Galileo's, then the fix holds | 30 s |
| **2** | Press **Or try Juno's real call**: decide Juno's 2016 engine problem, then see NASA's decision and sources | 1 min |
| **3** | Open the **[judge path](https://flown-eight.vercel.app/#/judge)**: Orbit Jupiter on a fixed seed with the unfolding dish and no deployment test already chosen. Go to review, **Launch**, and the dish jams like Galileo's. Open the case, then **Fix it and refly** with the antenna pinned and fixed: same seed, the fix holds | 3 min |
| **4** | **Fly as a crew** with 2 to 4 names on one device: **One craft** splits the spacecraft into roles, each with its own systems and a pin, launch needs every GO, and the role that owns a failing part makes the crisis call. Or race on the same seed, or send **Challenge a friend** after a solo flight | 4 min |

## Proof you can check

| Claim | How it is checked |
| --- | --- |
| Every failure in play can really strike, and its fix really prevents it | [Answer key](src/engine/__tests__/answer-key.test.ts): for each of the 27, a design and seed where it strikes, then the same seed with the fix. **27 of 27 pass.** |
| Every failure is real | All 38 lessons carry public sources, 98 links in total, listed on the [proof page](https://flown-eight.vercel.app/#/proof) and in [`lessons.json`](src/data/lessons.json) |
| Real spacecraft facts | Mass, power, rocket and launch date read from NASA's NSSDCA catalog by [`fetch_nssdca.py`](scripts/fetch_nssdca.py) |
| Flown's mass rules are close to real craft | Compared with NSSDCA for each mission: errors up to 37%, every row published on the proof page |
| The app works | 56 tests, plus a browser run of all six missions, crew mode and share links at desktop and phone width with zero console errors |

**Real:** the 38 failures, the crises and NASA's decisions, spacecraft facts from NSSDCA, budgets close to real mission costs (labelled "not a cap").
**Simplified for play:** part values, failure chances and dry mass limits, said so on screen. Firing Juno's engine anyway is a seeded gamble, because nobody knows what would have happened.

## Why NASA data is the game

Take the data out and Flown is one more game with made up failures. With it, every loss is a real lesson from a real mission:

- **NASA Lessons Learned Information System and mishap reports:** the failures, root causes and lessons ([`lessons.json`](src/data/lessons.json), [`rules.ts`](src/engine/rules.ts)).
- **NASA and JPL mission records:** the real crisis decisions and what NASA chose.
- **NASA NSSDCA:** the real craft in every "your craft vs the real one" reveal.
- **NASA Office of Inspector General:** the problem Flown answers.

## How it works

```
brief ─▶ hangar (parts, instruments, rocket, orbit, tests, live budget)
      ─▶ review (4 pins, pay for fixes)
      ─▶ flight (rules from real lessons fire on your design; crises pause for your call)
      ─▶ case file (real story + sources)  ─▶ refly same seed  ─▶ Lesson Sky (catch rate)
```

`src/engine` is pure TypeScript: the catalog, budget evaluation, 27 rules that map design choices to real lessons, a seeded flight simulator, catch scoring, share codes and the mass check. `src/ui` and `src/three` render it with React and three.js; the craft is built from your parts and every failure plays on the model. No accounts and no tracking; progress lives in your browser.

## How it was built

Built solo by team JDollar during NASA Space Apps 2026, November 14 to 15, with Claude Code (an AI coding assistant) writing and testing much of the code and helping gather the public sources, and the owner making every product call. Every lesson keeps its source links so each fact can be checked. Not a NASA product; no NASA logos or insignia are used.

```bash
npm install
npm run dev      # http://localhost:5173
npx vitest run   # engine tests and the answer key
npm run build
```

## License

[MIT](LICENSE)
