#!/usr/bin/env python3
"""Reproduce only the canonical mascot export in a temporary directory.

No fit/rig tool runs, no production pixels/coordinates change, no art report writes.
"""
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import PIL
from PIL import Image, features

SLOTS = Path(__file__).resolve().parents[4]
GAME = SLOTS / 'games/cyber-skunk'
REGISTERED = GAME / 'art/source/mascot-compact-v4/registered'
FITTED = GAME / 'art/rig/fitted'
SHIPPED = GAME / 'runtime/assets/mascot'
PREP = SLOTS / 'tools/art/cyber-skunk-prep.py'
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
rel = lambda p: str(p.relative_to(SLOTS))

with tempfile.TemporaryDirectory(prefix='cyber-mascot-lineage-') as temp:
    previous = sys.argv
    try:
        sys.argv = [str(PREP), '--mascot', str(REGISTERED), '--out', str(Path(temp) / 'assets')]
        spec = importlib.util.spec_from_file_location('cyber_lineage_prep', PREP)
        prep = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(prep)
    finally:
        sys.argv = previous
    notes = []
    # Call the shipping function directly; main() would also export unrelated art.
    status = prep.prep_mascot(False, notes)
    assert len(status) == 16 and all(v == 'ok' for v in status.values()), status
    assert not any(problems for _, _, problems in notes), notes
    assert 'jaw' not in status and {'tail-1', 'tail-2', 'tail-3', 'nozzle', 'far-ear'} <= set(status)
    generated = Path(temp) / 'assets/mascot'
    layers = json.loads((generated / 'layers.json').read_text())
    report = {
        'source': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=SLOTS, text=True).strip(),
        'scope': 'Canonical source-to-export identity only; no pose, browser, hosted or physical-device claim',
        'pillow': PIL.__version__, 'libwebp': features.version('webp'),
        'prepSha256': sha(PREP),
        'contractSha256': sha(prep.PIVOTS_FILE),
        'contractVersion': prep.PIVOTS.get('version'),
        'registeredPieceCount': len(status), 'parts': [], 'exports': [],
    }
    for name, selected, problems in notes:
        source = GAME / selected
        original = REGISTERED / (name + '.png')
        assert original.is_file()
        assert Image.open(original).size == (1600, 2000)
        override = source.parent == FITTED
        report['parts'].append({
            'part': name, 'registeredSource': rel(original), 'registeredSha256': sha(original),
            'effectiveSource': rel(source), 'effectiveSha256': sha(source),
            'fittedOverride': override, 'cropRegistration': layers[name],
            'pivot': prep.PIVOTS['parts'][name]['pivot'],
            'exportSize': list(Image.open(generated / (name + '.webp')).size),
        })
    assert {r['part'] for r in report['parts'] if r['fittedOverride']} == {'eyelids', 'nozzle'}
    expected_names = {p.name for p in generated.iterdir() if p.is_file()}
    actual_names = {p.name for p in SHIPPED.iterdir() if p.is_file()}
    assert expected_names == actual_names, (expected_names, actual_names)
    for p in sorted(generated.iterdir()):
        if not p.is_file():
            continue
        q = SHIPPED / p.name
        row = {'file': p.name, 'generatedSha256': sha(p), 'shippedSha256': sha(q), 'byteIdentical': p.read_bytes() == q.read_bytes()}
        report['exports'].append(row)
    report['exportCount'] = len(report['exports'])
    report['allExportsByteIdentical'] = all(r['byteIdentical'] for r in report['exports'])
    assert report['exportCount'] == 19 and report['allExportsByteIdentical']
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'parts': 16, 'byteIdenticalExports': 19, 'fittedOverrides': ['eyelids', 'nozzle'], 'problems': []}))
