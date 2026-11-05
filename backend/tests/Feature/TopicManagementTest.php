<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Workspace;
use App\Models\Topic;
use App\Models\TopicKeyword;
use Illuminate\Foundation\Testing\RefreshDatabase;

class TopicManagementTest extends TestCase
{
    use RefreshDatabase;

    protected Workspace $workspaceA;
    protected Workspace $workspaceB;

    protected function setUp(): void
    {
        parent::setUp();

        $userA = User::create([
            'name' => 'Owner Alpha',
            'email' => 'alpha@pulsescope.id',
            'password' => bcrypt('password'),
        ]);

        $this->workspaceA = Workspace::create([
            'name' => 'Workspace Alpha',
            'slug' => 'workspace-alpha',
            'owner_id' => $userA->id,
        ]);

        $userB = User::create([
            'name' => 'Owner Beta',
            'email' => 'beta@pulsescope.id',
            'password' => bcrypt('password'),
        ]);

        $this->workspaceB = Workspace::create([
            'name' => 'Workspace Beta',
            'slug' => 'workspace-beta',
            'owner_id' => $userB->id,
        ]);
    }

    public function test_can_create_topic_with_keywords(): void
    {
        $payload = [
            'name' => 'Fintech Regulasi OJK',
            'description' => 'Monitoring kepatuhan dan sentimen fintech',
            'include_keywords' => ['fintech', 'OJK', 'pinjol'],
            'exclude_keywords' => ['casino', 'judi'],
            'providers' => ['rss', 'youtube'],
            'match_mode' => 'any',
        ];

        $response = $this->postJson("/api/v1/workspaces/{$this->workspaceA->id}/topics", $payload);

        $response->assertStatus(201)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.name', 'Fintech Regulasi OJK')
            ->assertJsonPath('data.workspace_id', (string) $this->workspaceA->id);

        $this->assertDatabaseHas('topics', [
            'workspace_id' => $this->workspaceA->id,
            'name' => 'Fintech Regulasi OJK',
        ]);

        $this->assertDatabaseCount('topic_keywords', 5); // 3 include + 2 exclude
    }

    public function test_workspace_isolation_lists_only_scoped_topics(): void
    {
        // Create topic in workspace A
        $topicA = Topic::create([
            'workspace_id' => $this->workspaceA->id,
            'name' => 'Topic in Alpha',
            'status' => 'active',
            'match_mode' => 'any',
        ]);

        // Create topic in workspace B
        $topicB = Topic::create([
            'workspace_id' => $this->workspaceB->id,
            'name' => 'Topic in Beta',
            'status' => 'active',
            'match_mode' => 'any',
        ]);

        $responseA = $this->getJson("/api/v1/workspaces/{$this->workspaceA->id}/topics");
        $responseA->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $topicA->id)
            ->assertJsonPath('data.0.name', 'Topic in Alpha');

        $responseB = $this->getJson("/api/v1/workspaces/{$this->workspaceB->id}/topics");
        $responseB->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $topicB->id)
            ->assertJsonPath('data.0.name', 'Topic in Beta');
    }

    public function test_can_update_topic_status(): void
    {
        $topic = Topic::create([
            'workspace_id' => $this->workspaceA->id,
            'name' => 'Topic to Pause',
            'status' => 'active',
            'match_mode' => 'any',
        ]);

        $response = $this->patchJson("/api/v1/topics/{$topic->id}", [
            'status' => 'paused',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.status', 'paused');

        $this->assertDatabaseHas('topics', [
            'id' => $topic->id,
            'status' => 'paused',
        ]);
    }

    public function test_can_delete_or_archive_topic(): void
    {
        $topic = Topic::create([
            'workspace_id' => $this->workspaceA->id,
            'name' => 'Topic to Archive',
            'status' => 'active',
            'match_mode' => 'any',
        ]);

        $response = $this->deleteJson("/api/v1/topics/{$topic->id}");

        $response->assertStatus(200)
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('message', 'Topik berhasil diarsipkan.');

        $this->assertDatabaseHas('topics', [
            'id' => $topic->id,
            'status' => 'archived',
        ]);
    }
}
