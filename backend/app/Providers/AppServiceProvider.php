<?php

namespace App\Providers;

use App\Services\AssignmentService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(AssignmentService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // v1.0 F4 — ERP CRM federation outbound sync. Gated por config flag
        // (services.erp.crm.enabled). Dispatcha jobs en queue al hacer save().
        \App\Models\Lead::observe(\App\Observers\LeadErpSyncObserver::class);
        \App\Models\Opportunity::observe(\App\Observers\OpportunityErpSyncObserver::class);
    }
}
