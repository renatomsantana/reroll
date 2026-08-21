export const IpcChannels = {
  presetsGetAll: 'presets:getAll',
  presetsCreate: 'presets:create',
  presetsUpdate: 'presets:update',
  presetsDelete: 'presets:delete',
  presetsExport: 'presets:export',
  presetsImport: 'presets:import',
  profilesGet: 'profiles:get',
  profilesSave: 'profiles:save',
  profilesPickPhoto: 'profiles:pickPhoto',
  notesGet: 'notes:get',
  notesSave: 'notes:save',
  windowMinimize: 'window:minimize',
  windowMaximize: 'window:maximize',
  windowClose: 'window:close',
  windowSetCompact: 'window:setCompact',
  windowSetAppIcon: 'window:setAppIcon',
  scenePickBackgroundImage: 'scene:pickBackgroundImage',
  /** Escolhe um PDF de ficha e devolve os bytes — quem interpreta é o renderer (ver `extractPdfSheet.ts`). */
  sheetsPickPdf: 'sheets:pickPdf',
  /** Cria o personagem e grava anotações e presets dentro dele, em ordem — ver o comentário no handler. */
  sheetsApply: 'sheets:apply',
  appGetVersion: 'app:getVersion',
  updateGetStatus: 'update:getStatus',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstallNow: 'update:installNow',
  /** Único canal de MÃO ÚNICA daqui (main → renderer): o progresso do download chega sozinho, sem ninguém perguntar. */
  updateStatus: 'update:status'
} as const
