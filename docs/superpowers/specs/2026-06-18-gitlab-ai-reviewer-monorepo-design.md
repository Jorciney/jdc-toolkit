# Design: Port "GitLab AI Code Reviewer" into the jdc-toolkit monorepo

**Date:** 2026-06-18
**Status:** Approved (design), pending spec review

## Goal

Move the standalone "GitLab AI Code Reviewer" Chrome extension (currently a folder
of plain-JS MV3 files at `chrome-plugins-output/chrome-mr-reviews`) into the
`jdc-toolkit` NX monorepo so it builds and runs there using the monorepo's
established toolchain. As part of the move, update the Claude model selection to
currently-supported models and let the user type an arbitrary model name.

## Context

`jdc-toolkit` is an NX + Angular 17 monorepo. It already contains a sibling Chrome
extension, `apps/colorful-review`, which establishes the pattern this port follows:

- Built with `@angular-builders/custom-webpack:browser`.
- `background.ts` + `content_script.ts` declared as webpack entry points in
  `custom-webpack.config.ts` (`{ import, runtime: false }`).
- An Angular app (`main.ts` → `index.html`) serves as the popup.
- `manifest.json`, assets, and icons copied via the build `assets` array.
- Output to `dist/apps/<name>`, loadable as an unpacked extension.

The source extension is plain JavaScript (no build step): `background.js`
(module service worker), `content.js` (~139 KB), `popup.js` (~43 KB) +
`popup.html`, `styles.css`, `ai-reviewer.css`, `privacy_policy.html`, and
`icons/`. All three JS files are **self-contained** — no `import`/`export`
statements — confirmed by inspection. `popup.html` loads `popup.js` via a plain
`<script src="popup.js">` tag and links `styles.css`.

## Approach: pragmatic port (chosen)

Keep the working JS intact and integrate it into the monorepo build, rather than
rewriting the popup into Angular or converting everything to TypeScript. This is
the lowest-risk option: ~180 KB of working code stays byte-for-byte the same and
simply gets bundled by webpack. (Considered and rejected: a full Angular/TS
rewrite — large and risky; a static drop-in — barely uses NX.)

### New app: `apps/gitlab-ai-reviewer`

Sibling to `colorful-review`, wired with the identical build toolchain.

#### File mapping (source → `apps/gitlab-ai-reviewer/src/`)

| Source file | Destination | Build role |
|---|---|---|
| `background.js` | `src/background.js` | webpack entry → `background.js` |
| `content.js` | `src/content.js` | webpack entry → `content.js` |
| `popup.js` | `src/popup.js` | webpack entry → `popup.js` |
| `popup.html` | `src/popup.html` | asset (`action.default_popup`) |
| `privacy_policy.html` | `src/privacy_policy.html` | asset |
| `styles.css` | `src/styles.css` | asset (content-script CSS + popup `<link>`) |
| `ai-reviewer.css` | `src/ai-reviewer.css` | asset (content-script CSS) |
| `icons/` (16/48/128) | `src/icons/` | asset folder |
| `manifest.json` | `src/manifest.json` | asset (copied to dist root) |

#### Build mechanism (mirrors `colorful-review`)

- `custom-webpack.config.ts` declares three entry points, each
  `{ import: 'apps/gitlab-ai-reviewer/src/<file>.js', runtime: false }`:
  `background`, `content`, `popup`. Keeping the files as `.js` (not renaming to
  `.ts`) means **zero TypeScript type-checking churn** on the existing code;
  webpack bundles them as-is. Output filenames match the manifest references
  (`background.js`, `content.js`, `popup.js`).
- `project.json` uses `@angular-builders/custom-webpack:browser`,
  `outputPath: dist/apps/gitlab-ai-reviewer`, `tags: ["scope:app",
  "scope:chrome-extension"]`, with `manifest.json`, `icons`, `popup.html`,
  `privacy_policy.html`, `styles.css`, and `ai-reviewer.css` in the build
  `assets` array. Targets: `build`, `serve`, `lint`, `test` (copied/adapted from
  `colorful-review`).
- A minimal `main.ts` + `index.html` Angular stub exists only to satisfy the
  `@angular-builders/custom-webpack:browser` builder (which requires an Angular
  entry). It is **not referenced by the manifest** — the real popup is the static
  `popup.html`/`popup.js`. This matches the proven sibling pattern.
- Supporting tsconfig files (`tsconfig.json`, `tsconfig.app.json`,
  `tsconfig.spec.json`), `.eslintrc.json`, and `jest.config.ts` copied/adapted
  from `colorful-review`.

#### Manifest edit

Remove `"type": "module"` from the `background` service-worker entry. Webpack
bundles `background.js` into a self-contained classic script and there are no ES
imports, so module type is unnecessary and risks loader issues. All other
manifest fields (permissions, host_permissions, content_scripts matches/css,
action, icons, web_accessible_resources) are preserved.

### Model selection changes

The extension calls the Anthropic Messages API directly via browser `fetch`
(`POST https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`).
The model is just a string in the request body — swapping IDs requires **no
change to request structure**. The same Messages API shape works for the new
model IDs.

Current IDs in use are outdated or retired:
- `claude-opus-4-20250514` — deprecated; the default + main-review model (~10 spots)
- `claude-3-sonnet-20240229` — **retired** (Jul 2025); fallback default (3 spots)
- `claude-3-haiku-20240307` — deprecated; cheap connection-test calls (2 spots)

#### UI: editable combobox (`popup.html` lines 210-213)

Replace the fixed `<select id="model-select" class="modern-select">` with an
editable combobox: an `<input id="model-select" class="modern-select"
list="model-options">` plus a `<datalist id="model-options">`. This lets the user
**pick a suggested supported model OR type any model name**. `popup.js` reads and
writes `.value` and listens for the `change` event — both work unchanged on an
`<input>`. Suggested datalist options (current supported models):

- `claude-opus-4-8` — Claude Opus 4.8 (default)
- `claude-sonnet-4-6` — Claude Sonnet 4.6
- `claude-haiku-4-5` — Claude Haiku 4.5
- `claude-opus-4-7` — Claude Opus 4.7
- `claude-fable-5` — Claude Fable 5

#### Code: uniform ID replacement (`popup.js`, `content.js`, `background.js`)

Applied across all three JS files in the new app:

- `claude-opus-4-20250514` → `claude-opus-4-8` (default in settings + every
  main-review fallback)
- `claude-3-sonnet-20240229` → `claude-opus-4-8` (standardize fallback default)
- `claude-3-haiku-20240307` → `claude-haiku-4-5` (preserves the "fast/cheap model
  for testing" intent for connection-test calls)

Result: `claude-opus-4-8` is the single default everywhere; `claude-haiku-4-5` is
the test-call model; the combobox empowers any supported (or future) model by
typing.

## Result

`npx nx build gitlab-ai-reviewer` produces a loadable unpacked extension in
`dist/apps/gitlab-ai-reviewer`, functionally identical to the current extension
except for the modernized, user-editable model selection — living natively in the
monorepo.

## Out of scope

- Angularizing the popup or converting JS to TypeScript.
- Behavior changes beyond the model-ID modernization.
- An e2e app for the new extension.
- Adaptive-thinking / effort / other newer API parameters (the basic Messages API
  request is unchanged; only model strings move).
