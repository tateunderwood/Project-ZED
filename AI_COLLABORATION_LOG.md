# AI Collaboration Log — TrueContract (Project Zed)

> **DRAFT OUTLINE.** The facts, dates and prompts below come from the Claude Code session that built most of
> this project. Every `✏️` is a spot for **my own words**. Rewrite the summaries in your own voice before submitting,
> and delete anything you can't explain.

## Tools used

| Tool | What I used it for |
|---|---|
| Claude Code (model: Claude Opus 5.5), in the VS Code extension | Most of the building: features across several files, collecting and checking the data, debugging, and the course-alignment review. |
| ✏️ GitHub Copilot / ChatGPT / Claude in a browser? | ✏️ Say what, or remove this row. |

✏️ *Work done before the Oct. 14 session (the original 22-quarterback version, the sliders, the first comparison table):
which tool, and what I asked for.*

## Timeline of the Claude Code session (Oct. 14–16)

1. Opened the local preview in Safari (a local server was needed because the page `fetch`es a JSON file).
2. Added a **Head-to-head** section: two dropdowns, a line down the middle, every stat, and the better value marked.
3. Removed the quarterback already picked on one side from the other side's dropdown.
4. Added **headshots** (ESPN), saved in `images/headshots/`.
5. Added **salary caps for every season** and the **contract each player was on that season**.
6. Added **15 current starters**.
7. Added **season awards**, then limited Super Bowl wins to starters and added Offensive Player and Rookie of the Year.
8. Expanded to **every main starter since 2000 (201 quarterbacks)**, with a search box and an Active/Retired filter.
9. Set 2010 (uncapped year) to $123M, added an **MVP group and search** to Head-to-head, and changed **career totals to per-season averages**.
10. **Course-alignment review:** added `localStorage`, rewrote syntax we hadn't covered, and fixed a data bug found along the way.

## Significant conversations

### 1. Building the Head-to-head comparison (feature)
**My prompt:** "I want there to be an area below the list of quarterbacks, a line down the middle and 2 drop boxes on
either side with the list of all the quarterbacks… showing every stat including their actual game stats and their TrueValue."

**What the AI did:** it added a section with a quarterback and a "Stats from" dropdown on each side (scoring season, any
season, or career). Rows were built from a list of row definitions (`H2H_GROUPS`), each with a `get` and a `fmt` function,
and the better value was marked with ▲. It checked its passer rating formula against Pro Football Reference (Dak 2016: 104.9).

**My follow-up:** "whenever you select a QB, that same QB should disappear from the other drop box."

✏️ *What I learned / what I'd do differently:*

### 2. Debugging: headshots wouldn't show (debugging session)
**Problem:** after the headshots were added, Safari's page tab and VS Code's preview still showed initials. I noticed the
image files opened fine on their own.

**How it was found:** the AI checked the local server's log and saw that neither browser had downloaded `players.json` again
since before the photos were added. Both were using a cached copy where every `headshotUrl` was still `null`.

**Fix:** `fetch(DATA_URL, { cache: 'no-cache' })`, so the browser checks for a newer file on every load.

Other bugs in the session:
- VS Code's built-in preview ran an old copy of `app.js` until it was reloaded.
- During data collection, a `$` was eaten by the shell, so every dollar amount came out as "None".
- Some quarterbacks first matched the wrong Wikipedia page. For example, Tom Brady matched a coach named Tom Moore.
  The fix was to require both the name and the birth date to match.

✏️ *What this taught me about caching / testing:*

### 3. Per-season contracts and salary caps (judgment calls)
**My prompt:** "dak prescott wasn't being paid 60 million his rookie year, so we should have that contract be what is affecting
his TrueValue, not his current contract."

**Decisions the AI made and told me about:**
- **Contract amount:** used the average per year of the contract in effect, not the cap hit.
- **Mid-year signings:** a deal signed before a season counts for that season.
- **Fifth-year options:** these years use the option amount.
- **Brissett 2019:** OverTheCap listed $27.98M for one year, which overstated it, so it was overridden to the reported
  2 years, $30M.

**Decisions I made:**
- Super Bowl champion counts only the starting quarterback.
- 2010, which had no cap, uses $123M.
- Only seasons from 2000 on.
- Career totals average the cap, the contract and TrueValue.

✏️ *Which of these choices serve my reader, and why:*

### 4. Scaling up to 201 quarterbacks (data work done by AI)
**My prompt:** "add every starting quarterback from the year 2000 whether they are retired or not."
The AI asked what that meant. I chose "main starters 2000–now."

**Honest note:** the data in `data/players.json` was collected and checked by the AI using Python scripts that are **not in
this repo** and are **not course material**:

| Data | Source |
|---|---|
| Stats | nflverse. Pro Football Reference blocked automated downloads, so nflverse was checked against PFR and matched almost exactly. |
| Contracts | OverTheCap |
| Awards | Wikipedia |
| MVP voting | AP results |
| Headshots | ESPN and NFL.com |

**Limits:**
- **Starts are estimated** (the QB with the most pass attempts for his team each week), so they can be off by one.
- **Many pre-2012 contracts are missing**, because OverTheCap has little history for players who retired before then.

✏️ *How I checked the data myself (which players I spot-checked):*

### 5. Course-alignment review (what I can explain)
**My prompt:** "can you make sure that this website is not doing things that I haven't learned in my class…"

**Changes made:**
- **Added `localStorage`**, with `try`/`catch` on both reading and saving. It saves the list search and filter and the
  Head-to-head picks.
- **Rewrote newer syntax** as loops and `if` statements: `?.`, spread `...`, `flatMap`, `new Set`, `reduce`, destructuring
  and regex. Old and new code gave identical results across all 1,926 player/season combinations.
- **Fixed a data bug the comparison exposed:** in nflverse, 17 Jacksonville rows from 2001–2002 had team and opponent
  swapped. Correcting them fixed starts for Favre 2001, Peyton Manning 2002 and McNair 2002, and removed 9 fake teams
  from Mark Brunell.

### ✏️ 6. "Teach me a concept" exchange (still to do)
The assignment asks for one. ✏️ *Ask the AI to teach my chosen technique (event delegation, or building table rows from a
list of definitions), then paste the key part of the exchange and what I took from it.*

## How my prompting changed
✏️ *My words. Some observations from the session to react to:*
- **Early prompts** were short feature requests: "lets add 2 drop boxes…".
- **Later prompts** set rules and edge cases: "limit Super Bowls to starters", "for 2010 just say the cap is 123 million",
  "use the average salary cap during the years counted".
- **One correction mid-task:** I sent "don't do any data from pre 2000" while the AI was already collecting it.

## Learning moments and challenges
✏️ *2–4 bullets in my own words.*

## Commits
The work was committed at the end in grouped steps (structure and styles, app logic, data, headshots, docs), not as it was built.
