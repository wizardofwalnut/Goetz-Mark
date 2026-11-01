import sys, torch, numpy as np
sys.path.insert(0, '/tmp/claude-0/-home-claude/002013da-07ce-50a2-97cb-3102483db7d3/scratchpad/tsr')
from PIL import Image
from tsr.system import TSR
from tsr.utils import resize_foreground
src, out = sys.argv[1], sys.argv[2]
model = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
model.renderer.set_chunk_size(8192)
im = Image.open(src).convert('RGBA')
im = resize_foreground(im, 0.85)
arr = np.array(im).astype(np.float32) / 255.0
rgb = arr[:, :, :3] * arr[:, :, 3:4] + (1 - arr[:, :, 3:4]) * 0.5
img = Image.fromarray((rgb * 255).astype(np.uint8))
img.save(out + '.input.png')
with torch.no_grad():
    codes = model([img], device='cpu')
meshes = model.extract_mesh(codes, True, resolution=256)
meshes[0].export(out)
print('exported', out, len(meshes[0].vertices))
