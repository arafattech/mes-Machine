<?php

namespace App\Exports;

use App\Models\Client;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ClientsExport implements FromCollection, WithHeadings, WithMapping
{
    protected $filters;
    private $rowCount = 0;

    public function __construct($filters = [])
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $query = Client::query();

        if (!empty($this->filters['name'])) {
            $query->where('name', 'like', '%' . $this->filters['name'] . '%');
        }

        return $query->get();
    }

    public function headings(): array
    {
        return [
            'SL',
            'Name',
            'First Contact Person Name',
            'First Contact Person Phone',
            'Second Contact Person Name',
            'Second Contact Person Phone',
            'Email',
            'Address',
            'Bill To',
            'Ship To',
            'Note',
            'TIN',
            'BIN',
        ];
    }

    public function map($client): array
    {
        $this->rowCount++;

        return [
            $this->rowCount,
            $client->name,
            $client->first_contact_person_name,
            $client->first_contact_person_phone,
            $client->second_contact_person_name,
            $client->second_contact_person_phone,
            $client->email,
            $client->address,
            $client->bill_to,
            $client->ship_to,
            $client->note,
            $client->tin,
            $client->bin,
        ];
    }
}
