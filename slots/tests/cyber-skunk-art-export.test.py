"""Targeted art-profile checks. Run with Python; no runtime or provider access."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

PREP = Path(__file__).resolve().parents[1] / 'tools/art/cyber-skunk-prep.py'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ExportProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.art = self.root / 'art'
        self.out = self.root / 'out'
        self.master = self.art / 'symbols/a.png'
        self.profile = self.art / 'source/runtime-export-profile-v1'
        self.profile.mkdir(parents=True)
        self.master.parent.mkdir(parents=True)
        Image.new('RGBA', (512, 512), (230, 220, 190, 127)).save(self.master)
        self.export = self.profile / 'a.webp'
        Image.new('RGBA', (320, 320), (210, 190, 150, 127)).save(self.export, 'WEBP')
        self.binding = {'version': 1, 'assets': {'a': {
            'master': 'symbols/a.png', 'masterSha256': sha(self.master),
            'export': 'a.webp', 'exportSha256': sha(self.export),
            'runtime': 'symbols/a.webp', 'size': [320, 320],
        }}}
        self.write_binding()

    def write_binding(self):
        (self.profile / 'manifest.json').write_text(json.dumps(self.binding))

    def load(self, *flags):
        spec = importlib.util.spec_from_file_location('cyber_prep_test', PREP)
        module = importlib.util.module_from_spec(spec)
        with patch.object(sys, 'argv', [str(PREP), '--art', str(self.art), '--out', str(self.out), *flags]):
            spec.loader.exec_module(module)
        return module

    def assert_cli_refuses_before_writing(self, expected):
        self.out.mkdir()
        sentinel = self.out / 'sentinel.txt'
        sentinel.write_text('unchanged')
        result = subprocess.run([sys.executable, str(PREP), '--art', str(self.art), '--out', str(self.out)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(expected, result.stderr)
        self.assertEqual(list(self.out.iterdir()), [sentinel])
        self.assertEqual(sentinel.read_text(), 'unchanged')
        self.assertFalse((self.art / 'REPORT.md').exists())

    def test_bound_export_keeps_exact_bytes(self):
        module = self.load()
        module.validate_export_profile()
        self.assertEqual(module.prep_asset('a', False, []), 'ok')
        self.assertEqual((self.out / 'symbols/a.webp').read_bytes(), self.export.read_bytes())

    def test_changed_master_fails_before_any_write(self):
        Image.new('RGBA', (512, 512), (10, 20, 30, 127)).save(self.master)
        self.assert_cli_refuses_before_writing('master changed')

    def test_corrupt_export_fails_before_any_write(self):
        self.export.write_bytes(b'broken export')
        self.assert_cli_refuses_before_writing('preserved export is missing or changed')

    def test_path_escape_fails_before_any_write(self):
        self.binding['assets']['a']['export'] = '../outside.webp'
        self.write_binding()
        self.assert_cli_refuses_before_writing('path outside its art directory')

    def test_explicit_review_bypass_uses_master_defaults(self):
        module = self.load('--without-export-profile')
        module.validate_export_profile()
        self.assertEqual(module.EXPORT_PROFILE['assets'], {})
        self.assertEqual(module.prep_asset('a', False, []), 'ok')
        with Image.open(self.out / 'symbols/a.webp') as output:
            self.assertEqual(output.size, (512, 512))
        self.assertNotEqual((self.out / 'symbols/a.webp').read_bytes(), self.export.read_bytes())

    def test_review_bypass_refuses_production_output(self):
        module = self.load('--without-export-profile')
        module.OUT = module.GAME / 'runtime/assets'
        with self.assertRaisesRegex(ValueError, 'separate --out review directory'):
            module.validate_export_profile()


if __name__ == '__main__':
    unittest.main(verbosity=2)
