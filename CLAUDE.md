# CLAUDE.md

## 🚨 PRIMARY DIRECTIVE: AGENTIC WORKFLOW & CONTEXT
**Role:** You are an Expert Code Editor & Generator with access to terminal tools.
**Constraint:** You must NOT use your own context window to read/analyze large sets of files directly if they exceed standard limits.
**Capabilities:** You HAVE permission to execute terminal commands.

**Workflow:**
1. **Analyze Request:** Identify if the request requires analyzing multiple files, entire directories, or broad architecture.
2. **AUTONOMOUS ANALYSIS (Crucial):**
   - Do NOT ask the user to run commands.
   - **EXECUTE** the `gemini -p "..."` command yourself to gather the necessary context.
   - *Example Action:* Run `gemini -p "@app/Models/ @database/ Explain the relationship between X and Y"` in the terminal.
3. **Synthesize:** Use the output provided by the Gemini CLI as your context to perform the requested coding task.

---

## Project Overview & Architecture

**Stack:** Laravel 12 (API), PHP 8.2+, MySQL, Next.js (Frontend), Laravel Sanctum (Auth).
**Testing:** SQLite (in-memory).

### Domain Model (Single Table Inheritance)
The `persons` table uses a single-table inheritance pattern with `person_type_id`:
- **Lead** (`person_type_id = 1`): Potential customer.
- **Client** (`person_type_id = 2`): Converted customer.
*Both models inherit from `Person` and use Global Scopes to filter automatically.*

### Core Business Entities
- **Opportunity:** Linked to Lead via `lead_cedula` (Not a standard FK). Uses custom string IDs `YY-XXXXX-OP` (e.g., `25-00001-OP`).
- **Credit:** The loan record. Linked to Lead and Opportunity. Auto-creates an initial `PlanDePago` upon creation.
- **PlanDePago:** Amortization schedule entries.
- **CreditPayment:** Individual payment records.
- **Deductora:** Payroll deduction entity.

### Key Relationships
- `Lead`/`Client` -> `Opportunity` (via `cedula` field, **not** standard FK).
- `Credit` -> `Lead`, `Opportunity`, `Deductora`, `PlanDePago`, `CreditPayment`.
- `User` -> Assigned Leads, Opportunities, Credidts.

### Gamification System
- **Locations:** `app/Services/Rewards/`, `app/Models/Rewards/`, `app/Events/Rewards/`.
- **Config:** `config/gamification.php`.
- **Pattern:** Event-driven architecture (Events/Listeners).

### API Structure
- **Controllers:** `app/Http/Controllers/Api/`.
- **Routes:** Most are public (`routes/api.php`), protected ones use `auth:sanctum`.
- **Rewards:** Endpoints grouped under `/api/rewards`.

---

## Gemini CLI Execution Protocols

Use these patterns to fetch context BEFORE writing code. **Execute these commands directly.**

**🔎 Architecture & Structure:**
`gemini -p "@./folder_name Explain the structure and data flow"`

**✅ Implementation Verification:**
`gemini -p "@src/ @tests/ Is [feature] implemented? List files and functions"`

**🐛 Debugging:**
`gemini -p "@app/Http/Controllers/ @routes/ Analyze why [error] might occur"`

**🧪 Test Generation:**
`gemini -p "@app/Models/Credit.php @tests/Feature/ Analyze the model and suggest test cases"`

---

## Coding Standards (After Analysis)

Once you have the context from Gemini:
1. **Strict Typing:** Use PHP types for all method arguments and return values.
2. **Laravel Best Practices:** Use Eloquent scopes, FormRequests for validation, and API Resources.
3. **Tests:** Suggest test updates if logic changes.
4. **Action:** Apply the changes directly to the files.