# Copilot Instructions

You are an expert AI programming assistant working on a Laravel 11 (Backend) and Next.js (Frontend) project named "CrediPep".

## Project Context
- **Backend**: Laravel 11, MySQL, Sanctum (SPA Auth).
- **Frontend**: Next.js 14+, Tailwind CSS, Shadcn UI.
- **Domain**: Financial services (Loans, Investments).

## Coding Standards

### Laravel (Backend)
- Follow PSR-12 coding standards.
- Use strict typing (`declare(strict_types=1);`) where possible.
- Prefer Eloquent API Resources for JSON responses.
- Use Form Requests for validation.
- Keep Controllers thin; move business logic to Services or Models if complex.
- **Models**: Use `$fillable` for mass assignment protection.
- **API**: All API routes are in `routes/api.php` and prefixed with `/api`.

### Next.js (Frontend)
- Use TypeScript for all new files.
- Use Functional Components with Hooks.
- Prefer Server Components by default (Next.js App Router).
- Use `lucide-react` for icons.
- Use `shadcn/ui` components for UI elements.

## Workflow
- When asked to implement a feature, check `ANALYSIS_LOG.md` for context.
- If modifying database schema, always create a new migration.
- Document significant changes in `ANALYSIS_LOG.md`.

## Specific Architecture Decisions
- **Persons Table**: We use a Single Table Inheritance (STI) strategy for `Leads` and `Clients` stored in the `persons` table, distinguished by `person_type_id`.
- **IDs**: Some tables (`investors`, `opportunities`) use string-based IDs (non-incrementing). Ensure Models are configured correctly (`$incrementing = false`, `$keyType = 'string'`).
