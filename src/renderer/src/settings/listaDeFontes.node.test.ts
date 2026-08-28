import { describe, expect, it } from 'vitest'
import { FONT_OPTIONS } from './SettingsContext'
import { sanearPreferencias } from './sanearSettings'

/**
 * A LISTA DE FONTES tem uma regra que já virou bug relatado, e nada a cobrava.
 *
 * O relato foi este: "você errou no Papyrus, ela ficou com a fonte Comic Sans". Não era troca de
 * nome — a Papyrus não vem com o Windows, e a cadeia de reserva dela terminava justamente na Comic
 * Sans, que também era item do menu. Escolher uma dava visivelmente a outra, e da tela isso lê como
 * o app ignorando o clique.
 *
 * A regra ficou escrita em três comentários diferentes no arquivo da lista. Comentário não é
 * verificação: a lista mudou várias vezes desde então (dezoito fontes, depois doze) e cada mudança
 * era uma chance de reintroduzir o mesmo defeito sem ninguém perceber, porque só aparece na máquina
 * de quem NÃO tem a fonte instalada.
 *
 * `.node.test.ts` porque o último teste daqui LÊ O DISCO — ele confere que todo `.woff2` prometido
 * pelo `global.css` existe de verdade na pasta. É a convenção do projeto pros testes que precisam
 * dos tipos do Node, que o renderer não pode ter (ver o comentário em `tsconfig.web.json`).
 */

/** Só o primeiro nome da cadeia é a fonte pedida; o resto é reserva. */
function reservas(family: string): string[] {
  return family
    .split(',')
    .slice(1)
    .map((nome) => nome.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
}

function nomePrincipal(family: string): string {
  return family.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase()
}

const GENERICAS = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui'])

describe('lista de fontes', () => {
  /**
   * As fontes que PODEM NÃO EXISTIR na máquina de quem instalou.
   *
   * A distinção é o coração da regra, e sem ela o teste vira ruído. Quase toda a lista é garantida:
   * ou vem com o Windows (Tahoma, Arial, Times, Comic Sans) ou é
   * empacotada pelo próprio app (Montserrat, JetBrains Mono, Lora, Nunito, ver os `@font-face` em
   * `global.css`). Nessas, o reserva é teoria — ele nunca chega a ser usado, e apontar pra outra
   * opção do menu é escolha deliberada de "cair em algo do mesmo peso visual" se o empacotamento um
   * dia falhar.
   *
   * As quatro abaixo são diferentes: elas de fato faltam em máquina limpa, então o reserva delas é
   * o que a pessoa VÊ. É aí que cair noutra opção do menu vira o bug relatado. Três delas estão
   * nessa situação pelo mesmo motivo — licença gratuita só pra uso pessoal, que não deixa
   * redistribuir o arquivo dentro de um app publicado.
   */
  const PODEM_FALTAR = new Map<string, string>([
    ['papyrus', 'não vem com o Windows — vem com o Office/macOS. Foi este o bug relatado.'],
    ['janda-silly-monkey', 'gratuita só pra uso pessoal, então não pode ser empacotada'],
    ['sweetie', 'gratuita só pra uso pessoal (Graphix Line Studio), então não pode ser empacotada'],
    ['determination', 'gratuita só pra uso pessoal (Lucca Cedro), então não pode ser empacotada'],
    ['algerian', 'vem com o Microsoft Office, não com o Windows — e é comercial, então nem empacotar resolve']
  ])

  it('fonte que pode faltar na máquina não cai em outra opção do menu', () => {
    /**
     * O defeito da Papyrus, em forma de teste: ela não existia na máquina, a cadeia dela terminava
     * na Comic Sans, e a Comic Sans também era item do menu. Escolher uma dava visivelmente a outra,
     * e da tela isso lê como o app ignorando o clique.
     */
    const doMenu = new Set(FONT_OPTIONS.map((f) => nomePrincipal(f.family)))
    const problemas: string[] = []

    for (const fonte of FONT_OPTIONS) {
      if (!PODEM_FALTAR.has(fonte.id)) continue
      for (const reserva of reservas(fonte.family)) {
        if (doMenu.has(reserva)) {
          problemas.push(`${fonte.label}: cai em "${reserva}", que também é opção do menu`)
        }
      }
    }

    expect(problemas).toEqual([])
  })

  it('toda fonte que pode faltar TEM reserva de verdade, e não só a genérica', () => {
    /**
     * Cair direto em `cursive` ou `fantasy` deixa a escolha na mão do navegador, e o resultado varia
     * de máquina pra máquina. Estas precisam de um passo intermediário concreto — no caso das
     * quatro de hoje, a `Ink Free`, a `Segoe Print` e a `Segoe Script` (manuscritas que vêm com o
     * Windows) e a `Arial Black` (display pesada, idem).
     */
    for (const [id] of PODEM_FALTAR) {
      const fonte = FONT_OPTIONS.find((f) => f.id === id)
      expect(fonte, `"${id}" saiu da lista — atualize PODEM_FALTAR`).toBeDefined()
      const concretas = reservas(fonte!.family).filter((nome) => !GENERICAS.has(nome))
      expect(concretas.length, `${fonte!.label} cai direto na genérica`).toBeGreaterThan(0)
    }
  })

  it('toda cadeia termina numa família genérica', () => {
    /**
     * Sem a genérica no fim, uma fonte que não exista na máquina cai no padrão do navegador, que não
     * é necessariamente do mesmo peso visual — uma serifada virando sans, por exemplo. A genérica é
     * o que garante que o pior caso ainda pareça a mesma escolha.
     */
    const semGenerica = FONT_OPTIONS.filter((fonte) => {
      const cadeia = fonte.family.split(',').map((n) => n.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
      return !GENERICAS.has(cadeia[cadeia.length - 1])
    }).map((f) => `${f.label}: ${f.family}`)

    expect(semGenerica).toEqual([])
  })

  it('não há id repetido', () => {
    const ids = FONT_OPTIONS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fonte removida da lista não deixa a preferência quebrada', () => {
    /**
     * A lista já encolheu duas vezes (de catorze pra nove, e de dezoito pra doze). Quem tinha uma
     * das removidas escolhida guarda um id que não existe mais, e o app tem que cair no padrão em
     * vez de abrir sem fonte nenhuma.
     *
     * `sanearPreferencias` não cobre `fontId` de propósito — ele trata valores de lista FECHADA, e
     * a lista de fontes muda com frequência demais pra isso. Quem cobre é o `loadInitial`, e o que
     * este teste fixa é a garantia de que os ids removidos realmente sumiram.
     */
    const removidas = [
      'ms-sans-serif',
      'verdana',
      'trebuchet',
      'candara',
      'georgia',
      'palatino',
      'consolas',
      'opendyslexic',
      // Segunda limpeza (27/08/2026), a pedido do usuário — as três viraram reserva de quem ficou.
      'courier',
      'segoe',
      'impact'
    ]
    for (const id of removidas) {
      expect(FONT_OPTIONS.some((f) => f.id === id), `"${id}" ainda está na lista`).toBe(false)
    }

    // E a higiene das preferências continua deixando o campo passar — é o `loadInitial` que decide.
    expect(sanearPreferencias({ fontId: 'palatino' })).toEqual({ fontId: 'palatino' })
  })

  it('as quatro fontes EMPACOTADAS continuam com o arquivo no lugar', async () => {
    /**
     * Montserrat, JetBrains Mono, Lora e Nunito não vêm com o Windows — elas são declaradas por `@font-face`
     * em `global.css`, apontando pra um `.woff2` em `assets/fonts/`. Se o arquivo sumir (foi o que
     * aconteceu com a OpenDyslexic ao ser removida), a fonte cai no reserva SEM ERRO NENHUM: a tela
     * mostra outra letra e ninguém descobre por quê.
     */
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')
    const css = readFileSync(join(process.cwd(), 'src/renderer/src/styles/global.css'), 'utf-8')

    const declarados = [...css.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)].map((m) => m[1])
    expect(declarados.length).toBeGreaterThan(0)

    for (const arquivo of declarados) {
      const caminho = join(process.cwd(), 'src/renderer/src/assets/fonts', arquivo)
      expect(existsSync(caminho), `${arquivo} declarado no CSS e ausente da pasta`).toBe(true)
    }

    // E o contrário: `@font-face` que ficou pra trás apontando pra fonte que saiu do menu.
    const familiasDeclaradas = [...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1].toLowerCase())
    const doMenu = new Set(FONT_OPTIONS.map((f) => nomePrincipal(f.family)))
    for (const familia of familiasDeclaradas) {
      expect(doMenu.has(familia), `@font-face de "${familia}" sobrou sem opção no menu`).toBe(true)
    }
  })
})
