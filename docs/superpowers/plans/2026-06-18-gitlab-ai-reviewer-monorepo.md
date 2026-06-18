# GitLab AI Code Reviewer — Monorepo Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the standalone "GitLab AI Code Reviewer" Chrome extension into the `jdc-toolkit` NX monorepo as `apps/gitlab-ai-reviewer`, building via the same custom-webpack toolchain as `apps/colorful-review`, and modernize the Claude model selection (supported models + free-text entry).

**Architecture:** Pragmatic port. The three self-contained plain-JS files (`background.js`, `content.js`, `popup.js`) become webpack entry points (kept as `.js`, no TypeScript conversion). `popup.html`, CSS, icons, and `manifest.json` are copied as build assets. A minimal Angular stub (`main.ts` + `index.html`) satisfies the `@angular-builders/custom-webpack:browser` builder but is unused by the manifest.

**Tech Stack:** NX 18, Angular 17, `@angular-builders/custom-webpack:browser`, webpack, Chrome Extension Manifest V3, Anthropic Messages API.

**Paths:**
- Source extension: `/Users/jorciney.dias.chaveiro/git/JorcysHome/chrome-plugins-output/chrome-mr-reviews`
- Monorepo root: `/Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit`
- New app: `apps/gitlab-ai-reviewer` (relative to monorepo root)
- Reference sibling: `apps/colorful-review`

All commands run from the monorepo root unless noted. Work happens on branch `feat/gitlab-ai-reviewer-port` (already created).

---

## Task 1: Copy the source extension files into the new app `src/`

**Files:**
- Create: `apps/gitlab-ai-reviewer/src/{background.js,content.js,popup.js,popup.html,privacy_policy.html,styles.css,ai-reviewer.css,manifest.json}`
- Create: `apps/gitlab-ai-reviewer/src/icons/{icon16.png,icon48.png,icon128.png}`

- [ ] **Step 1: Create the app src directory and copy the source files verbatim**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
SRC=/Users/jorciney.dias.chaveiro/git/JorcysHome/chrome-plugins-output/chrome-mr-reviews
mkdir -p apps/gitlab-ai-reviewer/src/icons
cp "$SRC"/background.js "$SRC"/content.js "$SRC"/popup.js \
   "$SRC"/popup.html "$SRC"/privacy_policy.html \
   "$SRC"/styles.css "$SRC"/ai-reviewer.css "$SRC"/manifest.json \
   apps/gitlab-ai-reviewer/src/
cp "$SRC"/icons/icon16.png "$SRC"/icons/icon48.png "$SRC"/icons/icon128.png \
   apps/gitlab-ai-reviewer/src/icons/
```

- [ ] **Step 2: Verify all files copied**

Run:
```bash
ls -1 apps/gitlab-ai-reviewer/src apps/gitlab-ai-reviewer/src/icons
```
Expected: `ai-reviewer.css background.js content.js manifest.json popup.html popup.js privacy_policy.html styles.css` and the three icon PNGs.

- [ ] **Step 3: Commit**

```bash
git add apps/gitlab-ai-reviewer/src
git commit -m "feat(gitlab-ai-reviewer): vendor source extension files into monorepo app"
```

---

## Task 2: Add the Angular stub (popup builder requirement)

**Files:**
- Create: `apps/gitlab-ai-reviewer/src/main.ts`
- Create: `apps/gitlab-ai-reviewer/src/index.html`
- Create: `apps/gitlab-ai-reviewer/src/styles.scss`
- Create: `apps/gitlab-ai-reviewer/src/test-setup.ts`
- Create: `apps/gitlab-ai-reviewer/src/app/app.component.ts`
- Create: `apps/gitlab-ai-reviewer/src/app/app.component.scss`
- Create: `apps/gitlab-ai-reviewer/src/app/app.config.ts`
- Create: `apps/gitlab-ai-reviewer/src/app/app.routes.ts`

This stub is required because `@angular-builders/custom-webpack:browser` needs an Angular `main`/`index`. It is **not** referenced by `manifest.json` (the real popup is `popup.html`). It produces unused `main.js`/`index.html` in dist — harmless.

- [ ] **Step 1: Create `src/main.ts`**

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
```

- [ ] **Step 2: Create `src/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>gitlab-ai-reviewer</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <jdc-toolkit-root></jdc-toolkit-root>
  </body>
</html>
```

- [ ] **Step 3: Create `src/styles.scss`**

```scss
/* Angular stub global styles — the extension ships its own styles.css / ai-reviewer.css as assets. */
```

- [ ] **Step 4: Create `src/test-setup.ts`**

```typescript
// @ts-expect-error https://thymikee.github.io/jest-preset-angular/docs/getting-started/test-environment
globalThis.ngJest = {
  testEnvironmentOptions: {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
  },
};
import 'jest-preset-angular/setup-jest';
```

- [ ] **Step 5: Create `src/app/app.component.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'jdc-toolkit-root',
  template: `<h1>GitLab AI Code Reviewer</h1>`,
  styleUrl: './app.component.scss',
})
export class AppComponent {}
```

- [ ] **Step 6: Create `src/app/app.component.scss` (empty)**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
: > apps/gitlab-ai-reviewer/src/app/app.component.scss
```

- [ ] **Step 7: Create `src/app/app.config.ts`**

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes)],
};
```

- [ ] **Step 8: Create `src/app/app.routes.ts`**

```typescript
import { Route } from '@angular/router';

export const appRoutes: Route[] = [];
```

- [ ] **Step 9: Commit**

```bash
git add apps/gitlab-ai-reviewer/src/main.ts apps/gitlab-ai-reviewer/src/index.html \
        apps/gitlab-ai-reviewer/src/styles.scss apps/gitlab-ai-reviewer/src/test-setup.ts \
        apps/gitlab-ai-reviewer/src/app
git commit -m "feat(gitlab-ai-reviewer): add minimal Angular stub for the browser builder"
```

---

## Task 3: Add the build/config files (project.json, tsconfigs, eslint, jest, webpack)

**Files:**
- Create: `apps/gitlab-ai-reviewer/custom-webpack.config.ts`
- Create: `apps/gitlab-ai-reviewer/project.json`
- Create: `apps/gitlab-ai-reviewer/tsconfig.json`
- Create: `apps/gitlab-ai-reviewer/tsconfig.app.json`
- Create: `apps/gitlab-ai-reviewer/tsconfig.spec.json`
- Create: `apps/gitlab-ai-reviewer/tsconfig.editor.json`
- Create: `apps/gitlab-ai-reviewer/.eslintrc.json`
- Create: `apps/gitlab-ai-reviewer/jest.config.ts`

- [ ] **Step 1: Create `custom-webpack.config.ts`**

The three plain-JS files become standalone bundles (`runtime: false` = no shared runtime chunk). Output names match the manifest references.

```typescript
import type { Configuration } from 'webpack';

module.exports = {
  entry: {
    background: {
      import: 'apps/gitlab-ai-reviewer/src/background.js',
      runtime: false,
    },
    content: {
      import: 'apps/gitlab-ai-reviewer/src/content.js',
      runtime: false,
    },
    popup: {
      import: 'apps/gitlab-ai-reviewer/src/popup.js',
      runtime: false,
    },
  },
} as Configuration;
```

- [ ] **Step 2: Create `project.json`**

Note vs. `colorful-review`: `styles` is `[]` (the extension ships its own `styles.css`/`ai-reviewer.css` as assets, so we must NOT emit an Angular `styles.css` that would collide), and the assets array lists the extension's static files.

```json
{
  "name": "gitlab-ai-reviewer",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "prefix": "jdc-toolkit",
  "sourceRoot": "apps/gitlab-ai-reviewer/src",
  "tags": ["scope:app", "scope:chrome-extension"],
  "targets": {
    "build": {
      "executor": "@angular-builders/custom-webpack:browser",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/gitlab-ai-reviewer",
        "index": "apps/gitlab-ai-reviewer/src/index.html",
        "main": "apps/gitlab-ai-reviewer/src/main.ts",
        "polyfills": ["zone.js"],
        "tsConfig": "apps/gitlab-ai-reviewer/tsconfig.app.json",
        "inlineStyleLanguage": "scss",
        "assets": [
          "apps/gitlab-ai-reviewer/src/manifest.json",
          "apps/gitlab-ai-reviewer/src/popup.html",
          "apps/gitlab-ai-reviewer/src/privacy_policy.html",
          "apps/gitlab-ai-reviewer/src/styles.css",
          "apps/gitlab-ai-reviewer/src/ai-reviewer.css",
          "apps/gitlab-ai-reviewer/src/icons"
        ],
        "styles": [],
        "scripts": [],
        "customWebpackConfig": {
          "path": "apps/gitlab-ai-reviewer/custom-webpack.config.ts"
        },
        "optimization": {
          "styles": {
            "inlineCritical": false
          }
        }
      },
      "configurations": {
        "production": {
          "budgets": [
            {
              "type": "initial",
              "maximumWarning": "500kb",
              "maximumError": "2mb"
            },
            {
              "type": "anyComponentStyle",
              "maximumWarning": "2kb",
              "maximumError": "4kb"
            }
          ],
          "outputHashing": "none"
        },
        "development": {
          "buildOptimizer": false,
          "optimization": false,
          "vendorChunk": true,
          "extractLicenses": false,
          "sourceMap": true,
          "namedChunks": true,
          "outputHashing": "none"
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "configurations": {
        "production": {
          "buildTarget": "gitlab-ai-reviewer:build:production"
        },
        "development": {
          "buildTarget": "gitlab-ai-reviewer:build:development"
        }
      },
      "defaultConfiguration": "development"
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"]
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "apps/gitlab-ai-reviewer/jest.config.ts"
      }
    }
  }
}
```

> Note: the `initial` budget `maximumError` is raised to `2mb` (vs `colorful-review`'s `1mb`) because `content.js` alone is ~139 KB and the bundled total may exceed 1 MB. Adjust down later if desired.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "useDefineForClassFields": false,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "files": [],
  "include": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" },
    { "path": "./tsconfig.editor.json" }
  ],
  "extends": "../../tsconfig.base.json",
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
```

- [ ] **Step 4: Create `tsconfig.app.json`**

Only the Angular stub is type-checked here. The plain-JS entry files are handled by webpack and are deliberately NOT included (they are not TypeScript).

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["chrome"]
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"],
  "exclude": ["jest.config.ts", "src/**/*.test.ts", "src/**/*.spec.ts"]
}
```

- [ ] **Step 5: Create `tsconfig.spec.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "module": "commonjs",
    "target": "es2016",
    "types": ["jest", "node"]
  },
  "files": ["src/test-setup.ts"],
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts"
  ]
}
```

- [ ] **Step 6: Create `tsconfig.editor.json`**

```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*.ts"],
  "compilerOptions": {
    "types": ["jest", "node"]
  }
}
```

- [ ] **Step 7: Create `.eslintrc.json`**

```json
{
  "extends": ["../../.eslintrc.json"],
  "ignorePatterns": ["!**/*"],
  "overrides": [
    {
      "files": ["*.ts"],
      "extends": [
        "plugin:@nx/angular",
        "plugin:@angular-eslint/template/process-inline-templates"
      ],
      "rules": {
        "@angular-eslint/directive-selector": [
          "error",
          {
            "type": "attribute",
            "prefix": "jdcToolkit",
            "style": "camelCase"
          }
        ],
        "@angular-eslint/component-selector": [
          "error",
          {
            "type": "element",
            "prefix": "jdc-toolkit",
            "style": "kebab-case"
          }
        ]
      }
    },
    {
      "files": ["*.html"],
      "extends": ["plugin:@nx/angular-template"],
      "rules": {}
    }
  ]
}
```

- [ ] **Step 8: Create `jest.config.ts`**

```typescript
/* eslint-disable */
export default {
  displayName: 'gitlab-ai-reviewer',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/gitlab-ai-reviewer',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$)'],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
```

- [ ] **Step 9: Verify NX recognizes the project**

Run:
```bash
npx nx show projects | grep gitlab-ai-reviewer
```
Expected: prints `gitlab-ai-reviewer`.

- [ ] **Step 10: Commit**

```bash
git add apps/gitlab-ai-reviewer/custom-webpack.config.ts apps/gitlab-ai-reviewer/project.json \
        apps/gitlab-ai-reviewer/tsconfig.json apps/gitlab-ai-reviewer/tsconfig.app.json \
        apps/gitlab-ai-reviewer/tsconfig.spec.json apps/gitlab-ai-reviewer/tsconfig.editor.json \
        apps/gitlab-ai-reviewer/.eslintrc.json apps/gitlab-ai-reviewer/jest.config.ts
git commit -m "feat(gitlab-ai-reviewer): add NX build config mirroring colorful-review"
```

---

## Task 4: Edit the manifest for the webpack-bundled service worker

**Files:**
- Modify: `apps/gitlab-ai-reviewer/src/manifest.json`

- [ ] **Step 1: Remove `"type": "module"` from the background entry**

Change this block:
```json
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
```
to:
```json
  "background": {
    "service_worker": "background.js"
  },
```

(Webpack bundles `background.js` into a self-contained classic script; there are no ES `import`s, so module type is unnecessary and risks a loader error.)

- [ ] **Step 2: Verify the manifest is still valid JSON and no longer declares a module worker**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
node -e "JSON.parse(require('fs').readFileSync('apps/gitlab-ai-reviewer/src/manifest.json','utf8')); console.log('valid json')"
grep -c '"type": "module"' apps/gitlab-ai-reviewer/src/manifest.json
```
Expected: `valid json` then `0`.

- [ ] **Step 3: Commit**

```bash
git add apps/gitlab-ai-reviewer/src/manifest.json
git commit -m "fix(gitlab-ai-reviewer): drop module service-worker type for bundled background.js"
```

---

## Task 5: Modernize the model IDs in the JS files

**Files:**
- Modify: `apps/gitlab-ai-reviewer/src/popup.js`
- Modify: `apps/gitlab-ai-reviewer/src/content.js`
- Modify: `apps/gitlab-ai-reviewer/src/background.js`

- [ ] **Step 1: Replace the three stale model IDs across all three files**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit/apps/gitlab-ai-reviewer/src
# Default + main-review model
perl -pi -e 's/claude-opus-4-20250514/claude-opus-4-8/g' popup.js content.js background.js
# Retired Sonnet fallback -> standardize on the new default
perl -pi -e 's/claude-3-sonnet-20240229/claude-opus-4-8/g' popup.js content.js background.js
# Cheap connection-test model
perl -pi -e 's/claude-3-haiku-20240307/claude-haiku-4-5/g' popup.js content.js background.js
```

- [ ] **Step 2: Verify no stale IDs remain and new IDs are present**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit/apps/gitlab-ai-reviewer/src
echo "stale (expect 0):"; grep -c -E 'claude-opus-4-20250514|claude-3-sonnet-20240229|claude-3-haiku-20240307' popup.js content.js background.js
echo "opus-4-8 occurrences:"; grep -c 'claude-opus-4-8' popup.js content.js background.js
echo "haiku-4-5 occurrences:"; grep -c 'claude-haiku-4-5' popup.js content.js background.js
```
Expected: every `stale` count is `0`; `claude-opus-4-8` present in all three files; `claude-haiku-4-5` present in `popup.js` (test calls).

- [ ] **Step 3: Commit**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git add apps/gitlab-ai-reviewer/src/popup.js apps/gitlab-ai-reviewer/src/content.js apps/gitlab-ai-reviewer/src/background.js
git commit -m "feat(gitlab-ai-reviewer): modernize Claude model IDs to supported models"
```

---

## Task 6: Convert the model `<select>` into an editable combobox

**Files:**
- Modify: `apps/gitlab-ai-reviewer/src/popup.html`

- [ ] **Step 1: Replace the `<select id="model-select">` block**

Replace exactly this block:
```html
                <select id="model-select" class="modern-select">
                  <option value="claude-opus-4-20250514">Claude 4 Opus</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                </select>
```
with:
```html
                <input id="model-select" class="modern-select" list="model-options"
                       placeholder="claude-opus-4-8" autocomplete="off" spellcheck="false" />
                <datalist id="model-options">
                  <option value="claude-opus-4-8">Claude Opus 4.8</option>
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                  <option value="claude-opus-4-7">Claude Opus 4.7</option>
                  <option value="claude-fable-5">Claude Fable 5</option>
                </datalist>
```

(`popup.js` already reads/writes `#model-select` `.value` and listens for its `change` event — both work unchanged on an `<input>`. The user can pick a suggested model or type any model name.)

- [ ] **Step 2: Verify the markup**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit/apps/gitlab-ai-reviewer/src
grep -c '<select id="model-select"' popup.html   # expect 0
grep -c 'list="model-options"' popup.html         # expect 1
grep -c '<datalist id="model-options">' popup.html # expect 1
```
Expected: `0`, `1`, `1`.

- [ ] **Step 3: Commit**

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git add apps/gitlab-ai-reviewer/src/popup.html
git commit -m "feat(gitlab-ai-reviewer): editable model combobox with supported-model suggestions"
```

---

## Task 7: Build the extension and verify the dist output

**Files:** none (build verification)

- [ ] **Step 1: Run the production build**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
npx nx build gitlab-ai-reviewer
```
Expected: build completes successfully (budget *warnings* are acceptable; there must be no errors).

> If the production build fails on minifying the plain JS, retry the development build to isolate:
> `npx nx build gitlab-ai-reviewer --configuration development`
> and report the error before changing the source JS.

- [ ] **Step 2: Verify the required extension files exist at the dist root with the manifest-expected names**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
ls -1 dist/apps/gitlab-ai-reviewer
```
Expected to include: `background.js`, `content.js`, `popup.js`, `popup.html`, `privacy_policy.html`, `styles.css`, `ai-reviewer.css`, `manifest.json`, and an `icons/` directory.

- [ ] **Step 3: Verify the manifest and content-script CSS landed correctly**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
node -e "const m=require('./dist/apps/gitlab-ai-reviewer/manifest.json'); console.log('sw:', m.background.service_worker, '| sw type:', m.background.type); console.log('content js:', m.content_scripts[0].js, '| css:', m.content_scripts[0].css); console.log('popup:', m.action.default_popup);"
ls dist/apps/gitlab-ai-reviewer/icons
```
Expected: `sw: background.js | sw type: undefined`; content js `["content.js"]`, css `["styles.css","ai-reviewer.css"]`; popup `popup.html`; three icon PNGs.

- [ ] **Step 4: Confirm no stale model IDs survived into the bundles**

Run:
```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
grep -REc 'claude-opus-4-20250514|claude-3-sonnet-20240229|claude-3-haiku-20240307' dist/apps/gitlab-ai-reviewer/*.js | grep -v ':0' || echo "no stale model IDs in bundles"
```
Expected: `no stale model IDs in bundles`.

- [ ] **Step 5: Commit any build-config tweaks made during this task** (only if Step 1 required a `project.json` change)

```bash
cd /Users/jorciney.dias.chaveiro/git/JorcysHome/jdc-toolkit
git add -A apps/gitlab-ai-reviewer
git commit -m "chore(gitlab-ai-reviewer): build adjustments" || echo "nothing to commit"
```

---

## Task 8: Manual load verification (human step)

**Files:** none

- [ ] **Step 1: Document how to load the built extension**

The build output at `dist/apps/gitlab-ai-reviewer` is a loadable unpacked extension. To verify in Chrome:
1. Open `chrome://extensions/`, enable Developer mode.
2. "Load unpacked" → select `dist/apps/gitlab-ai-reviewer`.
3. Open the popup → confirm the Model field is an editable combobox; the dropdown suggests Opus 4.8 / Sonnet 4.6 / Haiku 4.5 / Opus 4.7 / Fable 5, and a typed value is accepted and persists.
4. Navigate to a GitLab merge-request page and confirm the content script injects and a review can be triggered (requires valid Claude + GitLab credentials).

- [ ] **Step 2: Final review/merge handoff**

Use superpowers:finishing-a-development-branch to decide how to integrate `feat/gitlab-ai-reviewer-port` (merge / PR).

---

## Self-Review

**Spec coverage:**
- New app `apps/gitlab-ai-reviewer` mirroring `colorful-review` → Tasks 1–3. ✅
- File mapping (JS as webpack entries, html/css/icons/manifest as assets) → Tasks 1, 3 (`custom-webpack.config.ts` + `project.json` assets). ✅
- Angular stub to satisfy the builder → Task 2. ✅
- Manifest `"type": "module"` removal → Task 4. ✅
- Model ID modernization across JS files → Task 5. ✅
- Editable combobox with supported-model suggestions + default `claude-opus-4-8` → Task 6 (and Task 5 sets the default in `popup.js`). ✅
- Build produces loadable extension in `dist/apps/gitlab-ai-reviewer` → Task 7. ✅
- styles.css collision avoided via `"styles": []` → Task 3 Step 2. ✅

**Placeholder scan:** No TBD/TODO; every file's full content is given; every command has expected output. ✅

**Type/name consistency:** Output bundle names (`background.js`, `content.js`, `popup.js`) match the webpack entry keys (Task 3) and the manifest references (Task 4 verification). The combobox keeps `id="model-select"`, matching `popup.js` usage. ✅
