<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Employee;
use App\Models\User;
use App\Models\Product;
use App\Models\LeaveRequest;

class MediaController extends Controller
{

    public function uploadMedia(Request $request)
    {
        $modelName = $request->get('model');
        $id = $request->get('id');

        $model = match ($modelName) {
            'Employee' => Employee::findOrFail($id),
            'User'     => User::findOrFail($id),
            'Product'  => Product::findOrFail($id),
            'LeaveRequest' => LeaveRequest::findOrFail($id),
            default    => abort(415, 'Model does not support media'),
        };

        $formData = [];
        $existingFileIds = [];

        if ($request->has('form_data')) {
            $formData = json_decode($request->get('form_data'), true);
            $existingFileIds = collect($formData)->pluck('id')->filter()->toArray();

            $model->media()
                ->whereNotIn('id', $existingFileIds)
                ->get()
                ->each
                ->delete();
        } else {
            $model->clearMediaCollection('images');
        }

        $uploadedMedia = $this->processMedia($model, $request, $formData);

        return response()->json([
            'message' => 'Media processed successfully',
            'files' => $uploadedMedia,
        ]);
    }

    private function processMedia($model, Request $request, array $formData): array
    {
        $uploadedMedia = [];

        // Update existing media metadata (like is_standard)
        foreach ($formData as $meta) {
            if (!empty($meta['id'])) {
                $media = $model->media()->where('id', $meta['id'])->first();
                if ($media) {
                    if (isset($meta['is_standard'])) {
                        $media->is_standard = filter_var($meta['is_standard'], FILTER_VALIDATE_BOOLEAN);
                    }
                    $media->save();

                    $uploadedMedia[] = [
                        'id' => $media->id,
                        'media_url' => $media->getUrl(),
                        'is_standard' => $media->is_standard ?? false,
                    ];
                }
            }
        }

        // Handle new uploads. $formData contains metadata for every file (existing
        // and new) in fileArr order, but $request->file('media') only contains the
        // newly-uploaded ones — filter formData down to the same subset, in the same
        // order the frontend appended them, before pairing by index.
        if ($request->hasFile('media')) {
            $newFileMetas = array_values(array_filter(
                $formData,
                fn ($meta) => empty($meta['isFromInput']),
            ));

            foreach ($request->file('media') as $index => $file) {
                $meta = $newFileMetas[$index] ?? [];
                $media = $model->addMedia($file)->toMediaCollection('images');

                if (isset($meta['is_standard'])) {
                    $media->is_standard = filter_var($meta['is_standard'], FILTER_VALIDATE_BOOLEAN);
                    $media->save();
                }

                $uploadedMedia[] = [
                    'id' => $media->id,
                    'media_url' => $media->getUrl(),
                    'is_standard' => $media->is_standard ?? false,
                ];
            }
        }

        return $uploadedMedia;
    }
}
