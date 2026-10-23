// Stable, diff-friendly JSON for model files: small arrays and objects on
// one line, everything else indented.
export function formatModel(obj) {
  const inline = (v) => JSON.stringify(v);
  const fmt = (v, ind) => {
    const pad = '  '.repeat(ind);
    const s = inline(v);
    if (v === null || typeof v !== 'object' || s.length <= 72 || typeof v === 'string') return s;
    if (Array.isArray(v)) {
      if (v.every((x) => typeof x === 'string')) return '[\n' + v.map((x) => `${pad}  ${inline(x)}`).join(',\n') + `\n${pad}]`;
      return '[\n' + v.map((x) => `${pad}  ${fmt(x, ind + 1)}`).join(',\n') + `\n${pad}]`;
    }
    return '{\n' + Object.entries(v).map(([k, x]) => `${pad}  ${inline(k)}: ${fmt(x, ind + 1)}`).join(',\n') + `\n${pad}}`;
  };
  return fmt(obj, 0) + '\n';
}
