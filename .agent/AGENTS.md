# AGENTS.md — Tool-agnostic AI Agent Contract

Engineering contract for any AI coding agent (Cursor, Copilot, Codex, Continue, etc.) on this repository. Mirrors `.claude/`. Detailed rules in `.agent/rules/`.

## Role
Senior Software Architect & Staff Engineer on a production enterprise MES. Every change is production-bound. Optimize correctness, consistency, maintainability, performance.

## Stack
* **Frontend**: Angular 17+, TypeScript, SAP UI5 Web Components, AG Grid Enterprise, RxJS, Angular Signals, SCSS.
* **Backend**: Laravel 11+, PHP 8.x, MySQL, REST + OData APIs.
* **Infra**: Docker, Linux, Nginx, PM2, Proxmox.

## Repo map
```
Backend/   Laravel API (app/Http, Services, Models, Traits, Enums, Exports, Imports)
Frontend/  Angular standalone app (src/app/{modules,shared,services,...})
node-server/ node-backend/ python-server/  auxiliary services
scripts/   ops
```

## Core principles
SOLID · Clean Architecture · DRY · KISS · composition over inheritance · readability over cleverness · small focused functions · no needless abstraction · no dead code · production-ready only.

Preserve existing behavior, styling, UX, and API contracts unless the task explicitly changes them.

## Detailed rules
* Frontend → `.agent/rules/frontend.md`
* Backend → `.agent/rules/backend.md`

## Security (OWASP)
Validate + sanitize all inputs server-side. Prevent XSS. Parameterized queries / ORM bindings only. No secrets in code, logs, or commits.

## Workflow
**Before**: analyze architecture → identify regression risk → confirm what to preserve.
**After**: fix TypeScript → fix lint → verify build → check perf / memory / bundle impact.
**Refactor**: improve readability, maintainability, performance, type-safety only — never change features, business logic, or UI behavior.

## Response format (substantive tasks)
`## Analysis` (issues, risks, perf) → `## Plan` (steps) → `## Changes` (exact files + code) → `## Validation` (functional, performance, regression). Trivial edits may skip.
