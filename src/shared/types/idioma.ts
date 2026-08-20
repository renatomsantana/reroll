/**
 * Os idiomas da interface.
 *
 * Mora em `shared` — e não junto das preferências, onde nasceu — porque quem precisa dele nem sempre
 * é um componente: os LEITORES DE FICHA recebem o idioma pra rotular o que eles próprios inventam
 * (ver `sheets/readers/types.ts`), e são módulos puros, testados sem React nenhum por perto. Enquanto
 * o tipo morava em `SettingsContext.tsx`, importá-lo de um leitor arrastava um arquivo `.tsx` pro
 * `tsconfig` dos testes, que não liga o JSX — o typecheck dos testes quebrava por causa de um tipo
 * que some na compilação.
 */
export type Language = 'pt-BR' | 'en-US'
