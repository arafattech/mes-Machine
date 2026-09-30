<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'odata/*'],

    // Allow all methods (GET, POST, PUT, DELETE, etc.)
    'allowed_methods' => ['*'],

    // Allow specific origins (your Angular app URL)
    'allowed_origins' => ['http://localhost:4200', 'http://localhost:4800' , '*'],


    // Leave this empty for no restrictions on patterns
    'allowed_origins_patterns' => [],

    // Allow all headers (for your API requests)
    'allowed_headers' => ['*'],

    // You can expose some specific headers
    'exposed_headers' => [],

    // Max age of the CORS response cache (0 for no caching)
    'max_age' => 0,

    // Set to true if credentials are supported (for cookies, sessions, etc.)
    'supports_credentials' => true,

];
