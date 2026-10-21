import {z} from 'zod';
import {chineseName,normalize,resolveSearch} from '../aliases';
import {NBA_TEAMS} from '../schedule';
import type {Player} from '../types';
import {requestCache} from './cache';
import {fetchJson} from './http';
import {DataError} from './errors';
import {searchPlayers} from './espn';

const rosterSchema=z.object({team:z.object({id:z.string()}),athletes:z.array(z.object({id:z.string().regex(/^\d+$/),uid:z.string(),displayName:z.string().min(1)}))});
export function parsePortraitRoster(raw:unknown,teamId:string):Player[]{
  const parsed=rosterSchema.safeParse(raw),team=NBA_TEAMS.find(t=>t.id===teamId);
  if(!parsed.success||!team||parsed.data.team.id!==teamId)throw new DataError('SCHEMA','球队名单暂时无法识别，请稍后重试。');
  return parsed.data.athletes.map(p=>{
    if(p.uid!==`s:40~l:46~a:${p.id}`)throw new DataError('MISMATCH','名单中的球员身份不匹配。');
    return {id:p.id,name:p.displayName,chineseName:chineseName(p.displayName),team:team.name};
  });
}
function roster(teamId:string){
  return requestCache.get(`card-portrait-roster:${teamId}`,60*60_000,async()=>parsePortraitRoster(await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`),teamId));
}
function matching(players:Player[],query:string){
  const raw=normalize(query),resolved=normalize(resolveSearch(query));
  return players.filter(p=>normalize(p.name).includes(resolved)||normalize(p.chineseName||'').includes(raw));
}
export async function searchCardPortraits(query:string,teamName:string){
  const team=NBA_TEAMS.find(t=>[t.name,t.abbreviation,t.id].some(n=>normalize(n)===normalize(teamName)));
  // Roster lookup works independently of the public search service and needs only one team request.
  if(team){
    try{const players=matching(await roster(team.id),query);if(players.length)return {players,source:'ESPN Team Roster'};}
    catch{/* Try global search and then the other current rosters. */}
  }
  try{const result=await searchPlayers(query);if(result.players.length)return result;}catch{/* ESPN public search can reject requests from the hosting network. */}
  const results=await Promise.allSettled(NBA_TEAMS.map(t=>roster(t.id)));
  const failures=results.filter(r=>r.status==='rejected').length;
  if(failures===results.length)throw new DataError('UPSTREAM','头像名单暂时无法读取，请稍后重试或上传自己的头像。');
  const all=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  const players=[...new Map(matching(all,query).map(p=>[p.id,p])).values()];
  return {players,source:'ESPN Team Rosters',requiresSelection:failures>0,warning:failures?'部分球队名单未能读取；请确认候选头像，或稍后重试。':undefined};
}
