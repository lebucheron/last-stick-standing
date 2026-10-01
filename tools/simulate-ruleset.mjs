import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const gamePath = path.join(projectRoot, 'game.js');
const seedFlag = process.argv.indexOf('--seed');
const singleSeed = seedFlag >= 0 ? Number.parseInt(process.argv[seedFlag + 1], 10) : null;
const requested = Number.parseInt(process.argv[2] || '10000', 10);
const roundCount = Number.isInteger(singleSeed) && singleSeed > 0 ? 1 : (Number.isFinite(requested) && requested > 0 ? requested : 10000);

class FakeElement {
  constructor() {
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.isConnected = false;
  }
}

const noop = () => {};
const gradient = { addColorStop: noop };
const ctx = new Proxy({
  createRadialGradient: () => gradient,
  measureText: () => ({ width: 0 }),
}, {
  get(target, key) {
    if (key in target) return target[key];
    return noop;
  },
  set(target, key, value) {
    target[key] = value;
    return true;
  },
});

const canvas = new FakeElement();
canvas.getContext = () => ctx;
const status = new FakeElement();
const button = new FakeElement();
const legend = new FakeElement();
const result = new FakeElement();
const runners = Array.from({ length: 6 }, () => new FakeElement());
const root = new FakeElement();
root.querySelector = (selector) => {
  if (selector === 'canvas') return canvas;
  if (selector === '#st-status') return status;
  if (selector === '#st-pause') return button;
  if (selector === '#st-legend') return legend;
  if (selector === '#st-result') return result;
  const match = selector.match(/^\[data-man="(\d)"\]$/);
  return match ? runners[Number(match[1])] : null;
};

const document = { getElementById: () => root };
const window = { addEventListener: noop, openai: null };
const sandbox = {
  console,
  document,
  window,
  globalThis: null,
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false }),
  getComputedStyle: () => ({ getPropertyValue: () => '#888' }),
  requestAnimationFrame: noop,
  crypto: globalThis.crypto,
  Math,
  Date,
  Uint32Array,
  setTimeout,
  clearTimeout,
};
sandbox.globalThis = sandbox;

let source = fs.readFileSync(gamePath, 'utf8');
source = source.replace(/\}\)\(\);\s*$/, `
  // Les particules de sang et de poussière sont purement visuelles. Les
  // désactiver accélère le lot sans toucher aux décisions ni à la physique.
  blood = () => {};
  globalThis.__lastStickSimulation = {
    reset,
    update,
    state: () => ({
      ruleset: RULESET,
      winnerId,
      time,
      raceStart: RACE_START,
      deathLog: deathLog.map(entry => ({ ...entry })),
      starts: JSON.parse(root.dataset.roundStarts || '{}'),
      teleports,
      men: men.map(runner => ({ id: runner.id, x: runner.x, y: runner.y, alive: runner.alive, dir: runner.dir, ground: runner.ground, climbing: Boolean(runner.climb) })),
      pieces: pieces.map(piece => ({ col: piece.col, y: piece.y, target: piece.target, wait: piece.wait, vy: piece.vy })),
    }),
  };
})();`);

vm.runInNewContext(source, sandbox, { filename: gamePath });
const simulation = sandbox.__lastStickSimulation;
if (!simulation) throw new Error('Le moteur de simulation n’a pas pu être exposé.');

const winners = Object.fromEntries('ABCDEF'.split('').map(id => [id, 0]));
const startWins = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 0]));
const startAppearances = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 0]));
const deathCauses = {};
const durations = [];
let combatFinals = 0;
const debugEvents = [];

const firstSeed = singleSeed || 1;
const lastSeed = singleSeed || roundCount;
for (let seed = firstSeed; seed <= lastSeed; seed++) {
  simulation.reset({ seed });
  let state;
  for (let step = 0; step < 60 * 70; step++) {
    const before = singleSeed ? simulation.state() : null;
    simulation.update(1 / 60);
    state = simulation.state();
    if (singleSeed && state.deathLog.length > before.deathLog.length) {
      debugEvents.push({
        time: state.time - state.raceStart,
        deaths: state.deathLog.slice(before.deathLog.length),
        teleportsBefore: before.teleports,
        teleportsAfter: state.teleports,
        menBefore: before.men,
        menAfter: state.men,
        piecesBefore: before.pieces,
        piecesAfter: state.pieces,
      });
    }
    if (state.winnerId >= 0) break;
  }
  if (!state || state.winnerId < 0) throw new Error(`La seed ${seed} n’a pas produit de gagnant.`);

  const winner = String.fromCharCode(65 + state.winnerId);
  const duration = Math.max(0, state.time - state.raceStart);
  winners[winner]++;
  durations.push(duration);
  for (const start of Object.values(state.starts)) startAppearances[start]++;
  startWins[state.starts[winner]]++;
  if (state.deathLog.some(entry => entry.cause === 'combat')) combatFinals++;
  for (const death of state.deathLog) deathCauses[death.cause] = (deathCauses[death.cause] || 0) + 1;
}

durations.sort((a, b) => a - b);
const percentile = p => durations[Math.min(durations.length - 1, Math.floor((durations.length - 1) * p))];
const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
const report = {
  generatedAt: new Date().toISOString(),
  ruleset: simulation.state().ruleset,
  rounds: roundCount,
  durationSeconds: {
    average,
    median: percentile(0.5),
    p90: percentile(0.9),
    min: durations[0],
    max: durations.at(-1),
  },
  combatFinals: {
    count: combatFinals,
    rate: combatFinals / roundCount,
  },
  winners: Object.fromEntries(Object.entries(winners).map(([id, count]) => [id, { count, rate: count / roundCount }])),
  starts: Object.fromEntries(Object.keys(startAppearances).map(start => [start, {
    wins: startWins[start],
    appearances: startAppearances[start],
    rate: startAppearances[start] ? startWins[start] / startAppearances[start] : 0,
  }])),
  deathCauses,
  ...(singleSeed ? { debugEvents } : {}),
};

const outputDir = path.join(projectRoot, 'output', 'stats');
fs.mkdirSync(outputDir, { recursive: true });
const suffix = singleSeed ? `seed-${singleSeed}` : String(roundCount);
const outputPath = path.join(outputDir, `simulation-${report.ruleset.toLowerCase()}-${suffix}.json`);
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, ...report }, null, 2));
