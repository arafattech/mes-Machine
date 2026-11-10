<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;

/** Batch count entry for one work order across its machines (`WorkOrderController::logProductionCounts`). */
class LogProductionCountsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'shift_id' => ['required', 'integer', 'exists:employee_shifts,id'],
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.machine_id' => ['required', 'integer', 'distinct', 'exists:machines,id'],
            'entries.*.good_count' => ['required', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'entries.*.good_count.min' => 'Good count cannot be negative.',
        ];
    }
}
