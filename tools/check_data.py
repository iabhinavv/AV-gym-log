#!/usr/bin/env python3
"""Validate data/exercises.js against js/muscles.js and the muscle nodes in assets/body.glb.

    python3 tools/check_data.py

Fails (exit 1) when an exercise names a muscle that is not in the model, an id is duplicated,
a ranking lists an unknown exercise or one that does not work that muscle, a group has fewer
than 4 exercises, or a required guide field is empty.
"""
import json, os, re, struct, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
read = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

ex_src, mu_src = read('data/exercises.js'), read('js/muscles.js')

muscles = re.findall(r"\{ id: '([a-z-]+)',", mu_src)

glb = open(os.path.join(ROOT, 'assets/body.glb'), 'rb').read()
jlen = struct.unpack('<I', glb[12:16])[0]
nodes = [n.get('name', '') for n in json.loads(glb[20:20 + jlen])['nodes']]
model = {n.split('|')[1] for n in nodes if n.startswith('m|')}

body, rank_src = ex_src.split('export const RANKINGS', 1)
blocks = re.split(r"\n  \{ id: ", body)[1:]
exercises = {}
errors = []
for b in blocks:
    eid = re.match(r"'([a-z0-9-]+)'", b).group(1)
    if eid in exercises:
        errors.append(f'duplicate exercise id {eid}')
    lists = {k: re.findall(r"'([a-z-]+)'", v) for k, v in re.findall(r"\b(p|s|st): \[([^\]]*)\]", b)}
    exercises[eid] = lists
    for k in ('p', 's', 'st'):
        if k not in lists:
            errors.append(f'{eid}: missing {k}')
    if not lists.get('p'):
        errors.append(f'{eid}: no primary muscle')
    for m in sum(lists.values(), []):
        if m not in muscles:
            errors.append(f'{eid}: unknown muscle {m}')
    for field in ('name', 'equipment', 'setup', 'breathe'):
        if not re.search(field + r": ['\"].+?['\"]", b):
            errors.append(f'{eid}: empty {field}')
    for field in ('steps', 'mistakes'):
        if not re.search(field + r": \[\s*['\"]", b):
            errors.append(f'{eid}: empty {field}')

rankings = {m: re.findall(r"'([a-z0-9-]+)'", ids) for m, ids in re.findall(r"'([a-z-]+)':\s*\[([^\]]*)\]", rank_src)}
for m, ids in rankings.items():
    if m not in muscles:
        errors.append(f'RANKINGS: unknown muscle {m}')
    if len(ids) != len(set(ids)):
        errors.append(f'RANKINGS[{m}]: duplicate entries')
    for i in ids:
        if i not in exercises:
            errors.append(f'RANKINGS[{m}]: unknown exercise {i}')
        elif m not in exercises[i]['p'] + exercises[i]['s']:
            errors.append(f'RANKINGS[{m}]: {i} does not work {m} as primary or secondary')

for m in muscles:
    if m not in model:
        errors.append(f'muscle {m} has no mesh in body.glb')
    n = sum(1 for e in exercises.values() if m in e['p'] + e['s'])
    if n < 4:
        errors.append(f'muscle {m} has only {n} exercises')
    if m not in rankings:
        errors.append(f'muscle {m} has no ranking')
for m in model - set(muscles):
    errors.append(f'model group {m} is not in js/muscles.js')

if errors:
    print('\n'.join(errors))
    sys.exit(1)
print(f'ok: {len(exercises)} exercises, {len(muscles)} muscle groups, all present in body.glb')
