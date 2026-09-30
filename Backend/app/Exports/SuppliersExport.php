<?php

namespace App\Exports;

use App\Models\Supplier;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class SuppliersExport implements FromCollection, WithHeadings
{
    public function collection()
    {
        $suppliers = Supplier::with('bankInfos')->get();
        $exportRows = new Collection();
        $rowCount = 1;

        foreach ($suppliers as $supplier) {
            if ($supplier->bankInfos->isEmpty()) {
                $exportRows->push([
                    'SL' => $rowCount++,
                    'supplierID' => $supplier->supplierID,
                    'name' => $supplier->name,
                    'address' => $supplier->address,
                    'first_contact_person_name' => $supplier->first_contact_person_name,
                    'first_contact_person_phone' => $supplier->first_contact_person_phone,
                    'second_contact_person_name' => $supplier->second_contact_person_name,
                    'second_contact_person_phone' => $supplier->second_contact_person_phone,
                    'email' => $supplier->email,
                    'note' => $supplier->note,
                    'tin' => $supplier->tin,
                    'bin' => $supplier->bin,
                    'is_active' => $supplier->is_active ? 'Yes' : 'No',

                    'mode_of_payment' => '',
                    'bank_name' => '',
                    'account_holder_name' => '',
                    'account_number' => '',
                    'account_type' => '',
                    'branch_name' => '',
                    'branch_address' => '',
                    'routing_number' => '',
                    'swift_code' => '',
                    'currency' => '',
                    'country' => '',
                    'additional_notes' => '',
                    'bank_is_active' => '',
                    'approved_by' => '',
                    'approved_at' => '',
                ]);
            }

            foreach ($supplier->bankInfos as $bank) {
                $exportRows->push([
                    'SL' => $rowCount++,
                    'supplierID' => $supplier->supplierID,
                    'name' => $supplier->name,
                    'address' => $supplier->address,
                    'first_contact_person_name' => $supplier->first_contact_person_name,
                    'first_contact_person_phone' => $supplier->first_contact_person_phone,
                    'second_contact_person_name' => $supplier->second_contact_person_name,
                    'second_contact_person_phone' => $supplier->second_contact_person_phone,
                    'email' => $supplier->email,
                    'note' => $supplier->note,
                    'tin' => $supplier->tin,
                    'bin' => $supplier->bin,
                    'is_active' => $supplier->is_active ? 'Yes' : 'No',

                    'mode_of_payment' => $bank->mode_of_payment,
                    'bank_name' => $bank->bank_name,
                    'account_holder_name' => $bank->account_holder_name,
                    'account_number' => $bank->account_number,
                    'account_type' => $bank->account_type,
                    'branch_name' => $bank->branch_name,
                    'branch_address' => $bank->branch_address,
                    'routing_number' => $bank->routing_number,
                    'swift_code' => $bank->swift_code,
                    'currency' => $bank->currency,
                    'country' => $bank->country,
                    'additional_notes' => $bank->additional_notes,
                    'bank_is_active' => $bank->is_active ? 'Yes' : 'No',
                    'approved_by' => $bank->user ? $bank->user->name : '',
                    'approved_at' => $bank->approved_at,
                ]);
            }
        }

        return $exportRows;
    }

    public function headings(): array
    {
        return [
            'SL',
            'Supplier ID',
            'Name',
            'Address',
            'First Contact Person Name',
            'First Contact Person Phone',
            'Second Contact Person Name',
            'Second Contact Person Phone',
            'Email',
            'Note',
            'TIN',
            'BIN',
            'Is Active',

            'Mode of Payment',
            'Bank Name',
            'Account Holder Name',
            'Account Number',
            'Account Type',
            'Branch Name',
            'Branch Address',
            'Routing Number',
            'SWIFT Code',
            'Currency',
            'Country',
            'Additional Notes',
            'Bank Is Active',
            'Approved By',
            'Approved At',
        ];
    }
}
