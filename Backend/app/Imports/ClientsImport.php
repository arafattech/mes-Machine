<?php

namespace App\Imports;

use App\Models\Client;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ClientsImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        if (empty($row['name'])) {
            throw ValidationException::withMessages([
                'name' => 'The "Name" field is required.',
            ]);
        }

        if (!empty($row['email']) && Client::where('email', $row['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => 'Email already exists: ' . $row['email'],
            ]);
        }

        return new Client([
            'name' => $row['name'],
            'first_contact_person_name' => $row['first_contact_person_name'] ?? null,
            'first_contact_person_phone' => $row['first_contact_person_phone'] ?? null,
            'second_contact_person_name' => $row['second_contact_person_name'] ?? null,
            'second_contact_person_phone' => $row['second_contact_person_phone'] ?? null,
            'email' => $row['email'] ?? null,
            'address' => $row['address'] ?? null,
            'bill_to' => $row['bill_to'] ?? null,
            'ship_to' => $row['ship_to'] ?? null,
            'note' => $row['note'] ?? null,
            'tin' => $row['tin'] ?? null,
            'bin' => $row['bin'] ?? null,
        ]);
    }
}
