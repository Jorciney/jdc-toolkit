# colorful-review Popup Legend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the `apps/colorful-review` Angular popup as a conventional-comments legend (color swatch + description per type, driven by existing data), remove the dead GitHub experiment code, and get build/lint/test green.

**Architecture:** Derive a `conventionalCommentsLegend` array from the existing `conventionalComments` data by parsing the `\colorbox{…}` color. Rewrite the standalone Angular popup component to render it with `@for`. Delete the unused `background.ts` experiment and its wiring. TDD: data spec and component spec first.

**Tech Stack:** NX 18, Angular 17 (standalone components, built-in control flow), Jest (`jest-preset-angular`), Chrome Extension MV3.

**Paths:** monorepo root `/Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit`; app `apps/colorful-review`. All commands run from the monorepo root. Work on branch `feat/colorful-review-popup-legend` (already created).

> **Note on `npx nx`:** if any `npx nx …` command modifies the repo-root `package-lock.json`, run `git checkout package-lock.json` afterward — that churn is out of scope and must not be committed.

---

## Task 1: Derive the legend from the conventional-comments data (TDD)

**Files:**
- Create: `apps/colorful-review/src/conventional-comments.spec.ts`
- Modify: `apps/colorful-review/src/conventional-comments.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/colorful-review/src/conventional-comments.spec.ts`:
```typescript
import { conventionalCommentsLegend } from './conventional-comments';

describe('conventionalCommentsLegend', () => {
  it('excludes the placeholder entry that has no color', () => {
    expect(
      conventionalCommentsLegend.some((e) => e.key === 'Select an option')
    ).toBe(false);
  });

  it('gives every entry a non-empty color and description', () => {
    expect(conventionalCommentsLegend.length).toBeGreaterThan(0);
    for (const entry of conventionalCommentsLegend) {
      expect(entry.color).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it('parses the hex color for Praise', () => {
    const praise = conventionalCommentsLegend.find((e) => e.key === 'Praise');
    expect(praise?.color).toBe('#02B532');
  });

  it('parses named colors such as Blocking (red)', () => {
    const blocking = conventionalCommentsLegend.find(
      (e) => e.key === 'Blocking'
    );
    expect(blocking?.color).toBe('red');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days'`
Expected: FAIL — `conventionalCommentsLegend` is not exported (TS error / "is not a function"/undefined).

- [ ] **Step 3: Implement the legend derivation**

Append to `apps/colorful-review/src/conventional-comments.ts` (after the existing `conventionalComments` object; do NOT modify that object):
```typescript

export interface LegendEntry {
  key: string;
  color: string;
  description: string;
}

const COLORBOX_RE = /\\colorbox\{([^}]+)\}/;

export const conventionalCommentsLegend: LegendEntry[] = Object.entries(
  conventionalComments
)
  .map(([key, value]) => {
    const match = value.innerText.match(COLORBOX_RE);
    return match
      ? { key, color: match[1], description: value.description }
      : null;
  })
  .filter((entry): entry is LegendEntry => entry !== null);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days'`
Expected: the `conventionalCommentsLegend` suite passes (4 tests). Note: the existing `app.component.spec.ts` may still fail at this point — that is fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git add apps/colorful-review/src/conventional-comments.ts apps/colorful-review/src/conventional-comments.spec.ts
git commit -m "feat(colorful-review): derive conventionalCommentsLegend from comment data"
```

---

## Task 2: Rewrite the popup component to render the legend (TDD)

**Files:**
- Modify: `apps/colorful-review/src/app/app.component.spec.ts`
- Modify: `apps/colorful-review/src/app/app.component.ts`
- Modify: `apps/colorful-review/src/app/app.component.scss`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `apps/colorful-review/src/app/app.component.spec.ts` with:
```typescript
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { conventionalCommentsLegend } from '../conventional-comments';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('renders the legend title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain(
      'Conventional Comments'
    );
  });

  it('renders one badge per legend entry', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const badges = compiled.querySelectorAll('.legend__badge');
    expect(badges.length).toBe(conventionalCommentsLegend.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days'`
Expected: FAIL — compile error `TS2304: Cannot find name 'chrome'` (current component still has the experiment code), and/or the assertions fail because the current template has no `Conventional Comments` title or `.legend__badge` elements.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `apps/colorful-review/src/app/app.component.ts` with:
```typescript
import { Component } from '@angular/core';
import { conventionalCommentsLegend } from '../conventional-comments';

@Component({
  standalone: true,
  selector: 'jdc-toolkit-root',
  template: `
    <div class="legend">
      <h1 class="legend__title">Conventional Comments</h1>
      <ul class="legend__list">
        @for (entry of legend; track entry.key) {
          <li class="legend__item">
            <span
              class="legend__badge"
              [style.background-color]="entry.color"
              >{{ entry.key }}</span
            >
            <span class="legend__description">{{ entry.description }}</span>
          </li>
        }
      </ul>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly legend = conventionalCommentsLegend;
}
```

- [ ] **Step 4: Add the component styles**

Replace the entire contents of `apps/colorful-review/src/app/app.component.scss` with:
```scss
:host {
  display: block;
  width: 360px;
  font-family: system-ui, -apple-system, sans-serif;
}

.legend {
  padding: 12px;
}

.legend__title {
  margin: 0 0 8px;
  font-size: 1rem;
}

.legend__list {
  margin: 0;
  padding: 0;
  max-height: 480px;
  overflow-y: auto;
  list-style: none;
}

.legend__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.legend__badge {
  align-self: flex-start;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
}

.legend__description {
  font-size: 0.75rem;
  color: #333;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx nx test colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days'`
Expected: PASS — both suites (`conventionalCommentsLegend` and `AppComponent`) green, `Test Suites: 2 passed`.

- [ ] **Step 6: Commit**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git add apps/colorful-review/src/app/app.component.ts apps/colorful-review/src/app/app.component.scss apps/colorful-review/src/app/app.component.spec.ts
git commit -m "feat(colorful-review): render conventional-comments legend in popup"
```

---

## Task 3: Remove the dead GitHub experiment

**Files:**
- Delete: `apps/colorful-review/src/background.ts`
- Modify: `apps/colorful-review/custom-webpack.config.ts`
- Modify: `apps/colorful-review/tsconfig.app.json`
- Modify: `apps/colorful-review/src/manifest.json`

- [ ] **Step 1: Delete the background experiment file**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git rm apps/colorful-review/src/background.ts
```

- [ ] **Step 2: Remove the `background` webpack entry**

Replace the entire contents of `apps/colorful-review/custom-webpack.config.ts` with:
```typescript
import type { Configuration } from 'webpack';

module.exports = {
  entry: {
    content_script: {
      import: 'apps/colorful-review/src/content_script.ts',
      runtime: false,
    },
  },
} as Configuration;
```

- [ ] **Step 3: Remove the stale `src/background.ts` from tsconfig include**

In `apps/colorful-review/tsconfig.app.json`, change the `include` array from:
```json
  "include": [
    "src/**/*.d.ts",
    "src/manifest.json",
    "src/background.ts",
    "src/content_script.ts"
  ],
```
to:
```json
  "include": [
    "src/**/*.d.ts",
    "src/manifest.json",
    "src/content_script.ts"
  ],
```

- [ ] **Step 4: Clean the manifest**

In `apps/colorful-review/src/manifest.json`, remove the commented-out `background` block (the four `//`-prefixed lines) and the entire `web_accessible_resources` block. The resulting file must be:
```json
{
  "manifest_version": 3,
  "name": "Colorful Review Comments for GitLab",
  "version": "1.0",
  "description": "Add colorful conventional comments to merge requests in GitLab.",
  "author": "jorciney.dias@hotmail.com",
  "host_permissions": ["<all_urls>"],
  "permissions": ["activeTab", "scripting", "tabs", "webNavigation"],
  "action": {
    "default_popup": "index.html"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.gitlab.com/*/merge_requests*",
        "https://gitlab.cmt.apps.telenet.be/*/merge_requests*",
        "*://*.gitlab.org/merge_requests*",
        "*://*.gitlab.net/merge_requests*"
      ],
      "js": ["content_script.js"]
    }
  ]
}
```
(Note: the original `matches` array had `*://*.gitlab.com/*/merge_requests*` listed three times — collapsed to one here. This is a harmless de-duplication; keep the other distinct entries.)

- [ ] **Step 5: Verify the manifest is valid JSON**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
node -e "const m=require('./apps/colorful-review/src/manifest.json'); console.log('valid; has background:', 'background' in m, '| has war:', 'web_accessible_resources' in m, '| popup:', m.action.default_popup);"
```
Expected: `valid; has background: false | has war: false | popup: index.html`.

- [ ] **Step 6: Commit**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git add apps/colorful-review/custom-webpack.config.ts apps/colorful-review/tsconfig.app.json apps/colorful-review/src/manifest.json
git commit -m "chore(colorful-review): remove dead GitHub experiment (background.ts, web_accessible_resources)"
```

---

## Task 4: Full verification (build + lint + test)

**Files:** none (verification)

- [ ] **Step 1: Build**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
npx nx build colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days' | tail -20
```
Expected: `Successfully ran target build for project colorful-review`, no errors. `content_script.js` and the Angular popup bundle (`main.js`, `index.html`) emitted; no `background.js` entry needed. If `npx nx` touched `package-lock.json`, run `git checkout package-lock.json`.

- [ ] **Step 2: Lint**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
npx nx lint colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days' | tail -20
```
Expected: `Successfully ran target lint`, **0 errors**. The two pre-existing warnings (from the removed `app.component.ts` experiment code) should be gone — expect `0 problems`. If any warning remains, report it (do not suppress).

- [ ] **Step 3: Test**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
npx nx test colorful-review --skip-nx-cache 2>&1 | grep -v -i 'nx cloud\|workspace\|cloud.nx\|three days' | tail -20
```
Expected: `Successfully ran target test`, `Test Suites: 2 passed`, all tests green.

- [ ] **Step 4: Confirm clean working tree**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git status --short
```
Expected: empty (no uncommitted changes — in particular no stray `package-lock.json`).

---

## Self-Review

**Spec coverage:**
- Legend derivation in `conventional-comments.ts` (parse `\colorbox{…}`, filter placeholder) → Task 1. ✅
- Popup renders legend (badge + description, `@for`, white text, ~360px) → Task 2. ✅
- Remove dead GitHub experiment (`background.ts`, webpack entry, tsconfig include, commented background block, `web_accessible_resources`) → Task 3. ✅
- Failing test fixed (remove `chrome.*` from component) → Task 2 (rewrite removes the `chrome.*` usage that caused `TS2304`). ✅
- New data spec + rewritten component spec → Tasks 1, 2. ✅
- build/lint/test green → Task 4. ✅
- Leave content_script/util/styles-util and app.config/app.routes as-is → not modified by any task. ✅

**Placeholder scan:** No TBD/TODO; full file contents given for every change; every command has expected output. ✅

**Type/name consistency:** `LegendEntry { key; color; description }` defined in Task 1 is consumed by the component (`entry.key`, `entry.color`, `entry.description`) in Task 2 and the specs. `conventionalCommentsLegend` is the single exported symbol referenced by the component and both specs. The CSS class `.legend__badge` asserted in the component spec (Task 2 Step 1) matches the template (Task 2 Step 3). ✅
