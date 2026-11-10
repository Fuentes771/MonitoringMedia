<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'rapidapi' => [
        'key' => env('RAPIDAPI_KEY'),
        'x' => [
            'host' => env('RAPIDAPI_X_HOST', 'twitter154.p.rapidapi.com'),
            'search_url' => env('RAPIDAPI_X_URL', 'https://twitter154.p.rapidapi.com/search/search'),
            'replies_url' => env('RAPIDAPI_X_REPLIES_URL', 'https://twitter154.p.rapidapi.com/tweet/replies'),
        ],
        'tiktok' => [
            'host' => env('RAPIDAPI_TIKTOK_HOST', 'tiktok-scraper7.p.rapidapi.com'),
            'search_url' => env('RAPIDAPI_TIKTOK_URL', 'https://tiktok-scraper7.p.rapidapi.com/feed/search'),
            'comments_url' => env('RAPIDAPI_TIKTOK_COMMENTS_URL', 'https://tiktok-scraper7.p.rapidapi.com/comment/list'),
        ],
        'instagram' => [
            'host' => env('RAPIDAPI_INSTAGRAM_HOST', 'instagram-scraper-api2.p.rapidapi.com'),
            'search_url' => env('RAPIDAPI_INSTAGRAM_URL', 'https://instagram-scraper-api2.p.rapidapi.com/v1/hashtag'),
            'comments_url' => env('RAPIDAPI_INSTAGRAM_COMMENTS_URL', 'https://instagram-scraper-api2.p.rapidapi.com/v1/comments'),
        ],
        'facebook' => [
            'host' => env('RAPIDAPI_FACEBOOK_HOST', 'facebook-scraper3.p.rapidapi.com'),
            'search_url' => env('RAPIDAPI_FACEBOOK_URL', 'https://facebook-scraper3.p.rapidapi.com/search/posts'),
            'comments_url' => env('RAPIDAPI_FACEBOOK_COMMENTS_URL', 'https://facebook-scraper3.p.rapidapi.com/post/comments'),
        ],
    ],

];
