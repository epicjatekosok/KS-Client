#!/usr/bin/env python3
"""Generate transparent, reproducible filenames and SHA256 checksums.
This is integrity provenance, not an antivirus scan or publisher signature.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path

root=Path(__file__).resolve().parents[1]
files=[
    "KS-Client-beta-1.0.6-Portable.zip",
    "KS-Client-beta-1.0.6-Setup.exe",
    "CI-TEST-RESULT.txt",
    "SIGNING-STATUS.txt",
]
records=[]
for name in files:
    target=root/name
    if not target.is_file() or target.stat().st_size<1:
        raise SystemExit(f"Release artifact missing or empty: {name}")
    digest=hashlib.sha256()
    with target.open("rb") as stream:
        for block in iter(lambda:stream.read(2*1024*1024),b""):
            digest.update(block)
    records.append({"name":name,"bytes":target.stat().st_size,"sha256":digest.hexdigest()})
manifest={
    "product":"KS Client","version":"1.0.6","release":"beta",
    "source_repo":"epicjatekosok/KS-Client",
    "source_commit":os.getenv("GITHUB_SHA","unknown"),
    "github_run":os.getenv("GITHUB_RUN_ID","local"),
    "generated_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "signing_audit":"SIGNING-STATUS.txt",
    "warning":"SHA256 checks confirm integrity, not absence of malware or Chrome/SmartScreen trust.",
    "files":records,
}
(root/"RELEASE-MANIFEST.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
(root/"SHA256SUMS.txt").write_text("".join(f"{r['sha256']}  {r['name']}\n" for r in records),encoding="utf8")
print("KS release SHA256 generated for "+", ".join(f["name"] for f in records))
