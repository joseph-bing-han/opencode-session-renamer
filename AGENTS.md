# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains the TypeScript source:
  - `src/index.ts`: OpenCode plugin entry (listens to `chat.message`, generates a title, updates session title).
  - `src/config.ts`: Config loading + defaults (supports JSON/JSONC).
- `dist/` contains the Bun build output used for distribution/runtime.
- `session-renamer.example.jsonc` provides an example end-user configuration.

## Build, Test, and Development Commands

- `bun install`: Install dependencies.
- `bun run dev`: Run the plugin in watch mode (useful while iterating locally).
- `bun run build`: Bundle `src/index.ts` into `dist/` for running/publishing.
- `bun run typecheck`: TypeScript type-check only (`tsc --noEmit`).

## Plugin Architecture

### Hook System

The plugin uses the `chat.message` hook which triggers when a message is processed. Key considerations:

- **Hook timing**: `chat.message` fires before messages are persisted to database, so `session.messages` API may return empty
- **Content source**: Use `output.message.summary` or `output.parts` (assistant response) for content, not `session.messages` API
- **Export format**: OpenCode requires **named exports** (`export const pluginName = plugin`), not just `export default`

### Temp Session Handling

The `generateTitle` function creates temporary sessions to call LLM for title generation. These temp sessions also trigger `chat.message` hook, so the plugin maintains a `tempSessions` Set to filter them out and prevent infinite loops.

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Prefer explicit types for public helpers and SDK boundaries.
- Indentation: 2 spaces; keep functions small and single-purpose.
- Naming: `camelCase` for variables/functions, `PascalCase` for types, `SCREAMING_SNAKE_CASE` for constants.
- User-facing strings in code should be English. Keep comments short and clear.

## Testing Guidelines

- This repository currently has no test suite. If you add tests, keep them close to behavior boundaries (e.g., config parsing, model resolution) and add a `bun run test` script.
- Manual testing: Create symlink `ln -sf src/index.ts ~/.config/opencode/plugin/session-renamer.ts`, restart OpenCode, send a message, verify session title changes.

## Commit & Pull Request Guidelines

- Use imperative, scoped messages (e.g., `fix: fallback when model missing`, `feat: add temp session filtering`).
- PRs should include: a short description, reproduction steps, and any config changes needed.

## Local Plugin Loading Notes

- **Recommended**: Symlink to `~/.config/opencode/plugin/` directory for auto-loading
- **Alternative**: Configure `plugin` array in `opencode.jsonc` with absolute path or `file://` prefix
