#!/usr/bin/env python3
"""Pre-merge validation for this Splunk app. CI runs it on every pull request.

Run it locally from the repo root before pushing:

    python3 ci/validate_app.py                    # all checks (AppInspect if installed)
    python3 ci/validate_app.py --require-appinspect

Checks:
  1. Hygiene: no instance state (local/, local.meta, *.backup) or bytecode is committed.
  2. Secrets: no tokens, Splunk-encrypted secrets, private keys or cleartext
     credentials in tracked files.
  3. Security: REST endpoints require authentication, nothing is exposed through
     web.conf, and Python code does not disable TLS verification without a
     "# ci: allow-insecure-tls" justification comment.
  4. .conf sanity: no duplicate stanzas or keys, no whitespace after a line continuation.
  5. JavaScript syntax (node --check), when node is available.
  6. Package build plus Splunk AppInspect (precert mode). Fails on any failure or error.

Exit code 0 means every check passed.
"""

import argparse
import configparser
import fnmatch
import json
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN = ["local/*", "*/local/*", "metadata/local.meta", "*.backup", "*.pyc", "*__pycache__*", "*.spl", "*.tgz", "*.tar.gz"]
NOT_PACKAGED = ["tests/*", "ci/*", ".github/*", ".gitignore", ".gitattributes"]
VENDORED = ["bin/splunklib/*", "bin/splunk_sdk-*", "appserver/static/javascript/vendor/*"]

SECRET_PATTERNS = {
    "JWT / Splunk auth token": re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "Splunk-encrypted secret ($7$)": re.compile(r"\$7\$[A-Za-z0-9+/=]{20,}"),
    "Private key": re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"),
    "AWS access key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
}
CONF_CREDENTIAL = re.compile(r"^\s*([\w.]*(?:password|passwd|token|secret|api_key|apikey)[\w.]*)\s*=\s*(\S.*)$", re.I)
CONF_CREDENTIAL_ALLOWED_VALUES = {"", "<string>", "<password>"}

failures = []


def fail(check, message):
    failures.append(f"[{check}] {message}")
    print(f"  FAIL {message}")


def matches(path, patterns):
    return any(fnmatch.fnmatch(path, p) for p in patterns)


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout
    return sorted(p for p in out.splitlines() if (ROOT / p).is_file())


def app_id():
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    parser.read(ROOT / "default" / "app.conf")
    return parser.get("package", "id")


def check_hygiene(files):
    print("== Hygiene")
    for path in files:
        if matches(path, FORBIDDEN):
            fail("hygiene", f"{path} must not be committed (instance state, bytecode or build output)")


def check_secrets(files):
    print("== Secrets")
    for path in files:
        if matches(path, VENDORED):
            continue
        try:
            text = (ROOT / path).read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue  # binary file
        for name, pattern in SECRET_PATTERNS.items():
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                fail("secrets", f"{path}:{line}: looks like a {name}")
        if path.endswith(".conf") and not path.startswith("README/"):
            for number, line in enumerate(text.splitlines(), 1):
                m = CONF_CREDENTIAL.match(line)
                if m and not line.lstrip().startswith("#") and m.group(2).strip() not in CONF_CREDENTIAL_ALLOWED_VALUES:
                    fail("secrets", f"{path}:{number}: cleartext credential '{m.group(1)}'; use storage/passwords")


INSECURE_TLS = re.compile(r"verify\s*=\s*False|CERT_NONE|_create_unverified_context|disable_warnings\(")
TLS_ALLOW_MARKER = "ci: allow-insecure-tls"


def check_security(files):
    print("== Security")
    for path in files:
        if path.endswith("restmap.conf"):
            stanza = None
            for number, line in enumerate((ROOT / path).read_text(encoding="utf-8").splitlines(), 1):
                m = re.match(r"^\s*\[(.*)\]\s*$", line)
                if m:
                    stanza = m.group(1)
                elif re.match(r"^\s*requireAuthentication\s*=\s*(false|0|f|no)\s*$", line, re.I):
                    fail("security", f"{path}:{number}: [{stanza}] has requireAuthentication = false (unauthenticated endpoint)")
        if path.endswith("web.conf"):
            for number, line in enumerate((ROOT / path).read_text(encoding="utf-8").splitlines(), 1):
                if re.match(r"^\s*\[expose:", line):
                    fail("security", f"{path}:{number}: exposes a REST endpoint through Splunk Web; call it on the management port instead")
        if path.endswith(".py") and not matches(path, VENDORED + NOT_PACKAGED):
            lines = (ROOT / path).read_text(encoding="utf-8").splitlines()
            for number, line in enumerate(lines, 1):
                if line.lstrip().startswith("#") or not INSECURE_TLS.search(line):
                    continue
                context = " ".join(lines[max(0, number - 6):number])
                if TLS_ALLOW_MARKER not in context:
                    fail("security", f"{path}:{number}: disables TLS verification; add a '# {TLS_ALLOW_MARKER}: <reason>' comment if intended")


def check_conf_files(files):
    print("== .conf sanity")
    stanza_re = re.compile(r"^\s*\[(.*)\]\s*$")
    key_re = re.compile(r"^\s*([^#;=\s][^=]*?)\s*=")
    for path in files:
        if not (path.endswith(".conf") or path.endswith(".meta")) or matches(path, VENDORED):
            continue
        stanzas, keys, stanza = set(), set(), "default"
        continuation = False
        for number, line in enumerate((ROOT / path).read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"\\[ \t]+$", line):
                fail("conf", f"{path}:{number}: whitespace after a line-continuation backslash")
            if continuation:
                continuation = line.endswith("\\")
                continue
            continuation = line.endswith("\\")
            m = stanza_re.match(line)
            if m:
                stanza = m.group(1)
                if stanza in stanzas:
                    fail("conf", f"{path}:{number}: duplicate stanza [{stanza}]")
                stanzas.add(stanza)
                keys = set()
                continue
            k = key_re.match(line)
            if k and not line.lstrip().startswith(("#", ";")):
                if k.group(1) in keys:
                    fail("conf", f"{path}:{number}: duplicate key '{k.group(1)}' in [{stanza}]")
                keys.add(k.group(1))


def check_javascript(files):
    print("== JavaScript syntax")
    node = shutil.which("node")
    scripts = [p for p in files if p.endswith(".js") and p.startswith("appserver/") and not matches(p, VENDORED)]
    if not scripts:
        print("  (no app JavaScript)")
        return
    if not node:
        print("  SKIP node not found")
        return
    with tempfile.TemporaryDirectory() as tmp:
        for index, path in enumerate(scripts):
            # The app mixes ES-module imports with AMD define(); check as a module.
            copy = Path(tmp) / f"{index}.mjs"
            shutil.copyfile(ROOT / path, copy)
            result = subprocess.run([node, "--check", str(copy)], capture_output=True, text=True)
            if result.returncode:
                fail("javascript", f"{path}: {result.stderr.strip().splitlines()[-1]}")


def build_package(files, app, out_dir):
    out_dir.mkdir(parents=True, exist_ok=True)
    package = out_dir / f"{app}.tgz"
    with tarfile.open(package, "w:gz") as tar:
        for path in files:
            if not matches(path, NOT_PACKAGED + FORBIDDEN):
                tar.add(ROOT / path, arcname=f"{app}/{path}")
    return package


def run_appinspect(package, report, required):
    print("== Splunk AppInspect (precert)")
    binary = shutil.which("splunk-appinspect")
    if not binary:
        if required:
            fail("appinspect", "splunk-appinspect not installed (pip install splunk-appinspect)")
        else:
            print("  SKIP splunk-appinspect not installed; CI runs it")
        return
    subprocess.run([binary, "inspect", str(package), "--mode", "precert",
                    "--data-format", "json", "--output-file", str(report)],
                   capture_output=True, text=True)
    if not report.exists():
        fail("appinspect", "AppInspect did not produce a report")
        return
    result = json.loads(report.read_text())["reports"][0]
    summary = result["summary"]
    print(f"  summary: {summary}")
    for group in result["groups"]:
        for check in group["checks"]:
            if check["result"] in ("failure", "error"):
                for message in check["messages"][:3]:
                    fail("appinspect", f"{check['name']}: {message['message'][:300]}")
            elif check["result"] == "warning":
                print(f"  warn {check['name']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--require-appinspect", action="store_true", help="fail if AppInspect is not installed")
    parser.add_argument("--out", default=str(ROOT / "dist"), help="where to write the package and report")
    args = parser.parse_args()

    files = tracked_files()
    app = app_id()
    print(f"Validating {app} ({len(files)} files)")
    check_hygiene(files)
    check_secrets(files)
    check_security(files)
    check_conf_files(files)
    check_javascript(files)
    out = Path(args.out)
    package = build_package(files, app, out)
    print(f"== Package: {package}")
    run_appinspect(package, out / "appinspect_report.json", args.require_appinspect)

    if failures:
        print(f"\n{len(failures)} problem(s) found:")
        for item in failures:
            print(f"  - {item}")
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
