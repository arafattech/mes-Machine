<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;

/** Single-machine manual count entry (`MachineController::logProductionCount`). */
class LogProductionCountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'work_order_id' => ['required', 'integer', 'exists:work_orders,id'],
            'shift_id' => ['required', 'integer', 'exists:employee_shifts,id'],
            'good_count' => ['required', 'integer', 'min:0'],
            'scrap_count' => ['required', 'integer', 'min:0'],
        ];
    }
}
