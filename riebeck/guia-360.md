# Como montar um visualizador 360 de um objeto

Regra que resolve 90% do problema: **você não desenha o objeto no código.** O código só troca imagens. Quem faz a beleza são as fotos.

---

## Etapa 1 — Conseguir os quadros

Você precisa de fotos do objeto girando, tiradas em passos iguais.

- **24 quadros** é o número bom (15° entre cada um). 36 fica mais suave, 16 é o mínimo aceitável.
- Se tiver menos de 12, para aqui — esse método não vai funcionar. Vá para a seção "E se eu só tenho 4 ou 5 ângulos" no final.

### Se você tem o objeto na mão

1. Marque um círculo no papel com as posições (24 marcas iguais). Um transferidor resolve.
2. Objeto no centro, sobre uma folha branca ou tecido liso.
3. **Câmera parada num tripé.** A câmera nunca se move — quem gira é o objeto.
4. Trave o foco e a exposição do celular (segure o dedo na tela até aparecer AE/AF LOCK). Sem isso, cada foto sai com um brilho diferente e o giro fica piscando.
5. Luz constante. Nada de luz de janela, que muda enquanto você fotografa.
6. Gire uma marca, tire a foto, repita 24 vezes.

### Se você só tem imagens da internet

Só serve se forem de um giro real, com o mesmo enquadramento. Fotos soltas de ângulos aleatórios não montam um 360.

---

## Etapa 2 — Preparar os arquivos

Aqui é onde a maioria erra.

1. Todas as imagens **exatamente do mesmo tamanho** em pixels.
2. Objeto no **mesmo lugar do quadro** em todas. Se ele pula de posição entre uma foto e outra, o giro treme.
3. Fundo: ou remove de todas (remove.bg, Photopea), ou deixa idêntico em todas. Nunca misturado.
4. Redimensione para no máximo 1000px de largura e salve como JPEG qualidade 80 — 24 fotos grandes deixam a página lentíssima.
5. Renomeie em sequência **com zero à esquerda**:
   `frame_01.jpg`, `frame_02.jpg`, ... `frame_24.jpg`
   Sem o zero, a ordem embaralha (`frame_10` vem antes de `frame_2`).

---

## Etapa 3 — Montar a página

1. Crie uma pasta para o projeto.
2. Coloque o arquivo `visualizador-360.html` dentro dela.
3. Crie uma subpasta chamada `frames/` e jogue as imagens lá.

A estrutura fica assim:

```
meu-projeto/
├── visualizador-360.html
└── frames/
    ├── frame_01.jpg
    ├── frame_02.jpg
    └── ...
```

4. Abra o `.html` num editor e ajuste só o bloco do topo:

```js
const CONFIG = {
  totalFrames: 24,
  path: i => `frames/frame_${String(i).padStart(2, '0')}.jpg`,
  autoRotate: true,
  autoSpeed: 90,
  reverse: false,
  fullTurnPx: 500
};
```

- `totalFrames` — quantas imagens você tem
- `path` — troque `.jpg` por `.png` se for o caso
- `autoSpeed` — milissegundos entre quadros. Menor = mais rápido
- `reverse` — se o giro sair pro lado errado, mude para `true`
- `fullTurnPx` — quantos pixels de arraste completam uma volta. Menor = mais sensível

5. Dê dois cliques no `.html` para abrir no navegador.

---

## Etapa 4 — Quando der errado

| Sintoma | Causa |
|---|---|
| Tela com a mensagem de erro | Nome da pasta, nome dos arquivos ou extensão não batem com o `CONFIG` |
| Giro pisca / muda de brilho | Exposição não estava travada na hora de fotografar |
| Objeto "pula" ou treme | Imagens desalinhadas ou de tamanhos diferentes |
| Giro travado, aos solavancos | Quadros de menos |
| Demora muito para carregar | Imagens pesadas demais — reduza o tamanho |
| Gira pro lado contrário | `reverse: true` |

---

## Etapa 5 — Colocar no ar (opcional)

Arraste a pasta inteira para o [Netlify Drop](https://app.netlify.com/drop). Sai um link em segundos, sem cadastro nem terminal. GitHub Pages também funciona, se ele já usar Git.

---

## E se eu só tenho 4 ou 5 ângulos

Aí não tem giro pronto — as posições intermediárias não existem. O caminho é gerar um modelo 3D a partir dessas fotos:

1. Suba as imagens no Meshy, Tripo3D ou Rodin (todos têm plano grátis e aceitam múltiplas imagens).
2. Baixe o resultado em `.glb`.
3. Exiba com o `<model-viewer>` do Google:

```html
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>

<model-viewer src="modelo.glb" alt="Objeto em 360"
  auto-rotate rotation-per-second="20deg"
  camera-controls shadow-intensity="1"
  environment-image="neutral" exposure="1.1">
</model-viewer>
```

Fica menos fiel que fotos reais, mas gira de verdade em qualquer ângulo.

---

## O erro que originou tudo isso

Tentar desenhar o objeto escrevendo código. Formas orgânicas são curvas de Bézier que precisam ser vistas enquanto se ajusta — digitando coordenadas no escuro, o resultado sai sempre torto.

Código é bom em: repetição, física, luz, interação, movimento.
Código é ruim em: contorno e proporção.

Sempre que a beleza depender da **forma**, o desenho vem de fora — foto, Figma, Blender. O código só dá vida a ele.

---

**Nota legal:** se o objeto for um produto licenciado (uma pelúcia oficial de um jogo, por exemplo), tudo bem como estudo ou projeto pessoal. Para publicar ou vender, o design precisa ser próprio.
