<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;

class ProducibleProductsRequest extends FormRequest
{
    /** Upper bound for both a search page and an id lookup. */
    public const MAX_RESULTS = 100;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:100'],
            'top' => ['nullable', 'integer', 'min:1', 'max:' . self::MAX_RESULTS],
            'ids' => ['nullable', 'array', 'max:' . self::MAX_RESULTS],
            'ids.*' => ['integer'],
        ];
    }
}
