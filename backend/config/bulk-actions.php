<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Bulk Actions Configuration
    |--------------------------------------------------------------------------
    |
    | This file contains configuration for bulk operations performed
    | on multiple records simultaneously.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Maximum Items Per Request
    |--------------------------------------------------------------------------
    |
    | The maximum number of items that can be processed in a single
    | bulk operation request. This helps prevent server timeouts.
    |
    */
    'max_items_per_request' => env('BULK_MAX_ITEMS', 50),

    /*
    |--------------------------------------------------------------------------
    | Timeout Seconds
    |--------------------------------------------------------------------------
    |
    | Maximum execution time for bulk operations in seconds.
    |
    */
    'timeout_seconds' => env('BULK_TIMEOUT', 30),

    /*
    |--------------------------------------------------------------------------
    | Chunk Size
    |--------------------------------------------------------------------------
    |
    | Number of items to process in each database chunk operation.
    | This helps optimize memory usage for large bulk operations.
    |
    */
    'chunk_size' => env('BULK_CHUNK_SIZE', 20),

    /*
    |--------------------------------------------------------------------------
    | Enable Transactions
    |--------------------------------------------------------------------------
    |
    | Whether to wrap bulk operations in database transactions.
    | If true, all operations will rollback if any single operation fails.
    |
    */
    'use_transactions' => env('BULK_USE_TRANSACTIONS', true),

    /*
    |--------------------------------------------------------------------------
    | Log Bulk Operations
    |--------------------------------------------------------------------------
    |
    | Whether to log bulk operations for audit purposes.
    |
    */
    'log_operations' => env('BULK_LOG_OPERATIONS', true),
];
