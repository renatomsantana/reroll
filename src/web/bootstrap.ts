/**
 * O arranque da versão web — o que no desktop é o processo principal + preload, aqui é esta
 * sequência, NESTA ordem:
 *
 * 1. `Buffer` global (os módulos do main o usam dentro das funções; ver `shims/buffer.ts`);
 * 2. onde os arquivos vivem (IndexedDB) e quem abre/baixa arquivo (o navegador);
 * 3. a versão do app, injetada no build;
 * 4. a ponte `window.api` — que registra os handlers REAIS do main (ver `api.ts`);
 * 5. só então o renderer, que encontra o `window.api` pronto como no Electron.
 *
 * Os imports do main ficam atrás de um `import()` dinâmico de propósito: eles só podem rodar
 * depois de o Buffer e o armazém existirem.
 */
import { BufferDoNavegador } from './shims/buffer'
import { configurarArmazemDeArquivos } from './shims/fs'
import { configurarPlataformaDeArquivos, configurarVersaoDoApp } from './shims/electron'
import { criarArmazemDoNavegador } from './armazemDoNavegador'
import { plataformaDoNavegador } from './seletorDeArquivos'
import { ehAppNativo, plataformaDoAndroid } from './plataformaDoAndroid'
import { ligarBotaoVoltar } from './botaoVoltarDoAndroid'
import './web.css'

;(globalThis as { Buffer?: unknown }).Buffer = BufferDoNavegador
configurarArmazemDeArquivos(criarArmazemDoNavegador())
/*
 * A MESMA página, dois jeitos de salvar arquivo: no navegador é download, no app de Android é a
 * folha de compartilhamento — lá o download de `blob:` não faz nada (ver `plataformaDoAndroid.ts`).
 * Abrir arquivo é igual nos dois.
 */
configurarPlataformaDeArquivos(ehAppNativo() ? plataformaDoAndroid : plataformaDoNavegador)
configurarVersaoDoApp(__VERSAO_DO_APP__)

// O botão VOLTAR do aparelho, que sem isto fecharia o app em vez de fechar o modal aberto.
if (ehAppNativo()) ligarBotaoVoltar()

const { montarApiWeb } = await import('./api')
window.api = await montarApiWeb()

await import('@renderer/main')
