# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A bilingual (Arabic/English, RTL-first) translation editor. A React SPA lets a user pick a GitHub repository, edit its `ar.json` / `en.json` side by side, and submit the changes as a pull request. There is no backend: the browser calls the GitHub API directly with Octokit, using a fine-grained personal access token. The app has no user login, so whatever the token can reach is what the editor can edit.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build
npm run lint         # eslint .
npm run format       # prettier (no semicolons, double quotes, tailwind class sorting)
npm run preview      # serve the built dist/
npx tsc -b           # the real typecheck: app and node projects
```

- `npm run typecheck` (`tsc --noEmit`) checks **nothing**: the root `tsconfig.json` has `"files": []` and only lists project references. Use `npx tsc -b` instead.
- There is no test suite.
- Copy `.env.example` to `.env` and set `GITHUB_TOKEN`. The token needs Contents and Pull requests read/write on the target repositories.
- Both `package-lock.json` and `bun.lock` are committed; the scripts use npm.

## Architecture

**GitHub access:** everything is in `src/services/github.ts`, and nothing else talks to GitHub.
- `vite.config.ts` sets `envPrefix: ["VITE_", "GITHUB_TOKEN"]`, so `import.meta.env.GITHUB_TOKEN` is **inlined into the built JavaScript**. Anyone who can load the deployed app can read the token. Treat a deployment as having the token's full permissions. Its type is declared in `src/vite-env.d.ts`.
- A missing token makes every call throw. A 401 (`isUnauthorized`) appears in the UI as "token invalid, expired or revoked".

**Translation file discovery:**
- A repository is editable only if it has both locales at `src/i18n/{ar,en}.json` or `src/i18n/locales/{ar,en}.json` (`translationPaths`).
- `getAllRepositories` checks for these files with a single GraphQL query: one aliased `object(expression: "HEAD:<path>")` per candidate path, against each repository's default branch. It calls raw `POST /graphql` instead of `octokit.graphql`, so a repository the token can't read comes back as a null node and is filtered out, instead of failing the whole request. It fetches only the first 100 repositories, sorted by most recently updated.
- Writes only ever touch the two discovered paths.

**Editing session / PR lifecycle** (driven by `src/stores/github-store.ts`):
1. "Start editing" creates a branch `locale/<YYYYMMDD-HHMMSS>` from the default branch. If an open PR already exists (head branch `locale/*` in the same repository, title starting with `Update translations (`), the editor reuses that branch instead.
2. "Submit" writes both locale files as **one commit** through the Git Data API (tree, commit, then ref). If the branch tip is already a locale-editor commit (message `Update translations from the locale editor`), that commit is amended and the ref is force-updated, so a PR branch holds a single rolling commit. A submit that changes nothing creates no commit. The first submit opens the PR; later submits only update the branch.
3. PR status is `open | approved | merged | closed`. "Approved" means at least one reviewer's latest review approves and no reviewer's latest review requests changes. A merged or closed PR clears `branchName`/`baseBranch`, so the next session starts a new branch.

The PR-matching title prefix, the `locale/` branch prefix and the commit message are protocol, not copy. Changing them breaks detection of existing PRs and the amend behaviour.

**Client state:** uses `@tanstack/react-store` with module-level stores and plain async functions, not hooks or context.
- `githubStore` holds the account, the repositories, and `Platform`s (one per repository: loaded locales, file paths, branch/PR state). It also tracks the loading flags `localeLoadingPlatformId` and `sessionLoadingPlatformId`.
- `translationEditorStore` holds the selected platform and `edits`. `edits` is keyed by a dot-joined JSON path (e.g. `section.items.0.title`) and holds `{ar, en}`. Unsaved edits persist to `localStorage` under `translation-draft:<platformId>` (`readDraft`/`writeDraft`). `readDraft` discards keys that no longer exist in the file. `applyEdits` merges the edits back into the JSON before submission.
- `collectEntries` walks the string leaves of the Arabic file; English values are looked up at the same paths. Sections in the sidebar are the top-level keys.

**UI / i18n:**
- The app's own strings are in `src/i18n/{ar,en}.json` (i18next). These are also the files the editor edits when it is pointed at this repository.
- `AppProviders` sets `<html lang/dir>` from the current language and wraps the app in Base UI's `DirectionProvider`.
- `src/components/ui/` contains shadcn components (style `base-vega`, built on `@base-ui/react`, not Radix, with `rtl: true`). Add more with `npx shadcn@latest add <name>`. Import alias: `@/` → `src/`.

**Leftovers:** these come from earlier approaches, and nothing in the current code uses them:
- `.pages.yml` (a Pages CMS config pointing at `src/i18n/locales/ar.json`) and the `@netlify/functions` dependency.
- The `.wrangler` entries in `.gitignore`, from the removed Cloudflare Worker.

`README.md` is the unmodified shadcn template.
