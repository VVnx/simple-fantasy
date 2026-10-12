import {describe,it,expect,vi,afterEach} from 'vitest';
import {browserStorage,loadSavedPlayers,parseSavedPlayers,rememberPlayer,savePlayers,savedPlayerKeys,toggleFavorite,type SavedPlayer} from '../lib/saved-players';
const player=(id:number):SavedPlayer=>({id:String(id),name:`Player ${id}`});
afterEach(()=>vi.unstubAllGlobals());
describe('local favorites and recent selections',()=>{
  it('recovers from absent, corrupt or non-array storage',()=>{
    for(const raw of [null,'{broken','{}','false','null'])expect(parseSavedPlayers(raw)).toEqual([]);
  });
  it('validates saved identities, deduplicates by ID, and strips extra data',()=>{
    expect(parseSavedPlayers(JSON.stringify([null,{id:'query',name:'typed query'},{id:'1',name:''},{id:'1',name:' Player 1 ',chineseName:' 球员一 ',team:'private',stats:{pts:9}},{id:'1',name:'Duplicate'},player(2)])))
      .toEqual([{id:'1',name:'Player 1',chineseName:'球员一'},player(2)]);
  });
  it('keeps only five actual selections and moves repeat visits to the front',()=>{
    let recent:SavedPlayer[]=[];
    for(let id=1;id<=6;id++)recent=rememberPlayer(recent,player(id));
    expect(recent.map(p=>p.id)).toEqual(['6','5','4','3','2']);
    expect(rememberPlayer(recent,player(3)).map(p=>p.id)).toEqual(['3','6','5','4','2']);
    expect(rememberPlayer(recent,{id:'search fragment',name:'query'})).toBe(recent);
  });
  it('toggles favorites reversibly by ID without mutating recent history',()=>{
    const recent=[player(2),player(1)],before=structuredClone(recent);
    const favorites=toggleFavorite([],recent[0]);
    expect(favorites).toEqual([player(2)]);
    expect(toggleFavorite(favorites,{id:'2',name:'Renamed'})).toEqual([]);
    expect(recent).toEqual(before);
  });
  it('round trips only minimal metadata under independent versioned keys',()=>{
    const data=new Map<string,string>();
    const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    const recent=Array.from({length:7},(_,i)=>player(i+1));
    expect(savePlayers('recent',recent,storage)).toBe(true);
    expect(savePlayers('favorites',[player(7)],storage)).toBe(true);
    expect(loadSavedPlayers(storage)).toEqual({recent:recent.slice(0,5),favorites:[player(7)],memoryOnly:false});
    expect([...data.keys()]).toEqual([savedPlayerKeys.recent,savedPlayerKeys.favorites]);
  });
  it('does not require window during SSR and degrades safely when storage is blocked',()=>{
    vi.stubGlobal('window',undefined);
    expect(browserStorage()).toBeNull();expect(loadSavedPlayers().memoryOnly).toBe(true);
    vi.stubGlobal('window',{get localStorage(){throw new Error('blocked');}});
    expect(browserStorage()).toBeNull();expect(savePlayers('favorites',[player(1)])).toBe(false);
    const storage={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('quota');}};
    expect(loadSavedPlayers(storage)).toEqual({recent:[],favorites:[],memoryOnly:true});
    expect(savePlayers('recent',[player(1)],storage)).toBe(false);
  });
  it('keeps the other list readable if one key fails',()=>{
    const storage={getItem:(key:string)=>{if(key===savedPlayerKeys.recent)throw new Error('blocked');return JSON.stringify([player(1)]);},setItem:()=>{}};
    expect(loadSavedPlayers(storage)).toEqual({recent:[],favorites:[player(1)],memoryOnly:true});
  });
});
