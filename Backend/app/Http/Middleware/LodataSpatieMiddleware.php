<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\PermissionRegistry;

class LodataSpatieMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $prefix = config('lodata.prefix', 'odata');
        
        $path = ltrim($request->path(), $prefix . '/');
        $entitySetName = explode('/', $path)[0];

        $fullMap = PermissionRegistry::getMap();
        $method = $request->getMethod();

        if (isset($fullMap[$entitySetName])) {
            $entityPermissions = $fullMap[$entitySetName];
            $requiredPermission = $entityPermissions[$method] ?? null;

            if ($requiredPermission) {
                if (!auth()->user() || !auth()->user()->can($requiredPermission)) {
                    return response()->json([
                        'error' => [
                            'code' => '403',
                            'message' => "Access Denied. You need permission to perform this action."
                        ]
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
