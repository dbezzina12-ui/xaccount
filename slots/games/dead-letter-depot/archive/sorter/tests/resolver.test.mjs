// Route fixtures for the mail-routing resolver: edge loss, forks, merges,
// jams and exactly-once delivery, plus rescues and input checks.
//   npm run test:dead-letter-depot-sorter
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute, stepStage } from '../engine/resolver.js';

// A board from five 3-letter stage codes, top lane first: 'S F S' etc.
const board = (code) => code.trim().split(/\s+/).map((stage) => [...stage].map((s) => ({ s })));
const kinds = (route, stage) => route.stages[stage].moves.map((m) => `${m.from}>${m.to ?? 'x'}:${m.kind}`);

test('a letter on straight track is delivered to the bin of its lane', () => {
  const r = resolveRoute(board('SSS SSS SSS SSS SSS'));
  assert.deepEqual(r.delivered, [1]);
  assert.deepEqual(r.stages.map((s) => s.in), [[1], [1], [1], [1], [1]]);
  assert.deepEqual(r.lost, { jam: 0, edge: 0 });
});

test('up and down move one lane per stage and the last stage picks the bin', () => {
  assert.deepEqual(resolveRoute(board('SUS SSS SSS SSS SSS')).delivered, [0]);
  assert.deepEqual(resolveRoute(board('SDS SSS SSS SSS SSS')).delivered, [2]);
  // up, then down from the top lane, then the last stage sends it down again
  const r = resolveRoute(board('SUS DSS SSS SSS SDS'));
  assert.deepEqual(r.stages.map((s) => s.in), [[1], [0], [1], [1], [1]]);
  assert.deepEqual(r.delivered, [2]);
});

test('edge loss: a move past the top or bottom lane loses the letter', () => {
  const top = resolveRoute(board('SUS USS SSS SSS SSS'));
  assert.deepEqual(top.delivered, []);
  assert.deepEqual(top.lost, { jam: 0, edge: 1 });
  assert.deepEqual(kinds(top, 1), ['0>x:edge']);
  const bottom = resolveRoute(board('SDS SSD SSS SSS SSS'));
  assert.deepEqual(bottom.delivered, []);
  assert.equal(bottom.lost.edge, 1);
  // the last stage can also throw it off the cabinet
  const last = resolveRoute(board('SUS SSS SSS SSS USS'));
  assert.deepEqual(last.delivered, []);
  assert.equal(last.lost.edge, 1);
});

test('fork: one copy goes up and one goes down', () => {
  const r = resolveRoute(board('SFS SSS SSS SSS SSS'));
  assert.deepEqual(kinds(r, 0), ['1>0:fork', '1>2:fork']);
  assert.deepEqual(r.stages[1].in, [0, 2]);
  assert.deepEqual(r.delivered, [0, 2]);
});

test('fork at an edge loses only the arm that leaves the cabinet', () => {
  const r = resolveRoute(board('SUS FSS SSS SSS SSS'));
  assert.deepEqual(kinds(r, 1), ['0>x:edge', '0>1:fork']);
  assert.deepEqual(r.delivered, [1]);
  assert.equal(r.lost.edge, 1);
  const low = resolveRoute(board('SDS SSF SSS SSS SSS'));
  assert.deepEqual(kinds(low, 1), ['2>1:fork', '2>x:edge']);
  assert.deepEqual(low.delivered, [1]);
});

test('merge: copies arriving in the same lane are reunited and count once', () => {
  const r = resolveRoute(board('SFS DSU SSS SSS SSS'));
  assert.deepEqual(r.stages[1].moves.map((m) => m.to), [1, 1]);
  assert.deepEqual(r.stages[1].merged, [1]);
  assert.deepEqual(r.stages[1].out, [1]);
  assert.equal(r.reunited, 1);
  assert.deepEqual(r.delivered, [1]);
  // a reunited letter forks again like any other
  assert.deepEqual(resolveRoute(board('SFS DSU SFS SSS SSS')).delivered, [0, 2]);
});

test('merge across a fork arm and a straight letter', () => {
  // copies in lanes 0 and 2; the top one forks (up arm lost), its down arm meets nobody;
  // then lanes 1 and 2: lane 2 goes up into lane 1, where the other copy goes straight
  const r = resolveRoute(board('SFS FSS SSU SSS SSS'));
  assert.deepEqual(r.stages[2].in, [1, 2]);
  assert.deepEqual(r.stages[2].merged, [1]);
  assert.deepEqual(r.delivered, [1]);
  assert.equal(r.lost.edge, 1);
});

test('jam: the branch that meets it dies; jams in empty lanes do nothing', () => {
  const r = resolveRoute(board('JSJ SSS SJS SSS SSS'));
  assert.deepEqual(kinds(r, 2), ['1>x:jam']);
  assert.deepEqual(r.delivered, []);
  assert.deepEqual(r.lost, { jam: 1, edge: 0 });
  // one fork arm jams, the other is delivered
  const arm = resolveRoute(board('SFS JSS SSS SSS SSS'));
  assert.deepEqual(arm.delivered, [2]);
  assert.equal(arm.lost.jam, 1);
});

test('exactly-once delivery: two copies into one bin deliver once; three bins are reachable', () => {
  // copies in lanes 0 and 2 meet in the last stage's middle bin
  const one = resolveRoute(board('SFS SSS SSS SSS DSU'));
  assert.deepEqual(one.stages[4].merged, [1]);
  assert.deepEqual(one.delivered, [1]);
  // lanes 0 and 1: the top goes down into lane 1 while the middle forks into 0 and 2
  const all = resolveRoute(board('SFS SSU SSS SSS DFS'));
  assert.deepEqual(all.stages[4].in, [0, 1]);
  assert.deepEqual(all.delivered, [0, 1, 2]);
  for (const code of ['SFS SFS SFS SFS SFS', 'FFF FFF FFF FFF FFF', 'SFS DSU SFS DSU SFS', 'UFD UFD UFD UFD UFD']) {
    const r = resolveRoute(board(code));
    assert.equal(new Set(r.delivered).size, r.delivered.length, code);
    assert.deepEqual(r.delivered, [...r.delivered].sort((a, b) => a - b), code);
    for (const s of r.stages) assert.equal(new Set(s.out).size, s.out.length, code);
  }
});

test('a rescue carries a jammed or edge-bound branch straight on, in route order', () => {
  // the first loss (stage 0 jam) is rescued; the second (stage 1 jam) is not
  const r = resolveRoute(board('SJS SJS SSS SSS SSS'), { rescues: 1 });
  assert.deepEqual(kinds(r, 0), ['1>1:rescue']);
  assert.equal(r.stages[0].moves[0].cause, 'jam');
  assert.deepEqual(kinds(r, 1), ['1>x:jam']);
  assert.equal(r.rescued, 1);
  assert.deepEqual(r.delivered, []);
  // two losses in one stage: the top lane is rescued first
  const two = resolveRoute(board('SFS JSJ SSS SSS SSS'), { rescues: 1 });
  assert.deepEqual(kinds(two, 1), ['0>0:rescue', '2>x:jam']);
  assert.deepEqual(two.delivered, [0]);
  // a fork's upper arm is saved at the top edge before anything below it
  const edge = resolveRoute(board('SUS FSS SSS SSS SSS'), { rescues: 1 });
  assert.deepEqual(kinds(edge, 1), ['0>0:rescue', '0>1:fork']);
  assert.deepEqual(edge.delivered, [0, 1]);
  assert.equal(edge.lost.edge, 0);
});

test('a rescued branch that lands on another letter is reunited with it', () => {
  // copies in lanes 0 and 2; lane 0 jams but is rescued into lane 0, lane 2 goes straight
  const r = resolveRoute(board('SFS JSS USS SSS SSS'), { rescues: 1 });
  assert.deepEqual(r.stages[2].in, [0, 2]);
  // the top copy goes up off the edge with no rescues left
  assert.deepEqual(r.delivered, [2]);
  // a rescue straight into the lane another copy is entering merges them
  const m = resolveRoute(board('SFS SSU JUS SSS SSS'), { rescues: 1 });
  assert.deepEqual(kinds(m, 2), ['0>0:rescue', '1>0:up']);
  assert.deepEqual(m.stages[2].merged, [0]);
  assert.deepEqual(m.delivered, [0]);
});

test('unlimited rescues (Registered Mail) never lose a branch', () => {
  const r = resolveRoute(board('JJJ JJJ JJJ JJJ JJJ'), { rescues: Infinity });
  assert.deepEqual(r.delivered, [1]);
  assert.equal(r.rescued, 5);
  const edges = resolveRoute(board('UUU UUU FFF DDD DDD'), { rescues: Infinity });
  assert.deepEqual(edges.lost, { jam: 0, edge: 0 });
  assert.ok(edges.delivered.length > 0);
});

test('several entry lanes share the sorter and merge like copies', () => {
  assert.deepEqual(resolveRoute(board('SSS SSS SSS SSS SSS'), { entries: [0, 2] }).delivered, [0, 2]);
  const three = resolveRoute(board('DSU SSS SSS SSS SSS'), { entries: [2, 0, 1, 1] });
  assert.deepEqual(three.entries, [0, 1, 2]);
  assert.deepEqual(three.stages[0].merged, [1]);
  assert.deepEqual(three.delivered, [1]);
});

test('the resolver is pure and checks its inputs', () => {
  const b = board('SFS DSU JSJ UFD SSS');
  const copy = structuredClone(b);
  const a = resolveRoute(b, { entries: [0, 1, 2], rescues: 1 });
  assert.deepEqual(b, copy);
  assert.deepEqual(resolveRoute(b, { entries: [0, 1, 2], rescues: 1 }), a);
  assert.throws(() => resolveRoute(board('SXS SSS SSS SSS SSS')), /Unknown stamp X/);
  assert.throws(() => resolveRoute(board('SSS SSS SSS SSS')), /5 stages of 3 lanes/);
  assert.throws(() => resolveRoute(board('SSS SSS SSS SSS SSS'), { entries: [3] }), /outside the sorter/);
  assert.deepEqual(stepStage(b[0], [], 0), { moves: [], merged: [], out: [], rescues: 0 });
});
