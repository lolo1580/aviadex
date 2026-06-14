# Development Rules

## General Principles

* Prioritize maintainability.
* Prioritize readability.
* Prioritize scalability.
* Avoid premature optimization.
* Follow industry best practices.
* Write production-grade code.

---

## Architecture

The application must follow a clean architecture approach.

Separate:

* UI
* Business Logic
* Data Access
* Infrastructure

Business logic must never be directly coupled to UI components.

---

## Database Rules

Use PostgreSQL.

Use proper foreign keys.

Use UUID primary keys.

Never store duplicated information.

Normalize data whenever appropriate.

Preserve historical data.

Avoid destructive updates.

Soft-delete should be preferred for user-generated content.

---

## Historical Integrity

Aircraft history is a core feature.

Never overwrite historical records.

Use dedicated history tables.

Examples:

* Registration History
* Operator History
* Squadron History
* Status History

Historical events must be timestamped whenever possible.

---

## Internationalization

English is the default language.

French is the secondary language.

All user-facing strings must support translation.

Do not hardcode language-specific content.

---

## API Design

Use REST or REST + OpenAPI.

Consistent naming conventions.

Version APIs from the beginning.

Example:

/api/v1/

---

## Security

Validate all inputs.

Protect against common web vulnerabilities.

Use role-based permissions.

Support future authentication providers.

Never trust client-side validation alone.

---

## Code Quality

Use TypeScript.

Enable strict mode.

Write reusable components.

Avoid code duplication.

Prefer composition over inheritance.

Document complex business logic.

---

## Testing

Unit tests for business logic.

Integration tests for APIs.

Critical workflows must be tested.

---

## User Experience

The interface must remain simple.

The application should work on:

* Desktop
* Tablet
* Mobile

Responsive design is mandatory.

---

## AI Assistant Rules

When generating code:

* Respect the existing architecture.
* Do not introduce unnecessary dependencies.
* Do not modify unrelated files.
* Explain major architectural decisions.
* Prefer long-term maintainability over shortcuts.
* Ask for clarification if requirements are ambiguous.
