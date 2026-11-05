// Reconstruct intermediate pictures from authored movements. No outcome decisions live here.
function fall(board, event) {
  const next = board.map(col => col.slice());
  const distances = Array(30).fill(0);
  for (const [x, from, to] of event.drops) {
    next[x][to] = board[x][from];
    distances[to * 6 + x] = to - from;
  }
  const heights = Array(6).fill(0);
  for (const [x] of event.refills) heights[x]++;
  for (const [x, y, s, v] of event.refills) {
    next[x][y] = v === undefined ? { s } : { s, v };
    distances[y * 6 + x] = heights[x];
  }
  return { board: next, distances };
}

function change(board, changes, stamp) {
  const next = board.map(col => col.slice());
  for (const [x, y, , s] of changes) next[x][y] = s === 'ST' ? { s, v: stamp } : { s };
  return { board: next, hits: changes.map(([x,y]) => [x,y]) };
}

export function* frames(board, step) {
  let frame = fall(board, step);
  yield frame;
  for (const job of step.jobs) {
    for (const part of [job.unpack, job.wild, job].filter(Boolean)) {
      frame = change(frame.board, part.changes, job.stamp);
      yield { ...frame, job: job.job, symbol: job.s, filtered: job.filtered, returned: job.returned };
    }
    if (job.refills) {
      frame = fall(frame.board, job);
      yield frame;
    }
  }
}
