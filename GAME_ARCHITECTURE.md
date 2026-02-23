# GAME_ARCHITECTURE.md — Champion Arena (UCLA RPG)

> Documentação mestre da arquitetura do sistema. Referência técnica completa para desenvolvimento, manutenção e extensão do jogo.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Arquivos](#3-estrutura-de-arquivos)
4. [Fluxo de Jogo (Game Loop)](#4-fluxo-de-jogo-game-loop)
5. [Camada de Rede — Socket.IO](#5-camada-de-rede--socketio)
6. [Classe Champion](#6-classe-champion)
7. [Sistema de Recursos (Mana / Energia)](#7-sistema-de-recursos-mana--energia)
8. [Pipeline de Combate — CombatResolver](#8-pipeline-de-combate--combatresolver)
9. [Fórmulas de Dano e Defesa](#9-fórmulas-de-dano-e-defesa)
10. [Sistema de Hooks — CombatEvents](#10-sistema-de-hooks--combatevents)
11. [Sistema de Keywords](#11-sistema-de-keywords)
12. [Sistema de Escudos (Shields)](#12-sistema-de-escudos-shields)
13. [Sistema de Modificadores de Dano](#13-sistema-de-modificadores-de-dano)
14. [Gerenciador de Animações — AnimsAndLogManager](#14-gerenciador-de-animações--animsandlogmanager)
15. [Indicadores de Status — StatusIndicator](#15-indicadores-de-status--statusindicator)
16. [Histórico de Turnos](#16-histórico-de-turnos)
17. [Modo de Edição / Debug](#17-modo-de-edição--debug)
18. [Como Criar um Novo Campeão](#18-como-criar-um-novo-campeão)
19. [Decisões de Design e Convenções](#19-decisões-de-design-e-convenções)

---

## 1. Visão Geral

**Champion Arena** é um jogo de arena turn-based multiplayer 1v1, jogado no browser. Dois jogadores se conectam via Socket.IO, selecionam equipes de 3 campeões cada, e alternam turnos usando habilidades até que um time seja eliminado. O formato é melhor-de-3 (primeiro a 2 pontos vence, pontua-se quando um campeão do jogador adversário é derrotado).

### Princípios Arquiteturais

- **Server Authoritative**: Todo o estado de jogo vive no servidor. O cliente apenas renderiza e envia intenções de ação; o servidor valida, processa e retransmite o estado canônico.
- **Código Compartilhado**: A pasta `/shared` contém código que roda tanto no Node.js (server) quanto no browser (client) — principalmente `Champion.js`, `CombatResolver.js`, e utilitários.
- **Event-Driven**: Passivas e efeitos de campeões se comunicam via sistema de hooks (`combatEvents.js`), sem acoplamento direto.
- **Animações Determinísticas**: O cliente recebe envelopes estruturados com lista de efeitos ordenados, e os anima sequencialmente em fila — nunca há corrida ou sobreposição visual.

---

## 2. Stack Tecnológica

| Camada       | Tecnologia                           |
| ------------ | ------------------------------------ |
| Servidor     | Node.js + Express (ES Modules)       |
| Comunicação  | Socket.IO (WebSocket)                |
| Cliente      | Vanilla JS (ES Modules, `import`)    |
| UI/Estilo    | HTML5 + CSS3 (sem framework)         |
| Fontes       | Google Fonts (Montserrat) + Boxicons |
| Debug mobile | Eruda (injetado em `index.html`)     |

---

## 3. Estrutura de Arquivos

```
/
├── public/                     # Servido estaticamente pelo Express
│   ├── index.html              # Único HTML — SPA com múltiplas "telas" por classe CSS
│   ├── js/
│   │   ├── main.js             # Ponto de entrada do cliente; toda lógica de UI e socket
│   │   └── animation/
│   │       └── animsAndLogManager.js   # Fila de animações e log de combate
│   └── styles/
│       ├── style.css           # Layout, componentes, telas
│       └── animations.css      # Keyframes, classes de efeito (damage, heal, buff…)
│
├── shared/                     # Código isomórfico (server + client)
│   ├── core/
│   │   ├── Champion.js         # Classe central do campeão
│   │   ├── combatResolver.js   # Motor de cálculo de dano
│   │   ├── combatEvents.js     # Sistema de hooks de evento
│   │   ├── keywordTurnEffects.js  # Efeitos de status por turno (burn, poison…)
│   │   ├── statusIndicator.js  # Gerenciador visual de ícones de status
│   │   ├── formatters.js       # HTML formatters (nomes com cor de time)
│   │   ├── id.js               # Gerador de IDs únicos
│   │   └── basicAttack.js      # Definição do ataque básico padrão
│   └── data/
│       ├── championDB.js       # Re-export do índice de campeões
│       └── champions/
│           ├── index.js        # Índice de todos os campeões registrados
│           ├── ralia/          # Pasta por campeão
│           ├── naelthos/
│           ├── barao_estrondoso/
│           └── ...             # (um diretório por campeão)
│
└── server/
    └── server.js               # Servidor Express + Socket.IO + toda lógica de jogo
```

> **Nota**: O servidor importa código de `shared/` diretamente. O cliente importa o mesmo código via path absoluto `/shared/...` servido pelo Express.

---

## 4. Fluxo de Jogo (Game Loop)

```
[LOGIN] → [SELEÇÃO DE CAMPEÕES] → [ARENA / TURNOS] → [FIM DE JOGO]
```

### 4.1 Login

1. Jogador digita username e clica em "Entrar na Arena".
2. Cliente emite `joinArena` com `{ username }`.
3. Servidor tenta alocar o jogador no slot 0 (Time 1) ou slot 1 (Time 2). Máximo 2 jogadores.
4. Servidor responde com `joinedArena` → `{ playerId, team, username, editMode }`.
5. Tela de login é escondida, tela de seleção de campeões aparece.

> No `editMode.autoLogin = true`, o servidor loga o jogador automaticamente com nome "AutoPlayer".

### 4.2 Seleção de Campeões

1. Servidor emite `championSelectionStarted` com a lista de campeões disponíveis (filtrado por `unreleased` se necessário).
2. Cliente exibe grade de campeões. Jogador arrasta/clica para montar uma equipe de 3, definindo a **ordem** (relevante para lógica de habilidades que afetam "adjacentes").
3. Ao confirmar, cliente emite `selectTeam` com `{ championKeys: string[] }`.
4. Servidor valida, instancia os campeões via `Champion.fromBaseData()`, registra em `activeChampions`.
5. Quando **ambos** confirmam, servidor emite `allTeamsSelected` + `gameStateUpdate` com o estado completo.

> Timer de seleção: 120 segundos. Ao expirar, campeões aleatórios são selecionados automaticamente.

### 4.3 Turno

Um turno segue o ciclo:

```
[Jogadores agem (qualquer ordem)] → [Ambos clicam "Finalizar Turno"] → [Servidor processa ações] → [Novo turno]
```

**Fase de Ação:**

- Cada jogador clica nos botões de skill de seus campeões.
- Cliente emite `requestSkillUse` → servidor valida pré-condições → responde `skillApproved` ou `skillDenied`.
- Após aprovação, cliente pergunta o alvo (overlay de seleção) → emite `useSkill` com `{ userId, skillKey, targetIds }`.
- Servidor debita o recurso e enfileira a ação em `pendingActions`.

**Fase de Resolução (handleEndTurn):**
Ambos os jogadores confirmam o fim do turno. O servidor então:

1. Ordena `pendingActions` por `priority DESC`, depois `speed DESC` (Speed do campeão desempata).
2. Processa cada ação em ordem:
   - Verifica se o campeão usuário ainda está vivo.
   - Verifica se o alvo ainda está vivo.
   - Executa `skill.execute({ user, targets, context })` → obtém resultado.
   - Constrói envelope `combatAction` com `{ action, effects[], log, state[] }`.
   - Emite para todos via `io.emit("combatAction", envelope)`.
3. Aplica efeitos de início de turno (keywords: `queimando`, `envenenado`).
4. Aplica regen de recurso global (`BASE_REGEN = 80`) para todos os campeões vivos.
5. Aplica eventos do hook `onTurnStart` de passivas.
6. Limpa ações pendentes, incrementa `currentTurn`, emite `turnUpdate`.

### 4.4 Morte e Substituição

- Se o HP de um campeão chega a 0 dentro de `resolveDamage`, `target.alive = false`.
- Ao final do processamento de uma ação, o servidor verifica campeões mortos e chama `removeChampionFromGame()`.
- `removeChampionFromGame()`:
  1. Emite `championRemoved` com delay de 2500ms (para animação no cliente).
  2. Remove do `activeChampions`.
  3. O time que ficou sem campeões, o time adversário marca 1 ponto (`playerScores`).
  4. Se algum time atingiu `MAX_SCORE = 2`, emite `gameOver`.
  5. Caso contrário, emite `???` + `gameStateUpdate` + reinicia para nova rodada.

### 4.5 Fim de Jogo

- `gameOver` é emitido com `{ winnerTeam, winnerName }`.
- Cliente exibe overlay de vitória/derrota por 10 segundos, depois overlay de contagem regressiva de 120 segundos para voltar ao login.
- Surrender: qualquer jogador pode se render a qualquer momento, concedendo vitória imediata ao adversário.

---

## 5. Camada de Rede — Socket.IO

### Eventos Cliente → Servidor

| Evento               | Payload                           | Descrição                                      |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| `joinArena`          | `{ username }`                    | Solicita entrada no jogo                       |
| `selectTeam`         | `{ championKeys: string[] }`      | Confirma seleção de equipe                     |
| `requestSkillUse`    | `{ userId, skillKey }`            | Pré-validação antes de mostrar overlay de alvo |
| `useSkill`           | `{ userId, skillKey, targetIds }` | Enfileira ação com alvos confirmados           |
| `endTurn`            | —                                 | Confirma fim de turno                          |
| `surrender`          | —                                 | Rendição imediata                              |
| `removeChampion`     | `{ championId }`                  | Remove campeão (edit mode)                     |
| `changeChampionHp`   | `{ championId, amount }`          | Altera HP (edit mode)                          |
| `changeChampionStat` | `{ championId, stat, action }`    | Altera stat (edit mode)                        |

### Eventos Servidor → Cliente

| Evento                      | Payload                                  | Descrição                         |
| --------------------------- | ---------------------------------------- | --------------------------------- |
| `joinedArena`               | `{ playerId, team, username, editMode }` | Confirmação de login              |
| `arenaFull`                 | —                                        | Sala lotada                       |
| `championSelectionStarted`  | `{ availableChampions, timeLimit }`      | Inicia seleção                    |
| `allTeamsSelected`          | —                                        | Ambos confirmaram equipes         |
| `gameStateUpdate`           | `{ champions[], currentTurn }`           | Estado completo do jogo           |
| `combatAction`              | `{ action, effects[], log, state[] }`    | Envelope de ação de combate       |
| `combatLog`                 | `string`                                 | Mensagem de log avulsa            |
| `championRemoved`           | `{ championId }`                         | Campeão morreu                    |
| `turnUpdate`                | `number`                                 | Número do novo turno              |
| `playerConfirmedEndTurn`    | `playerSlot`                             | Um jogador confirmou fim de turno |
| `waitingForOpponentEndTurn` | `string`                                 | Aguardando adversário             |
| `scoreUpdate`               | `{ player1, player2 }`                   | Placar atualizado                 |
| `gameOver`                  | `{ winnerTeam, winnerName }`             | Fim de jogo                       |
| `roundOver`                 | `{ winnerTeam }`                         | Fim de rodada                     |
| `skillApproved`             | `{ userId, skillKey }`                   | Skill pré-validada                |
| `skillDenied`               | `string`                                 | Motivo da negação                 |
| `actionFailed`              | `string`                                 | Ação rejeitada                    |
| `playerDisconnected`        | `{ slot, name, timeout }`                | Oponente desconectou              |
| `playerReconnected`         | `{ slot, name }`                         | Oponente reconectou               |
| `editModeUpdate`            | `object`                                 | Configurações de edit mode        |

### Envelopes de Ação (`combatAction`)

O envelope é o contrato principal entre servidor e cliente para comunicar o resultado de uma skill:

```js
{
  action: {
    userId: string,         // ID do campeão que agiu
    skillKey: string,       // Chave da skill usada
    skillName: string,      // Nome legível
    targetId: string | null // ID do alvo principal (para diálogo)
  },
  effects: [                // Lista de efeitos visuais, em ordem
    {
      type: "damage" | "heal" | "shield" | "dialog" | buff" | "evasion" | "resourceGain"
            | "keywordApplied" | "keywordRemoved" | "immune" | "gameOver"
            | "shieldBlock" | "taunt" | "bonusAttack",
      targetId: string,     // Campeão afetado
      amount?: number,      // Quantidade (dano, cura, escudo…)
      crit?: boolean,       // Se foi crítico
      // ... campos específicos por tipo
    }
  ],
  log: string,              // Texto completo HTML do log de combate
  state: [                  // Snapshots de estado dos campeões afetados
    { id, HP, maxHP, mana?, energy?, runtime, keywords, ... }
  ]
}
```

---

## 6. Classe Champion

**Arquivo**: `shared/core/Champion.js`

É o objeto central de dados de um campeão, compartilhado entre server e client.

### Propriedades Principais

```js
// Identidade
champion.id          // string — ID único (ex: "ralia-uuid-...")
champion.name        // string
champion.portrait    // string — path da imagem
champion.team        // 1 | 2
champion.entityType  // "champion" (extensível)

// Stats Atuais (podem ser modificados em combate)
champion.HP
champion.maxHP
champion.Attack
champion.Defense
champion.Speed
champion.Evasion     // % de chance de evadir
champion.Critical    // % de chance de crítico
champion.LifeSteal   // % de roubo de vida

// Stats Base (usados para referência; crítico respeita base)
champion.baseAttack, champion.baseDefense, etc.

// Recurso (apenas um dos dois existirá)
champion.mana        // number | undefined
champion.energy      // number | undefined
champion.resourceCap // limite máximo (padrão 999)

// Combate
champion.skills      // Skill[] — habilidades do campeão
champion.passive     // objeto passivo com hooks, ou null
champion.keywords    // Map<string, { duration?, stacks?, ... }>
champion.alive       // boolean
champion.hasActedThisTurn  // boolean (reset a cada turno)

// Modificadores
champion.damageModifiers       // DamageMod[]
champion.statModifiers         // StatMod[]
champion.tauntEffects          // TauntEffect[]
champion.damageReductionModifiers // ReductionMod[]

// Runtime (dados temporários de combate)
champion.runtime = {
  shields: Shield[],          // Escudos ativos
  hookEffects: HookEffect[],  // Efeitos temporários com hooks
  currentContext: object,     // Contexto do turno atual
  // campos específicos por campeão
}

// DOM (apenas client)
champion.el          // HTMLElement | null
```

### Métodos de Instância

```js
// Criação
Champion.fromBaseData(baseData, id, team); // Factory static — forma canônica de instanciar

// Serialização (para envio via socket)
champion.serialize(); // → plain object seguro para JSON

// HP
champion.takeDamage(amount, context); // Aplica dano, consome escudos primeiro
champion.heal(amount, context); // → healed (quantidade real curada)

// Recurso
champion.addResource(input); // → applied
champion.spendResource(cost); // → boolean (falhou se insuficiente)
champion.applyResourceChange({ amount, type, mode }); // → { applied, value, isCappedMax }
champion.getResourceState(); // → { type, current, currentKey }

// Modificadores
champion.addDamageModifier(mod);
champion.getDamageModifiers();
champion.purgeExpiredModifiers(currentTurn);

// UI (apenas client)
champion.render(container, handlers); // Cria e insere o elemento DOM
champion.updateUI(currentTurn); // Atualiza HP/MP/skills/escudos/indicadores
champion.destroy(); // Remove o elemento do DOM

// Utilitário
champion.roundToFive(x); // Arredonda para múltiplo de 5
champion.getSkillCost(skill); // Lida com manaCost/energyCost/cost
```

### Arredondamento para 5

Todos os valores de HP e de recurso são arredondados para múltiplos de 5 via `roundToFive`. Isso garante que as barras de HP e MP tenham segmentos visuais alinhados (1 segmento = 50 HP, 1 segmento de recurso = 75).

---

## 7. Sistema de Recursos (Mana / Energia)

Cada campeão usa **exatamente um** tipo de recurso. Declarar ambos no `baseData` lança um erro.

| Tipo               | Cor               | Uso típico                                     |
| ------------------ | ----------------- | ---------------------------------------------- |
| Mana (`mana`)      | Azul (#4aa3ff)    | Casters, suportes — regen lenta, pools grandes |
| Energia (`energy`) | Amarelo (#f4d03f) | Fighters, assassinos                           |

Em ambos os casos, geração percentual baixa por ação de dano executada.

### Regen Global

A cada fim de turno, **todos os campeões vivos** recebem `BASE_REGEN = 80` de recurso automaticamente (via `applyGlobalTurnRegen`). Isso é feito **depois** da resolução das ações, antes do `turnUpdate`.

Campeões também podem regenerar recurso ao causar dano (`applyRegenFromDamage` no `CombatResolver`, controlado por `champion.resourceRegenOnDamage`).

### Custo de Skill

O custo de uma skill é resolvido em cascata:

```js
// Prioridade de leitura do custo:
1. skill.cost           // campo genérico (número direto)
2. skill.energyCost     // custo específico de energia
3. skill.manaCost       // custo específico de mana
```

O cliente e o servidor têm funções paralelas para isso (`Champion.getSkillCost()` e `getSkillCost()` helper em server.js), garantindo que a UI reflita exatamente o que o servidor validará.

---

## 8. Pipeline de Combate — CombatResolver

**Arquivo**: `shared/core/combatResolver.js`

O `CombatResolver` é um objeto singleton (não uma classe) com todos os métodos de cálculo de dano. O método central é `resolveDamage()`.

### `resolveDamage(params)` — Pipeline Completo

```
params = {
  mode,           // "raw" | "direct" | "magic" | etc.
  baseDamage,     // dano antes de qualquer cálculo
  directDamage,   // dano adicional direto (ignora defesa)
  user,           // Champion atacante
  target,         // Champion alvo
  skill,          // objeto Skill
  context,        // contexto do turno (currentTurn, allChampions, etc.)
  options,        // { force: bool, disable: bool } para crítico
  allChampions    // Map (ou Array, se convertido) de todos os campeões ativos naquela partida
}
```

**Etapas em ordem:**

1. PRÉ-CHECAGENS
   ├── Imunidade absoluta? → retorna resultado imune (sem dano)
   ├── Shield Block? → consome escudo do tipo "supremo"/"feitiço"; retorna bloqueio
   └── Evasão? → roll aleatório vs target.Evasion%; retorna evasion result


2. CÁLCULO DO DANO
   ├── processCrit()                   → { didCrit, bonus, critExtra }
   ├── _applyDamageModifiers()         → aplica modificadores do atacante
   ├── _applyBeforeDealingPassive()    → hook onBeforeDmgDealing (atacante)
   └── _composeFinalDamage()           → aplica defesa, crítico, dano direto,
                                         garante piso mínimo (10),
                                         múltiplos de 5


3. AJUSTE FINAL ANTES DA APLICAÇÃO
   └── _applyBeforeTakingPassive()     → hook onBeforeDmgTaking (alvo)
                                         pode sobrescrever o dano final
                                         já composto


4. APLICAÇÃO DO DANO
   └── _applyDamage()
        ├── debita HP
        ├── consome escudos regulares
        └── mantém múltiplos de 5


5. AFTER HOOKS
   ├── _applyAfterTakingPassive()      → hook onAfterDmgTaking (alvo)
   └── _applyAfterDealingPassive()     → hook onAfterDmgDealing (atacante)

6. EFEITOS SECUNDÁRIOS
   ├── applyRegenFromDamage()  → regen de recurso por dano causado
   ├── _applyLifeSteal()       → roubo de vida
   └── extraDamageQueue        → processa contra-ataques e danos extras em cascata

7. CONSTRUÇÃO DO LOG
   └── Monta string HTML com todos os resultados intermediários

8. RETORNO
   → { baseDamage, totalDamage, finalHP, totalHeal, heal, targetId, userId, evaded, log, crit, damageDepth, skill, extraEffects }
   → Ou array [mainResult, ...extraResults] se houver dano extra
```

### Retorno de Hooks de Combate

Hooks podem retornar um objeto estruturado com qualquer uma das seguintes propriedades:

```ts
{
  damage?: number,        // Override do dano
  crit?: object,          // Override do crítico
  ignoreMinimumFloor?: boolean,
  log?: string | string[],
  logs?: string[],
  effects?: Effect[]      // 🔥 Novo: efeitos estruturados para o client
}

Os effects retornados por hooks são agregados pelo CombatResolver e propagados para o envelope.effects, sendo processados pelo cliente via animateEffect().
Isso permite que passivas e efeitos temporários gerem eventos visuais customizados (ex: dialogs, efeitos especiais, etc.).
```

### `damageDepth` e Cascata

Para evitar loops infinitos em passivas que causam dano (ex: contra-ataques), o contexto rastreia `damageDepth`. Depth 0 = ação principal, depth 1+ = reação. Passivas devem verificar o depth antes de gerar dano extra.

### Damage Modes

| Mode       | Comportamento                              |
| ---------- | ------------------------------------------ |
| `"raw"`    | Dano base passando pela defesa normalmente |
| `"direct"` | Ignora defesa inteiramente                 |
| `"magic"`  | Pode ter tratamento especial por passivas  |

---

## 9. Fórmulas de Dano e Defesa

### Fórmula de Dano (basicAttack como exemplo)

```
baseDamage = (user.Attack × BF / 100) + bonusFlat
```

Onde `BF` (Battle Factor) é um parâmetro da skill (ex: `bf: 15` no ataque básico).

### Defesa → Redução Percentual (`defenseToPercent`)

A função implementa uma curva **não linear** em dois segmentos:

**Segmento 1 — Interpolação linear por intervalo (Defense 0–220):**

| Defense | Redução |
| ------- | ------- |
| 0       | 0%      |
| 35      | 25%     |
| 60      | 40%     |
| 85      | 53%     |
| 110     | 60%     |
| 150     | 65%     |
| 200     | 72%     |
| 220     | 78%     |

Entre os pontos, a redução é interpolada linearmente.

**Segmento 2 — Cauda assintótica (Defense > 220):**

```
reduction = 0.75 + (0.95 - 0.75) × (1 - e^(-0.0045 × (defense - 220)))
```

Isso garante que a redução **nunca ultrapasse 95%** (cap), tornando inviável "matéria negra".

### Crítico

- Chance máxima: `MAX_CRIT_CHANCE = 95%`
- Bônus padrão de dano: `DEFAULT_CRIT_BONUS = 55%` (`critBonusOverride` pode sobrescrever)
- Crítico **ignora buffs de defesa**: usa `Math.min(baseDefense, currentDefense)`
- Pode ser forçado (`options.force`) ou bloqueado (`options.disable`)

### Dano Mínimo

Após toda a pipeline, o dano final é garantido a ser pelo menos `5` (exceto se `context.ignoreMinimumFloor = true`, usado por passivas específicas).

### Escudo e Absorção

Antes de o HP ser debitado, escudos do tipo `"regular"` absorvem dano na ordem em que foram criados. Tipos especiais (`"supremo"`, `"feitiço"`) são verificados antes da pipeline e bloqueiam a ação inteiramente, não apenas absorvem HP.

---

## 10. Sistema de Hooks — CombatEvents

**Arquivo**: `shared/core/combatEvents.js`

O sistema de hooks permite que passivas e efeitos temporários reajam a eventos de combate sem acoplamento direto com o `CombatResolver`.

### `emitCombatEvent(eventName, payload, champions)`

Itera sobre todos os campeões e dispara o hook `eventName` em duas fontes:

1. **`champion.passive`** — A passiva fixa do campeão
2. **`champion.runtime.hookEffects`** — Efeitos temporários com hooks (adicionados dinamicamente por skills)

Se o hook retornar um valor, este é coletado em um array de resultados e retornado pelo `emitCombatEvent`.

### Hooks Disponíveis (usados em `combatResolver.js` e `server.js`)

| Hook                | Quando dispara                | Payload principal                                                   |
| ------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `onBeforeDealing`   | Antes do atacante causar dano | `{ attacker/user, target, damage, crit, skill, context }`           |
| `onBeforeTaking`    | Antes do alvo receber dano    | `{ dmgSrc/user, dmgReceiver/target, damage, crit, skill, context }` |
| `onAfterDmgDealing` | Após o atacante causar dano   | `{ attacker, target, damage, crit, skill, context }`                |
| `onAfterTaking`     | Após o alvo receber dano      | `{ attacker, target, damage, crit, skill, context }`                |
| `onCriticalHit`     | Quando um crítico ocorre      | `{ attacker, critSrc, target, context }`                            |
| `onTurnStart`       | Início de cada turno          | `{ champion/self/owner, context, allChampions }`                    |
| `onChampionDeath`   | Quando um campeão morre       | `{ deadChampion, killer, context }`                                 |
| `onAfterHealing`    | Quando uma cura ocorre        | depende da passiva                                                  |
| `onKeywordApplied`  | Quando keyword é adicionada   | depende da passiva                                                  |

> **Nota de Consistência**: Os aliases `self` e `owner` ambos apontam para o `champion` no payload do `onTurnStart`, enquanto `attacker`/`user` e `target`/`dmgSrc`/`dmgReceiver` existem por razão histórica de migração. Novos hooks devem usar os nomes canônicos.

### Hook Effects Temporários (`runtime.hookEffects`)

Skills podem adicionar efeitos com hooks ao `champion.runtime.hookEffects`:

```js
champion.runtime.hookEffects.push({
  key: "efeito_especial",
  expiresAtTurn: context.currentTurn + 2,
  onBeforeTaking({ damage, ... }) {
    // modifica o dano
    return { damage: damage * 0.5, logs: ["..."] };
  }
});
```

Estes são avaliados junto às passivas permanentes em cada `emitCombatEvent`.

---

## 11. Sistema de Keywords

Keywords são **status de combate** aplicados aos campeões, armazenados em `champion.keywords` como um `Map<string, object>`.

### Estrutura

```js
// Adicionar
champion.keywords.set("queimando", { duration: 2, stacks: 1 });

// Remover
champion.keywords.delete("queimando");

// Verificar
champion.keywords.has("paralisado");
```

### Efeitos de Turno (`keywordTurnEffects.js`)

O servidor chama os efeitos de keywords no início de cada turno via `KeywordTurnEffects`:

```js
// queimando → 15 de dano direto por turno
// envenenado → 15 de dano direto por turno
```

Cada keyword registrada em `KeywordTurnEffects` tem um hook `onTurnStart` que retorna um objeto de efeito `{ type, mode, amount, skill }`.

### Keywords com Indicador Visual

Apenas keywords com entrada em `StatusIndicator.keywordIcons` terão ícone exibido:

| Keyword              | Ícone         | Cor de fundo     |
| -------------------- | ------------- | ---------------- |
| `paralisado`         | ⚡🚫⚡        | Laranja          |
| `atordoado`          | 💫            | Branco           |
| `inerte`             | 🔒            | Cinza            |
| `sobrecarga`         | ⚡            | Amarelo          |
| `imunidade absoluta` | (imagem)      | Ciano            |
| `tributo`            | TRIB. (texto) | Vermelho         |
| `queimando`          | 🔥            | Laranja-vermelho |
| `enraizado`          | 🌱            | Verde            |

Para adicionar uma nova keyword com ícone, basta adicionar entrada em `StatusIndicator.keywordIcons`.

---

## 12. Sistema de Escudos (Shields)

Escudos são armazenados em `champion.runtime.shields` como array de objetos:

```js
{
  amount: number,   // HP de escudo restante
  type: "regular" | "supremo" | "feitiço" | string,
  source: string,   // skill key que criou o escudo
  // outros campos customizados por campeão
}
```

### Tipos de Escudo

| Tipo                      | Comportamento                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------- |
| `"regular"`               | Absorve HP de dano antes de chegar ao HP do campeão                                     |
| `"supremo"` / `"feitiço"` | Bloqueia a **ação inteiramente** (verificado antes da pipeline de dano); não absorve HP |

Escudos regulares são consumidos em ordem (FIFO) dentro de `Champion.takeDamage()`. Escudos com `amount <= 0` são automaticamente removidos em `updateUI()`.

O efeito visual de escudo ativo é a classe CSS `.has-shield` no elemento do campeão, que ativa um overlay de bolha animada.

---

## 13. Sistema de Modificadores de Dano

`champion.damageModifiers` é um array de objetos que modificam o dano de saída do campeão:

```js
{
  name: string,           // identificador legível
  apply({ baseDamage, user, target, skill }) → number,  // nova damage
  permanent: boolean,     // se false, expira por turno
  expiresAtTurn: number,  // turno em que expira (se não permanent)
}
```

Antes de cada ataque, o `CombatResolver` chama `champion.purgeExpiredModifiers(currentTurn)` para remover modificadores vencidos, depois aplica os restantes em sequência via `_applyDamageModifiers()`.

Existe também `champion.damageReductionModifiers` para redução de dano recebido (mesma estrutura, mas aplicado no alvo).

---

## 14. Gerenciador de Animações — AnimsAndLogManager

**Arquivo**: `public/js/animation/animsAndLogManager.js`

Exporta uma factory function `createCombatAnimationManager(deps)` que retorna o gerenciador. É instanciado em `main.js` com injeção de dependências.

### Filosofia: Fila Determinística

**Todos** os eventos de combate passam pela fila antes de serem exibidos. Isso garante que animações nunca se sobreponham, que o estado final só é aplicado após as animações, e que log e visual estejam sempre sincronizados.

```
Server emits → handler enqueues → drainQueue() processa um por vez → animações visuais → applyStateSnapshots → next
```

### Tipos na Fila

| Tipo              | Processado por             |
| ----------------- | -------------------------- |
| `combatAction`    | `processCombatAction()`    |
| `gameStateUpdate` | `processGameStateUpdate()` |
| `turnUpdate`      | `processTurnUpdate()`      |
| `championRemoved` | `processChampionRemoved()` |
| `combatLog`       | `processCombatLog()`       |

### Processamento de `combatAction`

```
1. Exibe dialog de "X usou Y em Z" (showBlockingDialog)
2. Para cada effect em effects[]:
   └── animateEffect(effect) → aguarda animação CSS
3. applyStateSnapshots(state) → sincroniza dados com a verdade do servidor
4. appendToLog(log) → exibe texto no painel lateral
```

### Efeitos Animados

| Tipo de Effect   | Animação CSS               | Float                                     |
| ---------------- | -------------------------- | ----------------------------------------- |
| `damage`         | `.damage` + shake          | `.damage-float` + tier 1-6 por quantidade |
| `heal`           | `.heal` + brilho verde     | `.heal-float`                             |
| `shield`         | `.has-shield` + bolha      | `.shield-float`                           |
| `buff`           | `.buff` + brilho dourado   | `.buff-float`                             |
| `evasion`        | `.evasion` + slide         | "EVASÃO!" como float                      |
| `resourceGain`   | —                          | `.resource-float-mana` ou `-energy`       |
| `keywordApplied` | `animateIndicatorAdd()`    | `.taunt-float` se taunt                   |
| `keywordRemoved` | `animateIndicatorRemove()` | —                                         |
| `immune`         | —                          | "IMUNE!" como float                       |
| `shieldBlock`    | —                          | "BLOQUEADO!" como float                   |
| `gameOver`       | overlay de vitória         | —                                         |

### Damage Tier (Tamanho do Float)

```js
amount >= 251 → tier 6 (44px)
amount >= 151 → tier 5 (38px)
amount >= 101 → tier 4 (34px)
amount >= 61  → tier 3 (30px)
amount >= 31  → tier 2 (26px)
else          → tier 1 (22px)
```

### Constantes de Timing

```js
FLOAT_LIFETIME: 1900ms    // vida de floats (alinhado ao CSS)
DEATH_ANIM: 2000ms        // espera pela animação de morte
DIALOG_DISPLAY: 900ms     // tempo que o dialog fica visível
DIALOG_LEAVE: 120ms       // fade out do dialog
BETWEEN_EFFECTS: 60ms     // gap entre effects consecutivos
BETWEEN_ACTIONS: 20ms     // gap entre ações
```

### `applyStateSnapshots` — Sincronização Final

Após todas as animações de uma ação, os snapshots do servidor são aplicados ao estado local do cliente. Isso corrige qualquer discrepância entre o visual animado e o estado real (ex: HP que o cliente estimou incorretamente por uma passiva não mapeada no client).

---

## 15. Indicadores de Status — StatusIndicator

**Arquivo**: `shared/core/statusIndicator.js`

Singleton responsável por criar, atualizar, animar e remover os ícones de status que aparecem sobre o retrato do campeão.

### API Principal

```js
StatusIndicator.updateChampionIndicators(champion);
// Remove todos e recria com base em champion.keywords

StatusIndicator.animateIndicatorAdd(champion, keywordName);
// Atualiza indicators + pulsa o novo ícone

StatusIndicator.animateIndicatorRemove(champion, keywordName);
// Fade out + remoção após VISUAL_DELAY (1500ms)

StatusIndicator.startRotationLoop(champions);
// Quando um campeão tem múltiplos status, alterna visibilidade a cada 1750ms
// Deve ser chamado uma vez após gameStateUpdate

StatusIndicator.clearIndicators(champion);
// Remove todos os ícones sem animação
```

### Estrutura do Ícone

```js
keywordIcons["nome"] = {
  type: "emoji" | "image" | "text",
  value: string,         // emoji, path de imagem, ou texto
  background: string,    // cor rgba do fundo circular
  color?: string,        // cor do texto (para type "text")
}
```

---

## 16. Histórico de Turnos

O servidor mantém `turnHistory: Map<number, TurnData>` com o seguinte formato por turno:

```js
{
  events: [
    { type: "championDied" | "hpChanged" | "statChanged" | ..., ...data, timestamp }
  ],
  championsDeadThisTurn: [],
  skillsUsedThisTurn: {},    // { [championId]: skillKey[] }
  damageDealtThisTurn: {},   // { [championId]: totalDamage }
}
```

Isso é útil para:

- Rastrear quais skills foram usadas (para skills com "não pode usar duas vezes por turno").
- Debug e replay de partidas.
- Validações de passivas que dependem de histórico do turno.

---

## 17. Modo de Edição / Debug

O `editMode` é um objeto de configuração no servidor:

```js
const editMode = {
  enabled: true, // Ativa botões de edição na UI
  autoLogin: true, // Loga automaticamente ao conectar
  autoSelection: false, // Seleciona equipe aleatória automaticamente
  actMultipleTimesPerTurn: false, // Permite que o mesmo campeão aja várias vezes
  unreleasedChampions: true, // Exibe campeões marcados com `unreleased: true`
  damageOutput: null, // Força dano fixo (ex: 999). null = desativado
  alwaysCrit: false, // Força crítico em todos os ataques
};
```

O servidor filtra `damageOutput` e `alwaysCrit` antes de enviar `editModeUpdate` ao cliente (segurança). O cliente só recebe as flags de UI.

---

## 18. Como Criar um Novo Campeão

### 1. Criar a pasta e o `index.js`

```
shared/data/champions/meu_campeao/
└── index.js
```

### 2. Estrutura do `index.js`

```js
const meu_campeao = {
  // === IDENTIDADE ===
  name: "Meu Campeão",
  portrait: "/assets/champions/meu_campeao.png",
  entityType: "champion", // opcional, padrão "champion"
  unreleased: false, // true = só aparece em editMode

  // === STATS BASE ===
  HP: 500,
  Attack: 80,
  Defense: 40,
  Speed: 70,
  Evasion: 0, // % chance de evadir
  Critical: 10, // % chance de crítico

  // === RECURSO (escolha um) ===
  mana: 150, // OU energy: 100 (NUNCA os dois)
  // resourceCap: 300,  // opcional (padrão 999)

  // === SKILLS ===
  skills: [
    {
      key: "minha_skill_1",
      name: "Nome da Skill",
      manaCost: 50, // ou energyCost: 30
      priority: 0, // maior = age primeiro no turno
      contact: true, // ataque físico (relevante para passivas)
      description() {
        return `Custo: ${this.manaCost} MP\nDescrição da skill.`;
      },
      targetSpec: ["enemy"], // ["enemy"], ["ally"], ["self"], ["any"], etc.
      execute({ user, targets, context }) {
        const { enemy } = targets;
        const baseDamage = (user.Attack * 80) / 100 + 30;
        return CombatResolver.resolveDamage({
          baseDamage,
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        });
      },
    },
    // ... até 4 skills
  ],

  // === PASSIVA ===
  passive: {
    key: "passiva_meu_campeao",
    name: "Nome da Passiva",
    description: "Descrição da passiva.",

    // Hooks opcionais — implemente apenas os necessários:
    onAfterDmgDealing({ attacker, target, damage, crit, skill, context }) {
      // chamado após o campeão causar dano
    },
    onAfterTaking({ attacker, target, damage, context }) {
      // chamado após o campeão receber dano
    },
    onTurnStart({ owner, context, allChampions }) {
      // chamado no início do turno para este campeão
    },
    onCriticalHit({ attacker, target, context }) {
      // chamado quando este campeão acerta um crítico
    },
  },
};

export default meu_campeao;
```

### 3. Registrar no índice

Em `shared/data/champions/index.js`:

```js
import meu_campeao from "./meu_campeao/index.js";

const championDB = {
  // ... outros campeões
  meu_campeao,
};

export default championDB;
```

### 4. Boas práticas

- **IDs de skill com underscore e snake_case**: `"rajada_de_fogo"`.
- **`description()` como função**: Permite exibir valores dinâmicos (custo, BF, etc.) via `this`.
- **Sempre use `CombatResolver.resolveDamage()`** para dano — nunca debite HP diretamente em skills, pois o resolver lida com escudos, evasão, crítico, lifesteal, hooks, log, etc.
- **Passivas devem verificar `damageDepth`** antes de gerar dano extra para evitar recursão infinita: `if (context.damageDepth > 0) return;`.
- **Keywords**: Use `champion.keywords.set("nome", { duration: N })` para aplicar. O servidor deve emitir `keywordApplied` no array de effects para que o cliente anime.
- **Escudos**: Adicione em `champion.runtime.shields.push({ amount: X, type: "regular", source: skill.key })`.

---

## 19. Decisões de Design e Convenções

### Por que Server Authoritative?

Num jogo PvP, permitir que o cliente compute o estado final criaria espaço para trapaça. Toda validação ocorre no servidor: tem recurso suficiente? Campeão ainda vivo? Alvo válido? O cliente só exibe o que o servidor determina.

### Por que a fila de animações no cliente?

Socket.IO pode entregar múltiplos eventos em rajada (várias ações num turno). Sem fila, animações se sobreporiam e o estado visual ficaria inconsistente. A fila garante sequencialidade total e a `applyStateSnapshots` ao final de cada ação garante que o visual está correto mesmo se uma animação pulou etapas.

### Por que código compartilhado (`/shared`)?

A classe `Champion` precisa existir no servidor (para gerenciar estado real) e no cliente (para renderizar a UI e calcular custos de skill localmente). Evitar duplicação elimina divergências. O `CombatResolver` compartilhado garante que a UI do cliente pode fazer estimativas locais antes da confirmação do servidor.

### Convenção: Recursos arredondados para múltiplos de 5

Todos os valores de HP, dano, cura e recurso são arredondados para múltiplos de 5. Isso facilita a leitura visual (os segmentos das barras se encaixam), reduz "números feios" e simplifica o balanceamento.

### Aliases de hooks (legado)

Alguns hooks passam `self` E `owner`, outros passam `user` E `attacker`. Isso é resquício de refatorações incrementais. A direção futura é padronizar: `owner` para o dono do hook, `user`/`attacker` para o atacante, `target`/`receiver` para o alvo.

### `editMode` separado entre server e client

O servidor tem flags adicionais (`damageOutput`, `alwaysCrit`) que não são enviadas ao cliente por segurança. O cliente não deve conhecer valores de output de dano forçado ou flags que mudem o resultado do combate — apenas flags que afetam a UI (mostrar campeões não lançados, permitir múltiplas ações por turno visualmente, etc.).
