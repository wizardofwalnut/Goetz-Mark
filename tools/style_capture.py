import asyncio,sys,os
sys.path.insert(0,'/tmp/claude-0/-home-claude/002013da-07ce-50a2-97cb-3102483db7d3/scratchpad/s')
from h import *
OUT='/tmp/claude-0/-home-claude/002013da-07ce-50a2-97cb-3102483db7d3/scratchpad/style/shots/'
n=[0]
async def shot(pg,name):
    n[0]+=1; await pg.wait_for_timeout(350); await pg.screenshot(path=f'{OUT}{n[0]:02d}_{name}.png')
async def close(pg):
    for _ in range(4):
        if not await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.offsetParent).find(b=>['✕','Close','Got it','OK','Continue'].includes(b.innerText.trim())||b.getAttribute('aria-label')==='Close');if(b){b.click();return true}return false}"): break
        await pg.wait_for_timeout(250)
async def main():
    async with async_playwright() as p:
        b,pg,errs=await launch(p)
        await pg.goto('file:///home/claude/goetz-mark/aldermarch-single-file/aldermarch-game.html'); await pg.wait_for_timeout(1800)
        await shot(pg,'title')
        await click_text(pg,'New Game'); await pg.wait_for_timeout(600); await shot(pg,'new_game_setup')
        await click_text(pg,'Begin'); await pg.wait_for_timeout(2500); await shot(pg,'first_view_with_tip')
        await click_text(pg,'Got it'); await pg.wait_for_timeout(300); await close(pg); await shot(pg,'map_start')
        await pg.evaluate("()=>{const m=window.__ALDERMARCH_MATCH__;window.__ALDERMARCH_SET_MATCH__({...m,treasuries:{...m.treasuries,p0:{wood:3000,ore:3000,stone:3000,gold:20000}}})}"); await pg.wait_for_timeout(400)
        await pg.evaluate("()=>{try{const s=JSON.parse(localStorage.getItem('aldermarch.settings')||'{}');}catch(e){}}")
        for chip,name in [('👥','population'),('😊','happiness'),('❤','health'),('🏰','castle'),('🤝','diplomacy'),('👑','best_noble')]:
            await pg.evaluate("(c)=>{const e=[...document.querySelectorAll('.ov-figbar-status-chip')].find(x=>x.innerText.includes(c));e&&e.click()}",chip); await pg.wait_for_timeout(600)
            await click_text(pg,'Got it'); await shot(pg,name)
            if name=='castle':
                await pg.evaluate("()=>{const l=[...document.querySelectorAll('.ov-health-section-label')].find(x=>/Siege/.test(x.innerText));l&&l.scrollIntoView({block:'start'})}"); await shot(pg,'castle_siege_engines')
            await close(pg)
        for i,name in enumerate(['grain_report','cattle_report']):
            await pg.evaluate("(i)=>document.querySelectorAll('.ov-figbar-card')[i].click()",i); await pg.wait_for_timeout(500); await click_text(pg,'Got it'); await shot(pg,name); await close(pg)
        await pg.evaluate("()=>{const c=[...document.querySelectorAll('.ov-figbar-stat-card')].find(c=>c.innerText.includes('RATION'));const v=c&&[...c.querySelectorAll('*')].find(e=>e.children.length===0&&/Normal/.test(e.textContent));v&&v.click()}"); await pg.wait_for_timeout(500); await click_text(pg,'Got it'); await shot(pg,'ration'); await close(pg)
        await pg.evaluate("()=>document.querySelector('.ov-res').click()"); await pg.wait_for_timeout(500); await click_text(pg,'Got it'); await shot(pg,'kingdom_resources'); await close(pg)
        await click_text(pg,'🚚\nCARAVAN'); await pg.wait_for_timeout(600); await click_text(pg,'Got it'); await shot(pg,'caravan'); await close(pg)
        await click_text(pg,'⚔️\nLEVY'); await pg.wait_for_timeout(600); await click_text(pg,'Got it'); await shot(pg,'levy'); await close(pg)
        ok=await pg.evaluate("()=>{const m=window.__ALDERMARCH_MATCH__;window.__ALDERMARCH_SET_MATCH__({...m,merchant:{...m.merchant,county:'hollowmere'}});return true}"); await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>x.textContent.startsWith('Merchant caravan — tap'));t&&t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(600); await click_text(pg,'Got it'); await shot(pg,'merchant'); await close(pg)
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>x.textContent.startsWith('Hollowmere town centre'));t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(700); await click_text(pg,'Got it'); await shot(pg,'labor_screen')
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('.ov-labor-painted title')].find(e=>/^Forge/.test(e.textContent.trim()));t&&t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await shot(pg,'labor_forge_picked'); await close(pg)
        ok=await pg.evaluate("()=>{const p=[...document.querySelectorAll('polygon')].find(p=>p.style.cursor==='pointer');if(!p)return false;p.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true}")
        await pg.wait_for_timeout(500); await click_text(pg,'Got it'); await shot(pg,'field_panel'); await close(pg)
        await click_text(pg,'☰'); await pg.wait_for_timeout(400); await shot(pg,'menu')
        for item in ['Save & Load','Event History','Settings']:
            await pg.evaluate("(t)=>{const b=[...document.querySelectorAll('.ov-menu-item')].find(b=>b.innerText.includes(t));b&&b.click()}",item); await pg.wait_for_timeout(500); await click_text(pg,'Got it'); await shot(pg,item.replace(' ','_').replace('&','and')); await close(pg)
            await click_text(pg,'☰'); await pg.wait_for_timeout(300)
        await close(pg)
        # minimap
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('🗺'));b&&b.click()}"); await pg.wait_for_timeout(600); await shot(pg,'minimap'); await close(pg)
        # armies on the map, ZOC, attack prompt, report
        await pg.evaluate("""()=>{const m=window.__ALDERMARCH_MATCH__;const c=m.counties.hollowmere;const t=c.interior.town;
          const cells=c.interior.road.filter(x=>Math.abs(x.col-t.col)+Math.abs(x.row-t.row)>=2).sort((a,b)=>(Math.abs(a.col-t.col)+Math.abs(a.row-t.row))-(Math.abs(b.col-t.col)+Math.abs(b.row-t.row)));
          const a=cells[0];const near=cells.filter(x=>Math.abs(x.col-a.col)+Math.abs(x.row-a.row)===1);
          const mk=(id,owner,troops,at)=>({id,owner,troops,morale:50,location:{kind:'field',county:'hollowmere',col:at.col,row:at.row},movementRemaining:8,unpaidUpkeepTurns:0});
          window.__ALDERMARCH_SET_MATCH__({...m,armies:{...m.armies,KK:mk('KK','p0',{pikemen:100},a),RM:mk('RM','p0',{catapults:30},near[0]),EN:mk('EN','p1',{knights:60},near[1])}})}""")
        await pg.wait_for_timeout(500)
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>/^Your army — 100/.test(x.textContent));t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(500); await click_text(pg,'Got it'); await shot(pg,'army_selected_zoc')
        await pg.evaluate("""()=>{const t=[...document.querySelectorAll('title')].find(x=>/^(?!Your).*army/.test(x.textContent));const tr=t.parentNode.getBoundingClientRect();const tx=tr.x+tr.width/2,ty=tr.y+tr.height*.8;const d=p=>{const r=p.getBoundingClientRect();return Math.hypot(r.x+r.width/2-tx,r.y+r.height/2-ty)};[...document.querySelectorAll('polygon')].filter(p=>/214, 90, 74, 0.4\\)/.test(p.getAttribute('fill')||'')).sort((a,b)=>d(a)-d(b))[0].dispatchEvent(new MouseEvent('click',{bubbles:true}))}""")
        await pg.wait_for_timeout(600); await shot(pg,'attack_prompt')
        await pg.evaluate("()=>[...document.querySelectorAll('.ov-confirm-choices button')].find(b=>b.innerText.startsWith('Brace')).click()"); await pg.wait_for_timeout(700); await click_text(pg,'Got it'); await shot(pg,'battle_report'); await close(pg)
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>/^Your army — 30/.test(x.textContent));t&&t.parentNode.dispatchEvent(new MouseEvent('click',{bubbles:true}))}"); await pg.wait_for_timeout(500); await shot(pg,'engine_selected'); await close(pg)
        # end turn -> season summary
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('End Turn'));b&&b.click()}"); await pg.wait_for_timeout(2200)
        await shot(pg,'season_summary')
        await pg.evaluate("()=>{const b=[...document.querySelectorAll('button')].find(b=>/Standings/.test(b.innerText));b&&b.click()}"); await shot(pg,'season_standings')
        await close(pg); await close(pg); await shot(pg,'map_after_turn')
        # zoomed map views: another county
        await pg.evaluate("()=>{const t=[...document.querySelectorAll('title')].find(x=>x.textContent.startsWith('Marlbrook town centre'));t&&t.scrollIntoView&&0}")
        print('shots',n[0],'errors',errs)
asyncio.run(main())
