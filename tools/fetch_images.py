#!/usr/bin/env python3
"""Download start and halfway photos for each exercise from free-exercise-db (public domain, Unlicense)
into assets/exercises/<id>-0.jpg and -1.jpg, and write data/exercise-images.js.

    python3 tools/fetch_images.py

Source: https://github.com/yuhonas/free-exercise-db
MAP value: (free-exercise-db id, None) for a direct match, or (id, 'note') when the photo shows a
close variant; the note is shown under the photo. Exercises missing from MAP have no photo.
"""
import json, os, shutil, subprocess, urllib.request

RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

MAP = {
    'barbell-bench-press': ('Barbell_Bench_Press_-_Medium_Grip', None),
    'dumbbell-bench-press': ('Dumbbell_Bench_Press', None),
    'machine-chest-press': ('Leverage_Chest_Press', None),
    'parallel-bar-dip': ('Parallel_Bar_Dip', None),
    'cable-crossover': ('Cable_Crossover', None),
    'pec-deck-fly': ('Butterfly', None),
    'decline-bench-press': ('Decline_Barbell_Bench_Press', None),
    'push-up': ('Pushups', None),
    'dumbbell-fly': ('Dumbbell_Flyes', None),
    'incline-dumbbell-press': ('Incline_Dumbbell_Press', None),
    'incline-barbell-press': ('Barbell_Incline_Bench_Press_-_Medium_Grip', None),
    'low-to-high-cable-fly': ('Low_Cable_Crossover', None),
    'incline-smith-press': ('Smith_Machine_Incline_Bench_Press', None),
    'machine-incline-press': ('Leverage_Incline_Chest_Press', None),
    'overhead-press': ('Standing_Military_Press', None),
    'seated-dumbbell-press': ('Dumbbell_Shoulder_Press', None),
    'machine-shoulder-press': ('Leverage_Shoulder_Press', None),
    'arnold-press': ('Arnold_Dumbbell_Press', None),
    'dumbbell-front-raise': ('Front_Dumbbell_Raise', None),
    'cable-lateral-raise': ('Cable_Seated_Lateral_Raise', 'Shown seated with two cables; the movement is the same.'),
    'dumbbell-lateral-raise': ('Side_Lateral_Raise', None),
    'upright-row': ('Upright_Barbell_Row', 'Shown with a narrower grip; keep yours wide and stop at shoulder height.'),
    'reverse-pec-deck': ('Reverse_Machine_Flyes', None),
    'face-pull': ('Face_Pull', None),
    'cable-rear-delt-fly': ('Cable_Rear_Delt_Fly', None),
    'bent-over-reverse-fly': ('Seated_Bent-Over_Rear_Delt_Raise', 'Shown seated and bent over; the arm path is the same.'),
    'cable-external-rotation': ('External_Rotation_with_Cable', None),
    'side-lying-external-rotation': ('External_Rotation', None),
    'band-pull-apart': ('Band_Pull_Apart', None),
    'dumbbell-scaption': ('Dumbbell_Scaption', None),
    'cuban-press': ('Cuban_Press', None),
    'barbell-shrug': ('Barbell_Shrug', None),
    'dumbbell-shrug': ('Dumbbell_Shrug', None),
    'machine-shrug': ('Leverage_Shrug', None),
    'farmers-carry': ('Farmers_Walk', None),
    'rack-pull': ('Rack_Pulls', None),
    'chest-supported-t-bar-row': ('Lying_T-Bar_Row', None),
    'barbell-row': ('Bent_Over_Barbell_Row', None),
    'seated-cable-row': ('Seated_Cable_Rows', None),
    'chest-supported-dumbbell-row': ('Dumbbell_Incline_Row', None),
    'machine-row': ('Leverage_Iso_Row', None),
    'inverted-row': ('Inverted_Row', None),
    'pull-up': ('Pullups', None),
    'chin-up': ('Chin-Up', None),
    'lat-pulldown': ('Wide-Grip_Lat_Pulldown', None),
    'single-arm-dumbbell-row': ('One-Arm_Dumbbell_Row', None),
    'straight-arm-pulldown': ('Straight-Arm_Pulldown', None),
    'dumbbell-pullover': ('Straight-Arm_Dumbbell_Pullover', None),
    'deadlift': ('Barbell_Deadlift', None),
    'romanian-deadlift': ('Romanian_Deadlift', None),
    'back-extension': ('Hyperextensions_Back_Extensions', None),
    'good-morning': ('Good_Morning', None),
    'incline-dumbbell-curl': ('Incline_Dumbbell_Curl', None),
    'ez-bar-curl': ('EZ-Bar_Curl', None),
    'bayesian-cable-curl': ('Standing_One-Arm_Cable_Curl', 'Shown facing the pulley; for the Bayesian version face away so the arm starts behind you.'),
    'preacher-curl': ('Preacher_Curl', None),
    'hammer-curl': ('Hammer_Curls', None),
    'overhead-cable-extension': ('Cable_Rope_Overhead_Triceps_Extension', None),
    'close-grip-bench-press': ('Close-Grip_Barbell_Bench_Press', None),
    'cable-pushdown': ('Triceps_Pushdown_-_Rope_Attachment', None),
    'skull-crusher': ('EZ-Bar_Skullcrusher', None),
    'dumbbell-overhead-extension': ('Seated_Triceps_Press', None),
    'wrist-curl': ('Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench', None),
    'reverse-wrist-curl': ('Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench', None),
    'reverse-curl': ('Reverse_Barbell_Curl', 'Shown with a straight bar; an EZ bar is easier on the wrists.'),
    'dead-hang': ('One_Handed_Hang', 'Shown one-handed with feet down; hang from both hands with feet off the floor.'),
    'hanging-leg-raise': ('Hanging_Leg_Raise', None),
    'cable-crunch': ('Cable_Crunch', None),
    'ab-wheel-rollout': ('Ab_Roller', None),
    'machine-crunch': ('Ab_Crunch_Machine', None),
    'decline-crunch': ('Decline_Crunch', None),
    'plank': ('Plank', None),
    'dead-bug': ('Dead_Bug', None),
    'cable-woodchop': ('Standing_Cable_Wood_Chop', None),
    'pallof-press': ('Pallof_Press', None),
    'side-plank': ('Side_Bridge', None),
    'hanging-oblique-knee-raise': ('Hanging_Leg_Raise', 'Shown as a straight leg raise; bend the knees and bring them toward one shoulder.'),
    'push-up-plus': ('Pushups', 'Shown as a normal push-up; at the top, push further so the shoulder blades spread.'),
    'hip-thrust': ('Barbell_Hip_Thrust', None),
    'bulgarian-split-squat': ('Split_Squat_with_Dumbbells', None),
    'walking-lunge': ('Dumbbell_Lunges', 'Shown as a stationary lunge; step through into the next rep instead.'),
    'cable-kickback': ('One-Legged_Cable_Kickback', None),
    'hip-abduction-machine': ('Thigh_Abductor', None),
    'side-lying-hip-abduction': ('Side_Leg_Raises', 'Shown standing; the leg path is the same lying on your side.'),
    'banded-lateral-walk': ('Monster_Walk', 'Shown stepping forward; step sideways instead.'),
    'cable-hip-flexion': ('Hip_Flexion_with_Band', 'Shown with a band; a cable and ankle cuff works the same way.'),
    'lying-leg-raise': ('Flat_Bench_Lying_Leg_Raise', None),
    'hip-adduction-machine': ('Thigh_Adductor', None),
    'sumo-deadlift': ('Sumo_Deadlift', None),
    'cable-hip-adduction': ('Cable_Hip_Adduction', None),
    'back-squat': ('Barbell_Full_Squat', None),
    'hack-squat': ('Hack_Squat', None),
    'front-squat': ('Front_Barbell_Squat', None),
    'leg-press': ('Leg_Press', None),
    'leg-extension': ('Leg_Extensions', None),
    'goblet-squat': ('Goblet_Squat', None),
    'seated-leg-curl': ('Seated_Leg_Curl', None),
    'lying-leg-curl': ('Lying_Leg_Curls', None),
    'nordic-curl': ('Natural_Glute_Ham_Raise', None),
    'single-leg-rdl': ('Kettlebell_One-Legged_Deadlift', None),
    'standing-calf-raise': ('Standing_Calf_Raises', None),
    'seated-calf-raise': ('Seated_Calf_Raise', None),
    'leg-press-calf-raise': ('Calf_Press_On_The_Leg_Press_Machine', None),
    'single-leg-calf-raise': ('Standing_Dumbbell_Calf_Raise', 'Shown on both legs; do it one leg at a time.'),
    'neck-curl': ('Lying_Face_Up_Plate_Neck_Resistance', None),
    'neck-extension': ('Seated_Head_Harness_Neck_Resistance', None),
    'lateral-neck-flexion': ('Isometric_Neck_Exercise_-_Sides', 'Shown as an isometric hold with the hand; move through the range with a plate instead.'),
}


def shrink(path):
    # 850px originals -> 600px, JPEG quality 55 (about 40 KB each). Uses macOS sips when present.
    if shutil.which('sips'):
        subprocess.run(['sips', '-Z', '600', '-s', 'formatOptions', '55', path], check=True, capture_output=True)


def main():
    out_dir = os.path.join(ROOT, 'assets', 'exercises')
    os.makedirs(out_dir, exist_ok=True)
    data = {}
    for ex, (src, note) in MAP.items():
        for i in (0, 1):
            dest = os.path.join(out_dir, f'{ex}-{i}.jpg')
            if not os.path.exists(dest):
                with urllib.request.urlopen(f'{RAW}{src}/{i}.jpg') as r:
                    open(dest, 'wb').write(r.read())
                shrink(dest)
        data[ex] = {'src': src.replace('_', ' '), 'note': note}
    js = ('// Generated by tools/fetch_images.py. Photos: free-exercise-db (public domain, Unlicense).\n'
          '// Files live at assets/exercises/<id>-0.jpg (start) and -1.jpg (halfway, where the rep turns around).\n'
          'export const IMAGES = ' + json.dumps(data, indent=1) + ';\n')
    open(os.path.join(ROOT, 'data', 'exercise-images.js'), 'w').write(js)
    print(f'{len(data)} exercises with photos')


if __name__ == '__main__':
    main()
