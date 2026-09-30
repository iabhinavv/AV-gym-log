# Credits

## Anatomy model

`assets/body.glb` is derived from **BodyParts3D**, (c) The Database Center for Life Science,
licensed under Creative Commons Attribution-Share Alike 2.1 Japan
(https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en).

Source meshes were taken from the per-part STL mirror maintained by Kevin M. Moerman
(https://github.com/Kevin-Mattheus-Moerman/BodyParts3D, BodyParts3D version 3.0).
`tools/build_model.py` made these changes:
- selected the skeletal muscles and bones
- merged them into 25 left/right muscle groups plus context meshes
- simplified the meshes, reoriented them to metres with Y up, and quantised the positions

As a derivative work, `assets/body.glb` is shared under the same CC BY-SA 2.1 JP licence.

## Software

three.js r169 (`vendor/three/`), (c) three.js authors, MIT licence. See `vendor/three/LICENSE`.

## Exercise content

The exercise guides and rankings were written for this app. The rankings are editorial
and are not medical advice.
