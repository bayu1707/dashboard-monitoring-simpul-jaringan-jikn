<?php

return [
    // Data publik yang sudah disetujui; tidak pernah membaca workbook, .local, atau handoff.
    'data_root' => env('DASHBOARD_DATA_ROOT') ?: base_path('../public'),
    'default_mode' => 'pilot',
    'development_config' => base_path('../.local/development/connection.json'),
    // Opt-in lokal saja. File privat ini tidak termasuk paket Git/clone.
    'sikn_poc_config' => base_path('../.local/sikn-poc/config.json'),
];
