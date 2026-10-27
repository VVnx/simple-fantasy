<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commit messages

Write commit messages that describe the specific changes and the affected feature.
Do not use generic messages such as `update site source`, `update`, or `fix` alone.
For example, use `Add player performance details to daily briefings` or
`Fix surprise board player matching`. This applies to manual commits and commits
created through site publishing or deployment workflows.

## Daily briefings

The project's generation skill is versioned in
`skills/nba-fantasy-briefing/SKILL.md`. Treat this project copy as the source of
truth. When updating it, keep the installed personal copy at
`$CODEX_HOME/skills/nba-fantasy-briefing` (or `~/.codex/skills/nba-fantasy-briefing`
when `CODEX_HOME` is unset) in sync, and include the project copy in the commit.

The default illustrated Word export skill is versioned in
`skills/nba-fantasy-briefing-docx/SKILL.md` and is called after each complete
daily briefing. Keep this skill and its scripts in sync with the installed
personal copy using the same rule. Preserve the user's blue headings, compact
player cards, and 15 MB document limit.

For requests to publish or update a daily briefing, follow `docs/BRIEFINGS.md`.
Use the existing Sites project in `.openai/hosting.json` and the protected upload
API. Retrieve credentials through the authorized Sites tools, pass them only on
hidden stdin, and verify the saved text. Never put credentials in source, browser
code, files, command arguments, or output. Publishing a briefing does not require
a source deployment. Do not create a schedule unless the user requests one.
