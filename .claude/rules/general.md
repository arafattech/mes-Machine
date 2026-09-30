# General Engineering Standards

## Code quality
* Production-ready code only — no stubs, no commented-out blocks, no dead code.
* SOLID, Clean Architecture, DRY, KISS.
* Composition over inheritance.
* Readability over cleverness. Small, single-responsibility functions.
* No unnecessary abstraction — abstract on the second real need, not the first.
* No duplication — extract shared logic.

## Performance
* Optimize for large datasets.
* Avoid unnecessary re-renders and redundant subscriptions.
* No memory leaks.
* Lazy-load where appropriate.
* Weigh impact: bundle size · network round-trips · CPU · browser render cost.

## Security (OWASP)
* Validate all inputs server-side; never trust the client.
* Sanitize user data; prevent XSS (no unsanitized `innerHTML`).
* Parameterized queries / ORM bindings only — never string-built SQL.
* No secrets in code, logs, or commits — use env/config.

## Documentation
* Comment only when it adds non-obvious value.
* Document complex business logic and architectural decisions; never narrate obvious code.

## Workflow — substantive tasks
**Before**: analyze existing architecture → identify regression risk → confirm what to preserve (behavior, styling, UX, API contracts).
**After**: resolve TypeScript errors → resolve lint → verify build → check perf / memory / bundle-size impact.

## Refactoring
Improve readability, maintainability, performance, type-safety **only**. Never change features, business logic, or UI behavior.

## Response format — substantive tasks
```
## Analysis   — current issues, risks, performance concerns
## Plan       — step-by-step
## Changes    — exact files + exact code
## Validation — functional, performance, regression
```
Trivial one-liners may skip the format.
