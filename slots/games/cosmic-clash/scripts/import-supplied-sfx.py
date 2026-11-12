"""Import sounds.zip, or revised sounds(1).zip with --revised (requires ffmpeg)."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import zipfile

FILES = {
    'nice win': 'nice-win', 'big win': 'big-win', 'epic win': 'epic-win',
    'max win': 'max-win', 'buy bonus button': 'buy-bonus-button',
    'coin up': 'coin-up', 'coin down': 'coin-down',
    **{f'reel landing {i}': f'reel-landing-{i}' for i in range(1, 6)},
    'slide to open vs': 'slide-to-open-vs',
    'space revolver version 1': 'space-revolver-version-1',
    'space revolver version 2': 'space-revolver-version-2',
}
revised = '--revised' in sys.argv[2:]
if revised:
    FILES = {
        'coin up': 'coin-up', 'coin down': 'coin-down', 'fs landing': 'fs-landing',
        'reel slow down version 1': 'reel-slow-down-version-1',
        'reel slow down version 2': 'reel-slow-down-version-2',
    }
folder = 'sounds revised' if revised else 'sounds'
pack = 'revised-v106' if revised else 'supplied-v105'
out = Path(__file__).resolve().parents[1] / 'dist/assets/audio/sfx' / pack
out.mkdir(parents=True, exist_ok=True)
records = []
with zipfile.ZipFile(sys.argv[1]) as archive, tempfile.TemporaryDirectory() as temp:
    for original, name in FILES.items():
        member = f'{folder}/{original}.wav'
        if archive.namelist().count(member) != 1:
            raise ValueError(f'Expected exactly one {member}')
        data = archive.read(member)
        source = Path(temp) / f'{name}.wav'
        source.write_bytes(data)
        analysis = subprocess.run(
            ['ffmpeg', '-hide_banner', '-i', str(source), '-af', 'volumedetect',
             '-f', 'null', '-'], check=True, capture_output=True, text=True)
        peak = float(re.search(r'max_volume: ([-\d.]+) dB', analysis.stderr)[1])
        gain = -3 - peak
        target = out / f'{name}.mp3'
        subprocess.run(
            ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
             '-map_metadata', '-1', '-af', f'volume={gain:.3f}dB',
             '-codec:a', 'libmp3lame', '-q:a', '2', str(target)], check=True)
        duration = float(subprocess.check_output(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=nw=1:nk=1', str(source)], text=True))
        records.append({'file': target.name, 'source': member, 'seconds': duration,
                        'gainDB': round(gain, 3),
                        'sourceSha256': hashlib.sha256(data).hexdigest(),
                        'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
(out / 'credits.json').write_text(json.dumps({
    'source': 'User-supplied revised sounds(1).zip, 2026-10-05' if revised else 'User-supplied sounds.zip, 2026-10-02',
    'processing': 'Constant gain to -3 dBFS source peak; MP3 VBR quality 2. No trimming, pitch changes, time stretching or added reverb.',
    'files': records,
}, indent=2) + '\n')
print(f'Imported {len(records)} supplied sound effects.')
