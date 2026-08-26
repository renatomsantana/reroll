export const IpcChannels = {
  presetsGetAll: 'presets:getAll',
  presetsCreate: 'presets:create',
  presetsUpdate: 'presets:update',
  presetsDelete: 'presets:delete',
  presetsExport: 'presets:export',
  presetsImport: 'presets:import',
  /** A estrela (spec §3.9): marcar/desmarcar favorito e mover entre os favoritos. Devolvem a lista inteira. */
  presetsSetFavorito: 'presets:setFavorito',
  presetsMoverFavorito: 'presets:moverFavorito',
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
  /** Copia texto pra área de transferência — o preload roda em sandbox e não tem o módulo `clipboard`. */
  clipboardWriteText: 'clipboard:writeText',
  /** Escolhe um PDF de ficha e devolve os bytes — quem interpreta é o renderer (ver `extractPdfSheet.ts`). */
  sheetsPickPdf: 'sheets:pickPdf',
  /** Cria o personagem e grava anotações e presets dentro dele, em ordem — ver o comentário no handler. */
  sheetsApply: 'sheets:apply',
  /** O personagem inteiro num arquivo — exportar o ativo, importar um exportado (ver `pacoteDePersonagem.ts`). */
  pacoteExportar: 'pacote:exportar',
  pacoteImportar: 'pacote:importar',
  appGetVersion: 'app:getVersion',
  updateGetStatus: 'update:getStatus',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstallNow: 'update:installNow',
  /** Único canal de MÃO ÚNICA daqui (main → renderer): o progresso do download chega sozinho, sem ninguém perguntar. */
  updateStatus: 'update:status'
} as const
