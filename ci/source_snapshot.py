#!/usr/bin/env python3
"""Release only audited, byte-for-byte archives of one committed source tree."""
import argparse
import base64
import binascii
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import subprocess
import tarfile
import tempfile
from urllib.request import urlopen
from zipfile import ZipFile

SOURCE_DIRS = {"ci", "electron-app", "installer", "ksui", "launcher", "resources", "tests", "tools", "uninstaller"}
TEXT_SUFFIXES = {".cjs", ".go", ".html", ".js", ".json", ".md", ".mod", ".ps1", ".py", ".sum", ".yaml", ".yml"}
REQUIRED = {
    "README.md", "BUILDING.md", "CONTRIBUTING.md", "SECURITY.md", "LICENSE",
    "THIRD_PARTY_NOTICES.md", ".github/workflows/windows-build.yml",
    "electron-app/main.cjs", "electron-app/preload.cjs", "electron-app/package.json",
    "installer/go.mod", "launcher/go.mod", "uninstaller/go.mod", "ksui/go.mod",
    "ci/Build-Setup.ps1", "ci/Prepare-Electron.ps1", "ci/source_snapshot.py",
}
# These are the only reviewed binary assets in the source. Replace fingerprints
# after inspecting the replacement logo files and their metadata.
LOGOS = {
    "ks-logo.png": "ca7cd61c2c0b14347f8db2ee1f8af4b6ab3372c7399a5d1b5783c97600993cbd",
    "ks-logo.ico": "062334c83cb51b871f9b435b5a6836a5c56b2289c07cbafb612db6a8b1413cc2",
}
SENSITIVE_NAMES = re.compile(
    r"^(?:\.env(?:\..*)?|\.git|\.ssh|\.npmrc|\.netrc|id_(?:rsa|ed25519).*|"
    r"secrets?(?:\..*)?|credentials?(?:\..*)?|cookies?(?:\..*)?|"
    r"session(?:s|storage)?(?:\..*)?|(?:electron)?profiles?|user.data|node_modules|runtime|dist|__pycache__)$", re.I
)
EXTRA_RULES = {
    "certificate or private-key material": re.compile(r"-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CERTIFICATE)-----"),
    "credentials in a URL": re.compile(r"\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s/'\x22:@]+:[^\s/'\x22@]+@", re.I),
    "embedded OAuth secret": re.compile(r"[\x22']?client[_-]?secret[\x22']?\s*[:=]\s*[\x22'][A-Za-z0-9_.-]{16,}[\x22']", re.I),
    "embedded bearer credential": re.compile(r"\bBearer [A-Za-z0-9_./+=-]{32,}", re.I),
}
IMAGE_DATA = re.compile(r"data:image/[A-Za-z0-9.+-]+;base64,([A-Za-z0-9+/=]{32,})")
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_SOURCE_BYTES = 64 * 1024 * 1024

GITLEAKS_VERSION = "8.24.3"
GITLEAKS_DOWNLOADS = {
    "Windows": ("windows_x64.zip", "3f1a35578631dbfe633cc5b49e6c906e55ff14a4bfd7336a10fb27fe33b6dcd2"),
    "Linux": ("linux_x64.tar.gz", "9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c"),
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(repository, *args):
    # Git for Windows may apply checkout line endings to archive entries.
    # Use the committed LF bytes consistently on every build host.
    return subprocess.check_output([
        "git", "--no-replace-objects", "-c", "core.autocrlf=false", "-c", "core.eol=lf",
        "-C", str(repository), *args,
    ])


def source_path(name):
    parts = PurePosixPath(name).parts
    if not parts or name != "/".join(parts) or any(
        not re.fullmatch(r"[a-zA-Z0-9_.-]+", part)
        or part in {".", "..", "/"} or part.endswith(".")
        or re.fullmatch(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?", part, re.I)
        or SENSITIVE_NAMES.fullmatch(part) for part in parts
    ):
        raise ValueError(f"Unsafe source path: {name!r}")
    return parts


def source_tree(repository, commit):
    result = {}
    names = set()
    total = 0
    for entry in git(repository, "ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not entry:
            continue
        metadata, raw_name = entry.split(b"\t", 1)
        mode, kind, oid = metadata.decode("ascii").split()
        name = raw_name.decode("utf-8")
        parts = source_path(name)
        if name.casefold() in names or mode not in {"100644", "100755"} or kind != "blob":
            raise ValueError(f"Duplicate or non-regular source file: {name}")
        names.add(name.casefold())
        parent = "/".join(parts[:-1])
        allowed_text = (
            len(parts) == 1 and (name in {".gitattributes", "LICENSE"} or name.endswith(".md"))
            or parts[:2] == (".github", "workflows") and len(parts) == 3 and name.endswith((".yml", ".yaml"))
            or parts[0] in SOURCE_DIRS and PurePosixPath(name).suffix in TEXT_SUFFIXES
        )
        if not allowed_text and not (parent in {"resources", "electron-app/assets"} and parts[-1] in LOGOS):
            raise ValueError(f"Unreviewed file type or location: {name}")
        size = int(git(repository, "cat-file", "-s", oid))
        total += size
        if size > MAX_FILE_BYTES or total > MAX_SOURCE_BYTES:
            raise ValueError(f"Source size limit exceeded at {name}")
        data = git(repository, "cat-file", "blob", oid)
        if allowed_text:
            contents = data.decode("utf-8-sig")
            if "\0" in contents:
                raise ValueError(f"Binary data in source text: {name}")
            for label, pattern in EXTRA_RULES.items():
                match = pattern.search(contents)
                if match:
                    raise ValueError(f"{label} in {name}:{1 + contents.count(chr(10), 0, match.start())}")
            # Text scanners do not inspect binary metadata hidden in data URIs.
            for match in IMAGE_DATA.finditer(contents):
                try:
                    image = base64.b64decode(match[1], validate=True)
                except binascii.Error as error:
                    raise ValueError(f"Invalid embedded image: {name}") from error
                if sha(image) not in LOGOS.values():
                    raise ValueError(f"Unreviewed embedded image: {name}")
        elif sha(data) != LOGOS[parts[-1]]:
            raise ValueError(f"Unreviewed binary logo: {name}")
        result[name] = data
    missing = REQUIRED - result.keys()
    if missing:
        raise ValueError("Required build or documentation files missing: " + ", ".join(sorted(missing)))
    return result


def check_archive(blob, snapshot, commit):
    with ZipFile(io.BytesIO(blob)) as archive:
        if archive.comment != commit.encode("ascii"):
            raise ValueError("ZIP commit does not match the checkout")
        seen = set()
        directories = {str(parent) for name in snapshot for parent in PurePosixPath(name).parents}
        for entry in archive.infolist():
            name = entry.filename.rstrip("/")
            if name in seen or entry.orig_filename != entry.filename:
                raise ValueError(f"Duplicate or invalid ZIP entry: {name}")
            seen.add(name)
            if entry.is_dir():
                if name not in directories or entry.file_size:
                    raise ValueError(f"Unexpected ZIP directory: {name}")
            elif name not in snapshot or entry.file_size != len(snapshot[name]) or archive.read(entry) != snapshot[name]:
                raise ValueError(f"ZIP differs from committed source: {name}")
        if snapshot.keys() - seen:
            raise ValueError("ZIP is missing committed source files")


def write_source(snapshot, directory):
    directory.mkdir(parents=True, exist_ok=False)
    for name, data in snapshot.items():
        path = directory / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def scan_secrets(directory, temp):
    system = platform.system()
    if system not in GITLEAKS_DOWNLOADS or platform.machine().lower() not in {"x86_64", "amd64"}:
        raise ValueError("The pinned secret scanner requires x64 Windows or Linux")
    suffix, digest = GITLEAKS_DOWNLOADS[system]
    base = f"https://github.com/gitleaks/gitleaks/releases/download/v{GITLEAKS_VERSION}"
    with urlopen(f"{base}/gitleaks_{GITLEAKS_VERSION}_{suffix}", timeout=90) as response:
        package = response.read(20 * 1024 * 1024)
    if sha(package) != digest:
        raise ValueError("Gitleaks download checksum mismatch")
    if system == "Windows":
        executable = temp / "gitleaks.exe"
        with ZipFile(io.BytesIO(package)) as archive:
            executable.write_bytes(archive.read("gitleaks.exe"))
    else:
        executable = temp / "gitleaks"
        with tarfile.open(fileobj=io.BytesIO(package), mode="r:gz") as archive:
            with archive.extractfile("gitleaks") as scanner:
                executable.write_bytes(scanner.read())
        executable.chmod(0o700)
    environment = {key: value for key, value in os.environ.items() if not key.startswith("GITLEAKS_")}
    # Pass an explicit config to prevent a future repository file from silently
    # changing the scanner's defaults or adding an allowlist.
    config = temp / "gitleaks.toml"
    config.write_text("[extend]\nuseDefault = true\n", encoding="utf-8")
    subprocess.run(
        [str(executable), "dir", "--config", str(config), "--redact=100", "--no-banner",
         "--ignore-gitleaks-allow", str(directory)],
        cwd=temp, env=environment, check=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("package", "verify"))
    parser.add_argument("--repository", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--rebuild-directory", type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"\d+\.\d+\.\d+", args.version) or not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        raise ValueError("Expected a numeric version and full lowercase Git commit")
    repository = args.repository.resolve()
    if git(repository, "rev-parse", "HEAD").decode().strip() != args.commit:
        raise ValueError("Requested commit does not match checked-out HEAD")
    snapshot = source_tree(repository, args.commit)
    if json.loads(snapshot["electron-app/package.json"])["version"] != args.version + "-beta":
        raise ValueError("Archived package version differs from release version")
    prefix = f"KS-Client-beta-{args.version}-Source"
    archive_path = args.output / f"{prefix}.zip"
    checksum_path = args.output / f"{prefix}.sha256.txt"
    blob = git(repository, "archive", "--format=zip", args.commit)
    if args.command == "verify" and archive_path.read_bytes() != blob:
        raise ValueError("Source ZIP is not the exact archive generated from the release commit")
    check_archive(blob, snapshot, args.commit)
    checksum = f"{sha(blob)}  {archive_path.name}\n"
    if args.command == "package":
        with tempfile.TemporaryDirectory(prefix="ks-source-audit-") as work:
            temp = Path(work)
            write_source(snapshot, temp / "snapshot")
            scan_secrets(temp / "snapshot", temp)
        if args.rebuild_directory:
            with ZipFile(io.BytesIO(blob)) as archive:
                write_source({name: archive.read(name) for name in snapshot}, args.rebuild_directory)
        args.output.mkdir(parents=True, exist_ok=True)
        archive_path.write_bytes(blob)
        checksum_path.write_text(checksum, encoding="ascii", newline="\n")
    else:
        if checksum_path.read_bytes() != checksum.encode("ascii"):
            raise ValueError("The source checksum file differs from the verified archive")
        if args.rebuild_directory:
            for name, contents in snapshot.items():
                if (args.rebuild_directory / name).read_bytes() != contents:
                    raise ValueError(f"Rebuild inputs changed after verification: {name}")
    print(f"PASS: {archive_path.name}, {len(snapshot)} committed files, commit {args.commit}, SHA256 {sha(blob)}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Source release blocked: {error}") from None
