# AI Collaboration Log — TrueContract (Project Zed)



## Tools used

| Tool | What I used it for |
|---|---|
| Claude Code (model: Claude Opus 5.5), in the VS Code extension | Most of the building: features across several files, collecting and checking the data, debugging, and the course-alignment review. |
| I used Claude in a browser as well to help develop ideas for hwo to project could be as good and effective as possible



## Timeline of the Claude Code session (Oct. 14–16)

1. Opened the local preview in Safari (a local server was needed because the page `fetch`es a JSON file).
2. Added a **Head-to-head** section: two dropdowns, a line down the middle, every stat, and the better value marked.
3. Removed the quarterback already picked on one side from the other side's dropdown.
4. Added **headshots** (ESPN), saved in `images/headshots/`.
5. Added **salary caps for every season** and the **contract each player was on that season**.
6. Added **15 current starters** (the site already had 22 quarterbacks, so this made 37).
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

I would add even more features next time like running stats, and making an even more conplex formlua to quantify the stats. 

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

the browser was keeping an old saved copy (a cached copy) of players.json and kept using it instead of downloading the new one, so my changes didn't show up. adding cache: 'no-cache' makes the browser check the server for a newer version of the file every time the page loads, so new data shows up on a normal reload. For testing when i was renaming players it would chekc that it was rihgt and catch any errors. whenever i would have edits that wouldnt appear i could do a hard reset and reveiw the consle tab and be ale to work through it. 

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

All the choices serve the reader as they add key details and adjustments that are made that make for a more transparent TrueValue, and paint a better picture of what we are actually measuring and how we can continue to improve upon this. 

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

The AI cross-checked nflverse against Pro Football Reference. I also checked the data manually myself by looking players up on NFL.com to make sure the numbers matched.

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

  I can explain that the code is mostly made of what we have done in class. From the local storage and the loops and if statements and most of the syntax and structuring that we have already learned, it is mostly what we have done in class. A few things we didn't cover are still in the code: `Intl.NumberFormat` (formats the dollar amounts), `new Option()` and `<optgroup>` (build the dropdowns), `new Image()` (loads the headshots), `.some()` and `.every()`, and the `get` and `fmt` functions inside `H2H_GROUPS`.

### 6. Teach me a concept: grouping a dropdown (how the MVP winners get their own section)
**My prompt:** "teach me how you were able to make the MVPs have their own box at the top"

**The AI's explanation (key parts):**
A plain <select> holds <option>s. HTML also has <optgroup>, which puts a bold, unclickable heading above a set of options:


<select>
  <optgroup label="MVP winners">
    <option value="peyton-manning">Peyton Manning (5× MVP)</option>
    <option value="aaron-rodgers">Aaron Rodgers (4× MVP)</option>
  </optgroup>
  <optgroup label="Active">
    <option value="bo-nix">Bo Nix</option>
  </optgroup>
</select>

That's the whole visual trick. The browser draws the "box" heading itself, with no CSS involved. The JavaScript just builds this HTML.

let rest = sorted;                                   // start with everyone (A–Z)
if (mvpGroup) {
  const mvps = sorted.filter((p) => mvpCount(p) > 0) // only MVP winners...
    .sort((a, b) => mvpCount(b) - mvpCount(a));      // ...most MVPs first
  addGroup('MVP winners', mvps, ...);
  rest = sorted.filter((p) => mvpCount(p) === 0);    // everyone else
}
addGroup('Active', rest.filter((p) => p.active), ...);
addGroup('Retired or not active', rest.filter((p) => !p.active), ...);

**What I took from it:** The MVP is added first so it appears at the top, .sort allows for it to be sorted with the most at the top and the least at the bottom, such as mvpCount(b) - mvpCount(a). rest keeps the players from repeating in different sections

const addGroup = (label, group, text) => {
  if (!group.length) return;                         // no empty headings
  const optgroup = document.createElement('optgroup');
  optgroup.label = label;
  for (const player of group) optgroup.append(new Option(text(player), player.id));
  select.append(optgroup);
};
The AI helped me understand how ton make different sections of the dropboc by making more addGroup and ordering it hown i want them to apear in the dropbox. 

## How my prompting changed
i would give the AI small things that i wanted it to make a little better, like adding a drop down box to select players and adding features such as a comparison part and a copyright/clarification part. then as i really got int otbeh assignemnt i gave it a lot more from what i had already built. I had it give me stats and features of every significant starting quarterback from the year 2000. This si something that would have given me a ton of time and i could do in a lot shorter time thanks to claude code. 
- **Early prompts** were short feature requests: "lets add 2 drop boxes…".
- **Later prompts** set rules and edge cases: "limit Super Bowls to starters", "for 2010 just say the cap is 123 million",
  "use the average salary cap during the years counted".
- **One correction mid-task:** I sent "don't do any data from pre 2000" while the AI was already collecting it.

## Learning moments and challenges
Some challenegs orignally were when i was wanting to be able to mkae this app at all. I wasnt really sure where i wanted to go with it so i was haveing the IA make all sorts of t=different things. 

Once i knew what i wanted to do, i had the AI kind of do its own thing with things but when i wiuld go back and review i would be really confused so i ahd to have it change its code to stuff we had learned so i could understand it. 

I then learned that AI is very good at doing things at a large scale, i did 22 quarterbacks basically on my own origianlly but then i thought that wthis would be really cool to do for all QBs in the 21st century, so i had it do that for me. I thought it did very well and went back through a few and it made sense. 

I then had it double check everything t the end and make sure everything was what we had done in class or atleast close ot and stuff i could explain, somethings were not that, so i had it change it. 

I had a lot of fun on this assignment and enjoyed making somethign that i think is really cool and somethingthat i also just understand now and can expan on in the future.

## Commits
The work was committed at the end in grouped steps (structure and styles, app logic, data, headshots, docs), not as it was built.
