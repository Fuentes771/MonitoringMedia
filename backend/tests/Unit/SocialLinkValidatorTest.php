<?php

namespace Tests\Unit;

use App\Services\SocialLinkValidator;
use Tests\TestCase;

class SocialLinkValidatorTest extends TestCase
{
    public function test_detects_synthetic_post_hash_and_fallback_mirrors(): void
    {
        $validator = new SocialLinkValidator();

        $res1 = $validator->validateAndNormalize('tiktok', 'https://www.tiktok.com/post/a1b2c3d4e5f6');
        $this->assertEquals(SocialLinkValidator::STATUS_BROKEN_LEGACY, $res1['link_status']);

        $res2 = $validator->validateAndNormalize('instagram', 'https://www-fallback.instagram.com/popular/mbg/');
        $this->assertEquals(SocialLinkValidator::STATUS_BROKEN_LEGACY, $res2['link_status']);

        $res3 = $validator->validateAndNormalize('x', 'https://x.com/RadioElshinta/status/185512390123');
        $this->assertEquals(SocialLinkValidator::STATUS_BROKEN_LEGACY, $res3['link_status']);

        $res4 = $validator->validateAndNormalize('x', 'https://x.com/Twitter User/status/2114676540395135082');
        $this->assertEquals(SocialLinkValidator::STATUS_BROKEN_LEGACY, $res4['link_status']);
    }

    public function test_validates_canonical_social_and_video_urls_and_strips_tracking(): void
    {
        $validator = new SocialLinkValidator();

        $xRes = $validator->validateAndNormalize('x', 'https://x.com/Indolevelup/status/2114676540395135082?s=20');
        $this->assertEquals(SocialLinkValidator::STATUS_VERIFIED_POST, $xRes['link_status']);

        $ttRes = $validator->validateAndNormalize('tiktok', 'https://www.tiktok.com/@detikcom/video/7602134172550827272');
        $this->assertEquals(SocialLinkValidator::STATUS_VERIFIED_POST, $ttRes['link_status']);

        $igRes = $validator->validateAndNormalize('instagram', 'https://www.instagram.com/p/De8TYP6lIm4/?igshid=abc');
        $this->assertEquals(SocialLinkValidator::STATUS_VERIFIED_POST, $igRes['link_status']);
        $this->assertStringNotContainsString('igshid', (string) $igRes['url']);

        $fbRes = $validator->validateAndNormalize('facebook', 'https://m.facebook.com/reel/885240781079158/?fbclid=xyz');
        $this->assertEquals(SocialLinkValidator::STATUS_VERIFIED_POST, $fbRes['link_status']);
        $this->assertStringStartsWith('https://www.facebook.com/reel/885240781079158/', (string) $fbRes['url']);

        $ytRes = $validator->validateAndNormalize('youtube', 'https://www.youtube.com/watch?v=aIUWJ9t-Etk');
        $this->assertEquals(SocialLinkValidator::STATUS_VERIFIED_POST, $ytRes['link_status']);
    }

    public function test_normalizes_unencoded_search_urls_and_demo_placeholders(): void
    {
        $validator = new SocialLinkValidator();

        $searchRes = $validator->validateAndNormalize('facebook', 'https://www.facebook.com/search/top?q=Makan Bergizi Gratis');
        $this->assertEquals(SocialLinkValidator::STATUS_SEARCH_FALLBACK, $searchRes['link_status']);
        $this->assertStringNotContainsString(' ', (string) $searchRes['url']);

        $demoRes = $validator->validateAndNormalize('x', 'https://x.com/user/status/2114676540395135082', null, true);
        $this->assertEquals(SocialLinkValidator::STATUS_DEMO_PLACEHOLDER, $demoRes['link_status']);
        $this->assertNull($demoRes['url']);
    }
}

