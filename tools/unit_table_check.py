"""Every unit kind must appear in every per-kind table the battle code reads.

Usage: python3 tools/unit_table_check.py aldermarch-single-file/aldermarch-game.html

Oct 20: `rams` had no COUNTER_BONUS entry (the first battle with a crewed
ram threw) and was missing from both casualty-order lists in
applyCasualties (a crewed ram could never die, so its county never fell).
Both sat unnoticed because no ram had ever fought. Run this alongside
codebase_health_sweep.py after adding or renaming a unit kind.
"""
import re
import sys

s = open(sys.argv[1], encoding='utf-8').read()
units_block = s[s.index('var UNITS = {'):]
units_block = units_block[:units_block.index('\n};')]
kinds = re.findall(r'^\t(\w+): \{', units_block, re.M)
problems = []
cb = s[s.index('var COUNTER_BONUS = {'):]
cb = cb[:cb.index('\n};')]
for k in kinds:
    if not re.search(rf'^\t{k}: \{{', cb, re.M):
        problems.append(f'COUNTER_BONUS has no entry for "{k}"')
fn = s[s.index('function applyCasualties$1('):]
fn = fn[:fn.index('const losses = {}')]
lists = re.findall(r'\[([^\]]*)\]', fn)
for i, lst in enumerate(lists):
    present = set(re.findall(r'"(\w+)"', lst))
    for k in kinds:
        if k not in present:
            problems.append(f'casualty order list {i + 1} is missing "{k}"')
print(f'{len(kinds)} unit kinds: {", ".join(kinds)}')
if problems:
    print('FAIL\n  ' + '\n  '.join(problems))
    sys.exit(1)
print('PASS: every unit kind is in COUNTER_BONUS and both casualty orders')
