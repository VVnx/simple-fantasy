这些 fixtures 于 2026-10-12 在 Mac mini 使用 Node 22 原生 fetch，从 ESPN 无身份认证的公开 JSON 实际读取。

- `risacher-core-2025/2026.json`：完整 Core statistics/0 响应；球员 5211175；常规赛 type=2。
- `risacher-log-2025/2026/2027.json`：Web v3 gamelog 响应的确定性字段投影，保留 filters、names、seasonTypes、events 的 id/gameDate/gameResult；去除了广告、头像、无关链接等展示字段。没有修改统计值。
- 原始 URL 见 docs/DATA.md；原始响应也留在任务工作目录 research 中。
- 测试对独立赛季总数与逐场数据相互核对（GP、FG/FT、3PT、PTS、REB、AST、ST、BLK、TO、DD）；逐场分钟不与赛季分钟比较，因为逐场展示值已舍入。
- 应用运行时不会导入这些 fixtures。生产数据只来自在线适配器。

`schedule-2026-10-14.json` 于 2026-10-14 从 `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20261014` 读取，为当天 7 场季前赛的字段投影：仅保留联盟标识、比赛日期、赛事类型、状态、主客队及比赛备注；去掉赔率、广告、球队历史统计和无关链接，未修改赛程值。用于验证 UTC 跨日日期、主客队及赛程解析，不作为线上赛程。

`card-game-401909088.json` 于 2026-10-21 从 `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401909088` 获取，保留 header 和 boxscore.players 的字段投影。保留原始球队、球员身份与比赛数据，用于单场卡片的得分一致性、三分/罚球顺序、缺失值与 DNP 校验；运行时不读取此 fixture。
