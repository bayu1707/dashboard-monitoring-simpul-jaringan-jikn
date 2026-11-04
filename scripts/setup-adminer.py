#!/usr/bin/env python3
"""Unduh Adminer resmi yang dipin dan periksa digest rilis; tidak membaca kredensial."""
from pathlib import Path
import hashlib
import json
import urllib.request

root = Path(__file__).resolve().parents[1]
directory = root/'.local/tools/adminer'
directory.mkdir(mode=0o700, parents=True, exist_ok=True)
(root/'.local/adminer/web').mkdir(mode=0o700, parents=True, exist_ok=True)
url = 'https://github.com/vrana/adminer/releases/download/v6.1.2/adminer-6.1.2.php'
digest = 'b32316156bd18ffa99c1a27617142c2e5ad72260e37f15da4e9937a3dbb15f57'
target = directory/'adminer.php'
if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'JIKN-local-development-setup'}), timeout=30).read()
    if hashlib.sha256(data).hexdigest() != digest:
        raise RuntimeError('Digest Adminer tidak cocok. Berkas tidak dipasang.')
    target.write_bytes(data)
    target.chmod(0o600)
(directory/'manifest.json').write_text(json.dumps({'version':'6.1.2','url':url,'sha256':digest},indent=2)+'\n')
print('Adminer resmi 6.1.2 siap; SHA256 sesuai digest rilis. Kode vendor tetap lokal, tanpa kredensial.')
