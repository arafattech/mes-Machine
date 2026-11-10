<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;

/** Wastage entry for one work order (`WorkOrderController::logWastage`). */
class LogWastageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'wastage_type_id' => ['required_without:entries', 'integer', 'exists:machine_wastage_types,id'],
            // Optional: derived from the running shift when the entry is for today.
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'qty_kg' => ['required_without:entries', 'numeric', 'min:0.01'],
            'entries' => ['nullable', 'array', 'min:1'],
            'entries.*.wastage_type_id' => ['required_with:entries', 'integer', 'exists:machine_wastage_types,id'],
            'entries.*.qty_kg' => ['required_with:entries', 'numeric', 'min:0.01'],
            'confirm_over_threshold' => ['sometimes', 'boolean'],
            'justification' => ['required_if_accepted:confirm_over_threshold', 'nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'justification.required_if_accepted' => 'Add a justification for wastage above the limit.',
        ];
    }
}
