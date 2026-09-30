<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates internal service-to-service routes (e.g. node-server → Laravel) that have no
 * logged-in user to authenticate as. Not a substitute for auth:sanctum — only for
 * routes explicitly meant to be called by trusted internal services.
 */
class VerifyInternalServiceToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = config('services.internal.token');

        if (! $expected || ! hash_equals($expected, (string) $request->header('X-Internal-Token'))) {
            abort(401, 'Invalid internal service token.');
        }

        return $next($request);
    }
}
