---
description: Senior-engineer review of the current branch diff against MES standards
argument-hint: "[optional: path or area to focus]"
---

Review the current changes as a Senior Staff Engineer on a production enterprise MES.

Scope: `git diff` against `main` (focus area, if given: $ARGUMENTS).

Enforce `.claude/rules/general.md`, `.claude/rules/angular.md`, `.claude/rules/laravel.md`.

Produce:

## Analysis
- Current issues, regression risks, performance concerns.

## Findings
- `path:line: <🔴|🟠|🟡>: <problem>. <fix>.` — grouped Frontend / Backend / Cross-cutting.

## Validation checklist
- [ ] TypeScript / build clean
- [ ] Lint clean
- [ ] No N+1 / leaks introduced
- [ ] Behavior, styling, UX, API contracts preserved
- [ ] Perf / memory / bundle impact acceptable

No praise. No scope creep. Flag anything that changes features, styling, UX, or API contracts not required by the task.
