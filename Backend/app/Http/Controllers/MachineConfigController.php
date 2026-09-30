<?php

namespace App\Http\Controllers;

use App\Models\ConfigHasChannel;
use App\Models\Machine;
use App\Models\MachineCounter;
use App\Models\MachineHasConfig;
use App\Models\MachineSignal;
use App\Models\MachineState;
use App\Models\MachineTransportConfig;
use App\Services\MachineConfigCacheInvalidator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MachineConfigController extends Controller
{
    private const DEFAULT_API_SIGNAL_MAP = [
        'A' => 3,
        'F' => 1,
        'P' => 2,
        'HK' => 5,
        'ZH' => 4,
    ];

    /**
     * `config_has_channels.status` ENUM values still kept in best-effort sync alongside
     * the authoritative `machine_state_id` FK, same convention as node-server's
     * `MachineStateTrackerService::toLegacyState` — dropped once Phase 5 removes the
     * old column. A custom admin-defined state (e.g. "Changeover") has no slot here.
     */
    private const LEGACY_STATE_VALUES = ['active', 'inactive', 'maintenance', 'idle', 'fault'];

    public function __construct(private readonly MachineConfigCacheInvalidator $cacheInvalidator) {}

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        if (MachineHasConfig::where('machine_id', $validated['machine_id'])->exists()) {
            return response()->json([
                'message' => 'A configuration already exists for this machine.',
            ], 422);
        }

        $machine = Machine::findOrFail($validated['machine_id']);
        $validated['machine_name'] = $validated['machine_name'] ?: $machine->machine_name;

        $channels = $validated['channels'] ?? [];
        unset($validated['channels']);

        $machineConfig = DB::transaction(function () use ($validated, $channels) {
            $machineConfig = MachineHasConfig::create($validated);
            $this->syncMachineConfigDependencies($validated);
            $this->syncChannels($machineConfig->id, $channels);

            return $machineConfig;
        });

        $this->cacheInvalidator->invalidate();

        return response()->json([
            'message' => 'Machine configuration saved successfully.',
            'data' => $machineConfig,
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $machineConfig = MachineHasConfig::findOrFail($id);
        $validated = $this->validatePayload($request, $machineConfig->id);

        $machine = Machine::findOrFail($validated['machine_id']);
        $validated['machine_name'] = $validated['machine_name'] ?: $machine->machine_name;

        $channels = $validated['channels'] ?? [];
        unset($validated['channels']);

        DB::transaction(function () use ($machineConfig, $validated, $channels) {
            $machineConfig->update($validated);
            $this->syncMachineConfigDependencies($validated);
            $this->syncChannels($machineConfig->id, $channels);
        });

        $this->cacheInvalidator->invalidate();

        return response()->json([
            'message' => 'Machine configuration updated successfully.',
            'data' => $machineConfig->fresh(),
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        // Channel status assignment is constrained to this machine's own tagged states
        // (`machine_has_states`) — not the full `machine_states` table — so a channel
        // can't be wired to a state the machine was never configured to use.
        $machine = Machine::find($request->input('machine_id'));
        $allowedStateIds = $machine ? $machine->states()->pluck('machine_states.id')->all() : [];

        return $request->validate([
            'machine_id' => [
                'required',
                'integer',
                'exists:machines,id',
                Rule::unique('machine_has_configs', 'machine_id')->ignore($ignoreId),
            ],
            'machine_name' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'config_id' => ['nullable', 'integer'],
            'ip_plc' => ['required', 'string', 'max:255'],
            'id_iot' => ['nullable', 'string', 'max:255'],
            'protocol' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'read_from' => ['nullable', 'string', Rule::in(['MQTT', 'API', 'MODBUS'])],
            'ip_hmi' => ['nullable', 'string', 'max:255'],
            'port' => ['nullable', 'integer'],
            'websocket_port' => ['nullable', 'integer'],
            'max_rpm' => ['nullable', 'integer'],
            'min_rpm' => ['nullable', 'integer'],
            'max_temp' => ['nullable', 'integer'],
            'min_temp' => ['nullable', 'integer'],
            'ideal_cycle_seconds' => ['nullable', 'numeric', 'min:0'],
            'shot_buffer' => ['nullable', 'integer'],
            'timeout_sec' => ['nullable', 'integer'],
            'server_call_sec' => ['nullable', 'integer'],
            'auto_signal' => ['nullable', 'string', 'max:255'],
            'shot_signal' => ['nullable', 'string', 'max:255'],
            'inverse_auto' => ['sometimes', 'boolean'],
            'inverse_shot' => ['sometimes', 'boolean'],
            'auto_independent' => ['sometimes', 'boolean'],
            'live_status_api' => ['nullable', 'string', 'max:255'],
            'live_shot_api' => ['nullable', 'string', 'max:255'],
            'test_status_api' => ['nullable', 'string', 'max:255'],
            'test_shot_api' => ['nullable', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
            'scrap' => ['sometimes', 'boolean'],
            'robot_active' => ['sometimes', 'boolean'],
            'robot' => ['nullable', 'string', 'max:255'],
            'press_active' => ['sometimes', 'boolean'],
            'press' => ['nullable', 'string', 'max:255'],
            'handling_active' => ['sometimes', 'boolean'],
            'handling' => ['nullable', 'string', 'max:255'],
            'selection_type' => ['nullable', 'string', 'max:255'],
            'heating_start' => ['nullable', 'date'],
            'order_of_machine' => ['nullable', 'integer'],
            'channels' => ['nullable', 'array'],
            'channels.*.channel_id' => ['required_with:channels', 'integer', 'min:0', 'max:9'],
            'channels.*.machine_state_id' => ['required_with:channels', 'integer', Rule::in($allowedStateIds)],
        ]);
    }

    /**
     * Replace a config's channel status mappings with the supplied set.
     * Deduplicates by channel (last wins) so each channel maps to one status.
     * `status` is written best-effort for any state whose name matches a legacy value —
     * `machine_state_id` is the only column the runtime pipeline actually reads.
     */
    private function syncChannels(int $configId, array $channels): void
    {
        ConfigHasChannel::where('config_id', $configId)->delete();

        if ($channels === []) {
            return;
        }

        $stateIds = array_unique(array_column($channels, 'machine_state_id'));
        $stateNameById = MachineState::whereIn('id', $stateIds)->pluck('name', 'id');

        $now = now();
        $rows = [];
        foreach ($channels as $channel) {
            $channelId = $channel['channel_id'] ?? null;
            $stateId = $channel['machine_state_id'] ?? null;
            if ($channelId === null || $stateId === null) {
                continue;
            }
            // 'status' is NOT NULL with no legacy match — fall back to the column's own
            // 'inactive' default rather than break the bulk insert with a mixed key set.
            $stateName = strtolower((string) ($stateNameById[$stateId] ?? ''));
            $rows[(int) $channelId] = [
                'config_id' => $configId,
                'channel_id' => (int) $channelId,
                'machine_state_id' => (int) $stateId,
                'status' => in_array($stateName, self::LEGACY_STATE_VALUES, true) ? $stateName : 'inactive',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($rows !== []) {
            ConfigHasChannel::insert(array_values($rows));
        }
    }

    private function syncMachineConfigDependencies(array $validated): void
    {
        $machineId = $validated['machine_id'];

        MachineSignal::firstOrCreate(
            ['masch_id' => $machineId],
            [
                'invert_F' => 0,
                'invert_P' => 0,
                'invert_A' => 0,
                'invert_ZH' => 0,
                'invert_HK' => 0,
            ]
        );

        MachineCounter::firstOrCreate(
            ['masch_id' => $machineId],
            [
                'shot_nr' => 0,
                'last_cycle_time' => 0,
                'cycle_time' => 0,
            ]
        );

        $readFrom = strtoupper((string) ($validated['read_from'] ?? ''));
        $transport = $readFrom === 'API' ? 'api' : 'modbus';

        MachineTransportConfig::updateOrCreate(
            ['masch_id' => $machineId],
            [
                'transport' => $transport,
                'api_url' => $validated['live_status_api'] ?: null,
                'api_signal_map' => self::DEFAULT_API_SIGNAL_MAP,
            ]
        );
    }
}
