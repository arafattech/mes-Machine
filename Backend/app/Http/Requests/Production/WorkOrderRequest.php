<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;

/** Create and update share one contract: the form always submits the full order. */
class WorkOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'is_active' => ['sometimes', 'boolean'],
            'custom_id' => ['nullable', 'string', 'max:255'],
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'status' => ['nullable', 'string', 'in:pending,in_progress,completed,cancelled'],
            'scheduled_start' => ['required', 'date'],
            // An actual start before the scheduled one is valid: the order started early.
            'actual_start' => ['nullable', 'date'],
            'machine_ids' => ['nullable', 'array'],
            'machine_ids.*' => ['integer', 'distinct', 'exists:machines,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'quantity.min' => 'Quantity must be at least 1.',
            'quantity.integer' => 'Quantity must be a whole number.',
            'scheduled_start.required' => 'Scheduled start is required.',
        ];
    }
}
