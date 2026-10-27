# 导出输入

输入JSON沿用文章结构，每个球员携带完整、已核实的卡片数据。不硬编码用户姓名、比赛日期、仓库绝对路径、球员名单或场次ID。

```json
{
  "title": "文章标题",
  "publication_date": "YYYY-MM-DD",
  "subtitle": "可选副标题",
  "sections": [
    {
      "title": "一 今日牛人",
      "paragraphs": ["可选的已定稿正文"],
      "players": [
        {
          "id": "已核实的数字球员ID",
          "name": "标准英文名",
          "label": "正文昵称",
          "team": "该场球队",
          "color": "#316dae",
          "date": "YYYY-MM-DD",
          "gameId": "已核实的数字场次ID",
          "minutes": "31",
          "stats": {"pts": 20, "reb": 10, "ast": 5, "three": 2, "threeAttempted": 5, "fgm": 7, "fga": 14, "ftm": 4, "fta": 4, "st": 1, "blk": 1, "to": 2},
          "comment": "已定稿短评"
        }
      ]
    }
  ],
  "injuries": [{"team": "球队", "text": "已定稿伤病与阵容影响"}]
}
```

示例仅说明字段，不是比赛事实。`paragraphs`、`players`和`injuries`均可为空。可用 `injury_heading` 保留原稿的伤病标题与编号，默认不臆定编号。球员可提供 `display_name` 覆盖卡片显示名，或 `portrait_file` 使用已确认头像。`label`、`chineseName`和`name`依次作为显示名备用。投篮和罚球按命中/出手存储；三分出手确实缺失时可省略 `threeAttempted`，不编造。分钟保留源精度。不存在数据的球员不能用全零记录冒充。

先通过 `load_workspace_dependencies` 解析当前Node/Python和Node包目录，传入下列变量对应的实际路径。命令和输入JSON中的文件路径均用绝对路径。需要外部辅助包时只使用任务缓存，不修改全局或项目依赖。

```bash
"$DOC_NODE" "$DOCX_SKILL/scripts/render-cards.mjs" \
  --input "$ARTICLE_JSON" --project "$PROJECT_ROOT" \
  --output-dir "$EXPORT_DIR" --node-modules "$DOC_NODE_MODULES" \
  --portraits-dir "$PORTRAIT_CACHE" --browser-channel chrome

"$DOC_PYTHON" "$DOCX_SKILL/scripts/build-docx.py" \
  --input "$EXPORT_DIR/rendered.json" --output "$FINAL_DOCX" \
  --font "$CJK_FONT" --font-family "Noto Sans CJK SC" \
  --fonttools-wheel "$FONTTOOLS_WHEEL"
```

`--browser-channel`可省略以使用已配置的Playwright浏览器；不要为此任务启动用户已有浏览器会话。`--portraits-dir`可省略，脚本将把ESPN公开头像下载到导出目录并缓存。项目路径只用于读取当前卡片生成器，不运行站点或发布。

中文静态字体可复用已有的Noto Sans CJK SC文件；没有时从其官方字体仓库取得并记录来源。字体族名须与实际字体匹配。脚本只嵌使用到的字符，不保存整套字库到DOCX。若运行时已有fontTools，可不传 `--fonttools-wheel`；若缺少，可用选定Python下载纯Python wheel至任务缓存，再传其完整路径：

```bash
"$DOC_PYTHON" -m pip download --no-deps --only-binary=:all: \
  --platform any --python-version 3.13 --implementation py --abi none \
  fonttools==4.67.0 --dest "$TASK_CACHE"
```

最后按documents技能运行其 `render_docx.py`，逐页检查。渲染时使用依赖加载器返回的内置LibreOffice，不改用系统版本。检查 `*.verification.json` 的卡片数量、嵌入图片、字体子集及实际文件大小，并逐人核对；这些记录与PNG/PDF是本地校对材料，不作为读者正文交付。
