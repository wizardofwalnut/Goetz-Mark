"""Phase B stage 3: the painted labor screen (decided Oct 18, Art Bible "Labor screen").

Usage: python3 tools/phaseb_labor_screen.py <game.html>   (edits in place)

Replaces LaborScreen's body (pills + TownPlan + fixed stepper) with:
  header row  - county title, or the stepper for the tapped lot
  weapon row  - forge only
  backdrop    - painted grid + quarry/castle patches, crowds (1 per 10, max 12),
                plates "Grain 90 (-23)", red glow when short, blue under idle,
                two cows in the pasture corner, dimmed lots the county lacks.
Overlay coordinates are source pixels of the 1024x1536 painting (= labor_overlay.py).
"""
import sys

COMPONENT = r'''
/**
* The painted labor screen (Phase B, Oct 18).
*
* One overhead painting of the county's working ground on a grid of fenced
* lots, LOTR2-style; the game draws only what changes — who works where.
* Coordinates are pixels of the 1024x1536 source painting; the SVG viewBox is
* the painting, so they stay right at any size. Lots a county lacks are dimmed
* rather than removed, so every county reads as the same familiar place.
*/
var LABOR_W = 1024, LABOR_H = 1536;
var LABOR_LOT_BOX = { mine: [0, 322, 517, 686], castle: [517, 1058, 1024, 1490] };
var LABOR_ZONES = [
	{ zone: "farm", box: [20, 40, 490, 305], crowd: [255, 240], job: "farmer" },
	{ zone: "cattle", box: [545, 40, 1005, 305], crowd: [740, 200], job: "herder" },
	{ zone: "pit", box: [20, 340, 490, 665], crowd: [250, 585], job: "herder" },
	{ zone: "lumberMill", box: [545, 340, 1005, 665], crowd: [760, 590], job: "farmer" },
	{ zone: "blacksmith", box: [20, 705, 490, 1035], crowd: [250, 960], job: "herder" },
	{ zone: "repair", box: [545, 705, 1005, 1035], crowd: [775, 900], job: "farmer" },
	{ zone: "idle", box: [20, 1080, 490, 1460], crowd: [240, 1300], job: "mixed" },
	{ zone: "castle", box: [545, 1080, 1005, 1460], crowd: [775, 1330], job: "farmer" }
];
/** Two cows tucked in the pasture's far corner (Oct 18: "like two in the corner"). */
var LABOR_COWS = [[900, 165], [950, 245]];
/** Drawn heights, fitted by BODY: the farmer's scythe rises over his hat. */
var LABOR_FIG_H = { farmer: 80, herder: 72 };
var LABOR_TIER_KEYS = { woodenPalisade: 1, motteAndBailey: 1, normanKeep: 1, stoneCastle: 1, royalCastle: 1 };
function laborCrowdSpots(n, cx, cy, seed) {
	const k = Math.min(12, Math.ceil(n / 10));
	if (k <= 0) return [];
	const cols = Math.min(k, 4), rows = Math.ceil(k / cols);
	const out = [];
	for (let i = 0; i < k; i++) {
		const r = Math.floor(i / cols), c = i % cols;
		const jx = ((seed * 31 + i * 17) % 13) - 6, jy = ((seed * 7 + i * 29) % 9) - 4;
		out.push({ x: cx + (c - (cols - 1) / 2) * 58 + jx + (r % 2) * 18, y: cy + (r - (rows - 1) / 2) * 40 + jy, i });
	}
	return out.sort((a, b) => a.y - b.y);
}
function LaborBackdrop({ county, zones, idle, selected, onSelect }) {
	const h = import_react.createElement;
	const base = resolveAsset(["labor.backdrop"]);
	const figs = { farmer: laborerArt("farmer"), herder: laborerArt("herder") };
	const cow = cowArt();
	const nodes = [];
	nodes.push(h("defs", { key: "defs" }, h("filter", { id: "lb-glow", x: "-50%", y: "-50%", width: "200%", height: "200%" },
		h("feGaussianBlur", { stdDeviation: 22 }))));
	if (!base.missing) nodes.push(h("image", { key: "base", href: base.url, x: 0, y: 0, width: LABOR_W, height: LABOR_H, preserveAspectRatio: "none" }));
	const patch = (key, box) => {
		const art = resolveAsset([key]);
		if (art.missing) return;
		nodes.push(h("image", { key, href: art.url, x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1], preserveAspectRatio: "none" }));
	};
	const pit = county.interior.industry.find((s) => s.kind === "quarry" || s.kind === "mine");
	if (pit?.kind === "quarry") patch("labor.lot.quarry", LABOR_LOT_BOX.mine);
	if (LABOR_TIER_KEYS[county.castleTier]) patch(`labor.lot.castle.${county.castleTier}`, LABOR_LOT_BOX.castle);
	for (const z of LABOR_ZONES) {
		const info = zones[z.zone];
		const [x0, y0, x1, y1] = z.box;
		const kids = [];
		if (info.absent) kids.push(h("rect", { key: "dim", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 10, fill: "rgb(8 6 4 / .62)" }));
		const short = info.required > 0 && info.workers < info.required ? info.workers - info.required : 0;
		const isIdle = z.zone === "idle";
		const spots = laborCrowdSpots(info.workers, z.crowd[0], z.crowd[1], x0 + y0);
		if ((short || isIdle && info.workers > 0) && spots.length) {
			const cols = Math.min(spots.length, 4), rows = Math.ceil(spots.length / cols);
			kids.push(h("ellipse", { key: "glow", cx: z.crowd[0], cy: z.crowd[1] - 20, rx: 50 + cols * 34, ry: 40 + rows * 24,
				fill: short ? "rgb(230 50 40 / .6)" : "rgb(60 120 255 / .6)", filter: "url(#lb-glow)" }));
		}
		if (z.zone === "cattle" && !cow.missing && (county.herd ?? 0) > 0) LABOR_COWS.forEach(([cx, cy], i) => kids.push(h("g", { key: `cow${i}` }, [
			h("ellipse", { key: "s", cx, cy, rx: 31, ry: 6, fill: "rgb(0 0 0 / .3)" }),
			h("image", { key: "c", href: cow.url, x: cx - 37, y: cy - 74, width: 74, height: 74, preserveAspectRatio: "xMidYMax meet",
				transform: i % 2 ? `translate(${2 * cx} 0) scale(-1 1)` : void 0 })
		])));
		for (const s of spots) {
			const job = z.job === "mixed" ? (s.i % 2 ? "herder" : "farmer") : z.job;
			const art = figs[job];
			if (art.missing) continue;
			const fh = LABOR_FIG_H[job];
			kids.push(h("g", { key: `f${s.i}` }, [
				h("ellipse", { key: "s", cx: s.x, cy: s.y, rx: 19, ry: 5.5, fill: "rgb(0 0 0 / .35)" }),
				h("image", { key: "f", href: art.url, x: s.x - fh / 2, y: s.y - fh, width: fh, height: fh, preserveAspectRatio: "xMidYMax meet" })
			]));
		}
		const label = info.absent ? info.absent : short ? `${info.label}  ${info.workers} (${short})`.replace("(-", "(−") : info.locked && !info.workers ? info.label : `${info.label}  ${info.workers}`;
		const on = !info.absent && (info.workers > 0 || short);
		const fill = short ? "rgb(120 22 18 / .92)" : isIdle ? "rgb(40 70 140 / .92)" : on ? "rgb(52 24 16 / .9)" : "rgb(30 26 22 / .84)";
		const tw = label.length * 21 + 40;
		const px = (x0 + x1) / 2, py = y0 + 46;
		kids.push(h("g", { key: "plate" }, [
			h("rect", { key: "r", x: px - tw / 2, y: py - 30, width: tw, height: 60, rx: 10, fill, stroke: on ? "#e2ba6e" : "#8c785a", strokeWidth: 3 }),
			h("text", { key: "t", x: px, y: py + 1, textAnchor: "middle", dominantBaseline: "middle", fill: "#faeed2",
				style: { font: "700 38px 'Iowan Old Style', Georgia, serif" } }, label)
		]));
		if (selected === z.zone) kids.push(h("rect", { key: "sel", x: x0 + 3, y: y0 + 3, width: x1 - x0 - 6, height: y1 - y0 - 6, rx: 12,
			fill: "none", stroke: "#ffdd78", strokeWidth: 7 }));
		kids.push(h("rect", { key: "tap", x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: "transparent",
			style: { cursor: info.tappable ? "pointer" : "default" },
			onClick: info.tappable ? () => onSelect(z.zone) : void 0 }, h("title", null, label)));
		nodes.push(h("g", { key: z.zone }, kids));
	}
	return h("svg", { className: "ov-labor-paint", viewBox: `0 0 ${LABOR_W} ${LABOR_H}`, preserveAspectRatio: "xMidYMid meet", role: "img",
		"aria-label": `Town centre: ${idle} idle` }, nodes);
}
'''

RETURN_OLD_START = '\treturn h("div", { className: "ov-labor-overlay", ref: shell }, ['
RETURN_NEW = r'''	/**
	* Lot -> job. The castle lot holds whichever building job is live (castle
	* tier, castle repair, ram); when more than one is, the header offers them
	* as tabs. A lot the county lacks is dimmed and can't be tapped.
	*/
	const plotOf = (slot) => plots.find((p) => p.slot === slot) || null;
	const castleJobs = ["castle", "castleRepair", "ram"].map(plotOf).filter((p) => p && !p.locked);
	const pitPlot = quarryOrMine ? plotOf(quarryOrMine.kind) : null;
	const zoneInfo = (plot, extra) => plot ? { label: plot.label, workers: plot.workers, required: plot.required, locked: plot.locked, tappable: true, ...extra } : { label: "", workers: 0, required: 0, tappable: false, ...extra };
	const zones = {
		farm: zoneInfo(plotOf("farm")),
		cattle: zoneInfo(plotOf("cattle")),
		pit: pitPlot ? zoneInfo(pitPlot) : zoneInfo(null, { absent: "No mine" }),
		lumberMill: lumberMill ? zoneInfo(plotOf("lumberMill")) : zoneInfo(null, { absent: "No lumber" }),
		blacksmith: blacksmith ? zoneInfo(plotOf("blacksmith")) : zoneInfo(null, { absent: "No forge" }),
		repair: zoneInfo(plotOf("repair")),
		idle: { label: "Idle", workers: unemployed, required: 0, tappable: false },
		castle: castleJobs.length
			? { label: castleJobs.length === 1 ? castleJobs[0].label : "Building", workers: castleJobs.reduce((n, p) => n + p.workers, 0), required: 0, tappable: true }
			: zoneInfo(plotOf("castle"), { label: "Castle" })
	};
	const slotForZone = (zone) => zone === "pit" ? pitPlot?.slot : zone === "castle" ? (castleJobs[0] ?? plotOf("castle"))?.slot : zone;
	const zoneOfSlot = (slot) => slot === "mine" || slot === "quarry" ? "pit" : slot === "castle" || slot === "castleRepair" || slot === "ram" ? "castle" : slot;
	const proj = chosen ? projectionFor(chosen) : null;
	return h("div", { className: "ov-labor-overlay ov-labor-painted", ref: shell }, [
		h("div", { className: "ov-labor-header", key: "hd" }, chosen ? [
			h("div", { className: "ov-lb-step", key: "s" }, [
				h("strong", { key: "l", className: "ov-lb-name" }, chosen.label),
				h("button", { key: "-", className: "ov-town-btn", "aria-label": `10 fewer on ${chosen.label}`,
					disabled: !owned || chosen.locked || chosen.current <= 0,
					onClick: () => adjustSlot(chosen.slot, chosen.current, -STEP) }, "−"),
				h("span", { key: "v", className: "ov-town-count" }, chosen.current),
				h("button", { key: "+", className: "ov-town-btn", "aria-label": `10 more on ${chosen.label}`,
					disabled: !owned || chosen.locked || unemployed < STEP,
					onClick: () => adjustSlot(chosen.slot, chosen.current, STEP) }, "+"),
				proj ? h("span", { key: "p", className: "ov-lb-proj", title: proj.title }, [
					proj.icon ? h("img", { key: "i", src: proj.icon, alt: "", width: 24, height: 24 }) : null,
					h("span", { key: "t" }, proj.text)
				]) : null
			]),
			h("button", { key: "x", className: "ov-labor-close", "aria-label": "Close", onClick: onClose }, "✕")
		] : [
			h("h2", { key: "t" }, `${countyName ?? countyId} — Town Centre`),
			h("button", { key: "x", className: "ov-labor-close", "aria-label": "Close", onClick: onClose }, "✕")
		]),
		chosen && castleJobs.length > 1 && zoneOfSlot(chosen.slot) === "castle" ? h("div", { className: "ov-labor-weapon-picker", key: "cj" },
			castleJobs.map((p) => h("button", { key: p.slot, className: `ov-labor-weapon-btn${p.slot === chosen.slot ? " selected" : ""}`,
				onClick: () => setSelected(p.slot) }, p.label))) : null,
		chosen && chosen.slot === "blacksmith" && blacksmith && owned ? h("div", { className: "ov-labor-weapon-picker", key: "w" },
			Object.keys(WEAPON_COSTS).map((weapon) => h("button", { key: weapon,
				className: `ov-labor-weapon-btn${blacksmith.weapon === weapon ? " selected" : ""}`,
				onClick: () => pickWeapon(weapon) }, RESOURCE_LABEL[weapon] ?? weapon))) : null,
		chosen && chosen.locked ? h("p", { className: "ov-town-note ov-lb-note", key: "lk" }, "Nothing is being built — start a castle to assign builders.") : null,
		harvestAtRisk ? h("div", { className: "ov-town-warn ov-lb-note", key: "warn" }, "❗ Grain is ripe and nobody is harvesting it") : null,
		h("div", { className: "ov-lb-stage", key: "stage", onClick: (e) => { if (e.target === e.currentTarget) setSelected(null); } },
			h(LaborBackdrop, { county, zones, idle: unemployed, selected: chosen ? zoneOfSlot(chosen.slot) : null,
				onSelect: (zone) => setSelected(slotForZone(zone)) }))
	]);
}
'''

CSS = r'''
/* Painted labor screen (Phase B, Oct 18): header row doubles as the stepper,
   the painting fills whatever height is left, never scrolls. */
.ov-labor-painted .ov-labor-header { padding: 8px 10px; min-height: 52px; gap: 8px; }
.ov-lb-step { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; }
.ov-lb-name { color: #e3bf4a; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.ov-lb-proj { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: #e8dcc0; white-space: nowrap; }
.ov-lb-note { margin: 4px 10px 0 !important; }
.ov-labor-painted .ov-labor-weapon-picker { padding: 6px 10px 0; }
.ov-lb-stage { flex: 1 1 auto; min-height: 0; display: flex; justify-content: center; padding: 6px 8px 8px; }
.ov-labor-paint { width: 100%; height: 100%; display: block; }
'''


def main(p):
    s = open(p, encoding='utf-8').read()
    i = s.index(RETURN_OLD_START)
    j = s.index('\n}\n', i) + 3
    s = s[:i] + RETURN_NEW + s[j:]
    k = s.index('function LaborScreen(')
    s = s[:k] + COMPONENT.lstrip('\n') + s[k:]
    css_at = s.index('.ov-town-stepper {')
    s = s[:css_at] + CSS.lstrip('\n') + '\n' + s[css_at:]
    open(p, 'w', encoding='utf-8').write(s)
    print('labor screen replaced')


if __name__ == '__main__':
    main(sys.argv[1])
