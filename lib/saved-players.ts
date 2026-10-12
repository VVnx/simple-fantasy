import type { Player } from './types';

export type SavedPlayer = Pick<Player, 'id' | 'name' | 'chineseName'>;
export type SavedPlayers = { recent: SavedPlayer[]; favorites: SavedPlayer[]; memoryOnly: boolean };
export const savedPlayerKeys = {
  recent: 'fantasy-timeline:v1:recent',
  favorites: 'fantasy-timeline:v1:favorites',
} as const;
type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;
function cleanPlayer(value: unknown): SavedPlayer | null {
  if (!value || typeof value !== 'object') return null;
  const p=value as Record<string,unknown>;
  if (typeof p.id!=='string' || !/^\d{1,10}$/.test(p.id) || typeof p.name!=='string' || !p.name.trim() || p.name.length>120) return null;
  const chineseName=typeof p.chineseName==='string' && p.chineseName.trim() && p.chineseName.length<=120 ? p.chineseName.trim() : undefined;
  return {id:p.id,name:p.name.trim(),...(chineseName?{chineseName}:{})};
}
export function parseSavedPlayers(raw: string | null, limit=Infinity): SavedPlayer[] {
  try {
    const value: unknown=raw?JSON.parse(raw):[];
    if (!Array.isArray(value)) return [];
    const unique=new Map<string,SavedPlayer>();
    for (const item of value) {
      const player=cleanPlayer(item);
      if (player&&!unique.has(player.id)) unique.set(player.id,player);
      if (unique.size>=limit) break;
    }
    return [...unique.values()];
  } catch { return []; }
}
export function browserStorage(): BrowserStorage | null {
  try { return typeof window==='undefined'?null:window.localStorage; } catch { return null; }
}
export function loadSavedPlayers(storage=browserStorage()): SavedPlayers {
  const result: SavedPlayers={recent:[],favorites:[],memoryOnly:!storage};
  if (!storage) return result;
  try {result.recent=parseSavedPlayers(storage.getItem(savedPlayerKeys.recent),5);} catch {result.memoryOnly=true;}
  try {result.favorites=parseSavedPlayers(storage.getItem(savedPlayerKeys.favorites));} catch {result.memoryOnly=true;}
  return result;
}
export function savePlayers(kind: keyof typeof savedPlayerKeys, players: SavedPlayer[], storage=browserStorage()): boolean {
  if (!storage) return false;
  try {
    // Persist names and stable IDs only, never source responses or typed queries.
    const clean=parseSavedPlayers(JSON.stringify(players),kind==='recent'?5:Infinity);
    storage.setItem(savedPlayerKeys[kind],JSON.stringify(clean));return true;
  } catch { return false; }
}
export function rememberPlayer(recent: SavedPlayer[], player: SavedPlayer): SavedPlayer[] {
  const clean=cleanPlayer(player);
  return clean?[clean,...recent.filter(p=>p.id!==clean.id)].slice(0,5):recent;
}
export function toggleFavorite(favorites: SavedPlayer[], player: SavedPlayer): SavedPlayer[] {
  const clean=cleanPlayer(player);
  if (!clean) return favorites;
  return favorites.some(p=>p.id===clean.id)?favorites.filter(p=>p.id!==clean.id):[clean,...favorites];
}
