<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Services\LocalScraperService;

class LocalScraperTest extends TestCase
{
    public function test_local_scraper_is_available(): void
    {
        $service = new LocalScraperService();
        $this->assertTrue($service->isAvailable(), 'Python Local Scraper service must be available at port 8001');
    }

    public function test_local_scraper_can_scrape_x(): void
    {
        $service = new LocalScraperService();
        $items = $service->scrape('x', 'Prabowo', 2);
        $this->assertIsArray($items);
        if (!empty($items)) {
            $item = $items[0];
            $this->assertEquals('x', $item['provider']);
            $this->assertArrayHasKey('text', $item);
            $this->assertArrayHasKey('author_name', $item);
            $this->assertArrayHasKey('source_url', $item);
        }
    }

    public function test_local_scraper_can_scrape_tiktok(): void
    {
        $service = new LocalScraperService();
        $items = $service->scrape('tiktok', 'Prabowo', 2);
        $this->assertIsArray($items);
        if (!empty($items)) {
            $item = $items[0];
            $this->assertEquals('tiktok', $item['provider']);
            $this->assertArrayHasKey('text', $item);
        }
    }
}

