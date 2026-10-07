#!/usr/bin/env python3
"""Extra health checks for aldermarch-game.html (Lessons Learned items 7 and 8,
plus the unread-manifest-key check found Oct 7).

Usage:  python3 tools/extra_checks.py aldermarch-single-file/aldermarch-game.html

Checks:
  A. Wrong-object name lookups (Lessons #7). Players have .displayName, not
     .name; county names live on REALM.counties, not match.counties. Each hit
     is a place that can show a raw id ("p0", "hollowmere") to the player.
  B. Player-visible strings that read like dev notes or debug labels
     (Lessons #8). Noisy by nature: it flags candidates for a human to read.
  C. Manifest keys the code can never ask for (found Oct 7). Builds the set of
     keys resolveAsset() can be called with (literal keys and `${...}`
     template patterns) and lists manifest keys outside it.

Exit code is always 0: these are reports, not gates. Check A is precise
enough to act on; B is a candidate list. C undercounts: it treats a key as
read if any resolveAsset() call can produce it, even inside a helper nobody
calls. Example: field.* comes from fieldArt(), which has no callers (checked
by hand Oct 7), so the true unread total is 79, not the 73 C prints.
Tested Oct 7 against a planted file: A, B and C each fire on their target.
"""
import re
import sys

ART_PREFIX = "<script>window.__ALDERMARCH_ART__"


def load(path):
    text = open(path, encoding="utf-8").read()
    lines = text.split("\n")
    code = [(i + 1, l) for i, l in enumerate(lines) if not l.startswith(ART_PREFIX)]
    return text, code


def is_comment(line):
    s = line.strip()
    return s.startswith("*") or s.startswith("//") or s.startswith("/*")


# --- A. wrong-object name lookups -------------------------------------------
NAME_PATTERNS = [
    (r"match\.counties\[[^\]]+\]\??\.name\b", "match.counties[..].name — county names live on REALM.counties"),
    (r"\b(owner|holder|player|attacker|defender|winner|loser|you)\??\.name\b", "player .name — players have .displayName"),
    (r"players\[[^\]]+\]\??\.name\b", "players[..].name — players have .displayName"),
    (r"players\.find\([^)]*\)\??\.name\b", "players.find(..).name — players have .displayName"),
]


def check_names(code):
    hits = []
    for n, line in code:
        if is_comment(line):
            continue
        for pat, why in NAME_PATTERNS:
            if re.search(pat, line):
                hits.append((n, why, line.strip()[:150]))
    return hits


# --- B. dev-note strings ------------------------------------------------------
DEV_PHRASES = [
    "natural next step", "once this exists", "not yet implemented", "todo", "fixme",
    "placeholder", "coming soon", "for now", "stub", "debug", "lorem",
    "doesn't yet", "isn't wired", "not wired",
]
STRING_RE = re.compile(r'"((?:[^"\\]|\\.){6,})"|`((?:[^`\\]|\\.){6,})`')


def check_dev_strings(code):
    hits = []
    for n, line in code:
        if is_comment(line) or "console." in line:
            continue
        for m in STRING_RE.finditer(line):
            s = m.group(1) or m.group(2)
            low = s.lower()
            if " " not in s:
                continue  # identifiers, keys, class names
            if any(p in low for p in DEV_PHRASES):
                hits.append((n, s[:150]))
        # debug-looking labels: two bare template numbers joined by " - "
        if re.search(r"\$\{[^}]*length\}\s*-\s*\$\{", line):
            hits.append((n, "debug-looking label: " + line.strip()[:120]))
    return hits


# --- C. unread manifest keys ---------------------------------------------------
def manifest_keys(text):
    m = re.search(r"entries:\s*\{(.*?)\n\t\}", text, re.DOTALL)
    if not m:
        return []
    return re.findall(r'^\t\t"([^"]+)":', m.group(1), re.M)


def readable_patterns(code):
    pats = set()
    for _, line in code:
        # Everything after "resolveAsset(" on the line: covers plain arrays and
        # ternaries like resolveAsset(cond ? [`a.${x}`] : [`b.${y}`]).
        for call in [line[m.end():] for m in re.finditer(r"resolveAsset\(", line)]:
            if call.lstrip().startswith("keys,"):
                continue  # the function definition itself
            for lit in re.findall(r'"([a-zA-Z0-9_.\-]+)"', call):
                pats.add("^" + re.escape(lit) + "$")
            for tpl in re.findall(r"`([^`]+)`", call):
                parts = re.split(r"\$\{[^}]*\}", tpl)
                pats.add("^" + r"[^.]+".join(re.escape(p) for p in parts) + "$")
    return [re.compile(p) for p in pats]


def check_unread_keys(text, code):
    keys = manifest_keys(text)
    pats = readable_patterns(code)
    unread = [k for k in keys if not any(p.match(k) for p in pats)]
    return keys, unread


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return
    text, code = load(sys.argv[1])

    print("=" * 70)
    print("A — Wrong-object name lookups (Lessons #7)")
    print("=" * 70)
    a = check_names(code)
    for n, why, line in a:
        print(f"  L{n}  {why}\n        {line}")
    print(f"  {len(a)} hit(s)" if a else "  none found")

    print("=" * 70)
    print("B — Dev-note / debug strings (Lessons #8) — candidates, read each")
    print("=" * 70)
    b = check_dev_strings(code)
    for n, s in b:
        print(f"  L{n}  {s}")
    print(f"  {len(b)} candidate(s)" if b else "  none found")

    print("=" * 70)
    print("C — Manifest keys the code never asks for")
    print("=" * 70)
    keys, unread = check_unread_keys(text, code)
    groups = {}
    for k in unread:
        g = ".".join(k.split(".")[:2]) if k.startswith("overhead.") else k.split(".")[0]
        groups.setdefault(g, []).append(k)
    for g, ks in sorted(groups.items()):
        print(f"  {g}: {len(ks)}")
    print(f"  {len(unread)} of {len(keys)} manifest keys are never read")


if __name__ == "__main__":
    main()
