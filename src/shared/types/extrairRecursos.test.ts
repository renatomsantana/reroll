import { describe, expect, it } from 'vitest'
import { extrairRecursos } from './extrairRecursos'
import type { SheetImportField } from './sheetImport'

const campo = (label: string, value: string, group = 'Recursos'): SheetImportField => ({ label, value, group })

/**
 * Da ficha pra BARRA: os pares atual/máximo que cada leitor devolve como campos soltos, juntados
 * de volta. Os casos são os das fichas reais que o app já leu (ver `fichasReais.node.test.ts`),
 * reproduzidos aqui sem PDF nenhum.
 */
describe('extrairRecursos', () => {
  it('Ordem Paranormal: três pares com sufixo atual/máximo viram três barras', () => {
    const recursos = extrairRecursos([
      campo('PV atual', '19'),
      campo('PV máximo', '45'),
      campo('PE atual', '4'),
      campo('PE máximo', '12'),
      campo('Sanidade atual', '30'),
      campo('Sanidade máxima', '40'),
      campo('Defesa', '15'),
      campo('Deslocamento', '9m')
    ])
    expect(recursos).toEqual([
      { nome: 'PV', atual: 19, maximo: 45, atualEmBranco: false },
      { nome: 'PE', atual: 4, maximo: 12, atualEmBranco: false },
      { nome: 'Sanidade', atual: 30, maximo: 40, atualEmBranco: false }
    ])
  })

  it('a ficha do Matias: só os máximos preenchidos — barra CHEIA e marcada como atual em branco', () => {
    const recursos = extrairRecursos([campo('PV atual', ''), campo('PV máximo', '45'), campo('PE atual', ''), campo('PE máximo', '')])
    expect(recursos).toEqual([{ nome: 'PV', atual: 45, maximo: 45, atualEmBranco: true }])
  })

  it('D&D em inglês: prefixo Current/Max', () => {
    const recursos = extrairRecursos([campo('Current HP', '27', 'Combat'), campo('Max HP', '31', 'Combat'), campo('Temp HP', '5', 'Combat')])
    expect(recursos).toEqual([{ nome: 'HP', atual: 27, maximo: 31, atualEmBranco: false }])
  })

  it('Oblivio e a Carga de Ordem: "12/40" num campo só', () => {
    const recursos = extrairRecursos([campo('Vida', '12/40', 'Corpo'), campo('Carga', '3 / 10')])
    expect(recursos).toEqual([
      { nome: 'Vida', atual: 12, maximo: 40, atualEmBranco: false },
      { nome: 'Carga', atual: 3, maximo: 10, atualEmBranco: false }
    ])
  })

  it('atributo e aspecto "2/10" (as escalas de Oblívio) NÃO são barra, e "0/0" em branco também não', () => {
    const recursos = extrairRecursos([
      campo('Carne', '2/10', 'Atributos'),
      campo('Força', '0/10', 'Atributos'),
      campo('Coragem', '3/10', 'Aspectos'),
      campo('Torso', '0/0', 'Corpo'),
      campo('Braço Direito', '0/3', 'Corpo')
    ])
    expect(recursos).toEqual([{ nome: 'Braço Direito', atual: 0, maximo: 3, atualEmBranco: false }])
  })

  it('atual acima do máximo é preso; atual sem máximo vira barra cheia naquele valor', () => {
    expect(extrairRecursos([campo('PV atual', '60'), campo('PV máximo', '45')])[0].atual).toBe(45)
    expect(extrairRecursos([campo('PE atual', '7')])).toEqual([{ nome: 'PE', atual: 7, maximo: 7, atualEmBranco: false }])
  })

  it('recurso com um número só vira barra cheia — se o nome for de recurso vital', () => {
    const recursos = extrairRecursos([
      campo('Saúde', '18'),
      campo('Determinação', '8'),
      campo('Defesa', '15'),
      campo('Deslocamento', '9m'),
      campo('Sanidade', '0')
    ])
    expect(recursos).toEqual([
      { nome: 'Saúde', atual: 18, maximo: 18, atualEmBranco: false },
      { nome: 'Determinação', atual: 8, maximo: 8, atualEmBranco: false }
    ])
  })

  it('campo que não é par e valor que não é número não viram barra', () => {
    expect(extrairRecursos([campo('Nome', 'Matias', 'Identificação'), campo('PV máximo', 'muitos')])).toEqual([])
  })

  it('a primeira leitura de cada metade vale — o genérico não sobrescreve o dedicado', () => {
    const recursos = extrairRecursos([campo('PV atual', '19'), campo('PV máximo', '45'), campo('pv atual', '3')])
    expect(recursos).toEqual([{ nome: 'PV', atual: 19, maximo: 45, atualEmBranco: false }])
  })
})
