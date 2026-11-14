<?php

namespace App\Services;

class SocialLinkValidator
{
    public const STATUS_VERIFIED_POST = 'verified_post';
    public const STATUS_VERIFIED_ARTICLE = 'verified_article';
    public const STATUS_SEARCH_FALLBACK = 'search_fallback';
    public const STATUS_BROKEN_LEGACY = 'broken_legacy';
    public const STATUS_DEMO_PLACEHOLDER = 'demo_placeholder';
    public const STATUS_UNAVAILABLE = 'unavailable';

    /** Fake external IDs previously inserted by demo CLI seeders. */
    private const KNOWN_DEMO_URL_TOKENS = [
        '185512390123',
        '185523450987',
        '74312890123',
        '74319876543',
        'DC9xX290KL',
        'DC8wW189MN',
        '998877665544',
        '998811223344',
        '185590192831',
        '74319988221',
        'DC99SadapPrabowo',
        '185591028372',
    ];

    /**
     * Validate, normalize, and classify any social/news source_url.
     *
     * @return array{url: ?string, link_status: string, reason: ?string}
     */
    public function validateAndNormalize(
        ?string $provider,
        ?string $rawUrl,
        ?string $queryHint = null,
        bool $isDemo = false,
        ?string $declaredStatus = null
    ): array {
        $providerKey = strtolower(trim((string) $provider));

        if ($isDemo || $declaredStatus === self::STATUS_DEMO_PLACEHOLDER) {
            return [
                'url' => null,
                'link_status' => self::STATUS_DEMO_PLACEHOLDER,
                'reason' => 'Konten demonstrasi internal (tidak tertaut ke URL eksternal aktif).',
            ];
        }

        $trimmed = trim((string) $rawUrl);
        if ($trimmed === '') {
            return [
                'url' => null,
                'link_status' => self::STATUS_UNAVAILABLE,
                'reason' => 'Tautan sumber kosong.',
            ];
        }

        // Detect known fake/synthetic patterns before allowing persistence or browser navigation
        if ($this->isSyntheticOrBrokenPattern($trimmed)) {
            if ($queryHint) {
                return [
                    'url' => $this->buildSearchFallbackUrl($providerKey, $queryHint),
                    'link_status' => self::STATUS_SEARCH_FALLBACK,
                    'reason' => 'Tautan asli tidak tersedia; diarahkan ke pencarian platform.',
                ];
            }

            return [
                'url' => $trimmed,
                'link_status' => self::STATUS_BROKEN_LEGACY,
                'reason' => 'Tautan lama terdeteksi tidak valid (/post/ sintetis, domain fallback, atau ID demo).',
            ];
        }

        $encodedUrl = $this->encodeSpacesInUrl($trimmed);

        if (!filter_var($encodedUrl, FILTER_VALIDATE_URL)) {
            return [
                'url' => null,
                'link_status' => self::STATUS_BROKEN_LEGACY,
                'reason' => 'Format URL tidak valid.',
            ];
        }

        if ($providerKey === 'rss') {
            return [
                'url' => $encodedUrl,
                'link_status' => self::STATUS_VERIFIED_ARTICLE,
                'reason' => null,
            ];
        }

        if ($this->isSearchOrDiscoveryUrl($providerKey, $encodedUrl)) {
            return [
                'url' => $encodedUrl,
                'link_status' => self::STATUS_SEARCH_FALLBACK,
                'reason' => 'Tautan mengarah ke halaman pencarian platform untuk verifikasi manual.',
            ];
        }

        $canonicalStatus = $this->classifyCanonicalPostUrl($providerKey, $encodedUrl);
        if ($canonicalStatus === self::STATUS_VERIFIED_POST) {
            return [
                'url' => $this->canonicalizePlatformUrl($providerKey, $encodedUrl),
                'link_status' => self::STATUS_VERIFIED_POST,
                'reason' => null,
            ];
        }

        if ($declaredStatus === self::STATUS_SEARCH_FALLBACK) {
            return [
                'url' => $encodedUrl,
                'link_status' => self::STATUS_SEARCH_FALLBACK,
                'reason' => 'Tautan pencarian platform (perlu verifikasi).',
            ];
        }

        // Non-post profile/group/tag pages are converted to search fallback if hint exists, or marked search_fallback
        if ($queryHint) {
            return [
                'url' => $this->buildSearchFallbackUrl($providerKey, $queryHint),
                'link_status' => self::STATUS_SEARCH_FALLBACK,
                'reason' => 'URL sumber bukan postingan spesifik; dialihkan ke tautan pencarian platform.',
            ];
        }

        return [
            'url' => $encodedUrl,
            'link_status' => self::STATUS_SEARCH_FALLBACK,
            'reason' => 'Tautan merujuk ke profil atau grup umum, bukan postingan individual.',
        ];
    }

    public function isSyntheticOrBrokenPattern(string $url): bool
    {
        $lower = strtolower($url);

        // Previous BaseScraper bug emitted https://www.<domain>/post/<12 hex chars>
        if (preg_match('#/(?:post)/[a-f0-9]{6,}/?(?:\?|$)#i', $url)) {
            return true;
        }

        if (str_contains($lower, 'www-fallback.') || preg_match('#instagram\.com/popular/#i', $url)) {
            return true;
        }

        // Unescaped user display name injected directly into X URL e.g. x.com/Twitter User/status/123
        if (preg_match('#(?:x\.com|twitter\.com)/[^/]*\s[^/]*/status/#i', $url)) {
            return true;
        }

        foreach (self::KNOWN_DEMO_URL_TOKENS as $token) {
            if (str_contains($url, $token)) {
                return true;
            }
        }

        return false;
    }

    public function classifyCanonicalPostUrl(string $provider, string $url): string
    {
        return match ($provider) {
            'x', 'twitter' => preg_match(
                '#^https?://(?:www\.)?(?:x\.com|twitter\.com)/(?!(?:i|search|hashtag|explore|home|login)/)[a-zA-Z0-9_]{1,30}/status/\d{15,22}(?:[/?\#].*)?$#i',
                $url
            ) ? self::STATUS_VERIFIED_POST : self::STATUS_SEARCH_FALLBACK,
            'tiktok' => preg_match(
                '#^https?://(?:www\.|m\.)?tiktok\.com/@[a-zA-Z0-9_.\-]+/(?:video|photo)/\d{15,22}(?:[/?\#].*)?$#i',
                $url
            ) ? self::STATUS_VERIFIED_POST : self::STATUS_SEARCH_FALLBACK,
            'instagram' => preg_match(
                '#^https?://(?:www\.|m\.)?instagram\.com/(?:[a-zA-Z0-9_.]+/)?(?:p|reel|reels|tv)/[a-zA-Z0-9_\-]{5,30}/?(?:\?.*)?$#i',
                $url
            ) ? self::STATUS_VERIFIED_POST : self::STATUS_SEARCH_FALLBACK,
            'facebook' => preg_match(
                '#^https?://(?:www\.|m\.|web\.)?facebook\.com/(?:reel/\d+|watch/?\?(?:[^\#]*&)?v=\d+|permalink\.php\?.*story_fbid=|story\.php\?.*story_fbid=|share/(?:p|r|v)/[a-zA-Z0-9_\-]+|[^/?\#]+/(?:posts|videos)/[a-zA-Z0-9_.\-]+|groups/[^/?\#]+/(?:posts|permalink)/[a-zA-Z0-9_.\-]+)#i',
                $url
            ) || preg_match('#^https?://fb\.watch/[a-zA-Z0-9_\-]+#i', $url)
                ? self::STATUS_VERIFIED_POST
                : self::STATUS_SEARCH_FALLBACK,
            'youtube' => preg_match(
                '#^https?://(?:(?:www\.|m\.)?youtube\.com/(?:watch\?(?:[^\#]*&)?v=[a-zA-Z0-9_\-]{6,}|shorts/[a-zA-Z0-9_\-]{6,})|youtu\.be/[a-zA-Z0-9_\-]{6,})#i',
                $url
            ) ? self::STATUS_VERIFIED_POST : self::STATUS_SEARCH_FALLBACK,
            'rss' => self::STATUS_VERIFIED_ARTICLE,
            default => self::STATUS_SEARCH_FALLBACK,
        };
    }

    public function buildSearchFallbackUrl(string $provider, string $query): string
    {
        $encoded = urlencode(trim($query));

        return match ($provider) {
            'x', 'twitter' => "https://x.com/search?q={$encoded}&f=live",
            'tiktok' => "https://www.tiktok.com/search?q={$encoded}",
            'instagram' => "https://www.instagram.com/explore/search/keyword/?q={$encoded}",
            'facebook' => "https://www.facebook.com/search/posts/?q={$encoded}",
            'youtube' => "https://www.youtube.com/results?search_query={$encoded}",
            default => "https://www.google.com/search?q={$encoded}",
        };
    }

    public function encodeSpacesInUrl(string $url): string
    {
        $parts = parse_url(trim($url));
        if ($parts === false || empty($parts['host'])) {
            return str_replace(' ', '%20', trim($url));
        }

        $scheme = $parts['scheme'] ?? 'https';
        $host = strtolower($parts['host']);
        $path = isset($parts['path']) ? str_replace(' ', '%20', $parts['path']) : '';

        $query = '';
        if (isset($parts['query']) && $parts['query'] !== '') {
            parse_str($parts['query'], $qParams);
            $query = '?' . http_build_query($qParams);
        }

        return "{$scheme}://{$host}{$path}{$query}";
    }

    private function canonicalizePlatformUrl(string $provider, string $url): string
    {
        $clean = preg_replace('/([?&])(utm_[^=]+|fbclid|igsh|igshid|__tn__|mibextid|ref)=[^&]*(&?)/i', '$1', $url);
        $clean = rtrim((string) $clean, '?&');

        if ($provider === 'facebook') {
            $clean = str_ireplace(['://m.facebook.com', '://web.facebook.com'], '://www.facebook.com', $clean);
        }

        return $clean;
    }

    private function isSearchOrDiscoveryUrl(string $provider, string $url): bool
    {
        $lower = strtolower($url);

        if (str_contains($lower, '/search?') || str_contains($lower, '/search/')) {
            return true;
        }

        if ($provider === 'tiktok' && (str_contains($lower, '/tag/') || str_contains($lower, '/discover/'))) {
            return true;
        }

        if ($provider === 'instagram' && (str_contains($lower, '/explore/') || str_contains($lower, '/popular/'))) {
            return true;
        }

        if ($provider === 'youtube' && str_contains($lower, '/results?')) {
            return true;
        }

        return false;
    }

    /**
     * Derive effective link_status for API responses (supports legacy DB rows lacking metadata_json.link_status).
     */
    public function resolveEffectiveStatus(?string $provider, ?string $sourceUrl, ?array $metadata, bool $isDemo): string
    {
        if ($isDemo) {
            return self::STATUS_DEMO_PLACEHOLDER;
        }

        $metaStatus = $metadata['link_status'] ?? null;
        $evaluated = $this->validateAndNormalize($provider, $sourceUrl, null, $isDemo, $metaStatus);

        return $evaluated['link_status'];
    }
}
