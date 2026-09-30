<?php

namespace App\Http\Controllers;

use App\Models\User;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\RateLimiter;

class UserController extends Controller
{

    public function add_user(Request $request)
    {
        try {

            $validatedData = $request->validate([
                'userInfo.name' => 'required|string|max:255',
                'userInfo.email' => [
                    'nullable',
                    'email',
                    'required_without:userInfo.phone',
                    'unique:users,email',
                ],
                'userInfo.phone' => [
                    'nullable',
                    'string',
                    'required_without:userInfo.email',
                    'unique:users,phone',
                ],
                'userInfo.password' => 'required|string|min:6',
                'userInfo.is_active' => 'nullable',
                'roles' => 'nullable|array',
                'roles.*.id' => 'integer|exists:roles,id',
            ]);

            $userInfo = $validatedData['userInfo'];
            $userInfo['email'] = trim((string) ($userInfo['email'] ?? '')) ?: null;
            $userInfo['phone'] = trim((string) ($userInfo['phone'] ?? '')) ?: null;

            $user = User::create([
                'name' => $userInfo['name'],
                'email' => $userInfo['email'],
                'phone' => $userInfo['phone'],
                'password' => Hash::make($userInfo['password']),
                'is_active' => $userInfo['is_active'],
            ]);

            $roleIds = collect($validatedData['roles'])->pluck('id')->toArray();
            if (!empty($roleIds)) {
                $roles = Role::whereIn('id', $roleIds)->get();
                $user->syncRoles($roles);
            } else {
                $user->syncRoles([]);
            }

            return response()->json([
                'message' => 'User created successfully',
                'data' => $user->load('roles')
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error User create: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred while creating the user',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function edit_user(Request $request, $id)
    {
        try {
            $validatedData = $request->validate([
                'userInfo.name' => 'required|string|max:255',
                'userInfo.password' => 'string|nullable',
                'userInfo.email' => [
                    'nullable',
                    'email',
                    'required_without:userInfo.phone',
                ],
                'userInfo.phone' => [
                    'nullable',
                    'string',
                    'required_without:userInfo.email',
                ],
                'userInfo.is_active' => 'nullable',
                'roles' => 'nullable|array',
                'roles.*.id' => 'integer|exists:roles,id',
                'is_active' => 'nullable|boolean',
            ]);

            $userInfo = $validatedData['userInfo'];
            $userInfo['email'] = trim((string) ($userInfo['email'] ?? '')) ?: null;
            $userInfo['phone'] = trim((string) ($userInfo['phone'] ?? '')) ?: null;
            $user = User::findOrFail($id);

            $user->name = $userInfo['name'];
            $user->is_active = $userInfo['is_active'];
            if ($user->email !== $userInfo['email']) {
                $user->email = $userInfo['email'];
            }
            if ($user->phone !== $userInfo['phone']) {
                $user->phone = $userInfo['phone'];
            }
            if (!empty($userInfo['password'])) {
                $user->password = Hash::make($userInfo['password']);
            }

            $roleIds = collect($validatedData['roles'] ?? [])->pluck('id')->toArray();
            if (!empty($roleIds)) {
                $roles = Role::whereIn('id', $roleIds)->get();
                $user->syncRoles($roles);
            } else {
                $user->syncRoles([]);
            }

            $user->save();

            return response()->json([
                'message' => 'User updated successfully',
                'data' => $user->load('roles')
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating user: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred while updating the user',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    public function change_password(Request $request)
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $validated = $request->validate([
                'current_password' => 'required|string',
                'password' => [
                    'required',
                    'string',
                    'min:6',
                    'confirmed',
                ],
            ]);

            $key = 'change-password:' . $user->id;
            if (RateLimiter::tooManyAttempts($key, 6)) {
                $seconds = RateLimiter::availableIn($key);
                return response()->json([
                    'error' => 'Too many attempts. Try again in ' . $seconds . ' seconds.'
                ], 429);
            }

            if (!Hash::check($validated['current_password'], $user->password)) {
                RateLimiter::hit($key, 60);
                throw ValidationException::withMessages([
                    'error' => 'Your current password is incorrect.'
                ]);
            }

            $user->password = Hash::make($validated['password']);
            $user->save();

            RateLimiter::clear($key);

            return response()->json([
                'message' => 'Password changed successfully.'
            ], 200);
        } catch (ValidationException $e) {
            return response()->json([
                'error' => implode(' ', array_values($e->errors())[0])
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error changing password: ' . $e->getMessage());
            return response()->json([
                'error' => 'An error occurred while changing the password: ' . $e->getMessage()
            ], 500);
        }
    }

    public function user_list(Request $request)
    {
        try {
            $top = $request->filled('$top')
                ? max((int) $request->input('$top'), 0)
                : ($request->filled('top') ? max((int) $request->input('top'), 0) : 10);

            $skip = $request->filled('$skip')
                ? max((int) $request->input('$skip'), 0)
                : ($request->filled('skip') ? max((int) $request->input('skip'), 0) : 0);

            $expand = trim((string) ($request->input('$expand') ?? ''));
            $relationships = collect(explode(',', $expand))
                ->map(fn($relationship) => trim($relationship))
                ->filter()
                ->values()
                ->all();

            $odataFilter = urldecode((string) $request->input('$filter', ''));
            $searchTerms = [];

            if ($request->filled('filter')) {
                $searchTerms[] = trim((string) $request->input('filter'));
            }

            if ($odataFilter) {
                preg_match_all(
                    "/contains\\(tolower\\(([^)]+)\\),\\s*'([^']*)'\\)/i",
                    $odataFilter,
                    $matches,
                    PREG_SET_ORDER
                );

                foreach ($matches as $match) {
                    $searchTerms[] = urldecode($match[2]);
                }
            }

            $searchTerms = collect($searchTerms)
                ->map(fn($term) => trim((string) $term))
                ->filter()
                ->unique()
                ->values()
                ->all();

            $query = User::query();

            if (in_array('roles', $relationships, true)) {
                $query->with('roles');
            }

            if ($odataFilter && preg_match('/is_active\s+(eq|ne)\s+(true|false)/i', $odataFilter, $statusMatches)) {
                $operator = strtolower($statusMatches[1]);
                $value = strtolower($statusMatches[2]) === 'true';

                if ($operator === 'eq') {
                    $query->where('is_active', $value);
                } elseif ($operator === 'ne') {
                    $query->where('is_active', '!=', $value);
                }
            }

            if (!empty($searchTerms)) {
                $query->where(function ($q) use ($searchTerms) {
                    foreach ($searchTerms as $term) {
                        $likeTerm = '%' . strtolower($term) . '%';

                        $q->orWhereRaw('LOWER(name) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(custom_id) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(CAST(created_at AS CHAR)) LIKE ?', [$likeTerm])
                            ->orWhereHas('roles', function ($roleQuery) use ($likeTerm) {
                                $roleQuery->whereRaw('LOWER(name) LIKE ?', [$likeTerm]);
                            });

                        if (in_array(strtolower($term), ['true', 'false', 'active', 'inactive'], true)) {
                            $q->orWhere('is_active', in_array(strtolower($term), ['true', 'active'], true));
                        }
                    }
                });
            }

            $userCount = (clone $query)->count();

            $users = $query->orderBy('id', 'desc')
                ->offset($skip)
                ->limit($top)
                ->get();

            return response()->json([
                'value' => $users,
                '@count' => $userCount
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching users: ' . $e->getMessage());

            return response()->json([
                'error' => 'An error occurred while fetching users',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function trashed_list(Request $request)
    {
        try {
            if (!$request->user()->can('BASE_DATA_USER_BIN')) {
                return response()->json(['error' => 'Forbidden'], 403);
            }

            $top = $request->filled('$top')
                ? max((int) $request->input('$top'), 0)
                : ($request->filled('top') ? max((int) $request->input('top'), 0) : 10);

            $skip = $request->filled('$skip')
                ? max((int) $request->input('$skip'), 0)
                : ($request->filled('skip') ? max((int) $request->input('skip'), 0) : 0);

            $expand = trim((string) ($request->input('$expand') ?? ''));
            $relationships = collect(explode(',', $expand))
                ->map(fn($relationship) => trim($relationship))
                ->filter()
                ->values()
                ->all();

            $odataFilter = urldecode((string) $request->input('$filter', ''));
            $searchTerms = [];

            if ($request->filled('filter')) {
                $searchTerms[] = trim((string) $request->input('filter'));
            }

            if ($odataFilter) {
                preg_match_all(
                    "/contains\\(tolower\\(([^)]+)\\),\\s*'([^']*)'\\)/i",
                    $odataFilter,
                    $matches,
                    PREG_SET_ORDER
                );

                foreach ($matches as $match) {
                    $searchTerms[] = urldecode($match[2]);
                }
            }

            $searchTerms = collect($searchTerms)
                ->map(fn($term) => trim((string) $term))
                ->filter()
                ->unique()
                ->values()
                ->all();

            $query = User::onlyTrashed();

            if (in_array('roles', $relationships, true)) {
                $query->with('roles');
            }

            if ($odataFilter && preg_match('/is_active\s+(eq|ne)\s+(true|false)/i', $odataFilter, $statusMatches)) {
                $operator = strtolower($statusMatches[1]);
                $value = strtolower($statusMatches[2]) === 'true';

                if ($operator === 'eq') {
                    $query->where('is_active', $value);
                } elseif ($operator === 'ne') {
                    $query->where('is_active', '!=', $value);
                }
            }

            if (!empty($searchTerms)) {
                $query->where(function ($q) use ($searchTerms) {
                    foreach ($searchTerms as $term) {
                        $likeTerm = '%' . strtolower($term) . '%';

                        $q->orWhereRaw('LOWER(name) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(custom_id) LIKE ?', [$likeTerm])
                            ->orWhereRaw('LOWER(CAST(created_at AS CHAR)) LIKE ?', [$likeTerm])
                            ->orWhereHas('roles', function ($roleQuery) use ($likeTerm) {
                                $roleQuery->whereRaw('LOWER(name) LIKE ?', [$likeTerm]);
                            });

                        if (in_array(strtolower($term), ['true', 'false', 'active', 'inactive'], true)) {
                            $q->orWhere('is_active', in_array(strtolower($term), ['true', 'active'], true));
                        }
                    }
                });
            }

            $userCount = (clone $query)->count();

            $users = $query->orderBy('deleted_at', 'desc')
                ->offset($skip)
                ->limit($top)
                ->get();

            return response()->json([
                'value' => $users,
                '@count' => $userCount
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching trashed users: ' . $e->getMessage());

            return response()->json([
                'error' => 'An error occurred while fetching trashed users',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function restore_user(Request $request, $id)
    {
        try {
            if (!$request->user()->can('BASE_DATA_USER_RESTORE')) {
                return response()->json(['error' => 'Forbidden'], 403);
            }

            $user = User::onlyTrashed()->findOrFail($id);
            $user->restore();

            return response()->json([
                'message' => 'User restored successfully',
                'data' => $user->load('roles')
            ]);
        } catch (\Exception $e) {
            Log::error('Error restoring user: ' . $e->getMessage());

            return response()->json([
                'error' => 'An error occurred while restoring the user',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
