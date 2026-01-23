# Copilot Instructions

You are an expert AI programming assistant working on **CrediPep**, a Laravel 12 (Backend) + Next.js 16 (Frontend) financial services platform for loans, investments, and credit management.

## Project Overview
- **Backend**: `backend/` → Laravel 12, MySQL, Sanctum (SPA auth), PHP 8.2+
- **Frontend**: `src/` → Next.js 16, TypeScript, Tailwind CSS v4, Shadcn UI
- **Domain**: Loan origination, credit management, lead tracking, gamification rewards
- **Key Files**: 
  - Backend logic: `backend/app/Http/Controllers/Api/`, `backend/app/Models/`, `backend/app/Services/`
  - Frontend pages: `src/app/dashboard/`, components in `src/components/`
  - Configuration: `ANALYSIS_LOG.md` (project history & decisions), `config/gamification.php`

## Core Domain Model (Critical for Context)

### Single Table Inheritance Pattern
**`persons` table** stores both Leads (person_type_id=1) and Clients (person_type_id=2) with auto-filtering via Global Scopes:
- `Lead` model in [backend/app/Models/Lead.php](backend/app/Models/Lead.php): Potential customers
- `Client` model in [backend/app/Models/Client.php](backend/app/Models/Client.php): Converted customers
- Both inherit from `Person` base model; never query `persons` directly—use Lead/Client models

### String-Based ID Tables
`opportunities` and `investors` tables use custom string IDs (non-incrementing):
- **Opportunities**: Format `YY-XXXXX-OP` (e.g., `25-00001-OP`). Generated via `booted()` hook in [backend/app/Models/Opportunity.php](backend/app/Models/Opportunity.php#L31)
- **Investors**: String primary key. Models require: `public $incrementing = false; protected $keyType = 'string';`
- Linked to Leads via `lead_cedula` field, NOT standard foreign keys

### Key Relationships
- **Lead → Opportunity** (via `cedula`), **Lead → Credit** (1:N)
- **Credit → PlanDePago** (1:N amortization schedule), **Credit → CreditPayment** (1:N payment records), **Credit → CreditDocument** (1:N file storage)
- **Credit → Deductora** (payroll deduction entity)
- Documents: Lead documents auto-move to Credit's directory when Credit is created (see [backend/app/Http/Controllers/Api/CreditController.php](backend/app/Http/Controllers/Api/CreditController.php#L84))

## Backend Conventions

### Controllers & Routes
- **Location**: `backend/app/Http/Controllers/Api/`
- **Routes**: All in [backend/routes/api.php](backend/routes/api.php), prefixed `/api`, currently public (no auth middleware; add when needed)
- **Pattern**: Thin controllers using RESTful `apiResource()`, complex logic → Services
- **Example**: [backend/app/Http/Controllers/Api/CreditController.php](backend/app/Http/Controllers/Api/CreditController.php) calls `generateAmortizationSchedule()` internally (lines 67–80)

### Models & Database
- **Migrations**: `backend/database/migrations/`, always create new files for schema changes (e.g., `2025_12_04_000000_create_investors_table.php`)
- **Model Setup**: Use `$fillable` for mass assignment, `$casts` for type conversion (e.g., `'amount' => 'decimal:2'`)
- **Global Scopes**: [Lead.php](backend/app/Models/Lead.php) demonstrates filtering in `booted()` method to auto-scope queries

### Services & Business Logic
- **Location**: `backend/app/Services/` → Currently **Rewards-only** subsystem; expand here for future features
- **Rewards Pattern**: `Rewards/RewardService.php`, `Rewards/BadgeService.php`, event-driven via `app/Events/` & `app/Listeners/`
- **New Features**: Create service classes (e.g., `CreditCalculationService`, `LeadScoringService`) rather than bloating controllers

### Testing & Running
- **Commands**:
  - `composer dev` → Concurrent: artisan serve + queue listener + pail logs + vite dev
  - `composer test` → PHPUnit in `tests/` directory
  - `php artisan migrate` → Apply pending migrations
- **Database**: Use SQLite in-memory for tests, MySQL for local/production

## Frontend Conventions

### API Client & Auth
- **Axios Setup**: [src/lib/axios.ts](src/lib/axios.ts) configured with `withCredentials: true` & `withXSRFToken: true` for Sanctum auth (cross-port 3000↔8000)
- **Base URL**: `NEXT_PUBLIC_API_BASE_URL` env var (defaults to `http://localhost:8000/api`, stripped to root for Sanctum)
- **Pattern**: `import api from '@/lib/axios'` → `api.get('/api/leads')` or `api.post('/api/credits', data)`

### Pages & Components
- **App Router**: `src/app/dashboard/*/page.tsx` (e.g., [src/app/dashboard/clientes/page.tsx](src/app/dashboard/clientes/page.tsx), [src/app/dashboard/kpis/page.tsx](src/app/dashboard/kpis/page.tsx))
- **Client Components**: Mark with `"use client"` when using hooks/events
- **UI Library**: Shadcn components in `src/components/ui/` (Button, Card, Dialog, Table, etc.)
- **Icons**: Use `lucide-react` (e.g., `import { Users, TrendingUp } from "lucide-react"`)

### Hooks & Data Fetching
- **Custom Hooks**: `src/hooks/use-*.ts` (e.g., `use-debounce.ts`, `use-rewards.ts`)
- **Data Patterns**:
  - Fetch in `useEffect` with `api.get()`, store in `useState`
  - Use `useCallback` for memoized event handlers
  - Refer to `src/lib/data.ts` for type definitions (`Opportunity`, `Lead`)

### Styling
- **Tailwind v4**: `src/app/globals.css` defines root styles; use utility classes
- **Component Variants**: Class composition with `cn()` from `clsx` (e.g., `cn("p-4", isActive && "bg-blue-500")`)

## Cross-Stack Workflows

### Adding a New Feature (End-to-End)
1. **Database**: Create migration in `backend/database/migrations/`
2. **Backend Model**: Add model in `backend/app/Models/` with relationships & scopes
3. **API Endpoint**: Create controller method in `backend/app/Http/Controllers/Api/`
4. **Route**: Register in `backend/routes/api.php`
5. **Frontend Type**: Define interface in `src/lib/data.ts` or dedicated `types/` file
6. **Frontend Component**: Create page/component in `src/app/dashboard/*/` or `src/components/`
7. **API Call**: Use `api.get/post/put/delete()` with typed responses
8. **Documentation**: Update `ANALYSIS_LOG.md` with entry (date, changes, files modified)

### Special Patterns

**Document Management** (Credit-specific):
- Leads store documents at `person-docs/{lead_id}/`
- Credits auto-copy from Lead → `credit-docs/{credit_id}/` on creation
- Endpoints: `POST /api/person-documents`, `DELETE /api/person-documents/{id}`, `GET /api/credits/{id}/documents`

**Amortization Schedule**:
- Auto-generated when Credit status → "formalizado"
- Creates `PlanDePago` records (one per month/payment)
- Manual regeneration: `POST /api/credits/{id}/generate-plan-de-pagos`

**Gamification** (Rewards System):
- Event-driven: User actions trigger `Events/` → `Listeners/` → Service updates
- Services: `Rewards/RewardService.php`, `Rewards/BadgeService.php`, `Rewards/ChallengeService.php`
- Config: `config/gamification.php` (thresholds, badge criteria)

## Common Workflows & Commands

| Task | Command / File |
|------|---|
| Start dev server (backend + frontend) | `cd backend && composer dev` |
| Run tests | `cd backend && composer test` |
| Create migration | `cd backend && php artisan make:migration create_table_name` |
| Access DB console | `cd backend && php artisan tinker` |
| Build frontend | `npm run build` (root) |
| Frontend dev | `npm run dev` (root) |
| Check types | `npm run typecheck` (root) |

## Key Files Reference
- Backend entry: [backend/routes/api.php](backend/routes/api.php) (all routes)
- Frontend entry: [src/app/layout.tsx](src/app/layout.tsx)
- Models (core domain): [backend/app/Models/Credit.php](backend/app/Models/Credit.php), [backend/app/Models/Lead.php](backend/app/Models/Lead.php), [backend/app/Models/Opportunity.php](backend/app/Models/Opportunity.php)
- Auth setup: [src/lib/axios.ts](src/lib/axios.ts)
- Type definitions: [src/lib/data.ts](src/lib/data.ts)

## Before Writing Code
- **Check** `ANALYSIS_LOG.md` for recent decisions and context
- **Verify** table schema in `backend/database/migrations/` (especially `person_type_id` and string IDs)
- **Test** API calls locally with `curl` or Postman before frontend integration
- **Use** strict typing: PHP types in backend, TypeScript interfaces in frontend
