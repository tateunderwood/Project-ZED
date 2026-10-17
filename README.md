# TrueContract

TrueContract compares what an NFL quarterback was paid with what he did on the field. Pick a quarterback to see his
**TrueValue**, an estimate of what his passing season was worth as a share of that season's salary cap, next to the contract he
was actually on that season. You can change his stats with sliders, or compare any two quarterbacks head-to-head, by single season or by career.

This is a class project (Project Zed). TrueValue is an estimate made for this project, not financial or contract advice.

**Live site:** https://tateunderwood.github.io/Project-ZED/ 

## Features

- **Quarterback list:** 201 quarterbacks, every team's main starter in at least one season from 2000 on. Search by name or
  team and filter by active or retired.
- **Player table:** score, TrueValue and that season's contract for one quarterback, with sliders for passing yards,
  touchdowns and interceptions. A second quarterback can be added for comparison.
- **Head-to-head:** two dropdowns with a search box each (MVP winners listed first). Compare any season, the scoring season,
  or career totals across TrueValue, contract details, game stats, per-game stats and the score breakdown. The better number
  in each row is marked.
- **Season awards:** MVP, 2nd and 3rd in MVP voting, Offensive Player and Rookie of the Year, All-Pro, Pro Bowl,
  Super Bowl champion (starting quarterback only) and Super Bowl MVP.
- **Remembers your choices:** the list search and filter and both Head-to-head picks are saved in `localStorage`.

## How the numbers work

- **Score** = (0.9 × passing yards + 25 × touchdowns − 45 × interceptions − 0.9 × sack yards) ÷ (attempts + sacks).
  It's based on the ANY/A formula, with weights changed for this project. A season needs at least 140 attempts to be scored.
- **TrueValue** turns a score into a share of the salary cap (a score of 4 is worth 2%, a score of 8 is worth 21%, held between
  1.5% and 23%), then into dollars using that season's cap. 2010 had no cap, so the site uses $123 million (the 2009 cap) for it.
- **Career totals** average the salary cap, the contract per year and TrueValue across the seasons in the data.

## Running it locally

The page loads `data/players.json` with `fetch`, which browsers block when you open the file straight from disk.
Serve the folder instead, for example with VS Code's Live Server or:

```
python3 -m http.server 8000
```

Then open http://127.0.0.1:8000/.

## Files

```
index.html          page structure
css/styles.css      styles (design tokens at the top)
js/app.js           all app logic: loading, scoring, rendering, events, localStorage
data/players.json   player stats, contracts, awards and salary caps (built ahead of time)
images/headshots/   one photo per quarterback
```

## Data sources and credits

The data file was built ahead of time with help from AI (see `AI_COLLABORATION_LOG.md`). It is not fetched live.

- **Stats:** Pro Football Reference (the original 22 quarterbacks) and [nflverse](https://github.com/nflverse/nflverse-data)
  (everyone else). Passing stats only, seasons from 2000 on.
- **Contracts, cap hits and cash paid:** [OverTheCap.com](https://overthecap.com). Little history exists for quarterbacks who retired before about 2012.
- **Salary caps:** NFL figures, as listed on Wikipedia.
- **Awards:** Wikipedia player pages, plus Associated Press MVP voting results.
- **Headshots:** ESPN, and NFL.com for some retired quarterbacks.

This project is not connected to the NFL, any team, or any of these sites.
