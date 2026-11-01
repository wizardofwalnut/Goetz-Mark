# Blender sprite pipeline (test, Oct 31)

Renders 3D models at the game's map camera so every sprite shares one angle, one sun and real shadows.

- Install: `pip install --break-system-packages bpy` (Blender 5.2 as a Python module; ~400 MB, works in the session workspace).
- Camera: orthographic, 45 degrees round, tilted asin(1/1.55) = 40.2 degrees so a ground square renders at the game's 1.55 : 1 diamond.
  Image = SIZE tiles wide at 300 px per tile; the tile centre lands where `MapSprite` anchors a sprite (0.45 tile-heights above the bottom, centred).
- Light: warm sun (1.0, 0.9, 0.76) from the screen's upper left (world -x), 32 degrees up; cool sky fill. Ground is a shadow catcher, so the PNG holds the object plus its shadow on transparency.
- `mine.py`: a hand-built mine (primitives). `render_obj.py --in model.obj|.glb --rotz 0 --tilt 0 --width 1.2`: renders any model.
- `tsr_run.py`: open TripoSR image-to-3D on CPU (venv with torch CPU, transformers==4.46.3 — 5.x renames the ViT weights and fails to load; torchmcubes replaced by scikit-image's marching cubes). About 1 minute per model. Low detail; the real Tripo service is the candidate.
