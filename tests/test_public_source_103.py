"""Beta 1.0.5: publishing source files publicly must not include Git history/secrets."""
from pathlib import Path

root=Path(__file__).resolve().parents[1]
script=(root/'ci/Package-Source.ps1').read_text(encoding='utf-8')
release=(root/'ci/Publish-Release.ps1').read_text(encoding='utf-8')
notes=(root/'RELEASE_BETA_105_EN.md').read_text(encoding='utf-8')
assert 'git archive --format=zip' in script
assert 'git ls-files' in script
assert 'Get-FileHash' in script
assert 'Potential secret in tracked file' in script
assert 'Refusing to publish a potentially confidential source file' in script
assert "KS-Client-beta-1.0.5-Source.zip" in release
assert "KS-Client-beta-1.0.5-Source.sha256.txt" in release
assert 'Package-Source.ps1' in release
assert 'source-snapshot' in release
assert 'public source-code snapshot' in notes
assert 'KS-Client-beta-1.0.5-Source.zip' in notes
assert 'KS-Client-Updates' in release
print('PASS: Beta 1.0.5 source archive, Git-history exclusion, secret gates and public release integration')
