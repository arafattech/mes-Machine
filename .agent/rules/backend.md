# Backend Rules — Laravel 11 / PHP 8.x

Dirs in use: `app/Http`, `app/Services`, `app/Models`, `app/Traits`, `app/Enums`, `app/Exports`, `app/Imports`.

## Architecture
Thin controllers (orchestrate only) · business logic in `app/Services` · validation in Form Requests · data access in Models/Repositories per existing convention — don't add a new layer unless the pattern exists.

## Database
Prevent N+1 (eager load with `with()`) · index WHERE/JOIN/ORDER BY columns · optimize queries before caching · all schema changes via migration.

## API
Consistent response envelope (match existing) · API Resources for serialization · validate every request · graceful errors with correct HTTP status · preserve REST + OData contracts.

## Security
Eloquent bindings / parameterized queries only · no string-built SQL · no exposed secrets (config/env) · `php artisan` for schema/state changes.
