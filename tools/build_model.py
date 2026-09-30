#!/usr/bin/env python3
"""Build assets/body.glb from BodyParts3D.

Source: BodyParts3D (c) The Database Center for Life Science, CC BY-SA 2.1 JP,
via the per-part STL mirror at github.com/Kevin-Mattheus-Moerman/BodyParts3D
(the official DBCLS download lacks latissimus dorsi and rectus abdominis).

Usage (inside a venv with trimesh, numpy, pyfqmr):
    python tools/build_model.py --cache /path/to/cache            # dry run: list parts + download size
    python tools/build_model.py --cache /path/to/cache --build     # download what is missing, write the GLB

Output nodes:
    m|<group>|L / m|<group>|R   clickable muscle groups (see GROUPS)
    ctx|muscle                  other visible muscle, not clickable
    ctx|tendon                  tendons / fascia
(three.js strips ':' '.' '/' '[' ']' from node names, so '|' is the separator.)
    bone                        skeleton
"""
import argparse, csv, json, os, re, struct, sys, urllib.request
from collections import defaultdict

REPO = 'Kevin-Mattheus-Moerman/BodyParts3D'
RAW = f'https://raw.githubusercontent.com/{REPO}/main/'
TREE = f'https://api.github.com/repos/{REPO}/git/trees/main?recursive=1'

# Clickable muscle groups. Keys must match js/muscles.js; names are BodyParts3D
# labels with "left"/"right" removed, lower-case.
GROUPS = {
    'chest-upper':  ['clavicular part of pectoralis major'],
    'chest':        ['sternocostal part of pectoralis major', 'abdominal part of pectoralis major'],
    'delts-front':  ['clavicular part of deltoid'],
    'delts-side':   ['acromial part of deltoid'],
    'delts-rear':   ['spinal part of deltoid'],
    'traps':        ['descending part of trapezius', 'levator scapulae'],
    'upper-back':   ['transverse part of trapezius', 'ascending part of trapezius',
                     'rhomboid major', 'rhomboid minor', 'teres major'],
    'rotator-cuff': ['infraspinatus', 'teres minor', 'supraspinatus'],
    'lats':         ['latissimus dorsi'],
    'lower-back':   ['iliocostalis lumborum', 'iliocostalis thoracis', 'longissimus thoracis',
                     'spinalis thoracis'],
    'biceps':       ['long head of biceps brachii', 'short head of biceps brachii', 'brachialis',
                     'coracobrachialis'],
    'triceps':      ['long head of triceps brachii', 'lateral head of triceps brachii',
                     'medial head of triceps brachii', 'anconeus'],
    'forearms':     ['brachioradialis', 'flexor carpi radialis', 'palmaris longus',
                     'humeral head of flexor carpi ulnaris', 'ulnar head of flexor carpi ulnaris',
                     'humeroulnar head of flexor digitorum superficialis',
                     'radial head of flexor digitorum superficialis', 'flexor digitorum profundus',
                     'flexor pollicis longus', 'extensor carpi radialis longus',
                     'extensor carpi radialis brevis', 'extensor digitorum', 'extensor digiti minimi',
                     'extensor carpi ulnaris', 'abductor pollicis longus', 'extensor pollicis brevis',
                     'extensor pollicis longus', 'extensor indicis', 'humeral head of pronator teres',
                     'ulnar head of pronator teres', 'supinator', 'pronator quadratus'],
    'abs':          ['rectus abdominis', 'pyramidalis'],
    'obliques':     ['external oblique'],
    'serratus':     ['serratus anterior'],
    'glutes':       ['gluteus maximus'],
    'abductors':    ['gluteus medius', 'tensor fasciae latae'],
    'hip-flexors':  ['psoas major', 'iliacus', 'sartorius'],
    'adductors':    ['adductor longus', 'adductor brevis', 'adductor magnus', 'adductor minimus',
                     'gracilis', 'pectineus'],
    'quads':        ['rectus femoris', 'vastus lateralis', 'vastus medialis'],
    'hamstrings':   ['long head of biceps femoris', 'short head of biceps femoris',
                     'semitendinosus', 'semimembranosus'],
    'calves':       ['lateral head of gastrocnemius', 'medial head of gastrocnemius', 'soleus',
                     'plantaris'],
    'shins':        ['tibialis anterior', 'extensor digitorum longus', 'extensor hallucis longus',
                     'fibularis longus', 'fibularis brevis', 'fibularis tertius'],
    'neck':         ['sternocleidomastoid', 'splenius capitis', 'splenius cervicis',
                     'scalenus anterior', 'scalenus medius', 'scalenus posterior',
                     'semispinalis capitis'],
}

# Visible but not clickable: face, hands, feet, deep hip rotators, hyoid strap muscles.
CONTEXT_MUSCLE = [
    'frontalis', 'occipitalis', 'temporalis', 'superficial part of masseter', 'deep part of masseter',
    'orbicularis oris', 'orbital part of orbicularis oculi', 'palpebral part of orbicularis oculi',
    'zygomaticus major', 'zygomaticus minor', 'buccinator', 'depressor anguli oris',
    'depressor labii inferioris', 'levator labii superioris', 'levator labii superioris alaeque nasi',
    'levator anguli oris', 'mentalis', 'nasalis', 'procerus', 'risorius', 'corrugator supercilii',
    'temporoparietalis',
    'sternohyoid', 'sternothyroid', 'omohyoid', 'thyrohyoid', 'anterior belly of digastric',
    'posterior belly of digastric', 'mylohyoid', 'stylohyoid',
    'abductor pollicis brevis', 'opponens pollicis', 'superficial head of flexor pollicis brevis',
    'deep head of flexor pollicis brevis', 'abductor digiti minimi of hand',
    'flexor digiti minimi brevis of hand', 'opponens digiti minimi of hand',
    'set of dorsal interossei of hand', 'set of palmar interossei of hand', 'set of lumbricals of hand',
    'oblique head of adductor pollicis', 'transverse head of adductor pollicis',
    'extensor digitorum brevis', 'extensor hallucis brevis', 'abductor hallucis',
    'abductor digiti minimi of foot', 'flexor digitorum brevis', 'set of dorsal interossei of foot',
    'piriformis', 'gemellus superior', 'gemellus inferior', 'obturator internus', 'quadratus femoris',
    'popliteus', 'external intercostal muscle', 'subclavius',
]
CONTEXT_TENDON = [
    'calcaneal tendon', 'iliotibial tract', 'linea alba', 'aponeurosis of epicranius',
    'flexor retinaculum of wrist', 'inguinal ligament',
]
BONE_RE = re.compile(
    r'\b(femur|tibia|fibula|patella|hip bone|sacrum|humerus|radius|ulna|scapula|clavicle|rib|'
    r'costal cartilage|sternum|manubrium|xiphoid|vertebra|atlas|axis|frontal bone|parietal bone|'
    r'temporal bone|occipital bone|sphenoid|zygomatic bone|maxilla|mandible|nasal bone|ethmoid|'
    r'lacrimal bone|palatine bone|vomer|inferior nasal concha|scaphoid|lunate|triquetral|pisiform|'
    r'trapezium|trapezoid|capitate|hamate|metacarpal|phalanx|calcaneus|talus|navicular|cuboid|'
    r'cuneiform|metatarsal|sesamoid|hyoid bone|tooth)\b')
BONE_EXCLUDE = re.compile(r'intervertebral disk|body of sternum$')

# Triangle budgets after decimation.
BUDGET = {'group': 130_000, 'ctx|muscle': 22_000, 'ctx|tendon': 3_000, 'bone': 45_000}
MIN_TRIS = 250

SIDE_RE = re.compile(r'\b(left|right)\b ?', re.I)


def base_and_side(label):
    m = SIDE_RE.search(label)
    side = m.group(1)[0].upper() if m else None
    base = SIDE_RE.sub('', label).strip().lower()
    return base, side


def fetch(url, dest):
    tmp = dest + '.part'
    with urllib.request.urlopen(url) as r, open(tmp, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(tmp, dest)


def load_index(cache):
    tree_p, fma_p = os.path.join(cache, 'tree.json'), os.path.join(cache, 'FMA.csv')
    if not os.path.exists(tree_p):
        fetch(TREE, tree_p)
    if not os.path.exists(fma_p):
        fetch(RAW + 'assets/BodyParts3D_data/FMA.csv', fma_p)
    names = {r[0]: r[1] for r in csv.reader(open(fma_p))}
    parts = []
    for x in json.load(open(tree_p))['tree']:
        m = re.search(r'/stl/FMA(\d+)\.stl$', x['path'])
        if m and m.group(1) in names:
            parts.append({'fma': m.group(1), 'label': names[m.group(1)], 'path': x['path'], 'size': x['size']})
    return parts


def classify(parts):
    by_base = {}
    for g, bases in GROUPS.items():
        for b in bases:
            by_base[b] = ('group', g)
    for b in CONTEXT_MUSCLE:
        by_base[b] = ('ctx', 'ctx|muscle')
    for b in CONTEXT_TENDON:
        by_base[b] = ('ctx', 'ctx|tendon')
    chosen, seen = [], set()
    for p in parts:
        base, side = base_and_side(p['label'])
        kind = by_base.get(base)
        if kind is None and BONE_RE.search(base) and not BONE_EXCLUDE.search(base):
            kind = ('ctx', 'bone')
        if kind is None:
            continue
        seen.add(base)
        if kind[0] == 'group':
            if not side:
                continue
            node = f'm|{kind[1]}|{side}'
        else:
            node = kind[1]
        chosen.append({**p, 'base': base, 'side': side, 'node': node})
    missing = sorted(b for b in by_base if b not in seen)
    return chosen, missing


def load_stl(path):
    import numpy as np
    with open(path, 'rb') as f:
        data = f.read()
    n = struct.unpack('<I', data[80:84])[0]
    if 84 + n * 50 == len(data):
        rec = np.frombuffer(data[84:84 + n * 50], dtype=np.dtype([('n', '<f4', 3), ('v', '<f4', 9), ('a', '<u2')]))
        tri = rec['v'].reshape(-1, 3, 3).astype(np.float64)
    else:  # ASCII STL
        vs = re.findall(rb'vertex\s+(\S+)\s+(\S+)\s+(\S+)', data)
        tri = np.array(vs, dtype=np.float64).reshape(-1, 3, 3)
    verts, inv = np.unique(tri.reshape(-1, 3).round(4), axis=0, return_inverse=True)
    faces = inv.reshape(-1, 3)
    faces = faces[(faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])]
    return verts, faces


def area(v, f):
    import numpy as np
    a, b, c = v[f[:, 0]], v[f[:, 1]], v[f[:, 2]]
    return 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1).sum()


def decimate(v, f, target):
    import numpy as np, pyfqmr
    if len(f) <= target:
        return v, f
    s = pyfqmr.Simplify()
    s.setMesh(v.astype(np.float64), f.astype(np.int32))
    s.simplify_mesh(target_count=int(target), aggressiveness=7, preserve_border=True, verbose=0)
    v2, f2, _ = s.getMesh()
    return v2, f2


def write_glb(nodes, out):
    """nodes: list of (name, verts float32 Nx3, faces uint32 Mx3). Positions quantised to int16
    (KHR_mesh_quantization), one shared dequantisation transform on a root node."""
    import numpy as np
    allv = np.concatenate([v for _, v, _ in nodes])
    lo, hi = allv.min(0), allv.max(0)
    centre = (lo + hi) / 2
    scale = (hi - lo).max() / 2 / 32767.0
    buf, views, accessors, meshes, children = bytearray(), [], [], [], []

    def add_view(b, target):
        while len(buf) % 4:
            buf.append(0)
        views.append({'buffer': 0, 'byteOffset': len(buf), 'byteLength': len(b), 'target': target})
        buf.extend(b)
        return len(views) - 1

    for name, v, f in nodes:
        q = np.round((v - centre) / scale).clip(-32767, 32767).astype('<i2')
        qp = np.zeros((len(q), 4), dtype='<i2')  # pad to 8 bytes per vertex for alignment
        qp[:, :3] = q
        pv = add_view(qp.tobytes(), 34962)
        views[pv]['byteStride'] = 8
        idx_type = 5123 if len(v) < 65536 else 5125
        ib = f.astype('<u2' if idx_type == 5123 else '<u4').tobytes()
        iv = add_view(ib, 34963)
        accessors.append({'bufferView': pv, 'componentType': 5122, 'count': len(q), 'type': 'VEC3',
                          'min': q.min(0).tolist(), 'max': q.max(0).tolist()})
        accessors.append({'bufferView': iv, 'componentType': idx_type, 'count': int(f.size), 'type': 'SCALAR'})
        meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': len(accessors) - 2},
                                                     'indices': len(accessors) - 1}]})
        children.append(len(children) + 1)
    gltf = {
        'asset': {'version': '2.0', 'generator': 'workout-log build_model.py',
                  'copyright': 'BodyParts3D, (c) The Database Center for Life Science, CC BY-SA 2.1 JP'},
        'extensionsUsed': ['KHR_mesh_quantization'], 'extensionsRequired': ['KHR_mesh_quantization'],
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': 'body', 'children': children, 'scale': [float(scale)] * 3,
                   'translation': centre.astype(float).tolist()}]
                 + [{'name': n, 'mesh': i} for i, (n, _, _) in enumerate(nodes)],
        'meshes': meshes, 'accessors': accessors, 'bufferViews': views,
        'buffers': [{'byteLength': len(buf)}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    while len(buf) % 4:
        buf.append(0)
    with open(out, 'wb') as fh:
        fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
        fh.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        fh.write(struct.pack('<II', len(buf), 0x004E4942) + bytes(buf))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True)
    ap.add_argument('--build', action='store_true')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'assets', 'body.glb'))
    a = ap.parse_args()
    os.makedirs(os.path.join(a.cache, 'stl'), exist_ok=True)
    chosen, missing = classify(load_index(a.cache))

    by_node = defaultdict(list)
    for p in chosen:
        by_node[p['node']].append(p)
    groups_seen = {n.split('|')[1] for n in by_node if n.startswith('m|')}
    print(f'{len(chosen)} parts, {sum(p["size"] for p in chosen) / 1e6:.0f} MB of STL')
    for n in sorted(by_node):
        print(f'  {n:24s} {len(by_node[n]):3d} parts')
    if missing:
        print('Not in the mirror (skipped):', '; '.join(missing))
    lost = set(GROUPS) - groups_seen
    if lost:
        sys.exit(f'Groups with no parts: {sorted(lost)}')
    if not a.build:
        return

    import numpy as np
    meshes = {}
    for i, p in enumerate(chosen):
        dest = os.path.join(a.cache, 'stl', f'FMA{p["fma"]}.stl')
        if not os.path.exists(dest):
            print(f'  fetch {i + 1}/{len(chosen)} {p["label"]}', flush=True)
            fetch(RAW + p['path'], dest)
    for node, ps in by_node.items():
        vs, fs, off = [], [], 0
        for p in ps:
            v, f = load_stl(os.path.join(a.cache, 'stl', f'FMA{p["fma"]}.stl'))
            vs.append(v); fs.append(f + off); off += len(v)
        meshes[node] = [np.concatenate(vs), np.concatenate(fs)]

    # BodyParts3D is millimetres, Z up, -Y anterior. Convert to metres, Y up, +Z anterior.
    for m in meshes.values():
        v = m[0] / 1000.0
        m[0] = np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)
    floor = min(m[0][:, 1].min() for m in meshes.values())
    xs = np.concatenate([m[0][:, 0] for m in meshes.values()])
    zs = np.concatenate([m[0][:, 2] for m in meshes.values()])
    shift = np.array([(xs.min() + xs.max()) / 2, floor, (zs.min() + zs.max()) / 2])
    for m in meshes.values():
        m[0] = m[0] - shift

    # Area-proportional triangle budgets inside each budget class.
    def klass(n):
        return 'group' if n.startswith('m|') else n
    areas = {n: area(*m) for n, m in meshes.items()}
    tot = defaultdict(float)
    for n, ar in areas.items():
        tot[klass(n)] += ar
    out_nodes, report = [], []
    for n in sorted(meshes):
        v, f = meshes[n]
        target = max(MIN_TRIS, BUDGET[klass(n)] * areas[n] / tot[klass(n)])
        v2, f2 = decimate(v, f, target)
        out_nodes.append((n, v2.astype(np.float32), f2.astype(np.uint32)))
        report.append((n, len(f), len(f2)))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    write_glb(out_nodes, a.out)
    for n, f0, f1 in report:
        print(f'  {n:24s} {f0:8d} -> {f1:6d} tris')
    print(f'total {sum(r[2] for r in report)} tris, {os.path.getsize(a.out) / 1e6:.2f} MB -> {a.out}')
    h = max(m[0][:, 1].max() for m in meshes.values())
    print(f'figure height {h:.2f} m')


if __name__ == '__main__':
    main()
