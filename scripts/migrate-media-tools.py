"""Copy the four Fantasy tools from a user-selected MediaPlatform checkout.
Only the tool documents, required images, and display data are included.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = args.source / 'projects'
assets = root / 'public/tools/assets'
assets.mkdir(parents=True, exist_ok=True)

def asset(raw, suffix):
    name = hashlib.sha256(raw).hexdigest()[:24] + suffix.lower()
    (assets / name).write_bytes(raw)
    return '/tools/assets/' + name

def embedded(match):
    suffix = {'jpeg': '.jpg', 'png': '.png', 'webp': '.webp'}[match[1]]
    return asset(base64.b64decode(match[2]), suffix)

for filename, target in [('阵容头像表生成器.html', 'charts'), ('八人轮换图片生成器.html', 'rotation')]:
    html = (source / 'Yahoo-Fantasy-2026-27/tools' / filename).read_text()
    html = re.sub(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)', embedded, html)
    if target == 'charts':
        # Exported Markdown/HTML must work outside this website too.
        html = html.replace('function avatarUrl(name, customMap) {', 'function sourceAvatarUrl(name, customMap) {')
        html = html.replace('function initials(name) {', 'function avatarUrl(name, customMap) { const src = sourceAvatarUrl(name, customMap); return src ? new URL(src, location.href).href : ""; }\n\n    function initials(name) {')
    html = html.replace('30 队已预载 · 离线可用', '30 队历史方案 · 可自由编辑').replace('单文件离线工具', '首发轮转工具')
    path = root / 'public/tools' / target
    path.mkdir(exist_ok=True)
    (path / 'index.html').write_text(html)

board = source / 'yahoo-fantasy-publish-board'
seed = json.loads((board / 'data/seed.json').read_text())
for team in seed['teams']:
    for key in ('draftPlan', 'startingFive'):
        if key in team:
            path = board / 'public' / team[key]['image'].lstrip('/')
            team[key]['image'] = asset(path.read_bytes(), path.suffix)
(root / 'data/tools/publications.json').write_text(json.dumps(seed, ensure_ascii=False, indent=2) + '\n')
shutil.copyfile(board / 'lib/records.ts', root / 'lib/publication-records.ts')

reports = []
portrait_map = {}
for path in sorted((source / 'nba-preseason-cards/reports').glob('*/cards.json'), reverse=True):
    raw = json.loads(path.read_text())
    cards = []
    for card in raw['cards']:
        lineups = {}
        for kind in ('prediction', 'actual'):
            players = []
            for player in card[kind]['players']:
                portrait = (path.parent / player['avatar']).resolve()
                url = asset(portrait.read_bytes(), portrait.suffix)
                portrait_map[player['name']] = url
                players.append(dict(name=player['name'], position=player['position'], avatar=url))
            lineups[kind] = dict(players=players)
        lineups['prediction']['version'] = card['prediction']['version'].split(';')[0].split('；')[0]
        lineups['actual']['status'] = card['actual']['status']
        paragraphs = card.get('poster', {}).get('paragraphs')
        if paragraphs is None:
            paragraphs = [o['text'] for o in card['observations']]
            if card['sixthMan']['status'] != 'not_evaluated':
                paragraphs.append(card['sixthMan']['text'])
        cards.append(dict(id=card['id'], team=card['team'], game={k:card['game'][k] for k in ('opponent','score') if k in card['game']}, **lineups, poster=dict(paragraphs=paragraphs)))
    reports.append(dict(schemaVersion=1, reportDate=raw['reportDate'], cards=cards))
(root / 'data/tools/poster-reports.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2)+'\n')
(root / 'data/tools/poster-portraits.json').write_text(json.dumps(portrait_map, ensure_ascii=False, indent=2)+'\n')
print(f'Migrated 2 standalone tools, {len(seed["teams"])} publication records, {len(reports)} poster reports, {len(list(assets.iterdir()))} image assets.')
