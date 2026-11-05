// Dead Letter Depot: the mail-routing resolver. Pure and deterministic: the
// same board, entries and rescues always give the same route, in the game, the
// tests and the math tools alike. Nothing here draws randomness or pays.
//
// The sorter is STAGES columns of LANES lanes (lane 0 is the top). A letter in
// a lane meets that column's stamp and moves into the next column:
//   U up one lane · S straight · D down one lane · F fork (one copy up, one down)
//   J jam (the branch dies) · a move past the top or bottom lane is lost at the edge.
// Copies that arrive in the same lane are reunited into one letter, so a lane
// holds at most one letter and each bin receives at most one delivery a spin.
// Letters that leave the last column are delivered to the bin of the lane
// they leave into.
//
// A rescue (Lost & Found; unlimited on Registered Mail) saves a branch that
// would be lost to a jam or an edge: it carries straight on in its own lane.
// Rescues are spent in route order: stage by stage, top lane first, and for a
// fork its upper arm before its lower arm.
import { STAGES, LANES, STAMPS } from './sorter.js';

export const MOVES = Object.freeze({ U: Object.freeze([-1]), S: Object.freeze([0]), D: Object.freeze([1]), F: Object.freeze([-1, 1]), J: Object.freeze([]) });
const KIND = { '-1': 'up', 0: 'straight', 1: 'down' };

// One stage. column[lane] is that lane's cell ({ s: stamp }); active lists the
// lanes holding a letter, ascending. Returns every move, the lanes that
// reunited, the lanes leaving the stage (ascending) and the rescues left.
export function stepStage(column, active, rescues = 0) {
  const moves = [], arrivals = new Array(LANES).fill(0);
  let left = rescues;
  const save = (lane, cause, stamp) => {
    if (left > 0) { left -= 1; moves.push({ from: lane, to: lane, kind: 'rescue', cause, stamp }); arrivals[lane] += 1; return; }
    moves.push({ from: lane, to: null, kind: cause, stamp });
  };
  for (const lane of active) {
    const stamp = column[lane].s;
    if (!Object.hasOwn(MOVES, stamp)) throw Error(`Unknown stamp ${stamp} in lane ${lane}`);
    if (stamp === 'J') { save(lane, 'jam', stamp); continue; }
    for (const d of MOVES[stamp]) {
      const to = lane + d;
      if (to < 0 || to >= LANES) save(lane, 'edge', stamp);
      else { moves.push({ from: lane, to, kind: stamp === 'F' ? 'fork' : KIND[d], stamp }); arrivals[to] += 1; }
    }
  }
  const out = [], merged = [];
  for (let lane = 0; lane < LANES; lane++) {
    if (arrivals[lane] > 0) out.push(lane);
    if (arrivals[lane] > 1) merged.push(lane);
  }
  return { moves, merged, out, rescues: left };
}

const lanesOf = (entries) => {
  const set = [...new Set(entries)].sort((a, b) => a - b);
  for (const lane of set) if (!Number.isInteger(lane) || lane < 0 || lane >= LANES) throw Error(`Entry lane ${lane} is outside the sorter`);
  return set;
};

// The whole route. board[stage][lane] = { s, fs? }.
export function resolveRoute(board, { entries = [1], rescues = 0 } = {}) {
  if (!Array.isArray(board) || board.length !== STAGES || board.some((c) => !Array.isArray(c) || c.length !== LANES)) throw Error(`A board is ${STAGES} stages of ${LANES} lanes`);
  let active = lanesOf(entries), left = rescues;
  const stages = [], lost = { jam: 0, edge: 0 };
  let rescued = 0, reunited = 0;
  for (let stage = 0; stage < STAGES; stage++) {
    const step = stepStage(board[stage], active, left);
    for (const m of step.moves) {
      if (m.kind === 'jam') lost.jam += 1;
      else if (m.kind === 'edge') lost.edge += 1;
      else if (m.kind === 'rescue') rescued += 1;
    }
    reunited += step.merged.length;
    stages.push({ stage, in: active, moves: step.moves, merged: step.merged, out: step.out });
    active = step.out; left = step.rescues;
  }
  return { entries: lanesOf(entries), stages, delivered: active, lost, rescued, reunited };
}

export const isStamp = (s) => STAMPS.includes(s);
