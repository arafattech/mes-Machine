# Laravel 11 / PHP 8.x Standards

Backend dirs in use: `app/Http`, `app/Services`, `app/Models`, `app/Traits`, `app/Enums`, `app/Exports`, `app/Imports`.

## Architecture
* Controllers stay thin — orchestrate only, no business logic.
* Business logic lives in `app/Services`.
* Validation lives in Form Requests — never inline in controllers.
* Data access in Models / Repositories where that pattern already exists; match local convention rather than introducing a new layer.

## Database
* Prevent N+1 — eager load deliberately with `with()`.
* Index columns used in WHERE / JOIN / ORDER BY.
* Optimize the query before reaching for caching.
* Every schema change via migration — never hand-edit the DB.
* Write migration files as needed; `--pretend` to sanity-check the generated SQL is fine. Never run `php artisan migrate` (or `migrate:fresh`/`migrate:rollback`) — the user runs migrations themselves.

## API
* Consistent response envelope — match the existing shape, do not invent a new one.
* Use API Resources for serialization.
* Validate every request.
* Handle errors gracefully with the correct HTTP status.
* Preserve existing REST + OData contracts.

## Security
* `php artisan` for all schema/state changes (author the migration; the user runs it — see Database).
* Eloquent bindings / parameterized queries only.
* Never expose secrets; read from config/env.
