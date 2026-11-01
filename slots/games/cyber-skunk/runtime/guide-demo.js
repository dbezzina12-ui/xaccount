import { drawBoard, seeded, sprayRoute, paint } from './engine.js';
import { symbolHTML } from './symbols.js?v=4';

// Each frame uses the production symbol and route rules. Only the guide's examples are seeded.
export function mountDemos(cards) {
  const scatterFrames = [3, 4, 5].map((count, i) => {
    const board = drawBoard('base', seeded(22), new Map(), count);
    return { board, caption: ['3 FS · VENT BREAK', '4 FS · OVERPRESSURE', '5 FS · BLACKOUT'][i] };
  });
  const board = drawBoard('base', seeded(91)).map(({s}) => ({s}));
  board[6].vent = 1;
  board[9].vent = 2;
  const route = sprayRoute(board);
  const sprayed = (route, n) => paint(board, {path:route.path.slice(0,n)});
  const routeFrames = [{board, caption:'SPRAY ENTERS THE FIRST VENT'}, ...route.path.map((step, i) =>
    ({board:sprayed(route, i+1), caption:step.pressure + '× PRESSURE · FOLLOW THE ROUTE'}))];
  const next = sprayRoute(board, 3);
  const pressureFrames = [
    {board, caption:'RESERVOIR 0 · START AT 1×'},
    {board:paint(board, route), caption:'2 VENTS CROSSED · BANK 2'},
    {board, caption:'NEXT SPRAY · START AT 3×'},
    {board:paint(board, next), caption:'2 MORE VENTS · REACH 5×'},
  ];
  const scenes = [scatterFrames, routeFrames, pressureFrames];
  const pages = cards.map((card, i) => {
    const boardEl = card.querySelector('.guide-board'), caption = card.querySelector('.demo-caption'), button = card.querySelector('.demo-toggle');
    let frame = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
    function render() {
      const scene = scenes[i][frame];
      boardEl.innerHTML = scene.board.map(c => '<i' + (c.wild || c.s === 'S' ? ' class="lit"' : '') + '>' +
        symbolHTML(c.wild ? 'W' : c.s) + (c.multi > 1 ? '<b>' + c.multi + '×</b>' : c.vent !== undefined ? '<b>' + ['↑','→','↓','←'][c.vent] + '</b>' : '') + '</i>').join('');
      caption.textContent = scene.caption;
      button.textContent = paused ? 'Play' : 'Pause';
      button.setAttribute('aria-label', button.textContent + ' ' + card.querySelector('h3').textContent + ' demo');
    }
    button.onclick = () => { paused = !paused; render(); };
    render();
    return () => {
      if (!paused && card.getClientRects().length) { frame = (frame + 1) % scenes[i].length; render(); }
    };
  });
  let timer;
  return {start(){ clearInterval(timer); timer = setInterval(() => { if (!document.hidden) pages.forEach(step => step()); }, 1050); }, stop(){clearInterval(timer);} };
}
