#!/usr/bin/env python3
"""Rebuild ordinary art and the fitted mascot into temp storage; compare bytes."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

from PIL import Image, features
import PIL

HERE = Path(__file__).resolve().parent
GAME = HERE.parents[1]
SLOTS = GAME.parents[1]
REPO = SLOTS.parent
PREP = SLOTS / 'tools/art/cyber-skunk-prep.py'
RUNTIME = GAME / 'runtime'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path):
    return path.relative_to(REPO).as_posix()


def main():
    base = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip()
    spec = importlib.util.spec_from_file_location('cyber_prep_audit', PREP)
    prep = importlib.util.module_from_spec(spec)
    with tempfile.TemporaryDirectory(prefix='cyber-art-exports-') as temp:
        old_args = sys.argv
        sys.argv = [str(PREP), '--out', temp, '--mascot', str(GAME / 'art/source/mascot-compact-v4/registered')]
        try:
            spec.loader.exec_module(prep)
        finally:
            sys.argv = old_args
        prep.validate_export_profile()
        inputs = {PREP, prep.PIVOTS_FILE, GAME / 'ART_SPEC.md', prep.PROFILE_FILE}
        inputs.update(prep.find(name) for name in prep.SPEC)
        inputs.update(prep.PROFILE_DIR / entry['export'] for entry in prep.EXPORT_PROFILE['assets'].values())
        inputs.update(prep.MASCOT_DIR.glob('*.png'))
        inputs.update((GAME / 'art/rig/fitted').glob('*.png'))
        runtime_files = set(path for path in RUNTIME.rglob('*') if path.is_file())
        watched = inputs | runtime_files
        before = {relative(path): sha(path) for path in sorted(watched)}
        notes = []
        ordinary = {name: prep.prep_asset(name, False, notes) for name in prep.SPEC}
        mascot = prep.prep_mascot(False, notes)
        outputs = []
        for output in sorted(prep.OUT.rglob('*')):
            if not output.is_file():
                continue
            target = RUNTIME / 'assets' / output.relative_to(prep.OUT)
            row = {'file': output.relative_to(prep.OUT).as_posix(), 'sha256': sha(output),
                   'runtimeSha256': sha(target), 'bytes': output.stat().st_size,
                   'byteIdentical': output.read_bytes() == target.read_bytes()}
            if output.suffix == '.webp':
                with Image.open(output) as im:
                    row['size'] = list(im.size)
            outputs.append(row)
        # Quantify the difference this explicit profile prevents, using temp output only.
        bindings = prep.EXPORT_PROFILE
        prep.EXPORT_PROFILE = {'version': 1, 'assets': {}}
        defaults = []
        for name, entry in bindings['assets'].items():
            prep.prep_asset(name, False, [])
            output = prep.OUT / entry['runtime']
            target = RUNTIME / 'assets' / entry['runtime']
            with Image.open(output) as im:
                default_size = list(im.size)
            defaults.append({'name': name, 'runtimeSize': entry['size'], 'defaultSize': default_size,
                             'defaultSha256': sha(output), 'differsFromRuntime': output.read_bytes() != target.read_bytes()})
        after = {relative(path): sha(path) for path in sorted(watched)}
        tracked = []
        for path in sorted(runtime_files):
            name = relative(path)
            original = subprocess.check_output(['git', 'show', f'HEAD:{name}'], cwd=REPO)
            tracked.append({'file': name, 'matchesGit': original == path.read_bytes()})
        result = {
            'baseCommit': base, 'python': sys.version.split()[0], 'pillow': PIL.__version__,
            'webp': features.version('webp'), 'ordinary': ordinary, 'mascot': mascot,
            'profileBindings': len(bindings['assets']), 'exportCount': len(outputs),
            'byteIdenticalExports': sum(row['byteIdentical'] for row in outputs),
            'defaultDifferences': defaults, 'outputs': outputs,
            'inputFingerprintCount': len(before), 'inputsUnchanged': before == after,
            'inputFingerprints': before, 'runtimeGitChecks': tracked,
            'runtimeFilesMatchGit': all(row['matchesGit'] for row in tracked),
            'problems': [(name, str(source), problems) for name, source, problems in notes if problems],
            'scope': 'Temporary checkout export identity only; no hosted, visual, rig-pose, sampler or math sign-off.'
        }
        (HERE / 'report.json').write_text(json.dumps(result, indent=2) + '\n')
        assert len(outputs) == 68 and all(row['byteIdentical'] for row in outputs)
        assert all(status == 'ok' for status in [*ordinary.values(), *mascot.values()])
        assert all(row['differsFromRuntime'] for row in defaults)
        assert before == after and result['runtimeFilesMatchGit']
        print(f"PASS: {len(ordinary)} ordinary + {len(mascot) + 3} mascot exports byte-identical; "
              f"{len(defaults)} default differences prevented; {len(runtime_files)} runtime files match Git; "
              f"{len(before)} fingerprints unchanged.")


if __name__ == '__main__':
    main()
