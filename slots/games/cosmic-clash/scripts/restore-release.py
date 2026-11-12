#!/usr/bin/env python3
"""Restore missing files from the pinned release or offline zip. Never overwrite edits."""
import argparse, concurrent.futures, hashlib, json, os, urllib.request, urllib.parse, zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
files=json.loads((root/'scripts/release-manifest.json').read_text())
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('--archive',type=Path,help='Path to Cosmic-Clash-Claude-Handoff.zip for a completely offline restoration.')
args=cli.parse_args()
def restore(row):
 name,n,sha=row
 dst=root/name
 if dst.exists():return
 if args.archive:
  with zipfile.ZipFile(args.archive) as z:b=z.read('Cosmic-Clash/'+name)
 elif name.startswith('dist/'):
  with urllib.request.urlopen('https://bounty-breakers.djames1.chatgpt.site/'+urllib.parse.quote(name[5:]),timeout=90) as r:b=r.read()
 else:raise RuntimeError(name+' requires --archive')
 if len(b)!=n or hashlib.sha1(b'blob '+str(n).encode()+b'\0'+b).hexdigest()!=sha:raise ValueError('Release mismatch: '+name)
 dst.parent.mkdir(parents=True,exist_ok=True)
 tmp=dst.with_name(dst.name+'.restore-tmp')
 tmp.write_bytes(b);os.replace(tmp,dst)
if __name__=='__main__':
 targets=[x for x in files if args.archive or x[0].startswith('dist/')]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(restore,targets))
 print('Restoration complete. Existing edits were preserved.')
