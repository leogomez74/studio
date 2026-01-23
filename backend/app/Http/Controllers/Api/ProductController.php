<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $products = Product::orderBy('order_column')->get();
        return response()->json($products);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150|unique:products,name',
            'description' => 'nullable|string',
            'is_default' => 'sometimes|boolean',
            'order_column' => 'sometimes|integer|min:0',
        ]);

        // Generate slug from name if not provided
        $validated['slug'] = Str::slug($validated['name']);

        $product = Product::create($validated);

        return response()->json($product, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        return response()->json($product);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150|unique:products,name,' . $id,
            'description' => 'nullable|string',
            'is_default' => 'sometimes|boolean',
            'order_column' => 'sometimes|integer|min:0',
        ]);

        // Update slug if name changed
        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        $product->update($validated);

        return response()->json($product);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json(['message' => 'Producto eliminado exitosamente'], 200);
    }
}
