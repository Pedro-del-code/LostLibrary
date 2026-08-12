# Lost Library 📖🕯️

Um jogo de exploração 2D em HTML5 Canvas. Você anda pelos corredores de uma
biblioteca esquecida, encontra itens escondidos nas estantes e desvenda
pequenos fragmentos de sua história.

Feito com **HTML + CSS + JavaScript puro** (sem frameworks, sem build step) —
por isso é ideal para o plano *Static Site* gratuito do Render.com.

---

## Controles

| Ação            | Teclado         | Mobile                     |
|-----------------|-----------------|-----------------------------|
| Mover           | Setas / WASD    | Joystick virtual (esquerda) |
| **Agir**        | `Z`             | Botão **Z** (verde)         |
| **Cancelar**    | `X`             | Botão **X** (vermelho)      |
| **Itens**       | `C`             | Botão **C** (dourado)       |

- **Z** interage com estantes (✦), mesas e a presença silenciosa perto da ala leste; também avança diálogos.
- **C** abre o inventário (abas: Armas, Armaduras, Itens). Toque num item para examiná-lo.
- **X** fecha o inventário ou pula o diálogo atual.

---

## Estrutura do projeto

```
lost-library/
├── index.html              # página principal
├── style.css                # identidade visual (biblioteca / velas / pergaminho)
├── game.js                  # motor do jogo (loop, input, colisão, inventário)
├── render.yaml               # blueprint de deploy do Render.com
└── assets/
    └── sprites/
        ├── player_atlas.png       # sprite sheet da protagonista (4 direções)
        └── player_manifest.json   # coordenadas dos frames de animação
```

Os sprites da protagonista (fornecidos por você) foram processados
automaticamente: fundo removido, escala normalizada entre a pose parada e o
ciclo de caminhada, e organizados num único atlas com 4 direções
(baixo / cima / esquerda / direita), cada uma com sua animação de andar.

---

## Deploy no Render.com

### Opção A — Blueprint automático (recomendado, usa o `render.yaml`)

1. Suba esta pasta para um repositório no GitHub (ou GitLab).
2. No painel do Render, clique em **New +** → **Blueprint**.
3. Selecione o repositório. O Render vai ler o `render.yaml` automaticamente
   e configurar um **Static Site** chamado `lost-library`.
4. Clique em **Apply** — pronto, sem build command, sem configuração manual.

### Opção B — Manual (Static Site)

1. No painel do Render: **New +** → **Static Site**.
2. Conecte o repositório com estes arquivos.
3. Configure:
   - **Build Command:** deixe em branco
   - **Publish directory:** `.` (a raiz do projeto)
4. Clique em **Create Static Site**.

Em ambos os casos o Render te dá uma URL pública tipo
`https://lost-library.onrender.com` — o jogo carrega direto no navegador,
inclusive no celular (os botões mobile aparecem automaticamente em telas
sensíveis ao toque).

---

## Rodando localmente

Como o jogo carrega `assets/sprites/player_manifest.json` via `fetch`, ele
precisa ser servido por um servidor HTTP (abrir o `index.html` direto como
`file://` não funciona por causa do CORS do navegador). Qualquer servidor
estático resolve:

```bash
# opção 1: Python
python3 -m http.server 8080

# opção 2: Node
npx serve .
```

Depois acesse `http://localhost:8080`.

---

## Personalizando

- **Itens/textos**: edite o objeto `ITEM_DB` e a lista `INTERACTABLES` em `game.js`.
- **Layout da sala**: edite `SHELVES`, `TABLES`, `RUGS`, `CANDLES` em `game.js`.
- **Velocidade / animação do personagem**: constantes `speed` e `frameDur` no objeto `Player`.
- **Novos sprites**: troque `assets/sprites/player_atlas.png` e ajuste
  `player_manifest.json` (ou peça para gerar um novo atlas a partir de novas
  sprite sheets).
