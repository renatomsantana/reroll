export const IpcChannels = {
  presetsGetAll: 'presets:getAll',
  presetsCreate: 'presets:create',
  presetsUpdate: 'presets:update',
  presetsDelete: 'presets:delete',
  presetsExport: 'presets:export',
  presetsImport: 'presets:import',
  notesGet: 'notes:get',
  notesSave: 'notes:save',
  windowMinimize: 'window:minimize',
  windowMaximize: 'window:maximize',
  windowClose: 'window:close',
  windowSetCompact: 'window:setCompact',
  windowSetAppIcon: 'window:setAppIcon',
  scenePickBackgroundImage: 'scene:pickBackgroundImage',
  appGetVersion: 'app:getVersion',
  updateGetStatus: 'update:getStatus',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstallNow: 'update:installNow',
  /** Único canal de MÃO ÚNICA daqui (main → renderer): o progresso do download chega sozinho, sem ninguém perguntar. */
  updateStatus: 'update:status'
} as const
