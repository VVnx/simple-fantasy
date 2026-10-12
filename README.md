# Fantasy Timeline

输入中英文 NBA 球员名并明确选择候选人，比较 Yahoo Fantasy 11 CAT 赛季场均。白底浅蓝表头、手机横向滚动，支持 PNG / CSV 导出。默认过去两个完整常规赛、本季季前赛和本季常规赛；底部另列前两季原始总计。日期动态计算。

## 本地运行

需要 Node.js 22.13+，无需数据密钥或付费账户。

```sh
npm ci
npm run dev
```

Sites / Vinext 预览默认 http://127.0.0.1:5173 。Next.js / Vercel 预览：`npm run dev:vercel`，默认 http://127.0.0.1:3000 。开发预览请限制在本机。

## 检查与构建

```sh
npm run lint
npm run typecheck
npm test
npm run verify:live
npm run build
npm run build:vercel
```

`verify:live` 真实访问 ESPN，以赛季总数和逐场记录交叉核对；会受上游网络和数据修订影响。测试夹具只是回归证据，不用于线上数据。

## 数据口径

- 常规赛使用 ESPN Core All Splits 赛季合计，包含转队球员所有球队。
- 季前赛使用 ESPN gamelog 的明确 Preseason 分段，按字段名称读取、去重，排除全明星和杯赛决赛。
- GP、DD 为赛季总次数；MIN 及其余计数为场均。FG% / FT% / A/T 使用总数计算，分母为零显示 —。缺失字段保持缺失，真实零正常显示。
- ESPN 逐场分钟已取整，季前赛 MIN 标记 ≈；不能从该源恢复秒级精度。
- DD 为得分、篮板、助攻、抢断、盖帽中至少两项达到 10 的场次，三双也计一次。
- 本表读取时间是本站抓取时间，不声称为 ESPN 更新时间。逐场数据同时显示最近比赛日期。
- 中文搜索有 187 组常见译名/别名，尚非全量中文词库；未覆盖名字可使用英文。同姓返回候选供明确选择。

## 上游与缓存

使用公开 ESPN Search、Core 和 gamelog JSON。NBA.com stats 在本机实测返回 403，未绕过拒绝访问。ESPN 接口无需账号，但并非有 SLA 的正式开发者服务，结构或访问策略可能变化；读取失败会逐行明确报错，错误不会变成零。

每次上游请求最多 8 秒。进程内缓存最多 256 项并合并相同并发请求；历史常规赛 6 小时、当前赛事 5 分钟、搜索 1 小时，失败冷却 15 秒。API 另有 CDN 缓存（统计 5 分钟、搜索 1 小时），可能叠加数据年龄，界面保留原始读取时间。重新读取会重试本站 API，仍尊重缓存。不同 Worker / serverless 实例之间不共享内存缓存。

## Sites 发布

`.openai/hosting.json` 已绑定现有 Fantasy Timeline 项目。沿用 Sites 插件的 source workflow、构建和发布步骤；不要再次创建项目。`build/` 与 `scripts/` 中的 Sites 集成来自官方 starter。无需 D1、R2 或运行时密钥。网站访问范围由 Sites 控制台管理。

## 后续部署 Vercel

本项目保留标准 Next.js App Router 和 Node fetch 路径。导入 Git 仓库时选择 Next.js，Node.js 22，安装命令 `npm ci`，**Build Command 设为 `npm run build:vercel`**，输出目录保持 Next.js 默认。无需环境变量、数据库或登录服务。`npm run build` 是 Sites 构建，不用于 Vercel。

本地 Next 构建可验证兼容性，但不等于验证 Vercel 云端出口对 ESPN 的访问；部署后需再检查搜索与三个赛季数据。未代用户部署 Vercel。

## 实现与验证

数据适配器 `lib/data/espn.ts`，比率和导出 `lib/format.ts` / `lib/export.ts`，竞态处理及页面 `components/research-tool.tsx`。40 项单元测试覆盖赛季身份、缺失与零、转队合计、两双、全明星污染、缓存并发、超时和源错误；浏览器验证搜索、候选选择、切换赛季、失败占位、竞态、手机表格及真实导出。

上线前生产依赖审计：0 项已知漏洞。未将账户凭证、用户参考图片或本机测试截图打包公开。

## 季前赛分钟换算

下拉选择原始数据或按前两季之一的场均分钟换算。比例使用未舍入的目标分钟 / 季前赛分钟，只缩放场均计数；GP、DD、FG%、FT%、A/T 不变。底部总计始终使用原始赛季总数，不受换算影响。缺失/零分钟目标不可选，切换球员或赛季会重置换算。原始季前赛行始终保留，选择换算时仅在其下方追加一行，选择原始即移除。PNG、CSV 与当前表格及换算标记一致。换算仅便于比较，不是实际统计或预测。本季常规赛未有记录时显示 —，后续有真实数据自然显示。

DD 每行显示为“两双次数（两双场次占比）”，占比为实际 DD / GP × 100%。换算行保留原始样本的次数和占比；无 GP 或缺失 DD 显示 —。
