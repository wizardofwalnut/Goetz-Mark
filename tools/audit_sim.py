'''Invariant audit: 32 headless games x 100 seasons per difficulty.

Usage: python3 tools/audit_sim.py [easy normal hard veryHard]

Checks every county and treasury every season for NaN, negatives, happiness
over 100 and more workers than people (the Oct 22 'overassigned' bug), and
reports outcomes. Needs Playwright (Chromium). Added Oct 22 overnight audit.
'''
import asyncio,sys,json,os
from playwright.async_api import async_playwright
JS=r"""(diff)=>{const S=window.__ALDERMARCH_SIM__;const res={diff,games:0,winsStandIn:0,winsAI:0,undecided:0,endSeason:[],anomalies:{},anomalySamples:[],errors:[],eventKinds:{},maxTroops:0,maxGold:0,popMax:0,healthFlat50:0,woodOre3k:0,stalemates:0,secs:0};
 const t0=Date.now();
 const note=(k,s)=>{res.anomalies[k]=(res.anomalies[k]||0)+1;if(res.anomalySamples.length<12)res.anomalySamples.push(k+': '+s)};
 for(let seed=1;seed<=32;seed++){let m;try{m=S.newMatch({seed,difficulty:diff})}catch(e){res.errors.push('new '+e.message);continue}
  res.games++;let healthSeen=new Set();let lastOwners='';let sameOwners=0;
  for(let t=0;t<100;t++){let r;try{r=S.step(m)}catch(e){res.errors.push(`seed ${seed} t${t}: ${e.message}`.slice(0,200));break}
   m=r.match;for(const e of (r.events||[]))res.eventKinds[e.kind]=(res.eventKinds[e.kind]||0)+1;
   for(const [id,c] of Object.entries(m.counties)){if(!c.interior)continue;
     for(const k of ['population','happiness','health','herd','farmWorkers','cattleWorkers','unrestTurns','taxRate']){const v=c[k];if(typeof v==='number'&&!Number.isFinite(v))note('NaN '+k,`seed ${seed} t${t} ${id}`); if(typeof v==='number'&&v<0)note('neg '+k,`seed ${seed} t${t} ${id} ${v}`)}
     if(c.happiness>100)note('happy>100',`seed ${seed} ${id} ${c.happiness}`);
     const assigned=c.farmWorkers+c.cattleWorkers+(c.repairWorkers||0)+(c.castleWorkers||0)+(c.ramWorkers||0)+(c.castleRepairWorkers||0)+c.interior.industry.reduce((s,x)=>s+(x.workers||0),0);
     if(assigned>c.population+0.5)note('overassigned',`seed ${seed} t${t} ${id} ${assigned}/${c.population}`);
     if(c.owner)res.popMax=Math.max(res.popMax,c.population);
     if(c.owner) healthSeen.add(Math.round(c.health));}
   for(const [pid,tr] of Object.entries(m.treasuries)){for(const [k,v] of Object.entries(tr)){if(!Number.isFinite(v))note('NaN treasury '+k,`seed ${seed} t${t} ${pid}`);if(v< -0.01)note('neg treasury '+k,`seed ${seed} t${t} ${pid} ${v}`)} res.maxGold=Math.max(res.maxGold,tr.gold||0)}
   for(const a of Object.values(m.armies)){for(const [k,v] of Object.entries(a.troops||{})){if(!Number.isFinite(v)||v<0)note('bad troops',`seed ${seed} t${t} ${a.id} ${k}=${v}`)} const n=Object.values(a.troops||{}).reduce((x,y)=>x+y,0);res.maxTroops=Math.max(res.maxTroops,n)}
   const owners=Object.values(m.counties).filter(c=>c.interior).map(c=>c.owner).join();if(owners===lastOwners)sameOwners++;else{sameOwners=0;lastOwners=owners}
   if(m.winner)break;}
  if(m.winner==='p0')res.winsStandIn++;else if(m.winner)res.winsAI++;else{res.undecided++; if(sameOwners>=40)res.stalemates++}
  if(m.winner)res.endSeason.push(m.turn.number);
  if(healthSeen.size<=1)res.healthFlat50++;
  const tr=m.treasuries.p0||{};if((tr.wood||0)>3000||(tr.ore||0)>3000)res.woodOre3k++;}
 res.secs=Math.round((Date.now()-t0)/1000);res.endSeason.sort((a,b)=>a-b);res.medianEnd=res.endSeason[Math.floor(res.endSeason.length/2)]||null;delete res.endSeason;return res}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(); errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        game=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),'aldermarch-single-file','aldermarch-game.html')
        await pg.goto('file://'+game); await pg.wait_for_timeout(1200)
        for d in (sys.argv[1:] or ['easy','normal','hard','veryHard']):
            r=await pg.evaluate(JS,d); r['pageerrors']=errs[:3]
            ek=r.pop('eventKinds'); print(json.dumps(r)); print('  events:',json.dumps(dict(sorted(ek.items(),key=lambda x:-x[1])[:25])))
        await b.close()
asyncio.run(main())
