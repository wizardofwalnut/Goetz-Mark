"""Phone-size regression suite for aldermarch-game.html (Playwright, Chromium).

Usage:  python3 tools/regress.py [path/to/aldermarch-game.html]

Plays the real build at the S10e's CSS size (360x760, 2x) and checks the
behaviour fixed during the Oct 20-23 fix-list and audit sessions. Prints
PASS/FAIL per check and exits non-zero on any failure. Takes ~3 minutes.
Built Oct 23 from the session's one-off test scripts.
"""
import asyncio
import json
import os
import re
import sys

from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'aldermarch-single-file', 'aldermarch-game.html')
URL = 'file://' + os.path.abspath(GAME)
BAD_TEXT = re.compile(r'\bundefined\b|\bNaN\b|\[object|Infinity')
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''), flush=True)


# ---------------------------------------------------------------- helpers
async def launch(p):
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': 360, 'height': 760}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    return b, pg, errs


async def tap_button(pg, text, exact=False):
    ok = await pg.evaluate("""([t, exact]) => { const b = [...document.querySelectorAll('button')].filter(b => b.offsetParent)
        .find(b => exact ? b.innerText.trim() === t : b.innerText.trim().startsWith(t)); if (b) { b.click(); return true } return false }""", [text, exact])
    await pg.wait_for_timeout(300)
    return ok


async def tips(pg):
    await tap_button(pg, 'Got it', True)


async def clear(pg):
    for _ in range(6):
        if not await pg.evaluate("""() => { const b = [...document.querySelectorAll('button')].filter(b => b.offsetParent)
            .find(b => ['Continue', 'Got it', 'OK', '✕'].includes(b.innerText.trim()) || b.getAttribute('aria-label') === 'Close'); if (b) { b.click(); return true } return false }"""):
            return
        await pg.wait_for_timeout(200)


async def new_game(pg, difficulty=None):
    await pg.goto(URL)
    await pg.wait_for_timeout(1500)
    await tap_button(pg, 'New Game')
    await pg.wait_for_timeout(500)
    if difficulty:
        await pg.evaluate("(d) => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(d)); b && b.click() }", difficulty)
    await tap_button(pg, 'Begin')
    await pg.wait_for_timeout(2500)


async def state(pg, js):
    return await pg.evaluate("() => { const m = window.__ALDERMARCH_MATCH__; return (" + js + ") }")


async def set_state(pg, js):
    await pg.evaluate("() => { const m = window.__ALDERMARCH_MATCH__; window.__ALDERMARCH_SET_MATCH__(" + js + ") }")
    await pg.wait_for_timeout(400)


RICH = "{...m, treasuries: {...m.treasuries, p0: {wood: 3000, ore: 3000, stone: 3000, gold: 20000}}}"


async def open_town(pg, county='Hollowmere'):
    await pg.evaluate("(c) => { const t = [...document.querySelectorAll('title')].find(x => x.textContent.startsWith(c + ' town centre')); t.parentNode.dispatchEvent(new MouseEvent('click', {bubbles: true})) }", county)
    await pg.wait_for_timeout(600)
    await tips(pg)


async def pick_lot(pg, name):
    await pg.evaluate("(n) => { const t = [...document.querySelectorAll('.ov-labor-painted title')].find(e => e.textContent.trim().startsWith(n)); t.parentNode.dispatchEvent(new MouseEvent('click', {bubbles: true})) }", name)
    await pg.wait_for_timeout(300)


async def long_tasks_during(pg, action, wait=2500):
    await pg.evaluate("() => { window.__lt = []; if (!window.__po) { window.__po = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) }); window.__po.observe({type: 'longtask'}) } }")
    await action()
    await pg.wait_for_timeout(wait)
    return await pg.evaluate("() => window.__lt.splice(0)")


# ---------------------------------------------------------------- checks
async def run(p):
    b, pg, errs = await launch(p)

    await pg.goto(URL)
    await pg.wait_for_timeout(1500)
    titles = await pg.evaluate("() => [...document.querySelectorAll('button')].map(b => b.innerText.trim())")
    check('title screen loads', all(t in titles for t in ['Tutorial', 'New Game', 'Settings']), str(titles[:6]))

    await new_game(pg)
    check('turn 1: no warning strip', not await pg.query_selector('.ov-figbar-warn'))
    await pg.evaluate("() => [...document.querySelectorAll('.ov-figbar-status-chip')].find(x => x.innerText.includes('👥')).click()")
    await pg.wait_for_timeout(400)
    await tips(pg)
    body = await pg.evaluate("() => document.body.innerText")
    check('reports hide "Trend — Last 0 Seasons"', 'Population Report' in body and 'Trend' not in body)
    await clear(pg)

    # owner flags + garrison plates
    flags = await pg.evaluate("() => [...document.querySelectorAll('title')].map(t => t.textContent).filter(t => /— held by/.test(t))")
    plates = await pg.evaluate("() => [...document.querySelectorAll('.ov-troop-plate text')].map(t => t.textContent)")
    check('owner flag on each held county', len(flags) == 2 and any('held by you' in f for f in flags), str(flags))
    check('garrison troop plates', plates == ['12', '12'] or sorted(plates) == ['12', '12'], str(plates))

    # tax 1% steps
    async def tax(sign):
        await pg.evaluate("(s) => { const c = [...document.querySelectorAll('.ov-figbar-stat-card')].find(c => c.innerText.includes('TAX')); [...c.querySelectorAll('button')].find(b => b.innerText.trim() === s).click() }", sign)
        await pg.wait_for_timeout(200)
    t0 = await state(pg, 'm.counties.hollowmere.taxRate')
    await tax('+'); await tax('+')
    t1 = await state(pg, 'm.counties.hollowmere.taxRate')
    await tax('−'); await tax('−')
    check('tax moves in 1% steps', (t0, t1) == (0, 2), f'{t0} -> {t1}')

    # top bar fits at phone width with big numbers
    await set_state(pg, "{...m, treasuries: {...m.treasuries, p0: {wood: 12740, stone: 1010, ore: 9720, gold: 23464}}, counties: {...m.counties, hollowmere: {...m.counties.hollowmere, plagueTurns: 2}}}")
    fit = await pg.evaluate("() => { const t = document.querySelector('.ov-top'); return [t.scrollWidth, t.clientWidth, [...t.querySelectorAll('.ov-num')].map(n => n.textContent)] }")
    check('top bar fits 360 px with big numbers', fit[0] <= fit[1] and '23,464' in fit[2], str(fit))
    await set_state(pg, "{...m, counties: {...m.counties, hollowmere: {...m.counties.hollowmere, plagueTurns: 0}}}")

    # levy Safe max
    await tap_button(pg, '⚔️\nLEVY')
    await pg.wait_for_timeout(500)
    await tips(pg)
    await tap_button(pg, 'Safe max', True)
    txt = await pg.evaluate("() => document.body.innerText")
    m = re.search(r'happiness: (\d+)% → (\d+)%', txt)
    check('levy Safe max stays above unrest', m and int(m.group(2)) > 25 and 'Unrest' not in txt, m.group(0) if m else 'no summary')
    for _ in range(12):
        await pg.evaluate("() => document.querySelector('.ov-labor-stepper').querySelectorAll('.ov-stepper-btn')[1].click()")
        await pg.wait_for_timeout(80)
    check('levy warns past the unrest line', 'Unrest' in await pg.evaluate("() => document.body.innerText"))
    await clear(pg)

    # labor: Need, hold, tap, and the cost of a tap
    await set_state(pg, "{...m, counties: {...m.counties, hollowmere: {...m.counties.hollowmere, farmWorkers: 13}}}")
    await open_town(pg)
    await pick_lot(pg, 'Grain')
    need = await pg.query_selector('.ov-lb-need:not([disabled])')
    if need:
        await need.click()
        await pg.wait_for_timeout(400)
    farm = await state(pg, 'm.counties.hollowmere.farmWorkers')
    check('Fill to need button', need is not None and farm > 13, f'13 -> {farm}')
    plus = (await pg.evaluate_handle("() => [...document.querySelectorAll('.ov-labor-header .ov-town-btn')].find(b => b.innerText.trim() === '+')")).as_element()
    box = await plus.bounding_box()
    await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    await pg.mouse.down(); await pg.wait_for_timeout(1300); await pg.mouse.up(); await pg.wait_for_timeout(300)
    held = await state(pg, 'm.counties.hollowmere.farmWorkers')
    idle = await state(pg, 'm.counties.hollowmere.population - m.counties.hollowmere.farmWorkers - m.counties.hollowmere.cattleWorkers - m.counties.hollowmere.interior.industry.reduce((s, x) => s + (x.workers || 0), 0)')
    check('hold + repeats to the cap', idle == 0, f'{farm} -> {held}, idle {idle}')
    minus = (await pg.evaluate_handle("() => [...document.querySelectorAll('.ov-labor-header .ov-town-btn')].find(b => b.innerText.trim() === '−')")).as_element()

    async def tap_minus():
        await minus.click()
    lt = await long_tasks_during(pg, tap_minus, 2000)
    after = await state(pg, 'm.counties.hollowmere.farmWorkers')
    check('a tap is one step of 10', after == held - 10, f'{held} -> {after}')
    check('a labor tap does not freeze the page (no task > 300 ms)', max(lt or [0]) < 300, f'long tasks {lt}')
    await clear(pg)

    # castle panel: builders button opens labor on the castle lot
    await set_state(pg, "{...m, counties: {...m.counties, hollowmere: {...m.counties.hollowmere, building: {tier: 'normanKeep', workDone: 0}}}}")
    await pg.evaluate("() => [...document.querySelectorAll('.ov-figbar-status-chip')].find(x => x.innerText.includes('🏰')).click()")
    await pg.wait_for_timeout(500)
    await tips(pg)
    ok = await tap_button(pg, '👷 Assign builders')
    await pg.wait_for_timeout(500)
    hdr = await pg.evaluate("() => document.querySelector('.ov-labor-header')?.innerText || ''")
    check('castle "Assign builders" opens the castle lot', ok and hdr.startswith('Ca'), hdr[:40])
    await clear(pg)
    await set_state(pg, "{...m, counties: {...m.counties, hollowmere: {...m.counties.hollowmere, building: null}}}")

    # End Turn: one summary, tabs, no long freeze
    async def end_turn():
        await pg.evaluate("() => [...document.querySelectorAll('button')].find(b => b.innerText.includes('End Turn')).click()")
    lt = await long_tasks_during(pg, end_turn, 3500)
    heads = await pg.evaluate("() => [...document.querySelectorAll('h2')].filter(e => e.offsetParent).map(e => e.textContent)")
    tabs = await pg.evaluate("() => [...document.querySelectorAll('.ov-events-tab')].map(b => b.innerText)")
    check('one season summary after End Turn', len(heads) == 1 and tabs == ['What happened', 'Standings'], f'{heads} {tabs}')
    check('End Turn does not freeze the page (no task > 400 ms)', max(lt or [0]) < 400, f'long tasks {lt}')
    await clear(pg)

    # save -> reload -> continue
    before = await state(pg, 'JSON.stringify(m)')
    await pg.reload(); await pg.wait_for_timeout(1500)
    await tap_button(pg, 'Continue', True); await pg.wait_for_timeout(2500); await clear(pg)
    after = await state(pg, 'JSON.stringify(m)')
    A, B = json.loads(before), json.loads(after)

    def diff(a, b, path=''):
        # Loading fills defaults for fields a live game never set (e.g. an
        # unclaimed county's populationHistory) - absent-before is not a loss.
        if a is None and b is not None:
            return []
        if type(a) != type(b):
            return [path + f' {str(a)[:60]!r} vs {str(b)[:60]!r}']
        if isinstance(a, dict):
            out = []
            for k in set(a) | set(b):
                out += diff(a.get(k), b.get(k), path + '.' + str(k))
            return out
        if isinstance(a, list):
            if len(a) != len(b):
                return [path + f'[len {len(a)}!={len(b)}]']
            out = []
            for i, (x, y) in enumerate(zip(a, b)):
                out += diff(x, y, path + f'[{i}]')
            return out
        return [] if a == b else [path + f' {a!r}->{b!r}']
    lost = diff(A, B)
    check('autosave -> reload -> Continue restores the game', not lost, str(lost[:4]))
    check('no page errors (session 1)', not errs, str(errs[:2]))
    await b.close()

    # a war through the UI: march on Greyfen, assault, capture is logged
    b, pg, errs = await launch(p)
    await new_game(pg, 'Easy')
    await set_state(pg, RICH)
    await tap_button(pg, '⚔️\nLEVY'); await pg.wait_for_timeout(500); await tips(pg)
    await tap_button(pg, 'Safe max', True); await tap_button(pg, 'Raise this levy'); await pg.wait_for_timeout(600); await clear(pg)
    label = None
    for _ in range(10):
        if await state(pg, "m.counties.greyfen.owner === 'p0'"):
            break
        label = await pg.evaluate("() => { const t = [...document.querySelectorAll('title')].find(x => /^Your army/.test(x.textContent)); if (!t) return null; t.parentNode.dispatchEvent(new MouseEvent('click', {bubbles: true})); return t.textContent }")
        await pg.wait_for_timeout(400)
        await pg.evaluate("""() => { const town = [...document.querySelectorAll('title')].find(x => x.textContent.startsWith('Greyfen town centre')); const tr = town.parentNode.getBoundingClientRect(); const tx = tr.x + tr.width / 2, ty = tr.y + tr.height * .8;
            const polys = [...document.querySelectorAll('polygon')].filter(p => /255, 221, 120|214, 90, 74/.test(p.getAttribute('fill') || ''));
            const d = p => { const r = p.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - tx, r.y + r.height / 2 - ty) };
            const red = polys.filter(p => /214, 90, 74/.test(p.getAttribute('fill'))).sort((a, b) => d(a) - d(b))[0];
            const go = red && d(red) < 60 ? red : polys.filter(p => /255, 221, 120/.test(p.getAttribute('fill'))).sort((a, b) => d(a) - d(b))[0];
            go && go.dispatchEvent(new MouseEvent('click', {bubbles: true})) }""")
        await pg.wait_for_timeout(700)
        await tap_button(pg, 'Continue', True); await pg.wait_for_timeout(800)
        await clear(pg)
        if await state(pg, "m.counties.greyfen.owner === 'p0'"):
            break
        await pg.evaluate("() => [...document.querySelectorAll('button')].find(b => b.innerText.includes('End Turn')).click()")
        await pg.wait_for_timeout(1600); await clear(pg)
    check('army label reads "Your army"', bool(label) and label.startswith('Your army'), str(label))
    took = await state(pg, "m.counties.greyfen.owner === 'p0'")
    logged = await state(pg, "(m.eventLog || []).some(e => e.county === 'greyfen' && e.kind === 'conquered')")
    check('march + assault takes Greyfen through the UI', took)
    check('the capture is in Event History', logged)

    # screen tour: no bad text anywhere
    bad = []
    for chip in ['👥', '😊', '❤', '🏰', '🤝', '👑']:
        await pg.evaluate("(c) => { const e = [...document.querySelectorAll('.ov-figbar-status-chip')].find(x => x.innerText.includes(c)); e && e.click() }", chip)
        await pg.wait_for_timeout(450); await tips(pg)
        t = await pg.evaluate("() => document.body.innerText")
        bad += [chip + ':' + x.group(0) for x in BAD_TEXT.finditer(t)]
        await clear(pg)
    for item in ['Save & Load', 'Event History', 'Settings']:
        await tap_button(pg, '☰')
        await pg.evaluate("(t) => { const b = [...document.querySelectorAll('.ov-menu-item')].find(b => b.innerText.includes(t)); b && b.click() }", item)
        await pg.wait_for_timeout(450); await tips(pg)
        t = await pg.evaluate("() => document.body.innerText")
        bad += [item + ':' + x.group(0) for x in BAD_TEXT.finditer(t)]
        await clear(pg)
    check('screen tour: no undefined/NaN text', not bad, str(bad[:4]))
    check('no page errors (session 2)', not errs, str(errs[:2]))
    await b.close()

    # session 3 (Oct 25, d11 ROTK11 combat): one kind per army; a field fight explains itself
    b, pg, errs = await launch(p)
    await new_game(pg, 'Easy'); await clear(pg)
    await set_state(pg, """(() => { const c = m.counties.hollowmere; const t = c.interior.town;
      const cells = c.interior.road.filter(x => Math.abs(x.col - t.col) + Math.abs(x.row - t.row) >= 2).sort((a, b) => (Math.abs(a.col - t.col) + Math.abs(a.row - t.row)) - (Math.abs(b.col - t.col) + Math.abs(b.row - t.row)));
      const a = cells[0]; const near = cells.filter(x => Math.abs(x.col - a.col) + Math.abs(x.row - a.row) === 1);
      const mk = (id, owner, troops, at) => ({id, owner, troops, location: {kind: 'field', county: 'hollowmere', col: at.col, row: at.row}, movementRemaining: 4, unpaidUpkeepTurns: 0});
      return {...m, armies: {...m.armies, KK: {...mk('KK', 'p0', {pikemen: 100}, a), morale: 50}, AR: mk('AR', 'p0', {archers: 30}, near[0]), EN: mk('EN', 'p1', {knights: 60}, near[1])}} })()""")
    async def select_knights():
        await pg.evaluate("() => { const t = [...document.querySelectorAll('title')].find(x => /^Your army — 100/.test(x.textContent)); t.parentNode.dispatchEvent(new MouseEvent('click', {bubbles: true})) }")
        await pg.wait_for_timeout(400)
    async def tap_red_near(title_re):
        await pg.evaluate("""(re) => { const t = [...document.querySelectorAll('title')].find(x => new RegExp(re).test(x.textContent)); const tr = t.parentNode.getBoundingClientRect(); const tx = tr.x + tr.width / 2, ty = tr.y + tr.height * .8;
          const d = p => { const r = p.getBoundingClientRect(); return Math.hypot(r.x + r.width / 2 - tx, r.y + r.height / 2 - ty) };
          [...document.querySelectorAll('polygon')].filter(p => /214, 90, 74/.test(p.getAttribute('fill') || '')).sort((a, b) => d(a) - d(b))[0].dispatchEvent(new MouseEvent('click', {bubbles: true})) }""", title_re)
        await pg.wait_for_timeout(600)
    dialog = "() => { const b = [...document.querySelectorAll('button')].find(b => ['OK', 'Continue'].includes(b.innerText.trim())); return b ? b.parentNode.parentNode.innerText : '' }"
    await select_knights(); await tap_red_near('^Your army — 30')
    refused = await pg.evaluate(dialog)
    check('pikemen and archers refuse to merge, and say why', 'one kind of troop' in refused and await state(pg, "!!m.armies.AR && !!m.armies.KK"), refused[:80])
    await clear(pg)
    await select_knights(); await tap_red_near("^(?!Your).*army")
    offered = await pg.evaluate("() => [...document.querySelectorAll('.ov-confirm-choices button')].map(b => b.innerText.trim())")
    check('the attack prompt offers Attack and Brace for 20 morale', 'Attack' in offered and 'Brace (20 morale)' in offered, str(offered))
    await pg.evaluate("() => [...document.querySelectorAll('.ov-confirm-choices button')].find(b => b.innerText.trim().startsWith('Brace')).click()"); await pg.wait_for_timeout(600)
    told = await pg.evaluate("() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'OK'); return b ? b.parentNode.parentNode.innerText : '' }")
    morale = await state(pg, "m.armies.KK && m.armies.KK.morale")
    check('Brace is used, reported, and costs morale', 'used Brace' in told and 'You lost' in told and morale in (30, 35), f'{told[:70]} morale={morale}')
    check('no page errors (session 3)', not errs, str(errs[:2]))
    await b.close()


async def main():
    async with async_playwright() as p:
        await run(p)
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} passed')
    sys.exit(1 if failed else 0)


asyncio.run(main())
