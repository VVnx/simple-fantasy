import {z} from 'zod';
import portraits from '@/data/tools/poster-portraits.json';

const player = z.object({name:z.string().min(1).max(150),position:z.enum(['PG','SG','SF','PF','C']),avatar:z.string().max(2_000_000).optional()});
const card = z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  team:z.object({code:z.string().regex(/^[A-Z]{2,4}$/),name:z.string().min(1).max(40)}),
  game:z.object({opponent:z.string().max(100).optional(),score:z.string().max(40).optional()}).optional(),
  prediction:z.object({version:z.string().max(200).optional(),players:z.array(player).length(5)}),
  actual:z.object({status:z.string().max(40),players:z.array(player).max(5)}),
  poster:z.object({paragraphs:z.array(z.string().max(20000)).max(100)}).optional(),
  observations:z.array(z.object({text:z.string().max(20000)})).max(100).optional(),
  sixthMan:z.object({status:z.string(),text:z.string()}).optional(),
});
const report = z.object({schemaVersion:z.literal(1),reportDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const d=new Date(value);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}),cards:z.array(card).min(1).max(30)});
export type PosterPlayer = {name:string;position:string;avatar:string};
export type PosterCard = {
  id:string;team:{code:string;name:string};game?:{opponent?:string;score?:string};
  prediction:{version?:string;players:PosterPlayer[]};actual:{status:string;players:PosterPlayer[]};
  poster:{paragraphs:string[]};
};
export type PosterReport = {schemaVersion:1;reportDate:string;cards:PosterCard[]};
const portraitMap:Record<string,string> = portraits;
export function normalizePosterReport(input:unknown):PosterReport {
  const result = report.safeParse(input);
  if (!result.success) throw Error('报告格式不正确：需要日期、球队、五人预测首发与短评。可先导出草稿作为模板。');
  const data = result.data;
  if (new Set(data.cards.map(c=>c.id)).size !== data.cards.length) throw Error('报告中的球队编号重复。');
  return {schemaVersion:1,reportDate:data.reportDate,cards:data.cards.map(c=>{
    if (c.actual.status === 'confirmed' && c.actual.players.length !== 5) throw Error(`${c.team.name}的已确认首发必须为五人。`);
    const paragraphs=c.poster?.paragraphs ?? [...(c.observations?.map(o=>o.text) ?? []),...(c.sixthMan&&c.sixthMan.status!=='not_evaluated'?[c.sixthMan.text]:[])];
    if (paragraphs.join('').length > 20000) throw Error(`${c.team.name}的短评过长，请拆成多份报告。`);
    const resolve = (p:z.infer<typeof player>):PosterPlayer => ({...p,avatar: p.avatar && (/^\/tools\/assets\/[a-f0-9]{24}\.(png|jpg|webp)$/.test(p.avatar)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.avatar)) ? p.avatar : portraitMap[p.name] || ''});
    return {id:c.id,team:c.team,game:c.game,prediction:{version:c.prediction.version,players:c.prediction.players.map(resolve)},actual:{status:c.actual.status,players:c.actual.players.map(resolve)},poster:{paragraphs}};
  })};
}
export function parsePosterImport(raw:string):PosterReport[] {
  let input:unknown;
  try {input=JSON.parse(raw);} catch {throw Error('文件不是有效的 JSON。');}
  const reports = input && typeof input==='object' && 'version' in input && input.version===1 && 'reports' in input ? input.reports : [input];
  if (!Array.isArray(reports)||!reports.length||reports.length>100) throw Error('请选择单期报告或本工具导出的草稿备份。');
  const parsed=reports.map(normalizePosterReport);
  if(new Set(parsed.map(r=>r.reportDate)).size!==parsed.length)throw Error('备份中有重复日期。');
  return parsed;
}
export const posterKey=(date:string,id:string)=>`${date}/${id}`;

export function wrapPosterText(text:string,width:number,measure:(text:string)=>number):string[] {
  const result:string[]=[];
  for (const paragraph of text.split('\n')) {
    let line='';
    for(const token of paragraph.match(/[A-Za-zÀ-ž0-9’'.,:/_-]+|[^A-Za-zÀ-ž0-9’'.,:/_-]/gu)??[]) {
      if(measure(line+token)<=width){line+=token;continue;}
      if('。，；！？：、）》】”’'.includes(token)&&line.length>1){result.push(line.slice(0,-1).trimEnd());line=line.slice(-1)+token;continue;}
      if(line.trim())result.push(line.trimEnd());line='';
      for(const char of token.trimStart()){if(measure(line+char)>width&&line){result.push(line);line='';}line+=char;}
    }
    result.push(line.trimEnd());
  }
  return result;
}
