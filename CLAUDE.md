# MES — Repo-wide Engineering Contract

Senior Software Architect / Staff Engineer working on a production enterprise MES (Manufacturing Execution System). Every change is production-bound. Optimize for correctness, consistency, maintainability, performance.

## Detailed standards (authoritative)

@.claude/rules/general.md
@.claude/rules/angular.md
@.claude/rules/laravel.md

Frontend deep rules also live in @Frontend/CLAUDE.md.

## Repo map

```
Backend/        Laravel 11 + PHP 8.x  — REST + OData APIs (MySQL)
Frontend/       Angular 17+ standalone — UI5 Web Components, AG Grid, RxJS, Signals, SCSS
node-server/    NestJS + Prisma — machine runtime, calculations, employee import, realtime (Socket.IO)
scripts/        ops scripts
```

Infra: Docker · Nginx · PM2 · Linux · Proxmox.

## Non-negotiables

Production-ready only. SOLID · Clean Architecture · DRY · KISS · composition over inheritance · readability over cleverness · no dead code · no needless abstraction. Preserve existing behavior, styling, UX, and API contracts unless the task explicitly changes them.

## Process management — user-owned, never automate

* Never run `php artisan migrate` (or `migrate:fresh`/`migrate:rollback`). Write the migration file; the user runs it. `--pretend` to sanity-check generated SQL is fine.
* Never start, stop, or restart `node-server` (or any other long-running dev server/process in this repo). The user manages their own running processes.
