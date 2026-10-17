'use strict';

// Where the player data lives (made ahead of time).
const DATA_URL = 'data/players.json';

// The localStorage key for the choices we remember between visits.
const SETTINGS_KEY = 'truecontract-settings';

// The stats a person can change with a slider.
const SLIDERS = [
  { key: 'passYards', label: 'Passing yards', min: 0, max: 6000 },
  { key: 'touchdowns', label: 'Touchdowns', min: 0, max: 60 },
  { key: 'interceptions', label: 'Interceptions', min: 0, max: 30 },
];

// Everything the page needs to remember while it runs.
// slots[0] is Player 1, slots[1] is Player 2 (or null).
const state = {
  players: [],
  scoring: null,
  slots: [null, null],
};

const els = {
  list: document.getElementById('player-list'),
  search: document.getElementById('player-search'),
  filter: document.getElementById('player-filter'),
  listEmpty: document.getElementById('list-empty'),
  count: document.getElementById('player-count'),
  status: document.getElementById('status'),
  hint: document.getElementById('hint'),
  cards: document.getElementById('cards'),
  comparison: document.getElementById('comparison'),
  compareSelect: document.getElementById('compare-select'),
  resetBtn: document.getElementById('reset-btn'),
  clearBtn: document.getElementById('clear-btn'),
  heading: document.getElementById('detail-heading'),
  formula: document.getElementById('formula'),
  scaleNote: document.getElementById('scale-note'),
  seasonNote: document.getElementById('season-note'),
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('en-US');

/* ---------- small helpers ---------- */

// Make an element and set its text safely.
function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function showStatus(message) {
  els.status.textContent = message;
  els.status.hidden = false;
}

function clearStatus() {
  els.status.textContent = '';
  els.status.hidden = true;
}

function signed(value) {
  return (value >= 0 ? '+' : '\u2212') + Math.abs(value).toFixed(2);
}

// Sort a copy of a list of players by name (slice() makes the copy,
// so the original list keeps its order).
function sortByName(players) {
  return players.slice().sort((a, b) => a.name.localeCompare(b.name));
}

// Split what someone typed into lowercase words, skipping extra spaces.
function searchWords(text) {
  const words = [];
  for (const word of text.trim().toLowerCase().split(' ')) {
    if (word !== '') words.push(word);
  }
  return words;
}

// Every team a player was on, each listed once, in the order he played for them.
function teamList(player) {
  const teams = [];
  for (const season of player.seasons) {
    const seasonTeams = season.teams ? season.teams : [season.team];
    for (const team of seasonTeams) {
      if (!teams.includes(team)) teams.push(team);
    }
  }
  return teams;
}

// The first and last season we have for a player.
function firstAndLastSeason(player) {
  let first = player.seasons[0].season;
  let last = player.seasons[0].season;
  for (const season of player.seasons) {
    if (season.season < first) first = season.season;
    if (season.season > last) last = season.season;
  }
  return { first: first, last: last };
}

// Join names into a sentence: "A", "A and B", or "A, B, and C".
function joinNames(names) {
  if (names.length <= 2) return names.join(' and ');
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

// Average of a list of numbers, or null if the list is empty.
function average(list) {
  if (list.length === 0) return null;
  let total = 0;
  for (const value of list) total += value;
  return total / list.length;
}

/* ---------- saving choices (localStorage) ---------- */

// loadSettings(): read the saved choices, or return null if there are none.
// localStorage can be blocked (private browsing) and the saved text can be
// broken, so anything that goes wrong just means "nothing saved".
function loadSettings() {
  try {
    const text = localStorage.getItem(SETTINGS_KEY);
    if (!text) return null;
    const saved = JSON.parse(text);
    if (!saved || typeof saved !== 'object') return null;
    return saved;
  } catch (error) {
    console.warn('Could not read saved settings', error);
    return null;
  }
}

// saveSettings(): remember the list search and filter and both Head-to-head sides.
function saveSettings() {
  const settings = {
    search: els.search.value,
    filter: els.filter.value,
    h2h: [
      { playerId: h2h.sides[0].playerId, season: h2h.sides[0].season },
      { playerId: h2h.sides[1].playerId, season: h2h.sides[1].season },
    ],
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    // Saving is a nice extra; the page still works without it.
    console.warn('Could not save settings', error);
  }
}

// applySettings(): put saved choices back, but only ones that still make sense
// (the player must still exist, and the two sides can't be the same player).
function applySettings(saved) {
  if (!saved) return;
  if (typeof saved.search === 'string') els.search.value = saved.search;
  if (saved.filter === 'all' || saved.filter === 'active' || saved.filter === 'retired') {
    els.filter.value = saved.filter;
  }
  if (!Array.isArray(saved.h2h)) return;
  for (let i = 0; i < 2; i += 1) {
    const side = saved.h2h[i];
    if (!side || typeof side.playerId !== 'string') continue;
    const exists = state.players.find((p) => p.id === side.playerId);
    const otherId = h2h.sides[1 - i].playerId;
    if (!exists || side.playerId === otherId) continue;
    h2h.sides[i].playerId = side.playerId;
    // fillH2hSeasons() checks the season and falls back to 'scoring' if it's not valid.
    if (typeof side.season === 'string') h2h.sides[i].season = side.season;
  }
}

/* ---------- loading ---------- */

// loadPlayers(): fetch the JSON file and catch anything that goes wrong.
async function loadPlayers() {
  try {
    // no-cache: always check for a newer file, so data edits show up on reload.
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    if (!data || !Array.isArray(data.players) || data.players.length === 0) {
      throw new Error('No players found in file');
    }
    if (!data.scoring || !data.scoring.weights || !data.scoring.scale || !data.scoring.salaryCaps) {
      throw new Error('Scoring settings missing from file');
    }

    state.players = data.players;
    state.scoring = data.scoring;
    clearStatus();
    applySettings(loadSettings());
    listPlayers();
    renderAbout();
    setupHeadToHead();
  } catch (error) {
    console.error(error);
    showStatus(
      "Couldn't load player data. Check that data/players.json is in your " +
      'project and that the page is running from a local server.'
    );
  }
}

/* ---------- scoring ---------- */

// The season we score: 2025 unless the player has their own (Watson: 2026).
function getScoringSeason(player) {
  const year = player.scoringSeason || 2025;
  return player.seasons.find((s) => s.season === year) || null;
}

// Only score a season if every needed stat is there and the sample is big enough.
function getEligibleSeason(player) {
  const season = getScoringSeason(player);
  if (!season) return null;
  const needed = ['attempts', 'sacks', 'sackYards', 'passYards', 'touchdowns', 'interceptions'];
  if (needed.some((key) => typeof season[key] !== 'number')) return null;
  if (season.attempts < state.scoring.minAttempts) return null;
  return season;
}

// calculateScore(): modified ANY/A, points per play.
function calculateScore(season, values) {
  const w = state.scoring.weights;
  const plays = season.attempts + season.sacks;
  if (!(plays > 0)) return null;
  const total =
    w.yard * values.passYards +
    w.td * values.touchdowns -
    w.int * values.interceptions -
    w.sackYard * season.sackYards;
  return total / plays;
}

// statBreakdown(): how many points each stat adds or takes away.
function statBreakdown(season, values) {
  const w = state.scoring.weights;
  const plays = season.attempts + season.sacks;
  return [
    { label: 'Passing yards', points: (w.yard * values.passYards) / plays },
    { label: 'Touchdowns', points: (w.td * values.touchdowns) / plays },
    { label: 'Interceptions', points: -(w.int * values.interceptions) / plays },
    { label: 'Sack yards lost', points: -(w.sackYard * season.sackYards) / plays },
  ];
}

// The league salary cap for a season, or null if we don't have one.
function capFor(year) {
  const cap = state.scoring.salaryCaps[String(year)];
  return typeof cap === 'number' ? cap : null;
}

// calculateToDollars(): score -> share of the cap -> dollars under that season's cap.
function calculateToDollars(score, year) {
  const s = state.scoring.scale;
  const pct =
    s.capPctLow +
    ((score - s.scoreLow) * (s.capPctHigh - s.capPctLow)) / (s.scoreHigh - s.scoreLow);
  const limited = Math.min(s.capPctMax, Math.max(s.capPctMin, pct));
  const cap = capFor(year);
  return { pct: limited, dollars: cap === null ? null : (limited / 100) * cap };
}

/* ---------- the player list ---------- */

// The first and last seasons we have for a player, e.g. "2000\u20132007".
function seasonRange(player) {
  const range = firstAndLastSeason(player);
  return range.first === range.last ? String(range.first) : range.first + '\u2013' + range.last;
}

// listPlayers(): one button per quarterback, sorted by name.
// Active players show their team; others show their last team and years.
function listPlayers() {
  els.list.textContent = '';
  const sorted = sortByName(state.players);

  for (const player of sorted) {
    const last = player.seasons[player.seasons.length - 1];
    const item = h('li');
    item.dataset.active = String(Boolean(player.active));
    item.dataset.search = (player.name + ' ' + teamList(player).join(' ')).toLowerCase();
    const button = h('button', 'player-btn');
    button.type = 'button';
    button.dataset.id = player.id;
    button.setAttribute('aria-current', 'false');
    button.append(h('span', 'name', player.name));
    button.append(h('span', 'team', player.active ? last.team : last.team + ', ' + seasonRange(player)));
    item.append(button);
    els.list.append(item);
  }
  filterList();
}

// filterList(): show only the quarterbacks that match the search box and filter.
function filterList() {
  const words = searchWords(els.search.value);
  const show = els.filter.value;
  let shown = 0;
  for (const item of els.list.children) {
    const fitsFilter = show === 'all' || (show === 'active') === (item.dataset.active === 'true');
    const fitsSearch = words.every((w) => item.dataset.search.includes(w));
    item.hidden = !(fitsFilter && fitsSearch);
    if (!item.hidden) shown += 1;
  }
  const total = els.list.children.length;
  els.count.textContent = shown === total ? '(' + total + ')' : '(' + shown + ' of ' + total + ')';
  els.listEmpty.hidden = shown > 0;
}

// How many MVPs a quarterback won.
function mvpCount(player) {
  return player.seasons.filter((s) => (s.awards || []).includes('MVP')).length;
}

// Does a quarterback match the words typed in a search box? (name or any team)
function matchesSearch(player, text) {
  const words = searchWords(text);
  const haystack = (player.name + ' ' + teamList(player).join(' ')).toLowerCase();
  return words.every((w) => haystack.includes(w));
}

// addPlayerOptions(): fill a dropdown with quarterbacks, active ones first.
// With mvpGroup, MVP winners get their own group at the top (most MVPs first).
// mvpGroup is true or false; if it's left out it is undefined, which counts as false.
function addPlayerOptions(select, players, mvpGroup) {
  const sorted = sortByName(players);
  const addGroup = (label, group, text) => {
    if (!group.length) return;
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    for (const player of group) optgroup.append(new Option(text(player), player.id));
    select.append(optgroup);
  };
  let rest = sorted;
  if (mvpGroup) {
    const mvps = sorted.filter((p) => mvpCount(p) > 0).sort((a, b) => mvpCount(b) - mvpCount(a));
    addGroup('MVP winners', mvps, (p) => p.name + ' (' + (mvpCount(p) > 1 ? mvpCount(p) + '\u00D7 ' : '') + 'MVP)');
    rest = sorted.filter((p) => mvpCount(p) === 0);
  }
  addGroup('Active', rest.filter((p) => p.active), (p) => p.name);
  addGroup('Retired or not active', rest.filter((p) => !p.active), (p) => p.name);
}

function markSelected(id) {
  for (const button of els.list.querySelectorAll('.player-btn')) {
    button.setAttribute('aria-current', String(button.dataset.id === id));
  }
}

/* ---------- awards ---------- */

// The order awards are shown in. "big" ones get the gold badge.
const AWARD_ORDER = [
  'MVP', '2nd in MVP voting', '3rd in MVP voting', 'Offensive Player of the Year', 'Offensive Rookie of the Year',
  'First-team All-Pro', 'Second-team All-Pro', 'Pro Bowl', 'Super Bowl champion', 'Super Bowl MVP',
];
const BIG_AWARDS = [
  'MVP', 'Offensive Player of the Year', 'Offensive Rookie of the Year', 'Super Bowl champion', 'Super Bowl MVP',
];

// awardBadges(): one small badge per award, e.g. "MVP" or, for a career, "4× MVP".
function awardBadges(counts) {
  const list = h('ul', 'awards');
  list.setAttribute('aria-label', 'Awards');
  for (const name of AWARD_ORDER) {
    const n = counts[name];
    if (!n) continue;
    const item = h('li', 'award' + (BIG_AWARDS.includes(name) ? ' big' : ''), (n > 1 ? n + '\u00D7 ' : '') + name);
    list.append(item);
  }
  return list.children.length ? list : null;
}

// Awards for one season, or added up across a career.
function awardCounts(seasons) {
  const counts = {};
  for (const season of seasons) {
    for (const name of season.awards || []) counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

/* ---------- a player card ---------- */

// playerPicture(): initials for now; shows a headshot if headshotUrl is filled in.
function playerPicture(player) {
  const box = h('div', 'picture');
  box.setAttribute('aria-hidden', 'true');
  box.textContent = player.name
    .split(' ')
    .filter((part) => part !== '')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (player.headshotUrl) {
    const img = new Image();
    img.alt = '';
    img.addEventListener('load', () => {
      box.textContent = '';
      box.append(img);
    });
    img.src = player.headshotUrl; // if it fails, the initials stay
  }
  return box;
}

// The rows of the table, top to bottom.
const STAT_ROWS = [
  { key: 'score', label: 'Score' },
  { key: 'pct', label: "TrueValue (share of that season's cap)" },
  { key: 'dollars', label: "TrueValue (dollars under that season's cap)" },
  { key: 'contract', label: 'Contract that season (per year)' },
  { key: 'gap', label: 'TrueValue vs. contract' },
];
const BREAKDOWN_LABELS = ['Passing yards', 'Touchdowns', 'Interceptions', 'Sack yards lost'];

// One label + value pair, used inside a table cell.
function statCell(label, valueEl) {
  const wrap = h('div', 'stat');
  wrap.append(h('span', 'stat-label', label), valueEl);
  return wrap;
}

// createSlot(): build the pieces for one quarterback and remember his numbers.
// The table (renderTable) decides where each piece goes.
function createSlot(player, season, index) {
  const base = {
    passYards: season.passYards,
    touchdowns: season.touchdowns,
    interceptions: season.interceptions,
  };
  const slot = {
    player, season, base,
    // A separate copy of base, so moving a slider doesn't change the real stats.
    values: { passYards: base.passYards, touchdowns: base.touchdowns, interceptions: base.interceptions },
    out: {}, cells: {}, inputs: {},
    score: null, dollars: null,
  };

  // Header: picture, name, team
  const head = h('div', 'card-head');
  head.append(playerPicture(player));
  const titles = h('div');
  titles.append(h('h3', '', player.name));
  titles.append(h('p', 'detail-team', season.team + ', ' + season.season + ' season'));
  const badges = awardBadges(awardCounts([season]));
  if (badges) titles.append(badges);
  head.append(titles);
  slot.head = head;

  // Result rows
  for (const row of STAT_ROWS) {
    const value = h('span', 'stat-value');
    slot.out[row.key] = value;
    slot.cells[row.key] = statCell(row.label, value);
  }

  // Score breakdown rows
  slot.out.breakdown = [];
  slot.cells.breakdown = [];
  for (const label of BREAKDOWN_LABELS) {
    const value = h('span', 'stat-value');
    slot.out.breakdown.push(value);
    slot.cells.breakdown.push(statCell(label, value));
  }

  // Sliders
  const fieldset = h('fieldset', 'sliders');
  fieldset.append(h('legend', '', 'Change ' + player.name.split(' ').slice(-1)[0] + "'s stats"));
  for (const def of SLIDERS) {
    const id = 'slot' + index + '-' + def.key;
    const row = h('div', 'slider-row');

    const label = h('label', '', def.label);
    label.htmlFor = id;

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(def.min);
    input.max = String(Math.max(def.max, base[def.key]));
    input.step = '1';
    input.value = String(base[def.key]);

    const output = document.createElement('output');
    output.setAttribute('for', id);
    output.textContent = number.format(base[def.key]);

    input.addEventListener('input', () => {
      slot.values[def.key] = Number(input.value);
      output.textContent = number.format(slot.values[def.key]);
      slot.update();
      updateComparison();
    });

    slot.inputs[def.key] = { input, output };
    row.append(label, input, output);
    fieldset.append(row);
  }
  slot.sliders = fieldset;

  // Put every number in its place.
  slot.update = function update() {
    const score = calculateScore(season, slot.values);
    if (score === null) {
      slot.score = null;
      slot.dollars = null;
      for (const row of STAT_ROWS) slot.out[row.key].textContent = 'Not available';
      slot.out.breakdown.forEach((el) => { el.textContent = 'Not available'; });
      return;
    }
    const value = calculateToDollars(score, season.season);
    slot.score = score;
    slot.dollars = value.dollars;

    slot.out.score.textContent = score.toFixed(2);
    slot.out.pct.textContent = value.pct.toFixed(1) + '%';
    slot.out.dollars.textContent = value.dollars === null ? 'No cap that season' : money.format(value.dollars);

    // The contract he was on that season, not his current one.
    const contract = season.contract || {};
    if (typeof contract.apy === 'number' && value.dollars !== null) {
      slot.out.contract.textContent = money.format(contract.apy);
      const gap = value.dollars - contract.apy;
      if (Math.abs(gap) < 250000) {
        slot.out.gap.textContent = 'About equal';
      } else if (gap > 0) {
        slot.out.gap.textContent = 'TrueValue is ' + money.format(gap) + ' higher';
      } else {
        slot.out.gap.textContent = 'Contract is ' + money.format(-gap) + ' higher';
      }
    } else {
      slot.out.contract.textContent = 'Not available';
      slot.out.gap.textContent = 'Not available';
    }

    statBreakdown(season, slot.values).forEach((item, i) => {
      slot.out.breakdown[i].textContent = signed(item.points);
    });
  };

  // Put the sliders back where the real stats are.
  slot.reset = function reset() {
    for (const def of SLIDERS) {
      slot.values[def.key] = base[def.key];
      slot.inputs[def.key].input.value = String(base[def.key]);
      slot.inputs[def.key].output.textContent = number.format(base[def.key]);
    }
    slot.update();
  };

  slot.update();
  return slot;
}

/* ---------- the comparison table ---------- */

// renderTable(): one column per quarterback, with a line down the middle.
function renderTable() {
  els.cards.textContent = '';
  const slots = state.slots.filter((slot) => slot !== null);
  if (slots.length === 0) return;

  const table = h('table', 'compare');
  table.append(h('caption', 'sr-only',
    slots.length === 2
      ? 'Comparison of ' + slots[0].player.name + ' and ' + slots[1].player.name
      : 'Details for ' + slots[0].player.name));

  // Header row: the quarterbacks
  const thead = h('thead');
  const headRow = h('tr');
  for (const slot of slots) {
    const th = h('th');
    th.scope = 'col';
    th.append(slot.head);
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = h('tbody');
  const addRow = (getEl, className) => {
    const tr = h('tr', className);
    for (const slot of slots) {
      const td = h('td');
      td.append(getEl(slot));
      tr.append(td);
    }
    tbody.append(tr);
  };
  const addTitle = (text) => {
    const tr = h('tr', 'section');
    for (let i = 0; i < slots.length; i += 1) tr.append(h('th', '', text));
    tbody.append(tr);
  };

  for (const row of STAT_ROWS) addRow((slot) => slot.cells[row.key]);

  addTitle('Where the score comes from');
  BREAKDOWN_LABELS.forEach((_, i) => addRow((slot) => slot.cells.breakdown[i]));

  addRow((slot) => slot.sliders, 'slider-cell');
  table.append(tbody);

  const tfoot = h('tfoot');
  const footRow = h('tr');
  const footCell = h('td', 'fine-print', 'Estimates based on passing stats only.');
  footCell.colSpan = slots.length;
  footRow.append(footCell);
  tfoot.append(footRow);
  table.append(tfoot);

  els.cards.append(table);
}

/* ---------- choosing and comparing ---------- */

// selectPlayer(): the list picks Player 1.
function selectPlayer(id) {
  const player = state.players.find((p) => p.id === id);
  if (!player) return;

  const season = getEligibleSeason(player);
  if (!season) {
    els.hint.textContent = 'Not enough data to score ' + player.name + ': he needs at least ' +
      state.scoring.minAttempts + ' attempts in a season. You can still see all his stats in Head-to-head below.';
    els.hint.hidden = false;
    return;
  }

  markSelected(id);
  state.slots[0] = createSlot(player, season, 0);

  // A quarterback can't be compared with himself.
  if (state.slots[1] && state.slots[1].player.id === id) state.slots[1] = null;
  refresh();
}

// setCompare(): the dropdown picks Player 2.
function setCompare(id) {
  if (!id || !state.slots[0]) {
    state.slots[1] = null;
  } else if (id !== state.slots[0].player.id) {
    const player = state.players.find((p) => p.id === id);
    const season = player ? getEligibleSeason(player) : null;
    state.slots[1] = season ? createSlot(player, season, 1) : null;
  }
  refresh();
}

function populateCompare() {
  const first = state.slots[0];
  const current = state.slots[1] ? state.slots[1].player.id : '';

  els.compareSelect.textContent = '';
  els.compareSelect.append(new Option('No comparison', ''));

  addPlayerOptions(els.compareSelect,
    state.players.filter((p) => !(first && p.id === first.player.id) && getEligibleSeason(p)));
  els.compareSelect.value = current;
}

// Redraw the table and the controls around it.
function refresh() {
  const first = state.slots[0];
  const second = state.slots[1];

  renderTable();

  els.heading.textContent = second ? 'Comparison' : 'Player';
  els.hint.textContent = 'Pick a quarterback from the list to get started.';
  els.hint.hidden = Boolean(first);

  populateCompare();
  els.compareSelect.disabled = !first;
  els.resetBtn.disabled = !first;
  els.clearBtn.disabled = !first;
  updateComparison();
}

// updateComparison(): say in words how the two players differ.
function updateComparison() {
  els.comparison.textContent = '';
  const a = state.slots[0];
  const b = state.slots[1];
  if (!a || !b) return;

  if (a.score === null || b.score === null) {
    els.comparison.append(h('p', '', "Can't compare these two quarterbacks."));
    return;
  }

  const diff = a.score - b.score;
  if (Math.abs(diff) < 0.005) {
    els.comparison.append(h('p', '', a.player.name + ' and ' + b.player.name + ' score about the same.'));
    return;
  }

  const leader = diff > 0 ? a : b;
  const trailer = diff > 0 ? b : a;
  const gap = Math.abs(diff);

  els.comparison.append(
    h('p', '', leader.player.name + ' scores ' + gap.toFixed(2) + ' points higher than ' + trailer.player.name + '.')
  );

  const dollarGap = leader.dollars - trailer.dollars;
  els.comparison.append(
    h('p', '', dollarGap >= 1
      ? 'His TrueValue is ' + money.format(dollarGap) + ' higher.'
      : 'Both are at the limit of the scale, so their TrueValue is the same.')
  );

  const plays = trailer.season.attempts + trailer.season.sacks;
  const yardsNeeded = Math.round((gap * plays) / state.scoring.weights.yard);
  els.comparison.append(
    h('p', '', 'To match, ' + trailer.player.name + ' would need about ' + number.format(yardsNeeded) +
      ' more passing yards, with everything else unchanged.')
  );
}

function resetStats() {
  for (const slot of state.slots) if (slot) slot.reset();
  updateComparison();
}

// Clear everything and go back to the start.
function clearAll() {
  state.slots = [null, null];
  markSelected(null);
  refresh();
}

/* ---------- the "about" text ---------- */

function renderAbout() {
  const later = state.players
    .filter((p) => p.active && p.scoringSeason && p.scoringSeason !== 2025)
    .map((p) => p.name);
  els.seasonNote.textContent =
    'The main table scores one season. Active quarterbacks use 2025' +
    (later.length ? ', except ' + joinNames(later) +
      ', who ' + (later.length > 1 ? 'are' : 'is') + ' scored on 2026 so far because they did not play enough in 2025' : '') +
    '. Retired and inactive quarterbacks use their last season with at least ' + state.scoring.minAttempts +
    ' attempts. Head-to-head can show any season.';
  const w = state.scoring.weights;
  const s = state.scoring.scale;
  els.formula.textContent =
    'Score = (' + w.yard + ' \u00D7 passing yards + ' + w.td + ' \u00D7 touchdowns \u2212 ' +
    w.int + ' \u00D7 interceptions \u2212 ' + w.sackYard + ' \u00D7 sack yards) \u00F7 (attempts + sacks). ' +
    'It is based on the Pro Football Reference ANY/A formula with weights changed for this project.';
  els.scaleNote.textContent =
    'TrueValue turns a score into a share of the salary cap: a score of ' + s.scoreLow + ' is worth ' +
    s.capPctLow + '% and a score of ' + s.scoreHigh + ' is worth ' + s.capPctHigh + '%, held between ' +
    s.capPctMin + '% and ' + s.capPctMax + '%. These endpoints are choices made for this project, not facts. ' +
    'That share is turned into dollars using the cap for the same season (for example ' +
    money.format(capFor(2016)) + ' in 2016 and ' + money.format(capFor(2025)) + ' in 2025) and compared ' +
    'with the contract he was on that season.';
}

/* ---------- head-to-head ---------- */

// Each side remembers its quarterback and which stats to use.
// season is 'scoring', 'career', or a year like '2019'.
const h2h = {
  sides: [
    { playerId: '', season: 'scoring' },
    { playerId: '', season: 'scoring' },
  ],
  playerSelects: [document.getElementById('h2h-player-0'), document.getElementById('h2h-player-1')],
  searchInputs: [document.getElementById('h2h-search-0'), document.getElementById('h2h-search-1')],
  seasonSelects: [document.getElementById('h2h-season-0'), document.getElementById('h2h-season-1')],
  table: document.getElementById('h2h-table'),
};

// passerRating(): the NFL passer rating formula.
function passerRating(s) {
  if (!(s.attempts > 0)) return null;
  const limit = (x) => Math.min(2.375, Math.max(0, x));
  const a = limit((s.completions / s.attempts - 0.3) * 5);
  const b = limit((s.passYards / s.attempts - 3) * 0.25);
  const c = limit((s.touchdowns / s.attempts) * 20);
  const d = limit(2.375 - (s.interceptions / s.attempts) * 25);
  return ((a + b + c + d) / 6) * 100;
}

// careerTotals(): add up every season and work the rates out again.
function careerTotals(player) {
  // Add up one stat across every season (a missing stat counts as 0).
  function sum(key) {
    let total = 0;
    for (const season of player.seasons) total += season[key] || 0;
    return total;
  }
  const t = {
    games: sum('games'),
    starts: sum('starts'),
    completions: sum('completions'),
    attempts: sum('attempts'),
    passYards: sum('passYards'),
    touchdowns: sum('touchdowns'),
    interceptions: sum('interceptions'),
    sacks: sum('sacks'),
    sackYards: sum('sackYards'),
  };
  const range = firstAndLastSeason(player);
  t.team = teamList(player).join(', ');
  t.age = null;
  t.label = 'Career, ' + range.first + '–' + range.last;
  // We only have stats from 2000 on, so say so for careers that started earlier.
  if (player.rookieSeason && player.rookieSeason < 2000) t.label += ' (seasons before 2000 not included)';
  if (t.attempts > 0) {
    t.completionPct = (t.completions / t.attempts) * 100;
    t.yardsPerAttempt = t.passYards / t.attempts;
    t.passerRating = passerRating(t);
    t.adjNetYardsPerAttempt =
      (t.passYards + 20 * t.touchdowns - 45 * t.interceptions - t.sackYards) / (t.attempts + t.sacks);
  }
  return t;
}

// careerValues(): per-season averages across the seasons we have for a player.
// Each season uses its own salary cap, then the seasons are averaged.
function careerValues(player) {
  const caps = [];
  const contractDollars = [];
  const contractShares = [];
  const valueDollars = [];
  const valueShares = [];
  let capNumber = 0;
  let cashPaid = 0;
  for (const season of player.seasons) {
    const cap = capFor(season.season);
    if (cap !== null) caps.push(cap);
    const c = season.contract;
    if (c && typeof c.apy === 'number') {
      contractDollars.push(c.apy);
      if (cap !== null) contractShares.push((c.apy / cap) * 100);
    }
    if (c) {
      capNumber += c.capNumber || 0;
      cashPaid += c.cashPaid || 0;
    }
    // TrueValue only for seasons with enough attempts to score.
    if (season.attempts >= state.scoring.minAttempts) {
      const score = calculateScore(season, season);
      if (score !== null) {
        const value = calculateToDollars(score, season.season);
        valueShares.push(value.pct);
        if (value.dollars !== null) valueDollars.push(value.dollars);
      }
    }
  }
  return {
    cap: average(caps),
    contractApy: average(contractDollars),
    contractPct: average(contractShares),
    contractSeasons: contractDollars.length,
    value: valueShares.length ? { pct: average(valueShares), dollars: average(valueDollars) } : null,
    valueSeasons: valueShares.length,
    capNumber,
    cashPaid,
  };
}

// statsFor(): the numbers one side is showing.
// Single seasons use that season's cap and contract. Career totals use per-season
// averages: the average cap, the average contract per year, and the average TrueValue
// of the seasons he could be scored in.
function statsFor(side) {
  const player = state.players.find((p) => p.id === side.playerId);
  if (!player) return null;
  const needed = ['attempts', 'sacks', 'sackYards', 'passYards', 'touchdowns', 'interceptions'];
  const canScore = (stats) =>
    needed.every((key) => typeof stats[key] === 'number') && stats.attempts >= state.scoring.minAttempts;

  if (side.season === 'career') {
    const stats = careerTotals(player);
    const avg = careerValues(player);
    const score = canScore(stats) ? calculateScore(stats, stats) : null;
    const breakdown = score === null ? null : statBreakdown(stats, stats);
    return {
      player, stats, score, breakdown,
      label: stats.label + ' (per-season averages)',
      value: avg.value,
      cap: avg.cap,
      contract: { capNumber: avg.capNumber, cashPaid: avg.cashPaid },
      contractPct: avg.contractPct,
      contractApy: avg.contractApy,
      valueSeasons: avg.valueSeasons,
      contractSeasons: avg.contractSeasons,
      career: true,
    };
  }

  const year = side.season === 'scoring' ? (player.scoringSeason || 2025) : Number(side.season);
  const season = player.seasons.find((s) => s.season === year);
  if (!season) return null;
  const stats = season;
  const label = year + ' season' + (side.season === 'scoring' ? ' (scoring season)' : '');
  const cap = capFor(year);
  const contract = season.contract || null;
  const contractApy = contract && typeof contract.apy === 'number' ? contract.apy : null;
  const contractPct = contractApy !== null && cap !== null ? (contractApy / cap) * 100 : null;

  // TrueValue for these stats, if there are enough plays to score.
  const score = canScore(stats) ? calculateScore(stats, stats) : null;
  const value = score === null ? null : calculateToDollars(score, year);
  const breakdown = score === null ? null : statBreakdown(stats, stats);
  return { player, stats, label, score, value, breakdown, cap, contract, contractPct, contractApy, career: false };
}

const perGame = (key) => (d) => (d.stats.games > 0 ? d.stats[key] / d.stats.games : null);
const fmtMoney = (v) => money.format(v);
const fmtInt = (v) => number.format(Math.round(v));
const fmt1 = (v) => v.toFixed(1);
const fmt2 = (v) => v.toFixed(2);

// One field from the contract a side is showing, or null if there is no contract.
function contractField(d, key) {
  if (!d.contract) return null;
  return d.contract[key];
}

// Every row in the head-to-head table. better: which way wins ('high' or 'low').
const H2H_GROUPS = [
  {
    title: 'TrueValue vs. contract',
    rows: [
      { label: 'Score (points per play)', get: (d) => d.score, fmt: fmt2, better: 'high' },
      { label: 'TrueValue (share of cap)', get: (d) => d.value && d.value.pct, fmt: (v) => v.toFixed(1) + '%', better: 'high' },
      { label: 'TrueValue (dollars)', get: (d) => d.value && d.value.dollars, fmt: fmtMoney, better: 'high' },
      {
        label: 'Contract (per year)',
        get: (d) => d.contractApy,
        fmt: fmtMoney,
      },
      { label: 'Contract (share of cap)', get: (d) => d.contractPct, fmt: (v) => v.toFixed(1) + '%' },
      {
        label: 'TrueValue minus contract',
        get: (d) => (d.value && d.value.dollars !== null && d.contractApy !== null ? d.value.dollars - d.contractApy : null),
        fmt: (v) => (v >= 0 ? '+' : '−') + money.format(Math.abs(v)),
        better: 'high',
      },
      { label: 'Salary cap used', get: (d) => d.cap, fmt: (v) => money.format(Math.round(v)) },
      {
        label: 'Seasons averaged',
        get: (d) => (d.career ? d.valueSeasons + ' scored, ' + d.contractSeasons + ' with a contract' : null),
        fmt: String,
        careerOnly: true,
      },
    ],
  },
  {
    title: 'Contract details',
    rows: [
      {
        label: 'Contract',
        get: (d) => (d.contract && d.contract.team ? d.contract.team + ', ' + d.contract.type.toLowerCase() : null),
        fmt: String,
      },
      { label: 'Year signed', get: (d) => contractField(d, 'yearSigned'), fmt: String },
      { label: 'Length (years)', get: (d) => contractField(d, 'years'), fmt: String },
      { label: 'Total value', get: (d) => contractField(d, 'totalValue'), fmt: fmtMoney },
      { label: 'Guaranteed', get: (d) => contractField(d, 'guaranteed'), fmt: fmtMoney },
      { label: 'Cap hit', get: (d) => contractField(d, 'capNumber'), fmt: fmtMoney },
      { label: 'Cash paid', get: (d) => contractField(d, 'cashPaid'), fmt: fmtMoney },
      { label: 'Current contract (per year)', get: (d) => (d.player.contract ? d.player.contract.apy : null), fmt: fmtMoney },
    ],
  },
  {
    title: 'Game stats',
    rows: [
      { label: 'Team', get: (d) => (d.stats.teams ? d.stats.teams.join(', ') : d.stats.team) || null, fmt: String },
      { label: 'Age', get: (d) => d.stats.age, fmt: String },
      { label: 'Games', get: (d) => d.stats.games, fmt: fmtInt },
      { label: 'Starts', get: (d) => d.stats.starts, fmt: fmtInt },
      { label: 'Completions', get: (d) => d.stats.completions, fmt: fmtInt, better: 'high' },
      { label: 'Attempts', get: (d) => d.stats.attempts, fmt: fmtInt },
      { label: 'Completion %', get: (d) => d.stats.completionPct, fmt: (v) => v.toFixed(1) + '%', better: 'high' },
      { label: 'Passing yards', get: (d) => d.stats.passYards, fmt: fmtInt, better: 'high' },
      { label: 'Touchdowns', get: (d) => d.stats.touchdowns, fmt: fmtInt, better: 'high' },
      { label: 'Interceptions', get: (d) => d.stats.interceptions, fmt: fmtInt, better: 'low' },
      { label: 'Sacks', get: (d) => d.stats.sacks, fmt: fmtInt, better: 'low' },
      { label: 'Sack yards lost', get: (d) => d.stats.sackYards, fmt: fmtInt, better: 'low' },
      { label: 'Passer rating', get: (d) => d.stats.passerRating, fmt: fmt1, better: 'high' },
      { label: 'Yards per attempt', get: (d) => d.stats.yardsPerAttempt, fmt: fmt1, better: 'high' },
      { label: 'Adjusted net yards per attempt', get: (d) => d.stats.adjNetYardsPerAttempt, fmt: fmt2, better: 'high' },
    ],
  },
  {
    title: 'Per game',
    rows: [
      { label: 'Passing yards per game', get: perGame('passYards'), fmt: fmt1, better: 'high' },
      { label: 'Touchdowns per game', get: perGame('touchdowns'), fmt: fmt2, better: 'high' },
      { label: 'Interceptions per game', get: perGame('interceptions'), fmt: fmt2, better: 'low' },
      { label: 'Sacks per game', get: perGame('sacks'), fmt: fmt2, better: 'low' },
    ],
  },
  {
    title: 'Where the score comes from',
    rows: BREAKDOWN_LABELS.map((label, i) => ({
      label,
      get: (d) => (d.breakdown ? d.breakdown[i].points : null),
      fmt: signed,
      better: 'high',
    })),
  },
];

// Each dropdown leaves out the quarterback picked on the other side.
// h2hMatches(): the quarterbacks one side's dropdown can offer, after its search box.
function h2hMatches(i) {
  const otherId = h2h.sides[1 - i].playerId;
  const text = h2h.searchInputs[i].value;
  return state.players.filter((p) => p.id !== otherId && matchesSearch(p, text));
}

function fillH2hPlayers() {
  h2h.playerSelects.forEach((select, i) => {
    const current = state.players.find((p) => p.id === h2h.sides[i].playerId);
    const matches = h2hMatches(i);
    // Keep the chosen quarterback in the list even if the search no longer matches him.
    if (current && !matches.includes(current)) matches.push(current);
    select.textContent = '';
    const searching = h2h.searchInputs[i].value.trim() !== '';
    select.append(new Option(searching ? 'Matches: ' + h2hMatches(i).length : 'Choose a quarterback', ''));
    addPlayerOptions(select, matches, true);
    select.value = h2h.sides[i].playerId;
    select.disabled = false;
    h2h.searchInputs[i].disabled = false;
  });
}

// pickH2hPlayer(): put a quarterback on one side and redraw.
function pickH2hPlayer(i, id) {
  h2h.sides[i].playerId = id;
  fillH2hPlayers();
  fillH2hSeasons(i);
  renderHeadToHead();
  saveSettings();
}

function fillH2hSeasons(i) {
  const side = h2h.sides[i];
  const select = h2h.seasonSelects[i];
  const player = state.players.find((p) => p.id === side.playerId);
  select.textContent = '';
  if (!player) {
    select.disabled = true;
    return;
  }
  const scoringYear = player.scoringSeason || 2025;
  select.append(new Option('Scoring season (' + scoringYear + ')', 'scoring'));
  select.append(new Option('Career totals', 'career'));
  const newestFirst = player.seasons.slice().sort((a, b) => b.season - a.season);
  for (const s of newestFirst) {
    // A star marks seasons with an award.
    const star = s.awards && s.awards.length ? ' \u2605' : '';
    select.append(new Option(s.season + ' (' + s.team + ')' + star, String(s.season)));
  }
  // If the saved choice isn't one of this player's options, go back to his scoring season.
  let found = false;
  for (const option of select.options) {
    if (option.value === side.season) found = true;
  }
  if (!found) side.season = 'scoring';
  select.value = side.season;
  select.disabled = false;
}

// Which side wins a row: 0, 1, or -1 for neither.
function winner(a, b, better) {
  if (!better || typeof a !== 'number' || typeof b !== 'number') return -1;
  if (Math.abs(a - b) < 1e-9) return -1;
  return (better === 'high') === (a > b) ? 0 : 1;
}

// renderHeadToHead(): one column per side, with a line down the middle.
function renderHeadToHead() {
  h2h.table.textContent = '';
  const data = h2h.sides.map(statsFor);
  if (!data[0] && !data[1]) return;

  const table = h('table', 'compare');
  table.append(h('caption', 'sr-only', 'Head-to-head comparison'));

  const thead = h('thead');
  const headRow = h('tr');
  for (const d of data) {
    const th = h('th');
    th.scope = 'col';
    if (d) {
      const head = h('div', 'card-head');
      head.append(playerPicture(d.player));
      const titles = h('div');
      titles.append(h('h3', '', d.player.name));
      titles.append(h('p', 'detail-team', d.label));
      const badges = awardBadges(awardCounts(d.career ? d.player.seasons : [d.stats]));
      if (badges) titles.append(badges);
      head.append(titles);
      th.append(head);
    } else {
      th.append(h('span', 'hint', 'Choose a quarterback'));
    }
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = h('tbody');
  for (const group of H2H_GROUPS) {
    const titleRow = h('tr', 'section');
    for (let i = 0; i < 2; i += 1) titleRow.append(h('th', '', group.title));
    tbody.append(titleRow);

    for (const row of group.rows) {
      if (row.careerOnly && !data.some((d) => d && d.career)) continue;
      const values = data.map((d) => {
        if (!d) return null;
        const v = row.get(d);
        return v === undefined || v === null || Number.isNaN(v) ? null : v;
      });
      const win = winner(values[0], values[1], row.better);
      const tr = h('tr');
      values.forEach((v, i) => {
        const td = h('td');
        if (data[i]) {
          const valueEl = h('span', 'stat-value' + (win === i ? ' better' : ''),
            v === null ? 'Not available' : (win === i ? '▲ ' : '') + row.fmt(v));
          td.append(statCell(row.label, valueEl));
        }
        tr.append(td);
      });
      tbody.append(tr);
    }
  }
  table.append(tbody);

  const tfoot = h('tfoot');
  const footRow = h('tr');
  const footCell = h('td', 'fine-print',
    'TrueValue needs at least ' + state.scoring.minAttempts + ' attempts. Single seasons use that season\'s salary cap ' +
    'and the contract he was on that season. Career totals show per-season averages: the average salary cap over ' +
    'his seasons, his average contract per year, and his average TrueValue across the seasons he could be scored ' +
    'in (each worked out with that season\'s cap). Cap hit and cash paid are added up. The career score, rates and ' +
    'passer rating are worked out from his total stats.');
  footCell.colSpan = 2;
  footRow.append(footCell);
  tfoot.append(footRow);
  table.append(tfoot);

  h2h.table.append(table);
}

function setupHeadToHead() {
  fillH2hPlayers();
  fillH2hSeasons(0);
  fillH2hSeasons(1);
  renderHeadToHead();
}

h2h.playerSelects.forEach((select, i) => {
  select.addEventListener('change', () => pickH2hPlayer(i, select.value));
});
h2h.searchInputs.forEach((input, i) => {
  // Narrow the list as you type; if only one quarterback matches, pick him.
  input.addEventListener('input', () => {
    const matches = h2hMatches(i);
    if (matches.length === 1 && matches[0].id !== h2h.sides[i].playerId) pickH2hPlayer(i, matches[0].id);
    else fillH2hPlayers();
  });
  // Enter picks the first match in the list (MVP winners come first).
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    for (const option of h2h.playerSelects[i].options) {
      if (option.value !== '' && option.value !== h2h.sides[i].playerId) {
        pickH2hPlayer(i, option.value);
        return;
      }
    }
  });
});
h2h.seasonSelects.forEach((select, i) => {
  select.addEventListener('change', () => {
    h2h.sides[i].season = select.value;
    renderHeadToHead();
    saveSettings();
  });
});

/* ---------- events ---------- */

els.list.addEventListener('click', (event) => {
  const button = event.target.closest('.player-btn');
  if (button) selectPlayer(button.dataset.id);
});
els.compareSelect.addEventListener('change', () => setCompare(els.compareSelect.value));
els.search.addEventListener('input', () => {
  filterList();
  saveSettings();
});
els.filter.addEventListener('change', () => {
  filterList();
  saveSettings();
});
els.resetBtn.addEventListener('click', resetStats);
els.clearBtn.addEventListener('click', clearAll);

loadPlayers();