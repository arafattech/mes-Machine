<?php

namespace App\Imports;

use App\Models\Supplier;
use App\Models\SupplierBankInfo;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class SuppliersImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        if (empty($row['name'])) {
            throw ValidationException::withMessages([
                'name' => 'Supplier Name is required. Check your Excel sheet.',
            ]);
        }

        if (!empty($row['email']) && Supplier::where('email', $row['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => 'Email already exists: ' . $row['email'],
            ]);
        }

        if (!empty($row['supplier_id']) && Supplier::where('supplierID', $row['supplier_id'])->exists()) {
            throw ValidationException::withMessages([
                'supplier_id' => 'Supplier ID already exists: ' . $row['supplier_id'],
            ]);
        }

        $supplier = new Supplier();
        $supplier->supplierID = $row['supplier_id'] ?? null;
        $supplier->name = $row['name'] ?? null;
        $supplier->first_contact_person_name = $row['first_contact_person_name'] ?? null;
        $supplier->first_contact_person_phone = $row['first_contact_person_phone'] ?? null;
        $supplier->second_contact_person_name = $row['second_contact_person_name'] ?? null;
        $supplier->second_contact_person_phone = $row['second_contact_person_phone'] ?? null;
        $supplier->email = $row['email'] ?? null;
        $supplier->address = $row['address'] ?? null;
        $supplier->note = $row['note'] ?? null;
        $supplier->tin = $row['tin'] ?? null;
        $supplier->bin = $row['bin'] ?? null;

        $supplier->save();

        if (!empty($row['bank_name'])) {
            SupplierBankInfo::create([
                'supplier_id' => $supplier->id,
                'mode_of_payment' => $row['mode_of_payment'] ?? null,
                'bank_name' => $row['bank_name'],
                'account_holder_name' => $row['account_holder_name'] ?? null,
                'account_number' => $row['account_number'] ?? null,
                'account_type' => $row['account_type'] ?? null,
                'branch_name' => $row['branch_name'] ?? null,
                'branch_address' => $row['branch_address'] ?? null,
                'routing_number' => $row['routing_number'] ?? null,
                'country' => $row['country'] ?? null,
                'additional_notes' => $row['additional_notes'] ?? null,
                'is_active' => 0,
            ]);
        }
        return $supplier;
    }
}
