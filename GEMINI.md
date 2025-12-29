# GEMINI.md

This file provides guidance to gemini Code (gemini/code) when working with code in this repository.

## Project Overview

This is a Laravel 12 backend API for a credit/loan management system (CRM) with gamification features. It uses Laravel Sanctum for API authentication and integrates with a Next.js frontend.

## Common Commands

```bash
# Development (runs server, queue, logs, and vite concurrently)
composer dev

# Initial setup
composer setup

# Run tests
composer test

# Run a single test
php artisan test --filter=TestName

# Code formatting with Laravel Pint
./vendor/bin/pint

# Database migrations
php artisan migrate

# Clear configuration cache
php artisan config:clear
```

## Architecture

### Domain Model (Single Table Inheritance)

The `persons` table uses a single-table inheritance pattern with `person_type_id`:
- **Lead** (`person_type_id = 1`): Potential customer, extends `Person` with global scope
- **Client** (`person_type_id = 2`): Converted customer, extends `Person` with global scope

Both models inherit from `Person` and use Laravel's global scopes in `booted()` to automatically filter by type.

### Core Business Entities

- **Opportunity**: Sales opportunity linked to a Lead via `lead_cedula` (not FK). Uses custom string IDs with format `YY-XXXXX-OP` (e.g., `25-00001-OP`)
- **Credit**: Loan/credit record linked to Lead and Opportunity. Auto-creates initial `PlanDePago` entry on creation
- **PlanDePago**: Payment schedule/amortization entries for Credits
- **CreditPayment**: Individual payment records
- **Deductora**: Payroll deduction entity

### Gamification System (Rewards)

Located in `app/Services/Rewards/`, `app/Models/Rewards/`, and `app/Events/Rewards/`:
- Points, badges, levels, streaks, challenges, and catalog redemptions
- Event-driven architecture with Events/Listeners pattern
- Configuration in `config/gamification.php`

### API Structure

All API controllers are in `app/Http/Controllers/Api/`:
- Most routes are currently public (noted in `routes/api.php`)
- Protected routes require `auth:sanctum` middleware
- Rewards endpoints are grouped under `/api/rewards`

### Key Relationships



- Lead/Client -> Opportunity (via `cedula` field, not standard FK)
- Credit -> Lead, Opportunity, Deductora, PlanDePago, CreditPayment
- User -> assigned Leads, Opportunities, Credits

## Testing

Tests use SQLite in-memory database (configured in `phpunit.xml`). Test suites:
- `tests/Feature/` - Feature tests
- `tests/Unit/` - Unit tests

## Environment

- PHP 8.2+
- MySQL for production
- Laravel Sanctum for API tokens
- PHPSpreadsheet for Excel operations
