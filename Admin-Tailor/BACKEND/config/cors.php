<?php
return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'register', 'logout', 'user', 'profile'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'], // ✅ Correct for development. Restrict in production.

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
