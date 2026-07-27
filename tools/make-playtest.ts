/**
 * Build self-contained playtest HTML — a DEV TOOL, not shipped game code.
 *
 * Emits single-file pages that run with no server, no build and no network, so
 * they can be handed to a chat assistant on a phone for tuning away from the
 * repo. A strict "one file, no external requests" rule applies: art is inlined
 * as data URIs and there are no script or style tags pointing anywhere.
 *
 * Run with: npm run playtest
 *
 * IMPORTANT — how drift is prevented. The map, unit stats, stance profiles,
 * terrain modifiers and counter table are all IMPORTED FROM SOURCE and injected
 * as JSON. Nothing is retyped here. The combat algorithm is a hand port into
 * plain JS (the page cannot import TypeScript), and is the one thing that could
 * drift — so it is marked as a snapshot in the page itself, and the page's
 * export is designed to be applied back to source rather than edited in place.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALDERMARCH } from '../src/content/maps/aldermarch.generated';
import { UNITS, COUNTER_BONUS, COUNTER_THRESHOLD, MERCENARY_BANDS } from '../src/content/units';
import { FACTIONS } from '../src/content/factions';
import { STANCES } from '../src/domain/combat/battleResolver';
import { TERRAIN_DEFENCE_MODIFIER, TERRAIN_MOVE_COST, ROAD_MOVE_COST } from '../src/domain/map/mapTypes';
import { terrainTint, seatColors, palette } from '../src/ui/theme';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'playtest');
const ART = join(ROOT, 'public', 'art');

/** Inline a PNG as a data URI. Keeps each page to one file, no requests. */
function dataUri(relPath: string): string {
  const buf = readFileSync(join(ART, relPath));
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const SHARED_CSS = `
:root{
  --ink:#0d0b09;--ink-soft:#17130f;--ink-line:#2a231c;
  --parchment:#e8dcc0;--parchment-dim:#d3c4a2;--parchment-shadow:#a4906c;
  --gold:#c9a227;--gold-bright:#e3bf4a;
  --display:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif;
  --numeric:ui-monospace,'SF Mono',Menlo,Consolas,monospace;
  color-scheme:dark;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--ink);color:var(--parchment);font-family:var(--display)}
body{padding:0 0 40px;-webkit-text-size-adjust:100%}
h1{font-size:19px;margin:0}
.wrap{max-width:760px;margin:0 auto;padding:14px}
header{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,#1b1611,#14100c);
  border-bottom:1px solid var(--ink-line);padding:12px 14px}
.sub{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--parchment-shadow);margin-top:3px}
.card{border:1px solid var(--ink-line);border-radius:4px;padding:12px;margin:12px 0;
  background:linear-gradient(180deg,#191410,#120f0c)}
.h2{font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin:0 0 9px}
button{font-family:var(--display);cursor:pointer}
.btn{background:rgba(201,162,39,.1);border:1px solid var(--gold);color:var(--gold-bright);
  padding:10px 12px;border-radius:3px;font-size:14px;width:100%}
.btn:active{background:rgba(201,162,39,.25)}
.chip{background:none;border:1px solid var(--ink-line);color:var(--parchment-shadow);
  font-size:12px;padding:7px 10px;border-radius:3px}
.chip.on{border-color:var(--gold);color:var(--gold-bright);background:rgba(201,162,39,.12)}
.row{display:flex;gap:6px;flex-wrap:wrap}
label{font-size:12px}
input[type=range]{width:100%;accent-color:var(--gold)}
input[type=number]{background:#1d1813;border:1px solid var(--ink-line);color:var(--parchment-dim);
  font-family:var(--numeric);font-size:13px;padding:6px;border-radius:3px;width:100%}
select{background:#1d1813;border:1px solid var(--ink-line);color:var(--parchment-dim);
  font-family:var(--display);font-size:14px;padding:8px;border-radius:3px;width:100%}
.mono{font-family:var(--numeric)}
.muted{color:var(--parchment-shadow)}
.note{font-size:11px;line-height:1.5;color:var(--parchment-shadow);font-style:italic}
img{image-rendering:pixelated}
`;

// ---------------------------------------------------------------------------
// Combat tuner
// ---------------------------------------------------------------------------

function combatTuner(): string {
  const unitIcons = {
    militia: dataUri('unit/militia.png'),
    archers: dataUri('unit/archers.png'),
    knights: dataUri('unit/knights.png'),
    mercenaries: dataUri('unit/mercenaries.png'),
  };
  const stamp = dataUri('ui/wax-stamp.png');

  const constants = JSON.stringify(
    {
      units: UNITS,
      stances: STANCES,
      terrainDefence: TERRAIN_DEFENCE_MODIFIER,
      counterBonus: COUNTER_BONUS,
      counterThreshold: COUNTER_THRESHOLD,
      factions: FACTIONS.map((f) => ({ id: f.id, name: f.name, bonuses: f.bonuses })),
      mercenaryBands: MERCENARY_BANDS,
    },
    null,
    0,
  );

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Aldermarch — Combat Tuner</title>
<style>${SHARED_CSS}
.muster{display:grid;grid-template-columns:22px 66px 1fr 30px;gap:8px;align-items:center;margin:9px 0;font-size:13px}
.muster img{width:22px;height:22px;display:block}
.mname{font-size:12px;color:var(--parchment-dim)}
.cnt{font-family:var(--numeric);font-size:12px;text-align:right;color:var(--parchment-shadow)}
.verdict{display:flex;gap:12px;align-items:center;border:1px solid var(--ink-line);
  border-left:3px solid var(--gold);background:rgba(201,162,39,.07);padding:12px;border-radius:3px;margin:12px 0}
.verdict img{width:40px;height:40px;flex:none}
.vtext{font-size:17px;color:var(--gold-bright)}
.vsub{font-size:11px;color:var(--parchment-shadow);font-family:var(--numeric);margin-top:2px}
.round{border-top:1px solid var(--ink-line);padding:9px 0}
.rn{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin-bottom:5px}
.side{margin-bottom:9px}
.sh{display:flex;justify-content:space-between;font-size:12px;color:var(--parchment-dim)}
.out{font-family:var(--numeric);color:var(--gold-bright)}
.mods{display:flex;flex-wrap:wrap;gap:4px;margin:5px 0}
.mod{font-family:var(--numeric);font-size:10px;padding:2px 5px;border-radius:2px;background:rgba(255,255,255,.04);color:var(--parchment-shadow)}
.up{color:#8fbf7f}.down{color:#c98a7f}
.loss{font-size:11px;color:var(--parchment-shadow);font-style:italic}
.tune{display:grid;grid-template-columns:1fr 62px 62px 62px 62px;gap:6px;align-items:center;font-size:12px;margin:5px 0}
.tune-head{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
.st{display:grid;grid-template-columns:1fr 62px 62px 62px;gap:6px;align-items:center;font-size:12px;margin:5px 0}
textarea{width:100%;height:150px;background:#1d1813;border:1px solid var(--ink-line);
  color:var(--parchment-dim);font-family:var(--numeric);font-size:11px;padding:8px;border-radius:3px}
details{margin-top:8px}summary{cursor:pointer;font-size:12px;color:var(--gold)}
</style></head><body>
<header><h1>Aldermarch — Combat Tuner</h1>
<div class="sub">Auto-resolve · tune, then export</div></header>
<div class="wrap">

<div class="card">
  <p class="note" style="margin:0">Change any number below and the battle re-resolves immediately.
  When it feels right, hit <b>Export tuning</b> and paste the JSON back to Claude Code to apply it
  to the repo. Editing here never touches the repo on its own.</p>
</div>

<div class="card">
  <div class="h2">Attacker</div>
  <div id="atk"></div>
  <div class="row" id="atkStance" style="margin-top:8px"></div>
</div>

<div class="card">
  <div class="h2">Defender</div>
  <div id="def"></div>
  <div class="row" id="defStance" style="margin-top:8px"></div>
</div>

<div class="card">
  <div class="h2">Ground</div>
  <select id="terrain"></select>
  <div class="row" style="margin-top:10px">
    <button class="btn" id="reroll">Re-roll engagement</button>
  </div>
</div>

<div id="result"></div>

<div class="card">
  <div class="h2">Unit stats</div>
  <div class="tune tune-head"><span>Unit</span><span>Atk</span><span>Def</span><span>Hardy</span><span>Upkeep</span></div>
  <div id="unitTune"></div>
</div>

<div class="card">
  <div class="h2">Stances</div>
  <div class="st tune-head"><span>Stance</span><span>Attack</span><span>Taken</span><span>Shield</span></div>
  <p class="note" style="margin:4px 0 8px">Attack multiplies damage dealt · Taken multiplies damage
  received · Shield is the share of casualties archers are spared (0-1).</p>
  <div id="stanceTune"></div>
</div>

<div class="card">
  <div class="h2">Terrain defence</div>
  <div id="terrainTune"></div>
  <div class="h2" style="margin-top:14px">Counter-triangle</div>
  <div id="counterTune"></div>
</div>

<div class="card">
  <div class="h2">Export</div>
  <button class="btn" id="export">Export tuning</button>
  <details><summary>Show JSON</summary><textarea id="json" readonly></textarea></details>
  <p class="note">Paste this to Claude Code with "apply this tuning" — it maps onto
  src/content/units.ts and src/domain/combat/battleResolver.ts.</p>
</div>

<div class="card">
  <p class="note" style="margin:0"><b>Snapshot note.</b> The numbers above were imported from the
  repo at build time, so they match source exactly. The resolve algorithm is a hand port of
  src/domain/combat/battleResolver.ts into plain JS so this page can run with no build step —
  if the resolver changes materially, regenerate this file with <span class="mono">npm run playtest</span>.</p>
</div>

</div>
<script>
const C = ${constants};
const ICONS = ${JSON.stringify(unitIcons)};
const STAMP = ${JSON.stringify(stamp)};
const KINDS = ['militia','archers','knights','mercenaries'];

// Live, editable copies. Reset by reloading the page.
const units = JSON.parse(JSON.stringify(C.units));
const stances = JSON.parse(JSON.stringify(C.stances));
const terrainDef = JSON.parse(JSON.stringify(C.terrainDefence));
const counter = JSON.parse(JSON.stringify(C.counterBonus));
let counterThreshold = C.counterThreshold;

const state = {
  atk:{militia:30,archers:15,knights:5,mercenaries:0},
  def:{militia:25,archers:20,knights:3,mercenaries:0},
  atkStance:'aggressivePush', defStance:'shieldArchers',
  terrain:'hills', roll:0,
};

/* --- seeded rng: same seed, same battle (matches src/domain/rng.ts) --- */
function rng(seed){let s=seed>>>0;const next=()=>{s=(s+0x6d2b79f5)|0;let t=Math.imul(s^(s>>>15),1|s);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
  return {next,range:(a,b)=>a+next()*(b-a)};}
function seedFrom(){const str=[...arguments].join('|');let h=2166136261;
  for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}

const total = r => KINDS.reduce((s,k)=>s+(r[k]||0),0);
const r3 = n => Math.round(n*1000)/1000;

function composition(r){const t=total(r);const o={};for(const k of KINDS)o[k]=t?(r[k]||0)/t:0;return o;}

function counterMods(own,enemy){
  const os=composition(own), es=composition(enemy), out=[];
  for(const k of KINDS){
    if(!os[k]) continue;
    const against = counter[k]||{};
    for(const ek of Object.keys(against)){
      if(es[ek] < counterThreshold) continue;
      out.push({label:units[k].name+' vs '+units[ek].name+'-heavy',
                factor:r3(1+(against[ek]-1)*os[k])});
    }
  }
  return out;
}

function baseOutput(r,attacking){let t=0;
  for(const k of KINDS){const n=r[k]||0; if(n) t+=n*(attacking?units[k].attack:units[k].defence);}
  return t;}

function applyCasualties(troops,damage,archerProtection,R){
  const order = archerProtection>0 ? ['militia','mercenaries','knights','archers']
                                   : ['militia','mercenaries','archers','knights'];
  const losses={}, remaining={...troops};
  let pool = damage * R.range(0.92,1.08);
  for(const k of order){
    if(pool<=0) break;
    const avail = remaining[k]||0; if(!avail) continue;
    const hard = units[k].hardiness;
    const prot = k==='archers' ? 1-archerProtection : 1;
    const killable = Math.floor((pool*prot)/hard);
    const killed = Math.min(avail, Math.max(0,killable));
    if(killed>0){losses[k]=killed; remaining[k]=avail-killed; if(!remaining[k]) delete remaining[k];}
    pool -= (killed*hard)/prot;
  }
  return {losses,remaining};
}

function resolve(input){
  const R = rng(input.seed);
  let A={...input.atk}, D={...input.def};
  const as=stances[input.atkStance], ds=stances[input.defStance];
  const rounds=[];
  const side=(t,e,st,attacking)=>{
    const base=baseOutput(t,attacking); const mods=[];
    if(st.attack!==1) mods.push({label:st.name+' stance',factor:st.attack});
    mods.push(...counterMods(t,e));
    if(!attacking){const f=terrainDef[input.terrain]; if(f!==1) mods.push({label:input.terrain+' terrain',factor:f});}
    return {base,mods,final:mods.reduce((a,m)=>a*m.factor,base)};
  };
  for(let n=1;n<=(input.maxRounds||12);n++){
    if(!total(A)||!total(D)) break;
    const a=side(A,D,as,true), d=side(D,A,ds,false);
    const dh=applyCasualties(D,(a.final*ds.damageTaken)/10,ds.archerProtection,R);
    const ah=applyCasualties(A,(d.final*as.damageTaken)/10,as.archerProtection,R);
    rounds.push({n,
      atk:{base:r3(a.base),mods:a.mods,final:r3(a.final),losses:ah.losses,taken:total(ah.losses)},
      def:{base:r3(d.base),mods:d.mods,final:r3(d.final),losses:dh.losses,taken:total(dh.losses)}});
    A=ah.remaining; D=dh.remaining;
    if(!total(ah.losses)&&!total(dh.losses)) break;
  }
  const al=total(A), dl=total(D);
  let outcome = al===0&&dl===0 ? 'mutualDestruction'
              : dl===0 ? 'attackerWins'
              : al===0 ? 'defenderHolds' : 'stalemate';
  const sub=(a,b)=>{const o={};for(const k of KINDS){const d=(a[k]||0)-(b[k]||0); if(d>0)o[k]=d;}return o;};
  return {outcome,rounds,atkSurv:A,defSurv:D,
          atkLoss:sub(input.atk,A),defLoss:sub(input.def,D),seed:input.seed};
}

/* ------------------------------- rendering ------------------------------- */
const VERDICT={attackerWins:'The field is taken',defenderHolds:'The defence holds',
  mutualDestruction:'Both hosts destroyed',stalemate:'Neither host breaks'};
const describe = r => KINDS.filter(k=>r[k]>0).map(k=>r[k]+' '+units[k].name.toLowerCase()).join(', ');

function musterUI(id,key){
  const el=document.getElementById(id); el.innerHTML='';
  for(const k of KINDS){
    const row=document.createElement('label'); row.className='muster';
    row.innerHTML='<img src="'+ICONS[k]+'" alt=""><span class="mname">'+units[k].name+
      '</span><input type="range" min="0" max="60" value="'+
      (state[key][k]||0)+'"><span class="cnt">'+(state[key][k]||0)+'</span>';
    row.querySelector('input').oninput=e=>{state[key][k]=+e.target.value;
      row.querySelector('.cnt').textContent=e.target.value; render();};
    el.appendChild(row);
  }
}
function stanceUI(id,key){
  const el=document.getElementById(id); el.innerHTML='';
  for(const s of Object.keys(stances)){
    const b=document.createElement('button');
    b.className='chip'+(state[key]===s?' on':''); b.textContent=stances[s].name;
    b.title=stances[s].blurb;
    b.onclick=()=>{state[key]=s; stanceUI(id,key); render();};
    el.appendChild(b);
  }
}

function render(){
  const res=resolve({atk:state.atk,def:state.def,atkStance:state.atkStance,defStance:state.defStance,
    terrain:state.terrain,seed:seedFrom(JSON.stringify(state.atk),JSON.stringify(state.def),state.terrain,state.roll)});
  let h='<div class="verdict"><img src="'+STAMP+'" alt=""><div><div class="vtext">'+VERDICT[res.outcome]+
    '</div><div class="vsub">Attacker lost '+total(res.atkLoss)+' · Defender lost '+total(res.defLoss)+
    ' · '+res.rounds.length+' rounds</div></div></div><div class="card">';
  if(!res.rounds.length) h+='<p class="note">No engagement — one side had nothing in the field.</p>';
  for(const r of res.rounds){
    h+='<div class="round"><div class="rn">Round '+r.n+'</div>';
    for(const [lbl,s] of [['Attacker',r.atk],['Defender',r.def]]){
      h+='<div class="side"><div class="sh"><span>'+lbl+'</span><span class="out">'+s.final+'</span></div><div class="mods"><span class="mod">base '+s.base+'</span>';
      for(const m of s.mods) h+='<span class="mod '+(m.factor>=1?'up':'down')+'">'+m.label+' ×'+m.factor+'</span>';
      h+='</div><div class="loss">'+(s.taken===0?'no losses':'−'+s.taken+': '+describe(s.losses))+'</div></div>';
    }
    h+='</div>';
  }
  h+='<div class="round"><div class="rn">Survivors</div><div class="loss">Attacker: '+
     (total(res.atkSurv)?describe(res.atkSurv):'annihilated')+'<br>Defender: '+
     (total(res.defSurv)?describe(res.defSurv):'annihilated')+'</div></div></div>';
  document.getElementById('result').innerHTML=h;
  document.getElementById('json').value=exportJson();
}

function numInput(get,set){
  const i=document.createElement('input'); i.type='number'; i.step='0.05'; i.value=get();
  i.oninput=()=>{const v=parseFloat(i.value); if(!isNaN(v)){set(v); render();}};
  return i;
}
function unitTuneUI(){
  const el=document.getElementById('unitTune'); el.innerHTML='';
  for(const k of KINDS){
    const row=document.createElement('div'); row.className='tune';
    const name=document.createElement('span'); name.textContent=units[k].name; row.appendChild(name);
    row.appendChild(numInput(()=>units[k].attack,v=>units[k].attack=v));
    row.appendChild(numInput(()=>units[k].defence,v=>units[k].defence=v));
    row.appendChild(numInput(()=>units[k].hardiness,v=>units[k].hardiness=v));
    row.appendChild(numInput(()=>units[k].upkeep,v=>units[k].upkeep=v));
    el.appendChild(row);
  }
}
function stanceTuneUI(){
  const el=document.getElementById('stanceTune'); el.innerHTML='';
  for(const s of Object.keys(stances)){
    const row=document.createElement('div'); row.className='st';
    const n=document.createElement('span'); n.textContent=stances[s].name; row.appendChild(n);
    row.appendChild(numInput(()=>stances[s].attack,v=>stances[s].attack=v));
    row.appendChild(numInput(()=>stances[s].damageTaken,v=>stances[s].damageTaken=v));
    row.appendChild(numInput(()=>stances[s].archerProtection,v=>stances[s].archerProtection=v));
    el.appendChild(row);
  }
}
function terrainTuneUI(){
  const el=document.getElementById('terrainTune'); el.innerHTML='';
  for(const t of Object.keys(terrainDef)){
    const row=document.createElement('div'); row.className='st';
    const n=document.createElement('span'); n.textContent=t; row.appendChild(n);
    row.appendChild(numInput(()=>terrainDef[t],v=>terrainDef[t]=v));
    el.appendChild(row);
  }
  const ct=document.getElementById('counterTune'); ct.innerHTML='';
  for(const k of Object.keys(counter)){
    for(const ek of Object.keys(counter[k])){
      const row=document.createElement('div'); row.className='st';
      const n=document.createElement('span'); n.textContent=units[k].name+' vs '+units[ek].name; row.appendChild(n);
      row.appendChild(numInput(()=>counter[k][ek],v=>counter[k][ek]=v));
      ct.appendChild(row);
    }
  }
  const row=document.createElement('div'); row.className='st';
  const n=document.createElement('span'); n.textContent='threshold'; row.appendChild(n);
  row.appendChild(numInput(()=>counterThreshold,v=>counterThreshold=v));
  ct.appendChild(row);
}

function exportJson(){
  const u={}; for(const k of KINDS) u[k]={attack:units[k].attack,defence:units[k].defence,
    hardiness:units[k].hardiness,upkeep:units[k].upkeep};
  const s={}; for(const k of Object.keys(stances)) s[k]={attack:stances[k].attack,
    damageTaken:stances[k].damageTaken,archerProtection:stances[k].archerProtection};
  return JSON.stringify({_apply:'Aldermarch combat tuning — apply to src/content/units.ts and src/domain/combat/battleResolver.ts',
    units:u,stances:s,terrainDefence:terrainDef,counterBonus:counter,counterThreshold},null,2);
}

const tsel=document.getElementById('terrain');
for(const t of Object.keys(terrainDef)){const o=document.createElement('option');o.value=t;o.textContent=t;tsel.appendChild(o);}
tsel.value=state.terrain;
tsel.onchange=e=>{state.terrain=e.target.value; render();};
document.getElementById('reroll').onclick=()=>{state.roll++; render();};
document.getElementById('export').onclick=async()=>{
  const t=exportJson();
  try{await navigator.clipboard.writeText(t);
    document.getElementById('export').textContent='Copied — paste to Claude';}
  catch(e){document.querySelector('details').open=true;
    document.getElementById('export').textContent='Copy from the box below';}
};

musterUI('atk','atk'); musterUI('def','def');
stanceUI('atkStance','atkStance'); stanceUI('defStance','defStance');
unitTuneUI(); stanceTuneUI(); terrainTuneUI(); render();
</script></body></html>`;
}

// ---------------------------------------------------------------------------
// Map browser
// ---------------------------------------------------------------------------

function mapBrowser(): string {
  const tiles = {
    open: dataUri('terrain/open.png'),
    forest: dataUri('terrain/forest.png'),
    hills: dataUri('terrain/hills.png'),
    chokepoint: dataUri('terrain/chokepoint.png'),
  };
  const castles = {
    motteAndBailey: dataUri('castle/motte-and-bailey.png'),
    normanKeep: dataUri('castle/norman-keep.png'),
    royalCastle: dataUri('castle/royal-castle.png'),
  };
  const banners = {
    crimson: dataUri('banner/crimson.png'),
    steel: dataUri('banner/steel.png'),
    gold: dataUri('banner/gold.png'),
    verdigris: dataUri('banner/verdigris.png'),
  };

  const mapData = JSON.stringify({
    map: ALDERMARCH,
    tint: terrainTint,
    seats: seatColors,
    palette,
    moveCost: TERRAIN_MOVE_COST,
    roadCost: ROAD_MOVE_COST,
    defence: TERRAIN_DEFENCE_MODIFIER,
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>The Aldermarch — Map</title>
<style>${SHARED_CSS}
svg{width:100%;height:auto;display:block;filter:drop-shadow(0 10px 26px rgba(0,0,0,.6))}
.county{cursor:pointer}
.lbl{font-size:17px;font-weight:600;fill:#0d0b09;paint-order:stroke;stroke:rgba(232,220,192,.75);stroke-width:3.5px;stroke-linejoin:round}
.sub2{font-size:11px;fill:#4a3f31;paint-order:stroke;stroke:rgba(232,220,192,.6);stroke-width:2.5px}
.kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;align-items:baseline}
.k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--parchment-shadow)}
.v{font-family:var(--numeric);color:var(--parchment-dim);text-align:right}
.legend{display:flex;gap:10px;flex-wrap:wrap;font-size:12px}
.lg{display:flex;align-items:center;gap:5px}
.sw{width:22px;height:14px;border:1px solid var(--ink-line);border-radius:2px;background-size:22px}
</style></head><body>
<header><h1>The Aldermarch</h1><div class="sub">19 counties · one chokepoint · 2-4 players</div></header>
<div class="wrap">
<div class="card" style="padding:6px"><div id="map"></div></div>
<div class="card"><div class="h2">County</div><div id="detail"><p class="note">Tap a county.</p></div></div>
<div class="card"><div class="h2">Terrain</div><div class="legend" id="legend"></div>
<p class="note" style="margin-top:10px">Move cost is the cost to ENTER that terrain; a road link
overrides it with a flat ${ROAD_MOVE_COST}. Defence multiplies the defender's output only.</p></div>
<div class="card"><div class="h2">Design intent</div>
<p class="note" style="margin:0">Ironthroat is the only link between the two basins — removing it
splits the map 9/9. Stone is scarce (3 of 19) and never in a starting county, so every player must
expand or trade for castle upgrades. The four seats are structurally identical: same neighbour
count, same terrain in early reach, same road distance to the pass. That symmetry is a choice for
THIS map, not a rule — asymmetric maps are expected in map packs.</p></div>
</div>
<script>
const D = ${mapData};
const TILES = ${JSON.stringify(tiles)};
const CASTLES = ${JSON.stringify(castles)};
const BANNERS = ${JSON.stringify(banners)};
const SEAT_BANNER = ['crimson','steel','gold','verdigris'];
const M = D.map;
const owner = {};
M.starts.forEach(s => owner[s.county] = s.seat);
const path = pts => pts.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ')+'Z';
const byId = Object.fromEntries(M.counties.map(c=>[c.id,c]));
const nbrs = {};
for(const c of M.counties) nbrs[c.id]=[];
for(const b of M.borders){nbrs[b.a].push(b.b);nbrs[b.b].push(b.a);}
const roads = new Set(M.borders.filter(b=>b.road).map(b=>[b.a,b.b].sort().join('|')));

let svg='<svg viewBox="0 0 '+M.width+' '+M.height+'"><defs>';
for(const t of Object.keys(TILES))
  svg+='<pattern id="t-'+t+'" width="30" height="30" patternUnits="userSpaceOnUse"><image href="'+TILES[t]+'" width="30" height="30"/></pattern>';
for(let s=0;s<4;s++)
  svg+='<pattern id="h-'+s+'" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate('+(s*45)+')"><line x1="0" y1="0" x2="0" y2="8" stroke="'+D.seats[s].base+'" stroke-width="2.2"/></pattern>';
svg+='</defs><rect width="'+M.width+'" height="'+M.height+'" fill="#17130f"/>';
for(const c of M.counties){
  const seat = owner[c.id];
  svg+='<g class="county" data-id="'+c.id+'"><path d="'+path(c.shape)+'" fill="url(#t-'+c.terrain+')"/>';
  if(seat!==undefined) svg+='<path d="'+path(c.shape)+'" fill="url(#h-'+seat+')" opacity=".34"/>';
  svg+='<path d="'+path(c.shape)+'" fill="none" stroke="'+(seat!==undefined?D.seats[seat].base:'#2a231c')+
       '" stroke-width="'+(seat!==undefined?2.6:1.6)+'" stroke-linejoin="round" opacity="'+(seat!==undefined?.95:.55)+'"/></g>';
}
for(const b of M.borders.filter(x=>x.road)){
  const a=byId[b.a],c=byId[b.b];
  svg+='<line x1="'+a.centroid.x+'" y1="'+a.centroid.y+'" x2="'+c.centroid.x+'" y2="'+c.centroid.y+
       '" stroke="#a4906c" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" opacity=".8"/>';
}
for(const c of M.counties){
  const seat=owner[c.id];
  if(seat!==undefined){
    svg+='<image href="'+CASTLES.motteAndBailey+'" x="'+(c.centroid.x-17)+'" y="'+(c.centroid.y-29)+'" width="34" height="34"/>';
    svg+='<image href="'+BANNERS[SEAT_BANNER[seat]]+'" x="'+(c.centroid.x-30)+'" y="'+(c.centroid.y-27)+'" width="15" height="25"/>';
  }
  svg+='<text class="lbl" x="'+c.centroid.x+'" y="'+(c.centroid.y+16)+'" text-anchor="middle">'+c.name+'</text>';
  svg+='<text class="sub2" x="'+c.centroid.x+'" y="'+(c.centroid.y+31)+'" text-anchor="middle">'+c.resource+' · '+c.yield+'</text>';
}
svg+='</svg>';
document.getElementById('map').innerHTML=svg;

document.querySelectorAll('.county').forEach(g=>{
  g.onclick=()=>{
    const c=byId[g.dataset.id]; const seat=owner[c.id];
    document.getElementById('detail').innerHTML=
      '<div style="font-size:18px;margin-bottom:8px">'+c.name+
      (seat!==undefined?' <span style="font-size:11px;color:'+D.seats[seat].bright+'">SEAT '+(seat+1)+'</span>':'')+'</div>'+
      '<div class="kv">'+
      kv('Terrain',c.terrain)+kv('Resource',c.resource+' · '+c.yield+'/turn')+
      kv('Build slots',c.size)+kv('Region',c.region)+
      kv('Enter cost',D.moveCost[c.terrain])+kv('Defence','×'+D.defence[c.terrain].toFixed(2))+
      '</div><div style="margin-top:10px"><span class="k">Borders</span><div style="font-size:12px;color:var(--parchment-shadow);line-height:1.5">'+
      nbrs[c.id].map(n=>byId[n].name+(roads.has([c.id,n].sort().join('|'))?' (road)':'')).join(', ')+'</div></div>';
  };
});
function kv(k,v){return '<span class="k">'+k+'</span><span class="v">'+v+'</span>';}

const lg=document.getElementById('legend');
for(const t of Object.keys(TILES))
  lg.innerHTML+='<span class="lg"><span class="sw" style="background-image:url('+TILES[t]+')"></span>'+t+'</span>';
</script></body></html>`;
}

mkdirSync(OUT_DIR, { recursive: true });

const files: [string, string][] = [
  ['combat-tuner.html', combatTuner()],
  ['aldermarch-map.html', mapBrowser()],
];

for (const [name, html] of files) {
  const target = join(OUT_DIR, name);
  writeFileSync(target, html);
  console.log(`Wrote playtest/${name} (${(html.length / 1024).toFixed(0)} KB)`);
}
