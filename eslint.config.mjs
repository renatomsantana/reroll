// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/**
 * O LINTER, que até aqui não existia — e a prova disso estava no próprio código: havia comentários
 * `// eslint-disable-next-line` espalhados, escritos pra um linter que nunca foi instalado. Ninguém
 * percebeu a ausência porque a ausência não faz barulho.
 *
 * A régua aqui é a mesma do resto do projeto: cada regra ligada precisa pegar um DEFEITO, não um
 * gosto. Formatação não entra (o TypeScript e a revisão já dão conta), estilo de nomeação não entra.
 * O que entra são as três famílias que estouram longe de onde nasceram:
 *
 * 1. PROMESSA SOLTA. O app é assíncrono do começo ao fim — IPC, disco, pdf.js — e uma promessa sem
 *    `await` nem `catch` vira uma rejeição não tratada que, no Electron, aparece como nada. Esse
 *    defeito exato já aconteceu duas vezes aqui: o botão de importar ficha que não fazia nada, e o
 *    de escolher foto que engolia a falha em silêncio.
 * 2. GANCHO DE REACT com dependência faltando — o estado congelado que faz o componente mostrar o
 *    valor de dois renders atrás. Difícil de ver lendo, trivial de ver pro linter.
 * 3. VARIÁVEL/IMPORT MORTO, que é o rastro de um refatorar pela metade.
 *
 * O `--max-warnings 0` do script do npm é o que impede a lista de avisos de virar paisagem.
 */
export default tseslint.config(
  {
    // Nada de conferir o que não é fonte: saída de build, instaladores, dependências.
    ignores: ['out/**', 'release/**', 'release2/**', 'node_modules/**', 'dist/**', '*.tsbuildinfo']
  },

  js.configs.recommended,

  /**
   * As regras COM TIPO (`recommendedTypeChecked`) e não só as sintáticas. É a diferença que importa
   * pro item 1 acima: sem os tipos, o linter não sabe o que é uma promessa, e `no-floating-promises`
   * — a regra que pega o botão que não faz nada — simplesmente não funciona.
   */
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx,mts,mjs,js}'],
    languageOptions: {
      parserOptions: {
        // `projectService` em vez de listar os tsconfigs à mão: o projeto tem três
        // (node/web/tests) e um arquivo novo que não caísse em nenhum deles deixaria de ser
        // conferido em silêncio.
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /**
       * Promessa ignorada. `void` continua permitido: o código usa `void promessa` de propósito em
       * vários lugares pra dizer "eu sei que isto é assíncrono e não quero esperar", e essa é uma
       * declaração de intenção legítima — o que a regra proíbe é o esquecimento.
       */
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      /** Rastro de refatorar pela metade. `_` na frente marca o parâmetro deliberadamente ignorado. */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
      ],

      /**
       * DESLIGADAS, e cada uma com o motivo — a lista curta é de propósito, porque regra ligada sem
       * motivo vira `eslint-disable` espalhado, que é pior que não ter linter.
       */

      // O código lê JSON de disco e anotações de PDF de terceiro o tempo todo. `unknown` com
      // guardas é o padrão adotado (ver `normalizeNotes`, `validarSheetApplyPayload`), e onde há
      // `any` ele está numa fronteira já conferida logo abaixo.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // `${objeto}` em mensagem de console é intencional em vários logs de diagnóstico.
      '@typescript-eslint/restrict-template-expressions': 'off',
      // `a || b` com número/string é usado de propósito pra tratar 0 e '' como ausência.
      '@typescript-eslint/prefer-nullish-coalescing': 'off'
    }
  },

  /**
   * OS ARQUIVOS QUE NÃO SÃO TypeScript — os scripts de ferramenta (`scripts/*.mjs`) e esta própria
   * configuração. Eles não pertencem a nenhum `tsconfig`, e sem esta exceção o linter reclamaria de
   * "não encontrado pelo serviço de projeto" em cada um.
   *
   * Perdem as regras COM TIPO e ficam com as sintáticas, que é o certo: são scripts curtos de
   * bancada, e o que se quer deles é variável não usada e engano de sintaxe, não análise de fluxo.
   */
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } }
  },

  /** PROCESSO PRINCIPAL e scripts: rodam no Node, com `process`, `console` e `__dirname`. */
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'scripts/**/*.mjs', '*.config.{ts,js,mjs}'],
    languageOptions: { globals: { ...globals.node } }
  },

  /** RENDERER: roda no Chromium, com `window`, `document` e `crypto`. */
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } }
  },

  /** COMPARTILHADO: atravessa os dois lados, então só o que existe nos dois. */
  {
    files: ['src/shared/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },

  /**
   * TESTES. Os `.node.test.ts` leem arquivo do disco e por isso precisam do Node junto do browser —
   * é a mesma divisão que os tsconfigs já fazem, ver o comentário em `tsconfig.web.json`.
   */
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/**/testes/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Teste monta objeto torto de propósito, pra provar que o código aguenta.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/unbound-method': 'off',
      /**
       * Dublê que implementa uma interface assíncrona não tem o que esperar por dentro — o `async`
       * está ali porque o CONTRATO pede promessa, não porque haja trabalho assíncrono. Exigir um
       * `await` inventado deixaria o dublê menos parecido com o original.
       */
      '@typescript-eslint/require-await': 'off'
    }
  }
)
