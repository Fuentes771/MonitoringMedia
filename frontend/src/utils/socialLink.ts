import type { SocialLinkStatusType } from '../lib/api';

export type SocialLinkStatus = SocialLinkStatusType;

export interface SocialLinkInspection {
  status: SocialLinkStatus;
  href: string | null;
  isExternalNavigable: boolean;
  isVerifiedDirect: boolean;
  isSearchFallback: boolean;
  reason: string;
}

const KNOWN_DEMO_TOKENS = [
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

export function isSyntheticOrBrokenUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  // Synthetic BaseScraper artifact previously emitted on dead queries
  if (/\/post\/[a-f0-9]{6,}\/?(?:\?|$)/i.test(trimmed)) {
    return true;
  }

  if (lower.includes('www-fallback.') || /instagram\.com\/popular\//i.test(trimmed)) {
    return true;
  }

  // Corrupted X URL with spaces in author display name
  if (/(?:x\.com|twitter\.com)\/[^/]*\s[^/]*\/status\//i.test(trimmed)) {
    return true;
  }

  return KNOWN_DEMO_TOKENS.some((token) => trimmed.includes(token));
}

export function buildPlatformSearchFallbackUrl(provider: string, query: string): string {
  const key = provider.toLowerCase().trim();
  const encoded = encodeURIComponent(query.trim());

  switch (key) {
    case 'x':
    case 'twitter':
      return `https://x.com/search?q=${encoded}&f=live`;
    case 'tiktok':
      return `https://www.tiktok.com/search?q=${encoded}`;
    case 'instagram':
      return `https://www.instagram.com/explore/search/keyword/?q=${encoded}`;
    case 'facebook':
      return `https://www.facebook.com/search/posts/?q=${encoded}`;
    case 'youtube':
      return `https://www.youtube.com/results?search_query=${encoded}`;
    default:
      return `https://www.google.com/search?q=${encoded}`;
  }
}

export function encodeSpacesIfNeeded(url: string): string {
  const trimmed = url.trim();
  if (!trimmed.includes(' ')) return trimmed;
  return trimmed.replace(/ /g, '%20');
}

function isSearchOrDiscoveryUrl(providerKey: string, url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('/search?') || lower.includes('/search/')) return true;
  if (providerKey === 'tiktok' && (lower.includes('/tag/') || lower.includes('/discover/'))) return true;
  if (providerKey === 'instagram' && (lower.includes('/explore/') || lower.includes('/popular/'))) return true;
  if (providerKey === 'youtube' && lower.includes('/results?')) return true;
  return false;
}

export function classifyCanonicalPostUrl(providerKey: string, url: string): SocialLinkStatus {
  switch (providerKey) {
    case 'x':
    case 'twitter':
      return /^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/(?!(?:i|search|hashtag|explore|home|login)\/)[a-zA-Z0-9_]{1,30}\/status\/\d{15,22}(?:[/?#].*)?$/i.test(
        url
      )
        ? 'verified_post'
        : 'search_fallback';
    case 'tiktok':
      return /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[a-zA-Z0-9_.-]+\/(?:video|photo)\/\d{15,22}(?:[/?#].*)?$/i.test(
        url
      )
        ? 'verified_post'
        : 'search_fallback';
    case 'instagram':
      return /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:[a-zA-Z0-9_.]+\/)?(?:p|reel|reels|tv)\/[a-zA-Z0-9_-]{5,30}\/?(?:\?.*)?$/i.test(
        url
      )
        ? 'verified_post'
        : 'search_fallback';
    case 'facebook':
      return /^https?:\/\/(?:www\.|m\.|web\.)?facebook\.com\/(?:reel\/\d+|watch\/?\?(?:[^#]*&)?v=\d+|permalink\.php\?.*story_fbid=|story\.php\?.*story_fbid=|share\/(?:p|r|v)\/[a-zA-Z0-9_-]+|[^/?#]+\/(?:posts|videos)\/[a-zA-Z0-9_.-]+|groups\/[^/?#]+\/(?:posts|permalink)\/[a-zA-Z0-9_.-]+)/i.test(
        url
      ) || /^https?:\/\/fb\.watch\/[a-zA-Z0-9_-]+/i.test(url)
        ? 'verified_post'
        : 'search_fallback';
    case 'youtube':
      return /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=[a-zA-Z0-9_-]{6,}|shorts\/[a-zA-Z0-9_-]{6,})|youtu\.be\/[a-zA-Z0-9_-]{6,})/i.test(
        url
      )
        ? 'verified_post'
        : 'search_fallback';
    case 'rss':
      return 'verified_article';
    default:
      return 'search_fallback';
  }
}

export function inspectSocialLink(params: {
  provider?: string | null;
  sourceUrl?: string | null;
  linkStatus?: SocialLinkStatus | null;
  isDemo?: boolean;
  fallbackQuery?: string | null;
}): SocialLinkInspection {
  const providerKey = (params.provider || '').toLowerCase().trim();
  const isDemo = Boolean(params.isDemo) || params.linkStatus === 'demo_placeholder';

  if (isDemo) {
    return {
      status: 'demo_placeholder',
      href: null,
      isExternalNavigable: false,
      isVerifiedDirect: false,
      isSearchFallback: false,
      reason: 'Data simulasi internal (tidak memiliki tautan publik aktif).',
    };
  }

  const rawUrl = (params.sourceUrl || '').trim();
  if (!rawUrl) {
    if (params.fallbackQuery && params.fallbackQuery.trim()) {
      return {
        status: 'search_fallback',
        href: buildPlatformSearchFallbackUrl(providerKey, params.fallbackQuery),
        isExternalNavigable: true,
        isVerifiedDirect: false,
        isSearchFallback: true,
        reason: 'Tautan asli kosong; diarahkan ke pencarian platform.',
      };
    }

    return {
      status: 'unavailable',
      href: null,
      isExternalNavigable: false,
      isVerifiedDirect: false,
      isSearchFallback: false,
      reason: 'Tautan sumber tidak tersedia.',
    };
  }

  if (isSyntheticOrBrokenUrl(rawUrl) || params.linkStatus === 'broken_legacy') {
    if (params.fallbackQuery && params.fallbackQuery.trim()) {
      return {
        status: 'search_fallback',
        href: buildPlatformSearchFallbackUrl(providerKey, params.fallbackQuery),
        isExternalNavigable: true,
        isVerifiedDirect: false,
        isSearchFallback: true,
        reason: 'Tautan lama terdeteksi rusak; dialihkan ke pencarian platform.',
      };
    }

    return {
      status: 'broken_legacy',
      href: null,
      isExternalNavigable: false,
      isVerifiedDirect: false,
      isSearchFallback: false,
      reason: 'Tautan lama tidak valid (format /post/ sintetis atau domain rusak).',
    };
  }

  const safeHref = encodeSpacesIfNeeded(rawUrl);

  if (providerKey === 'rss' || params.linkStatus === 'verified_article') {
    return {
      status: 'verified_article',
      href: safeHref,
      isExternalNavigable: true,
      isVerifiedDirect: true,
      isSearchFallback: false,
      reason: 'Tautan artikel media massa valid.',
    };
  }

  if (isSearchOrDiscoveryUrl(providerKey, safeHref) || params.linkStatus === 'search_fallback') {
    return {
      status: 'search_fallback',
      href: safeHref,
      isExternalNavigable: true,
      isVerifiedDirect: false,
      isSearchFallback: true,
      reason: 'Tautan mengarah ke halaman pencarian platform untuk verifikasi.',
    };
  }

  if (params.linkStatus === 'verified_post') {
    return {
      status: 'verified_post',
      href: safeHref,
      isExternalNavigable: true,
      isVerifiedDirect: true,
      isSearchFallback: false,
      reason: 'Tautan langsung ke postingan terverifikasi.',
    };
  }

  const classified = classifyCanonicalPostUrl(providerKey, safeHref);
  if (classified === 'verified_post') {
    return {
      status: 'verified_post',
      href: safeHref,
      isExternalNavigable: true,
      isVerifiedDirect: true,
      isSearchFallback: false,
      reason: 'Format tautan postingan kanonik terverifikasi.',
    };
  }

  return {
    status: 'search_fallback',
    href: safeHref,
    isExternalNavigable: true,
    isVerifiedDirect: false,
    isSearchFallback: true,
    reason: 'Tautan merujuk halaman umum platform (perlu verifikasi).',
  };
}

