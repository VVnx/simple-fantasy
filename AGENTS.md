<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Daily briefings

For requests to publish or update a daily briefing, follow `docs/BRIEFINGS.md`.
Use the existing Sites project in `.openai/hosting.json` and the protected upload
API. Retrieve credentials through the authorized Sites tools, pass them only on
hidden stdin, and verify the saved text. Never put credentials in source, browser
code, files, command arguments, or output. Publishing a briefing does not require
a source deployment. Do not create a schedule unless the user requests one.
