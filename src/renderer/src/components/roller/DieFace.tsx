import { useSettings } from '@renderer/settings/SettingsContext'

/**
 * A face de um dado, DESENHADA — silhueta em SVG com o valor no meio, nas cores dos dados do
 * estojo (as de Preferências, incluindo a cor por tipo, se houver).
 *
 * Existe porque as ilustrações de `assets/dice/` são clipart preto com um número JÁ IMPRESSO na
 * face. No modo compacto isso dava dois problemas de uma vez: o dado ficava "feio e preto" ao lado
 * do resto do app, e o valor sorteado precisava de uma plaqueta opaca por cima pra não brigar com o
 * número impresso — com um ponto diferente pra cada arte, porque cada uma tem a face principal num
 * lugar. Uma face desenhada não tem número impresso, então nada disso é necessário.
 *
 * As silhuetas são as canônicas de dado visto de frente, e é o que as torna distinguíveis de
 * relance: triângulo é d4, quadrado é d6, losango é d8, pipa é d10, pentágono é d12, hexágono é
 * d20, círculo é d100. É a mesma linguagem que o rolador do Google usa na fileira dele.
 */
interface DieFaceProps {
  sides: number
  value: number
}

interface Forma {
  /** Pontos do polígono num viewBox 100×100, ou `null` pro círculo do d100. */
  pontos: string | null
  /**
   * Altura do número dentro da forma. Nem sempre é 50: num triângulo o espaço fica na metade de
   * baixo, e centrar pelo meio da caixa deixaria o número montado na ponta.
   */
  numeroY: number
}

const FORMAS: Record<number, Forma> = {
  4: { pontos: '50,7 95,86 5,86', numeroY: 65 },
  6: { pontos: '10,10 90,10 90,90 10,90', numeroY: 50 },
  8: { pontos: '50,5 91,50 50,95 9,50', numeroY: 53 },
  10: { pontos: '50,4 92,36 50,96 8,36', numeroY: 47 },
  12: { pontos: '50,5 95,38 78,93 22,93 5,38', numeroY: 57 },
  20: { pontos: '50,4 90,27 90,73 50,96 10,73 10,27', numeroY: 52 },
  100: { pontos: null, numeroY: 50 }
}

const FORMA_PADRAO: Forma = { pontos: null, numeroY: 50 }

/** Número de três dígitos (o 100) não cabe no mesmo corpo que um de um dígito. */
function tamanhoDaFonte(valor: number): number {
  const digitos = String(valor).length
  if (digitos >= 3) return 26
  if (digitos === 2) return 36
  return 44
}

export function DieFace({ sides, value }: DieFaceProps) {
  const { diceBodyColor, diceNumberColor, diceColorOverrides } = useSettings()

  const porTipo = diceColorOverrides[sides]
  const corpo = porTipo?.bodyColor ?? diceBodyColor
  const numero = porTipo?.numberColor ?? diceNumberColor

  const forma = FORMAS[sides] ?? FORMA_PADRAO

  return (
    <svg className="die-face" viewBox="0 0 100 100" role="img" aria-label={`${value}`}>
      {/*
        O contorno na cor do número não é enfeite: a cor de fábrica do corpo é um creme (#f2ead6)
        que, sobre o painel branco do widget, sumiria sem uma borda. `stroke-linejoin: round`
        arredonda as pontas do triângulo e do losango, que sem isso viram agulhas.
      */}
      {forma.pontos ? (
        <polygon
          points={forma.pontos}
          fill={corpo}
          stroke={numero}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      ) : (
        <circle cx={50} cy={50} r={46} fill={corpo} stroke={numero} strokeWidth={4} />
      )}
      <text
        x={50}
        y={forma.numeroY}
        fill={numero}
        fontSize={tamanhoDaFonte(value)}
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        /* A fonte é a mesma da interface (o usuário escolhe em Preferências) — um dado com fonte
           própria destoaria de tudo. */
        fontFamily="var(--font-family)"
      >
        {value}
      </text>
    </svg>
  )
}
