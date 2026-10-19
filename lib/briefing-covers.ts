export interface BriefingCover {
  src: string;
  alt: string;
  width: number;
  height: number;
}

// Only registered, published assets are rendered; articles without a cover stay text-only.
const covers: Record<string, BriefingCover | undefined> = {
  '2026-10-17': {
    src: '/briefing-covers/2026-10-17.png',
    alt: '魔术一场伤三个 — 10月17日 NBA Fantasy 每日简报封面',
    width: 1922,
    height: 818,
  },
  '2026-10-18': {
    src: '/briefing-covers/2026-10-18.png',
    alt: '杰克逊上位了 — 10月18日 NBA Fantasy 每日简报封面',
    width: 1922,
    height: 818,
  },
  '2026-10-19': {
    src: '/briefing-covers/2026-10-19.png',
    alt: '西帝倒了 — 10月19日 NBA Fantasy 每日简报封面',
    width: 1922,
    height: 818,
  },
};

export function getBriefingCover(date: string): BriefingCover | undefined {
  return covers[date];
}
