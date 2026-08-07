"""Verify Prisma declaration uniqueness and exact equivalence to a Git baseline."""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
from collections import defaultdict
from pathlib import Path


DECLARATION = re.compile(r"(?m)^(model|enum)\s+([A-Za-z0-9_]+)\s*\{")


def blocks(text: str) -> dict[tuple[str, str], list[tuple[str, str]]]:
    found: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for match in DECLARATION.finditer(text):
        depth = 0
        end = None
        brace = text.find("{", match.start(), match.end())
        for index in range(brace, len(text)):
            if text[index] == "{":
                depth += 1
            elif text[index] == "}":
                depth -= 1
                if depth == 0:
                    end = index + 1
                    break
        if end is None:
            raise ValueError(f"unclosed {match.group(1)} {match.group(2)}")
        block = text[match.start():end]
        # Git stores normalized LF while Windows checkouts may use CRLF. Newline
        # style is source formatting, not part of the Prisma declaration semantics.
        normalized = block.replace("\r\n", "\n")
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        found[(match.group(1), match.group(2))].append((digest, block))
    return found


def working_tree(root: Path) -> dict[tuple[str, str], list[tuple[str, str]]]:
    result: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for path in sorted((root / "prisma").rglob("*.prisma")):
        for key, values in blocks(path.read_text(encoding="utf-8-sig")).items():
            result[key].extend((digest, str(path.relative_to(root))) for digest, _ in values)
    return result


def git_baseline(root: Path, revision: str) -> dict[tuple[str, str], list[tuple[str, str]]]:
    names = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", revision, "--", "prisma"],
        cwd=root,
        text=True,
    ).splitlines()
    result: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for name in names:
        if not name.endswith(".prisma"):
            continue
        raw = subprocess.check_output(["git", "show", f"{revision}:{name}"], cwd=root)
        for key, values in blocks(raw.decode("utf-8-sig")).items():
            result[key].extend((digest, name) for digest, _ in values)
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", default="HEAD")
    args = parser.parse_args()
    root = Path.cwd()
    current = working_tree(root)
    baseline = git_baseline(root, args.baseline)
    duplicates = {key: values for key, values in current.items() if len(values) != 1}
    missing = sorted(set(baseline) - set(current))
    added = sorted(set(current) - set(baseline))
    changed = sorted(
        key for key in set(current) & set(baseline)
        if len(current[key]) == 1 and len(baseline[key]) == 1
        and current[key][0][0] != baseline[key][0][0]
    )
    models = sum(key[0] == "model" for key in current)
    enums = sum(key[0] == "enum" for key in current)
    duplicate_models = sum(key[0] == "model" for key in duplicates)
    duplicate_enums = sum(key[0] == "enum" for key in duplicates)
    print(f"TOTAL MODELS: {models}")
    print(f"TOTAL ENUMS: {enums}")
    print(f"DUPLICATE MODELS: {duplicate_models}")
    print(f"DUPLICATE ENUMS: {duplicate_enums}")
    print(f"MISSING DECLARATIONS: {len(missing)}")
    print(f"ADDED DECLARATIONS: {len(added)}")
    print(f"CHANGED DECLARATIONS: {len(changed)}")
    for label, values in (("duplicate", sorted(duplicates)), ("missing", missing), ("added", added), ("changed", changed)):
        for kind, name in values:
            print(f"ERROR {label}: {kind} {name}")
    return 1 if duplicates or missing or added or changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
