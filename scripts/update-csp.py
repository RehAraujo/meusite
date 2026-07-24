#!/usr/bin/env python3
"""Atualiza os hashes dos scripts inline usados pela CSP do site estático."""

from __future__ import annotations

import base64
import hashlib
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
HEADERS = ROOT / "_headers"
INLINE_SCRIPT = re.compile(
    r"<script\b(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)
INLINE_HANDLER = re.compile(r"\son[a-z]+\s*=", re.IGNORECASE)


def script_hashes() -> list[str]:
    hashes: set[str] = set()
    violations: list[str] = []

    for html_file in sorted(ROOT.glob("*.html")):
        source = html_file.read_text(encoding="utf-8")
        if INLINE_HANDLER.search(source):
            violations.append(html_file.name)
        for match in INLINE_SCRIPT.finditer(source):
            digest = hashlib.sha256(match.group(1).encode("utf-8")).digest()
            hashes.add(f"'sha256-{base64.b64encode(digest).decode('ascii')}'")

        tracked = subprocess.run(
            ["git", "show", f"HEAD:{html_file.name}"],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if tracked.returncode == 0 and tracked.stdout != source:
            for match in INLINE_SCRIPT.finditer(tracked.stdout):
                digest = hashlib.sha256(match.group(1).encode("utf-8")).digest()
                hashes.add(f"'sha256-{base64.b64encode(digest).decode('ascii')}'")

    if violations:
        names = ", ".join(violations)
        raise SystemExit(f"Handlers inline impedem script-src-attr 'none': {names}")

    return sorted(hashes)


def main() -> None:
    hashes = " ".join(script_hashes())
    policy = (
        "  Content-Security-Policy: default-src 'self'; "
        f"script-src 'self' {hashes}; "
        "script-src-attr 'none'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "media-src 'self'; "
        "object-src 'none'; "
        "frame-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "manifest-src 'self'; "
        "worker-src 'none'; "
        "upgrade-insecure-requests; "
        "block-all-mixed-content"
    )

    source = HEADERS.read_text(encoding="utf-8")
    updated, count = re.subn(
        r"^  Content-Security-Policy:.*$",
        policy,
        source,
        count=1,
        flags=re.MULTILINE,
    )
    if count != 1:
        raise SystemExit("Linha Content-Security-Policy não encontrada em _headers")
    if len(policy.encode("utf-8")) > 2000:
        raise SystemExit("CSP ultrapassa o limite de 2.000 bytes da Cloudflare")

    HEADERS.write_text(updated, encoding="utf-8")
    print(f"CSP atualizada com {len(hashes.split())} hashes ({len(policy)} caracteres).")


if __name__ == "__main__":
    main()
