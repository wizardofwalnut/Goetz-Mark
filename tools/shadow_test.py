import sys
SRC='/home/claude/goetz-mark/aldermarch-single-file/aldermarch-game.html'
OUT='/tmp/claude-0/-home-claude/002013da-07ce-50a2-97cb-3102483db7d3/scratchpad/shadow/'
base=open(SRC,encoding='utf8').read()
def variant(name, length, opacity, blur, keep_blobs):
    s=base
    helper=f'''
/** TEST (Oct 31): a cast shadow made from the sprite's own silhouette, thrown down-right by a sun at the upper left (reference look). */
var SHADOW_LEN = {length}, SHADOW_SKEW = {length*2.0}, SHADOW_OPACITY = {opacity};
function castShadowOf(el, key) {{
	const p = el?.props;
	if (!p || !p.art || p.art.missing || !p.art.url || !p.cell) return null;
	const centre = cellCentre(p.cell.col, p.cell.row);
	const w = TILE_W * p.size;
	const x = centre.x - w / 2 + (p.offset?.x ?? 0) * TILE_W;
	const by = centre.y + TILE_H * .45 + (p.offset?.y ?? 0) * TILE_H;
	const bx = x + w / 2;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("image", {{
		href: p.art.url, x, y: by - w, width: w, height: w, preserveAspectRatio: "xMidYMax meet",
		transform: `translate(${{bx}},${{by}}) matrix(1,0,${{-SHADOW_SKEW}},${{-SHADOW_LEN}},0,0) translate(${{-bx}},${{-by}})` + (p.mirror ? ` translate(${{2 * bx}},0) scale(-1,1)` : ""),
		opacity: SHADOW_OPACITY,
		style: {{ filter: "brightness(0) blur({blur}px)", pointerEvents: "none" }}
	}}, key);
}}
function MapSprite({{'''
    s=s.replace('function MapSprite({',helper,1)
    old='''	const shadows = sprites.filter((s) => s.shadow).map((s, i) => {'''
    assert s.count(old)==1
    s=s.replace(old,'''	const silhouettes = sprites.filter((s) => s.shadow && s.el?.type === MapSprite).map((s, i) => castShadowOf(s.el, `cs${i}`)).filter(Boolean);
	const shadows = sprites.filter((s) => s.shadow && '''+('true' if keep_blobs else 's.el?.type !== MapSprite')+''').map((s, i) => {''')
    old='''		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { style: { pointerEvents: "none" }, children: shadows }, "shadows"),'''
    assert s.count(old)==1
    s=s.replace(old,'''		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { style: { pointerEvents: "none" }, children: [...shadows, ...silhouettes] }, "shadows"),''')
    # cows
    old='''				return HERD_ICON_OFFSETS[tier].map((offset, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapSprite, {'''
    assert s.count(old)==1
    s=s.replace(old,'''				return HERD_ICON_OFFSETS[tier].flatMap((offset, i) => { const cow = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapSprite, {''')
    old='''					label: `${state.herd} head of cattle in ${plot.county.name} \\u2014 ${cowsPerField.toFixed(1)} per field`
				}, `${field.id}-cow-${i}`));'''
    assert s.count(old)==1, 'cow end'
    s=s.replace(old,'''					label: `${state.herd} head of cattle in ${plot.county.name} \\u2014 ${cowsPerField.toFixed(1)} per field`
				}, `${field.id}-cow-${i}`); return [castShadowOf(cow, `${field.id}-cowsh-${i}`), cow]; });''')
    open(OUT+name+'.html','w',encoding='utf8').write(s)
variant('soft',0.45,0.30,1.2,False)
variant('strong',0.65,0.40,1.6,False)
print('ok')
