"""Private source snapshot may exist; public update releases contain binaries only."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
script=(root/'ci/Package-Source.ps1').read_text(encoding='utf-8')
release=(root/'ci/Publish-Release.ps1').read_text(encoding='utf-8')
assert 'git archive --format=zip' in script
assert 'git ls-files' in script
assert 'Get-FileHash' in script
assert 'Potential secret in tracked file' in script
assert 'Refusing to publish a potentially confidential source file' in script
assert "KS-Client-beta-1.0.22-Source.zip" in release
assert "KS-Client-beta-1.0.22-Source.sha256.txt" in release
assert 'Package-Source.ps1' in release
assert 'source-snapshot' in release
assert '$publicPaths=' in release
assert 'gh release create $tag @publicPaths --repo $publicRepo' in release
assert 'foreach($required in $publicPaths)' in release
assert "Public release contains forbidden source archive" in release
assert release.count('gh release create $tag @publicPaths --repo $publicRepo')==1
assert release.count('gh release create $tag @paths --repo $publicRepo')==0
assert release.count('$publicPaths=@')==1
assert release.count('} finally {')==1
assert 'KS-Client-Updates' in release
print('PASS: private source package retained, public release excludes source, hash gates preserved')
