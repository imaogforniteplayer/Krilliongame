# DEEPER game design

## Core loop
Read a question, type an answer, see its rarity tier, watch the miner automatically dig with matching
equipment, maybe discover something, repeat. Seven questions, then results. The player never mines,
steers or taps anything to dig. A "Skip animation" button, a reduced-motion setting and a skip-all setting
exist, but the automatic animation is the normal experience.

## Modes
- **Daily Dig.** Same seven questions for everyone, chosen deterministically from the UTC date, one per
  category where possible, ordered easy to hard. One ranked attempt per day. It rolls over at 00:00 UTC.
- **Endless Dig / Practice.** Random runs, unlimited, never affect the ranked result or the streak.
- Planned (need a backend): Friend Challenge, Live Dig Duel, Squad Expedition, Survival Dig.

## Answers
Typed text is normalised (case, accents, punctuation, leading articles), singular/plural are unified, and
each question has accepted entries with aliases. Spelling tolerance is 0 edits for short answers, 1 for
5 to 8 letters, 2 for longer. If a typo is equally close to two answers it is rejected as ambiguous
rather than guessed. Exclusions give a reason ("a referee is not a playing position"). Anything else is
**unknown**: it scores 0 and is queued for human review. No AI model decides correctness.
Empty or over-ambiguous input asks again without using up the question; everything else uses it up, so
guessing rapid-fire is not free.

## Rarity and scoring
Each answer has a curated commonness class (1 to 6) that maps to an estimated share of players. The share
maps to a tier:

| Tier | Share at or above | Points | Equipment |
| --- | --- | --- | --- |
| Pebble | 8% | 10 | Basic Shovel |
| Copper | 3% | 15 | Reinforced Pickaxe |
| Quartz | 1% | 30 | Electric Jackhammer |
| Obsidian | 0.4% | 60 | Pneumatic Drill |
| Void | 0.15% | 85 | Industrial Excavator |
| Corebound | below that | 100 | Giant Tunnel Borer |

1 point = 10 m, so a perfect run is 700 points and 7,000 m.

When real player data exists, it blends with the curated prior using smoothing (the prior counts as 40
pseudo-submissions) and is only used after 300 valid answers on a question. One odd submission therefore
cannot make an answer "extremely rare". The UI always labels the source: *estimated* or *observed*. Each
attempt counts at most once per question in the statistics. Every run stores the scoring and rarity
version it used. Today the game only ever shows estimated rarity because there are no real players to
measure; it never invents statistics.

## Time
25 seconds per question, measured by wall-clock time from when the question was shown. Refreshing the page
does not restart the clock (a daily run in progress resumes, and a question whose time ran out counts as a
timeout). A server would add a small network grace period (`timerGraceMs`).

## Discoveries
Each successful dig has a chance to turn up an item, higher for rarer answers (6% for Pebble up to 55%
for Corebound). The roll is seeded by the run id and question, so refreshing cannot re-roll it. Items are
tied to biomes (34 items across 15 biomes, in six rarities). The descent pauses, the item is shown, and it
is saved to the Museum. Nothing is collected manually.

## Biomes
Surface 0 m, Soft Soil 40, Root Caverns 200, Clay Depths 400, Stone Caverns 650, Underground Lakes 900,
Fossil Beds 1,200, Crystal Caverns 1,600, Ancient Ruins 2,100, Frozen Underground 2,700, Volcanic Depths
3,400, Forgotten Mines 4,200, The Hollow 5,000, Deep Core 5,900, The Unknown 6,800. Each has its own
palette, tile art, decorations, ambient particles and music pitch. Only a near-perfect run reaches The
Unknown.

## Progression
XP is lifetime points plus 25 per distinct discovery. Level n needs 100 x (n-1)^2 total XP. Streaks count
consecutive ranked Daily Digs. Personal bests and a Daily history are kept.

## Fairness principles
- Cosmetic content (planned) must never affect digging.
- Scores must be server-authoritative before any leaderboard is shown. Until then results are private.
- No fake players, fake leaderboards or fake community totals anywhere in the UI.
- Spoilers: explanations and "other answers that count" appear only after a run is finished.
