import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {parsePortraitRoster,searchCardPortraits} from '../lib/data/player-card-portraits';
import {fetchJson} from '../lib/data/http';
import {searchPlayers} from '../lib/data/espn';
import {GET} from '../app/api/player-card-portraits/route';
vi.mock('../lib/data/cache',()=>({requestCache:{get:(_key:string,_ttl:number,loader:()=>unknown)=>loader()}}));
vi.mock('../lib/data/http',()=>({fetchJson:vi.fn()}));
vi.mock('../lib/data/espn',()=>({searchPlayers:vi.fn()}));
const raw=(id='2',name='Paul George')=>({team:{id},athletes:[{id:'4251',uid:'s:40~l:46~a:4251',displayName:name}]});
beforeEach(()=>vi.resetAllMocks());
describe('pasted-card portrait lookup',()=>{
  it('uses the pasted team roster without relying on the global search endpoint',async()=>{
    vi.mocked(fetchJson).mockResolvedValue(raw());
    const result=await searchCardPortraits('乔治','凯尔特人');
    expect(result.players).toEqual([{id:'4251',name:'Paul George',chineseName:'保罗乔治',team:'凯尔特人'}]);
    expect(fetchJson).toHaveBeenCalledOnce();expect(searchPlayers).not.toHaveBeenCalled();
  });
  it('handles an old pasted team and a blocked search by checking other teams',async()=>{
    vi.mocked(searchPlayers).mockRejectedValue(new Error('403'));
    vi.mocked(fetchJson).mockImplementation(async url=>{
      const id=url.match(/teams\/(\d+)/)![1];return id==='2'?raw():{team:{id},athletes:[]};
    });
    const result=await searchCardPortraits('保罗乔治','快船');
    expect(result.players[0]).toMatchObject({id:'4251',team:'凯尔特人'});
    expect(result).toMatchObject({requiresSelection:false});
  });
  it('makes partial roster results explicit and does not silently claim a complete search',async()=>{
    vi.mocked(searchPlayers).mockRejectedValue(new Error('403'));
    vi.mocked(fetchJson).mockImplementation(async url=>{if(url.includes('/teams/2/'))return raw();throw new Error('offline');});
    const result=await searchCardPortraits('乔治','未知球队');
    expect(result.players).toHaveLength(1);expect(result).toMatchObject({requiresSelection:true});expect('warning' in result&&result.warning).toBeTruthy();
  });
  it('rejects mismatched identities and invalid user input before fetching',async()=>{
    expect(()=>parsePortraitRoster(raw(),'1')).toThrow();
    const wrong=raw();wrong.athletes[0].uid='s:20~l:28~a:4251';expect(()=>parsePortraitRoster(wrong,'2')).toThrow();
    expect((await GET(new NextRequest('https://example.com/api/player-card-portraits?q=a'))).status).toBe(400);
    expect(fetchJson).not.toHaveBeenCalled();
  });
});
