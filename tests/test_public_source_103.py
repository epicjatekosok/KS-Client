"""Keep the public source release bound to the verified build inputs."""
import importlib.util
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("source_snapshot", root / "ci/source_snapshot.py")
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
commit = "a" * 40
files = {"LICENSE": b"MIT\n", "ci/test.py": b"print(1)\n"}


def make_zip(contents, revision=commit):
    data = BytesIO()
    with ZipFile(data, "w") as archive:
        archive.comment = revision.encode()
        for name, content in contents.items():
            archive.writestr(name, content)
    return data.getvalue()


def rejected(action):
    try:
        action()
    except ValueError:
        return
    raise AssertionError("Unapproved source content passed verification")


source.check_archive(make_zip(files), files, commit)
rejected(lambda: source.check_archive(make_zip(files, "b" * 40), files, commit))
rejected(lambda: source.check_archive(make_zip({"LICENSE": b"altered"}), files, commit))
rejected(lambda: source.check_archive(make_zip({"LICENSE": files["LICENSE"]}), files, commit))
rejected(lambda: source.check_archive(make_zip({**files, ".git/config": b"extra"}), files, commit))
for invalid in ("../license.md", "ci/.env.local", "ci/config:stream", "electron-app/ElectronProfile/a.json", "resources/CON.md"):
    rejected(lambda: source.source_path(invalid))

release = (root / "ci/Publish-Release.ps1").read_text(encoding="utf-8")
workflow = (root / ".github/workflows/windows-build.yml").read_text(encoding="utf-8")
assert "$publicPaths=@($paths)" in release
assert "-Source.zip" in release and "-Source.sha256.txt" in release
assert "gh release create $tag @publicPaths --repo $publicRepo" in release
assert "source_snapshot.py verify" in release and "--target main" in release
assert "working-directory: _verified_source" in workflow and "-RebuildDirectory $rebuild" in workflow
print("PASS: reject altered or misattributed archives and publish only verified source and binaries")
