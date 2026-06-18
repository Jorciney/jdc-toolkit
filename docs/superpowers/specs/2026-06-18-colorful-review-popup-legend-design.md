# Design: finish the colorful-review Angular popup as a conventional-comments legend

**Date:** 2026-06-18
**Status:** Approved (design), proceeding to plan

## Goal

The `apps/colorful-review` Chrome extension was partway migrated to an Angular popup
and left unfinished: the popup is generator placeholder text plus dead "GitHub
color-painting" experiment code, and `npx nx test colorful-review` fails to compile.
Finish the migration by turning the popup into a useful **conventional-comments
legend**, remove the dead GitHub experiment, and get build/lint/test green.

## Current state

- **Working feature (leave alone):** `content_script.ts` injects a dropdown of
  conventional-comment types into GitLab merge-request comment toolbars; selecting
  one prepends the colored `\colorbox{…}` markup to the comment textarea. Supported
  by `util.ts`, `styles-util.ts`, and the data in `conventional-comments.ts`.
- **Unfinished popup:** `app/app.component.ts` renders `<h1>Welcome colorful-review</h1>`
  + an "Update Color" button that only `console.log`s, and an `ngOnInit` that runs
  experimental `chrome.scripting`/`chrome.tabs` calls painting a GitHub
  `#user-profile-frame` element red/green.
- **Dead experiment:** `background.ts` (disable action on github.com, inject
  `main.js`, paint `#user-profile-frame` orange) — already commented out of the
  manifest. The manifest's `web_accessible_resources` exposes `index.html` to
  `https://github.com/*` (same experiment).
- **Failing test:** `app.component.spec.ts` compiles `app.component.ts`, which uses
  `chrome.*`; the spec tsconfig only loads `["jest","node"]` types →
  `TS2304: Cannot find name 'chrome'`. Removing the `chrome.*` usage from the
  component is what fixes the test.

## Design

### The legend data (`src/conventional-comments.ts`)

Keep the existing `conventionalComments` object unchanged (the content script still
imports it). Add:

- `export interface LegendEntry { key: string; color: string; description: string }`
- `export const conventionalCommentsLegend: LegendEntry[]` — derived from
  `conventionalComments` by parsing the color out of each entry's `innerText`
  (`/\\colorbox\{([^}]+)\}/`). Entries with no `\colorbox{…}` (i.e. the
  `"Select an option"` placeholder, `innerText: ''`) are filtered out. Colors are
  used verbatim as CSS — both hex (`#02B532`) and named (`gray`, `red`) values are
  valid CSS colors. Result: 13 entries.

All badges render white text (the source data uses `\textcolor{#FFFFFF}` for every
entry), matching how the labels appear in GitLab.

### The popup component (`src/app/app.component.ts` + `.scss`)

Rewrite the standalone component to render the legend with Angular 17 built-in
`@for` control flow (no `CommonModule`/`RouterModule` import needed):

- A title (`Conventional Comments`) and a scrollable list.
- Each row: a colored badge (`[style.background-color]="entry.color"`, white text,
  text = `entry.key`) followed by `entry.description`.
- `app.component.scss`: fixed popup width (~360px), badge + row styling. Kept well
  under the per-component-style budget (2 kb warning / 4 kb error in `project.json`).

Removed from the component: `OnInit`/`ngOnInit`, `updateColor`,
`updateBackgroundColor`, all `chrome.*` calls, and the `RouterModule` import.

### Tests

- **New `src/conventional-comments.spec.ts`** — unit-tests the legend derivation:
  excludes `"Select an option"`, every entry has a non-empty `color` and
  `description`, `Praise` parses to `#02B532`, `Blocking` parses to the named color
  `red`.
- **Rewrite `src/app/app.component.spec.ts`** — drops `RouterTestingModule`; asserts
  the title renders and that the number of `.legend__badge` elements equals
  `conventionalCommentsLegend.length`. (Avoids asserting computed DOM colors, which
  jsdom may normalize.)

### Remove the dead GitHub experiment

- Delete `src/background.ts`.
- `custom-webpack.config.ts`: remove the `background` entry; keep `content_script`.
- `tsconfig.app.json`: remove the now-stale `"src/background.ts"` line from `include`.
- `src/manifest.json`: delete the commented-out `background` block and the
  `web_accessible_resources` block (both GitHub-experiment leftovers). Keep
  `content_scripts` and `action.default_popup`.

### Intentionally left as-is

- `content_script.ts`, `util.ts`, `styles-util.ts` — the working feature.
- `app/app.config.ts`, `app/app.routes.ts` — harmless empty-router scaffold; not part
  of the GitHub experiment.
- `tsconfig.app.json` `"types": ["chrome"]` — harmless once `background.ts` is gone
  (no remaining `chrome.*` usage), left to avoid unnecessary churn.

## Result

`npx nx build colorful-review`, `npx nx lint colorful-review`, and
`npx nx test colorful-review` all succeed; the popup is a colored conventional-
comments legend instead of placeholder text and dead experiment code.

## Out of scope

- Changes to the content-script behavior.
- A settings/toggle popup or persisted state.
- Touching any other app in the monorepo.
