"""Play the whole tutorial through the UI at S10e size and report each step.

Usage: python3 tools/tutorial_run.py [path/to/aldermarch-game.html]
Exits non-zero if it gets stuck or the page throws. ~3 minutes. Added Oct 23.
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAME = 'file://' + os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'aldermarch-single-file', 'aldermarch-game.html'))
async def launch(p):
    b = await p.chromium.launch()
    pg = await b.new_page(viewport={'width': 360, 'height': 760}, device_scale_factor=2)
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    return b, pg, errs
async def click_text(pg, t):
    ok = await pg.evaluate("""(t)=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&b.innerText.trim().startsWith(t)).pop(); if(b){b.click();return true}return false}""", t)
    await pg.wait_for_timeout(350)
    return ok
async def card(pg):
    return await pg.evaluate("""()=>{const c=[...document.querySelectorAll('.ov-tut')].find(e=>!e.classList.contains('ov-tip')&&e.getBoundingClientRect().width>0);if(!c)return null;const who=c.querySelector('.ov-tut-who')?.textContent||'';const m=who.match(/(\\d+) of (\\d+)/);return m?[+m[1],+m[2],c.querySelector('.ov-tut-goal')?.textContent||'']:null}""")
async def tips(pg):
    await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>b.innerText.trim()==='Got it');b&&b.click()}"); await pg.wait_for_timeout(150)
async def close(pg):
    for _ in range(4):
        if not await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>['✕','Continue','OK'].includes(b.innerText.trim())||b.getAttribute('aria-label')==='Close');if(b){b.click();return true}return false}"): break
        await pg.wait_for_timeout(200)
async def end_turn(pg):
    await pg.evaluate("()=>[...document.querySelectorAll('button')].find(b=>b.innerText.includes('End Turn')).click()"); await pg.wait_for_timeout(1600); await close(pg)
async def chip(pg,c):
    await pg.evaluate("(c)=>{const e=[...document.querySelectorAll('.ov-figbar-status-chip')].find(x=>x.innerText.includes(c));e&&e.click()}",c); await pg.wait_for_timeout(500); await tips(pg)
async def march(pg,target):
    await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>/^Your army/.test(x.textContent));t&&t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(400)
    await pg.evaluate("""(tg)=>{const town=[...document.querySelectorAll('title')].find(x=>x.textContent.startsWith(tg+' town centre'));const tr=town.parentNode.getBoundingClientRect();const tx=tr.x+tr.width/2,ty=tr.y+tr.height*.8;
      const polys=[...document.querySelectorAll('polygon')].filter(p=>/255, 221, 120|214, 90, 74/.test(p.getAttribute('fill')||''));const d=p=>{const r=p.getBoundingClientRect();return Math.hypot(r.x+r.width/2-tx,r.y+r.height/2-ty)};
      const red=polys.filter(p=>/214, 90, 74/.test(p.getAttribute('fill'))).sort((a,b)=>d(a)-d(b))[0];const go=red&&d(red)<60?red:polys.filter(p=>/255, 221, 120/.test(p.getAttribute('fill'))).sort((a,b)=>d(a)-d(b))[0];go&&go.dispatchEvent(new MouseEvent('click',{bubbles:true}))}""",target)
    await pg.wait_for_timeout(700)
    await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>b.innerText.trim()==='Continue');b&&b.click()}"); await pg.wait_for_timeout(800); await close(pg)
async def main():
    async with async_playwright() as p:
        b,pg,errs=await launch(p)
        await pg.goto(GAME); await pg.wait_for_timeout(1500)
        await click_text(pg,'Tutorial'); await pg.wait_for_timeout(2500)
        log=[]; last=None; stuck=0
        for it in range(120):
            c=await card(pg)
            if not c: log.append('no card'); break
            n,total,title=c
            if (n,title)!=last: log.append(f'{n}/{total} {title}'); last=(n,title); stuck=0
            else: stuck+=1
            if stuck>6:
                dbg=await pg.evaluate("()=>{const c=window.__ALDERMARCH_MATCH__.counties.hollowmere;return {farm:c.farmWorkers,pop:c.population,cattle:c.cattleWorkers,ind:c.interior.industry.map(x=>x.kind+':'+x.workers),grainFields:c.interior.fields.filter(f=>f.status==='grain').length,header:document.querySelector('.ov-labor-header')?.innerText.replace(/\\n/g,' '),need:!!document.querySelector('.ov-lb-need:not([disabled])'),cardText:document.querySelector('.ov-tut:not(.ov-tip)')?.innerText.replace(/\\n/g,' ').slice(0,300)}}")
                log.append(f'  STUCK on {title}: {dbg}'); break
            if title.startswith('Rule the Aldermarch'): log.append('reached the last step'); break
            await tips(pg)
            if await pg.evaluate("()=>!![...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>b.innerText.trim()==='Next')"):
                await click_text(pg,'Next'); continue
            t=title.lower()
            if 'survey' in t: await pg.evaluate("()=>document.querySelector('.ov-minimap-tab').click()"); await pg.wait_for_timeout(400); await pg.evaluate("()=>document.querySelector('.ov-minimap-tab').click()")
            elif 'town centre' in t: await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>x.textContent.startsWith('Hollowmere town centre'));t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(600); await tips(pg)
            elif 'grain fields' in t:
                if not await pg.query_selector('.ov-labor-painted'):
                    await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>x.textContent.startsWith('Hollowmere town centre'));t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(600); await tips(pg)
                await pg.evaluate("()=>{const t=[...document.querySelectorAll('.ov-labor-painted title')].find(e=>/^Mine/.test(e.textContent.trim()));t&&t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(300)
                for _ in range(5):
                    await pg.evaluate("()=>{const b=[...document.querySelectorAll('.ov-labor-header .ov-town-btn')].find(b=>b.innerText.trim()==='−');b&&!b.disabled&&b.click()}"); await pg.wait_for_timeout(250)
                await pg.evaluate("()=>{const t=[...document.querySelectorAll('.ov-labor-painted title')].find(e=>/^Grain/.test(e.textContent.trim()));t&&t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(300)
                await pg.evaluate("()=>{const b=document.querySelector('.ov-lb-need:not([disabled])');b?b.click():[...document.querySelectorAll('.ov-labor-header .ov-town-btn')].find(b=>b.innerText.trim()==='+').click()}"); await pg.wait_for_timeout(400)
            elif 'field' in t:
                await pg.evaluate("()=>{const c=document.querySelector('.ov-labor-close');c&&c.click()}"); await pg.wait_for_timeout(300)
                await pg.evaluate("()=>{const p=[...document.querySelectorAll('polygon[data-field-id]')][0]||[...document.querySelectorAll('polygon')].find(p=>p.style.cursor==='pointer');p&&p.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(500)
            elif t.startswith('end the'): await close(pg); await end_turn(pg)
            elif 'ration' in t: await close(pg); await pg.evaluate("()=>{const c=[...document.querySelectorAll('.ov-figbar-stat-card')].find(c=>c.innerText.includes('RATION'));const v=[...c.querySelectorAll('*')].find(e=>e.children.length===0&&/Normal|Half|Double/.test(e.textContent));v&&v.click()}"); await pg.wait_for_timeout(500)
            elif 'pleases' in t: await close(pg); await chip(pg,'😊')
            elif 'tax' in t:
                await close(pg)
                await pg.evaluate("()=>{const c=[...document.querySelectorAll('.ov-figbar-stat-card')].find(c=>c.innerText.includes('TAX'));[...c.querySelectorAll('button')].find(b=>b.innerText.trim()==='+').click()}"); await pg.wait_for_timeout(250)
            elif 'castle' in t: await close(pg); await chip(pg,'🏰')
            elif 'raise' in t:
                await close(pg); await click_text(pg,'⚔️\nLEVY'); await pg.wait_for_timeout(500); await tips(pg)
                await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>b.innerText.trim()==='25');b&&b.click()}"); await pg.wait_for_timeout(200)
                await click_text(pg,'Raise this levy'); await pg.wait_for_timeout(600); await close(pg)
            elif 'second county' in t:
                await close(pg); await march(pg,'Greyfen')
                if await pg.evaluate("()=>window.__ALDERMARCH_MATCH__.counties.greyfen.owner!=='p0'"): await end_turn(pg)
            elif 'lady aubrey' in t: await close(pg); await chip(pg,'🤝')
            await pg.wait_for_timeout(500)
        print('\n'.join(log)); print('ERRORS',errs)
        ok = any('reached the last step' in l for l in log) and not errs
        sys.exit(0 if ok else 1)
asyncio.run(main())
