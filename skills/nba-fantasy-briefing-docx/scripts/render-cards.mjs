import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire,stripTypeScriptTypes} from 'node:module';

const args={};
for(let i=2;i<process.argv.length;i+=2){
  const key=process.argv[i];if(!key?.startsWith('--')||!process.argv[i+1])throw new Error('Expected --option value pairs');
  args[key.slice(2)]=process.argv[i+1];
}
for(const key of ['input','project','output-dir','node-modules'])if(!args[key])throw new Error(`Missing --${key}`);
const output=path.resolve(args['output-dir']),project=path.resolve(args.project);
const require=createRequire(path.join(path.resolve(args['node-modules']),'package.json'));
const {chromium}=require('playwright'),sharp=require('sharp');
const data=JSON.parse(await fs.readFile(path.resolve(args.input),'utf8'));
if(!data.title||!/^\d{4}-\d{2}-\d{2}$/.test(data.publication_date)||!Array.isArray(data.sections))throw new Error('Missing article title, publication_date or sections');
const players=data.sections.flatMap(s=>s.players||[]),seen=new Set();
for(const p of players){
  if(!p.name||!p.team||!p.comment||!/^#[0-9a-f]{6}$/i.test(p.color)||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!/^\d+(?:\.\d+|:[0-5]\d)?$/.test(String(p.minutes)))throw new Error(`Incomplete player: ${p.name||'unknown'}`);
  if(p.id&&!/^\d{1,12}$/.test(p.id))throw new Error(`Invalid player ID: ${p.name}`);
  if(p.gameId&&!/^\d{1,12}$/.test(p.gameId))throw new Error(`Invalid game ID: ${p.name}`);
  for(const key of ['pts','reb','ast','three','fgm','fga','ftm','fta','st','blk','to'])if(!Number.isInteger(p.stats?.[key])||p.stats[key]<0)throw new Error(`Missing ${key}: ${p.name}`);
  const s=p.stats;
  if(s.fgm>s.fga||s.ftm>s.fta||s.three>s.fgm||2*s.fgm+s.three+s.ftm!==s.pts||s.threeAttempted!==undefined&&(!Number.isInteger(s.threeAttempted)||s.threeAttempted<s.three||s.threeAttempted>s.fga))throw new Error(`Inconsistent shooting: ${p.name}`);
  const key=p.id||`${p.name}:${p.team}:${p.date}`;if(seen.has(key))throw new Error(`Duplicate player: ${p.name}`);seen.add(key);
  p.minutes=String(p.minutes);
}
await fs.mkdir(path.join(output,'cards'),{recursive:true});
const portraits=path.resolve(args['portraits-dir']||path.join(output,'portraits'));
await fs.mkdir(portraits,{recursive:true});
let next=0;
async function portraitWorker(){while(next<players.length){
  const p=players[next++];
  if(p.portrait_file){p.portrait_file=path.resolve(p.portrait_file);await sharp(p.portrait_file).metadata();continue;}
  if(!p.id)throw new Error(`Need a portrait_file or verified ID: ${p.name}`);
  const dest=path.join(portraits,`${p.id}.png`);
  try{await fs.access(dest);}catch{
    const response=await fetch(`https://a.espncdn.com/i/headshots/nba/players/full/${p.id}.png`,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Headshot unavailable: ${p.name} (${response.status})`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>5_000_000||(await sharp(bytes).metadata()).format!=='png')throw new Error(`Invalid portrait: ${p.name}`);
    await fs.writeFile(dest,bytes);
  }
  p.portrait_file=dest;
}}
await Promise.all(Array.from({length:4},portraitWorker));
const constants=await fs.readFile(path.join(project,'lib/player-cards.ts'),'utf8');
const width=Number(constants.match(/export const CARD_WIDTH\s*=\s*(\d+)/)?.[1]);
const height=Number(constants.match(/export const CARD_HEIGHT\s*=\s*(\d+)/)?.[1]);
if(width!==2400||height!==200)throw new Error('The project renderer must use the compact 2400×200 card');
const source=await fs.readFile(path.join(project,'lib/player-card-image.ts'),'utf8');
const executable=stripTypeScriptTypes(source.replace(/^import[^\n]+\n/m,`const CARD_WIDTH=${width},CARD_HEIGHT=${height};\n`).replace(/^export /gm,''))+'\nglobalThis.renderPlayerCard=renderPlayerCard;';
const browser=await chromium.launch({headless:true,...(args['browser-channel']?{channel:args['browser-channel']}:{})});
try{
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0;background:white"></body>');
  await page.addScriptTag({content:executable});await page.evaluate(()=>document.fonts.ready);
  for(let i=0;i<players.length;i++){
    const p=players[i],bytes=await fs.readFile(p.portrait_file);
    const format=(await sharp(bytes).metadata()).format;
    if(!['png','jpeg','webp'].includes(format))throw new Error(`Unsupported portrait format: ${p.name}`);
    const mime=format==='jpeg'?'image/jpeg':`image/${format}`;
    const png=await page.evaluate(async({p,portrait})=>{
      const photo=new Image();photo.src=portrait;await photo.decode();
      const canvas=globalThis.renderPlayerCard(p,{name:p.display_name||p.label||p.chineseName||p.name,portrait:photo});
      return canvas.toDataURL('image/png').split(',')[1];
    },{p,portrait:`data:${mime};base64,${bytes.toString('base64')}`});
    p.card_file=path.join(output,'cards',`${String(i+1).padStart(2,'0')}-${p.id||'player'}.png`);
    await fs.writeFile(p.card_file,Buffer.from(png,'base64'));
    const meta=await sharp(p.card_file).metadata();if(meta.width!==width||meta.height!==height)throw new Error(`Invalid card size: ${p.name}`);
  }
  const graphemes=new Set(),segmenter=new Intl.Segmenter('zh',{granularity:'grapheme'});
  function walk(value){
    if(typeof value==='string'){
      for(const {segment} of segmenter.segment(value))if(/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(segment))graphemes.add(segment);
    }else if(Array.isArray(value)){value.forEach(walk);}
    else if(value&&typeof value==='object'){Object.values(value).forEach(walk);}
  }
  walk(data);
  data.emoji_files={};
  if(graphemes.size)await fs.mkdir(path.join(output,'emoji'),{recursive:true});
  for(const glyph of graphemes){
    const b64=await page.evaluate(glyph=>{
      const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');
      ctx.font='108px "Apple Color Emoji", "Noto Color Emoji", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph,64,68);
      return c.toDataURL('image/png').split(',')[1];
    },glyph);
    const dest=path.join(output,'emoji',`${[...glyph].map(c=>c.codePointAt(0).toString(16)).join('-')}.png`);
    await fs.writeFile(dest,Buffer.from(b64,'base64'));data.emoji_files[glyph]=dest;
  }
}finally{await browser.close();}
await fs.writeFile(path.join(output,'rendered.json'),JSON.stringify(data,null,2));
console.log(JSON.stringify({players:players.length,dimensions:[width,height],manifest:path.join(output,'rendered.json')}));
