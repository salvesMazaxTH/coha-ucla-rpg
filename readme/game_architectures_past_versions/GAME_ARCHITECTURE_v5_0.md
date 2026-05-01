# GAME_ARCHITECTURE.md — Champion Arena (UCLA RPG)

> Documentação mestre da arquitetura do sistema. Referência técnica completa para desenvolvimento, manutenção e extensão do jogo.
> **v5.0** — Adiciona cobertura completa de `GameMatch` / `Player` / estrutura `shared/engine`; atualiza pipeline de dano para refletir módulos numerados.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Arquivos](#3-estrutura-de-arquivos)
4. [Fluxo de Jogo (Game Loop)](#4-fluxo-de-jogo-game-loop)
5. [Camada de Rede — Socket.IO](#5-camada-de-rede--socketio)
6. [Gerenciamento de Sessão — GameMatch e Player](#6-gerenciamento-de-sessão--gamematch-e-player)
7. [Classe Champion](#7-classe-champion)
8. [Sistema de Ultômetro (ultMeter)](#8-sistema-de-ultômetro-ultmeter)
9. [Pipeline de Combate — DamageEvent](#9-pipeline-de-combate--damageevent)
10. [Sistema de Contexto e Efeitos Estruturados](#10-sistema-de-contexto-e-efeitos-estruturados)
11. [Fórmulas de Dano e Defesa](#11-fórmulas-de-dano-e-defesa)
12. [Sistema de Afinidades Elementais](#12-sistema-de-afinidades-elementais)
13. [Sistema de Hooks — CombatEvents](#13-sistema-de-hooks--combatevents)
14. [Sistema de StatusEffects](#14-sistema-de-statuseffects)
15. [Sistema de Escudos (Shields)](#15-sistema-de-escudos-shields)
16. [Sistema de Modificadores de Dano](#16-sistema-de-modificadores-de-dano)
17. [Gerenciador de Animações — AnimsAndLogManager](#17-gerenciador-de-animações--animsandlogmanager)
18. [Sistema de VFX — vfxManager](#18-sistema-de-vfx--vfxmanager)
19. [Indicadores de Status — StatusIndicator](#19-indicadores-de-status--statusindicator)
20. [Histórico de Turnos](#20-histórico-de-turnos)
21. [Modo de Edição / Debug](#21-modo-de-edição--debug)
22. [Como Criar um Novo Campeão](#22-como-criar-um-novo-campeão)
23. [Decisões de Design e Convenções](#23-decisões-de-design-e-convenções)

---

## 1. Visão Geral

**Champion Arena** é um jogo de arena turn-based multiplayer 1v1, jogado no browser. Dois jogadores se conectam via Socket.IO, selecionam equipes de 3 campeões cada, e alternam turnos usando habilidades até que um time seja eliminado. O formato é melhor-de-3 rodadas (primeiro a 2 pontos vence).

### Princípios Arquiteturais

- **Server Authoritative**: Todo o estado de jogo vive no servidor. O cliente apenas renderiza e envia intenções de ação; o servidor valida, processa e retransmite o estado canônico.
- **Código Compartilhado**: A pasta `/shared` contém código que roda tanto no Node.js (server) quanto no browser (client) — principalmente `Champion.js`, `DamageEvent.js`, e utilitários.
- **Event-Driven**: Passivas, efeitos de campeões e status-effects se comunicam via sistema de hooks (`combatEvents.js`), sem acoplamento direto com o motor de combate.
- **Animações Determinísticas**: O cliente recebe envelopes estruturados com arrays tipados de eventos ordenados, e os anima sequencialmente em fila — nunca há corrida ou sobreposição visual.

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
├── public/                         # Servido estaticamente pelo Express
│   ├── index.html                  # Único HTML — SPA com múltiplas "telas"
│   ├── js/
│   │   ├── main.js                 # Entrada do cliente; UI e socket
│   │   └── animation/
│   │       ├── AnimsAndLogManager.js
│   │       └── vfx/
│   │           ├── vfxManager.js
│   │           ├── shieldCanvas.js
│   │           ├── fireStanceCanvas.js
│   │           └── obliterate.js
│   └── styles/
│       ├── style.css
│       └── animations.css
│
├── shared/                         # Código isomórfico (server + client)
│   │
│   ├── core/
│   │   ├── Champion.js             # Classe central do campeão
│   │   └── basicAttack.js          # Definição do ataque básico padrão
│   │
│   ├── engine/                     # ← Motor de combate (novo namespace)
│   │   ├── DamageEvent.js          # Orquestrador da pipeline de dano
│   │   ├── combatEvents.js         # Sistema de hooks (emitCombatEvent)
│   │   │
│   │   ├── pipeline/               # Etapas numeradas da pipeline de dano
│   │   │   ├── 01_preChecks.js     # Imunidade, evasão, shield block
│   │   │   ├── 02_prepareDamage.js # Crit, modificadores, afinidade elemental
│   │   │   ├── 03_composeDamage.js # Aplicação de crit + curva de defesa + floor/cap
│   │   │   ├── 04_beforeHooks.js   # onBeforeDmgDealing / onBeforeDmgTaking
│   │   │   ├── 05_applyDamage.js   # target.takeDamage() + registerDamage()
│   │   │   ├── 06_obliterate.js    # Execução por obliterateRule
│   │   │   ├── 07_afterHooks.js    # onAfterDmgTaking / onAfterDmgDealing / lifesteal
│   │   │   ├── 08_extraQueue.js    # Processamento de DamageEvents extras (reações)
│   │   │   └── 09_resultBuilder.js # Monta e retorna resultado final
│   │   │
│   │   └── match/                  # ← Estado de sessão/partida
│   │       ├── GameMatch.js        # Container mestre de uma partida (LobbyState + CombatState)
│   │       └── Player.js           # Dados de um jogador conectado
│   │
│   ├── data/
│   │   ├── championDB.js           # Re-export do índice de campeões
│   │   ├── champions/
│   │   │   ├── index.js            # Índice de todos os campeões registrados
│   │   │   └── <champion>/         # Um diretório por campeão
│   │   │       └── index.js
│   │   └── statusEffects/
│   │       ├── effectsRegistry.js
│   │       ├── atordoado.js
│   │       ├── paralisado.js
│   │       ├── enraizado.js
│   │       ├── inerte.js
│   │       ├── gelado.js
│   │       ├── congelado.js
│   │       ├── queimando.js
│   │       └── imunidadeAbsoluta.js
│   │
│   └── ui/
│       ├── formatters.js           # HTML formatters (nomes com cor de time)
│       ├── statusIndicator.js      # Gerenciador visual de ícones de status
│       └── id.js                   # Gerador de IDs únicos
│
└── server/
    └── server.js                   # Express + Socket.IO + toda lógica de jogo
```

### Notas sobre localização dos módulos

| Módulo               | Caminho canônico                   |
| -------------------- | ---------------------------------- |
| `DamageEvent`        | `shared/engine/DamageEvent.js`     |
| `combatEvents`       | `shared/engine/combatEvents.js`    |
| Pipeline steps       | `shared/engine/pipeline/0N_*.js`   |
| `GameMatch`          | `shared/engine/match/GameMatch.js` |
| `Player`             | `shared/engine/match/Player.js`    |
| `Champion`           | `shared/core/Champion.js`          |
| `formatChampionName` | `shared/ui/formatters.js`          |

> `shared/core/combatResolver.js` não existe mais. O motor de combate é a classe `DamageEvent`. Qualquer código que antes chamava `CombatResolver.processDamageEvent(params)` agora instancia `new DamageEvent(params).execute()`.

---

## 4. Fluxo de Jogo (Game Loop)

```
[LOGIN] → [SELEÇÃO DE CAMPEÕES] → [ARENA / TURNOS] → [FIM DE JOGO]
```

O servidor gerencia toda a sessão por meio de uma instância de `GameMatch` (ver seção 6). `GameMatch` delega estado de lobby a `LobbyState` e estado de combate a `CombatState` — o `server.js` acessa ambos via interface pública de `GameMatch`.

### 4.1 Login

1. Jogador digita username e clica em "Entrar na Arena".
2. Cliente emite `joinArena` com `{ username }`.
3. Servidor tenta alocar o jogador no slot 0 (Time 1) ou slot 1 (Time 2). Máximo 2 jogadores.
4. Cria `new Player({ id, username, team })` e registra via `match.setPlayer(slot, player)`.
5. Servidor responde com `joinedArena` → `{ playerId, team, username, editMode }`.

> No `editMode.autoLogin = true`, o servidor loga o jogador automaticamente com nome "AutoPlayer".

### 4.2 Seleção de Campeões

1. Servidor emite `championSelectionStarted` com a lista de campeões disponíveis.
2. Cliente exibe grade. Jogador monta equipe de 3.
3. Ao confirmar, cliente emite `selectTeam` com `{ championKeys: string[] }`.
4. Servidor valida, instancia os campeões via `Champion.fromBaseData()`, registra em `match.combat.activeChampions`.
5. Quando **ambos** confirmam, servidor emite `allTeamsSelected` + `gameStateUpdate`.

> Timer de seleção: 120 segundos. Ao expirar, campeões aleatórios são selecionados automaticamente.

### 4.3 Turno

```
[Jogadores agem] → [Ambos clicam "Finalizar Turno"] → [Servidor processa] → [Novo turno]
```

**Fase de Resolução (handleEndTurn):** Ambos confirmam. O servidor então:

1. Ordena `pendingActions` por `priority DESC`, depois `speed DESC`.
2. Processa cada ação via `performSkillExecution(action, context)`:
   - Verifica se usuário e alvo ainda estão vivos.
   - Executa `skill.resolve({ user, targets, context })` → internamente `new DamageEvent(params).execute()`.
   - Emite envelopes `combatAction` via `emitCombatEnvelopesFromContext`.
3. Dispara hooks `onTurnStart` — status-effects ativos (ex: `queimando`) respondem a esse hook.
4. Aplica regen de recurso global para todos os campeões vivos.
5. Purga status-effects expirados via `champion.purgeExpiredStatusEffects(currentTurn)`.
6. Limpa ações pendentes (`match.clearActions()`), incrementa turno (`match.nextTurn()`), emite `turnUpdate`.

### 4.4 Morte e Substituição

- Se HP chega a 0 dentro de `applyDamage`, `target.alive = false`.
- O servidor chama `removeChampionFromGame()`, que usa `match.removeChampion(championId)`.
- Se o time ainda tem reservas, o próximo campeão entra. Caso contrário, adversário marca ponto (`match.addPointForSlot(slot)`).
- Se algum time atingiu `MAX_SCORE = 2`, emite `gameOver`. Caso contrário, `roundOver` + nova rodada.

### 4.5 Fim de Jogo

- `gameOver` é emitido com `{ winnerTeam, winnerName }`.
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
| `combatAction`              | envelope tipado (ver seção 5.1)          | Envelope de ação de combate       |
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

### 5.1 Envelopes de Ação (`combatAction`)

O envelope é o contrato principal entre servidor e cliente. O servidor envia **arrays tipados separados por grupo** — o cliente itera sobre eles por chave, animando cada grupo em sequência:

```js
{
  action: {
    userId: string,
    userName: string,
    skillKey: string,
    skillName: string,
    targetId: string | null,
    targetName: string | null,
  },

  damageEvents: [
    {
      type: "damage",
      targetId: string,
      sourceId: string,
      amount: number,
      isCritical: boolean,
      damageDepth: number,
      evaded?: boolean,
      immune?: boolean,
      shieldBlocked?: boolean,
      obliterate?: boolean,
      isDot?: boolean,
    }
  ],
  healEvents:         [{ type:"heal",              targetId, sourceId, amount }],
  shieldEvents:       [{ type:"shield",            targetId, sourceId, amount }],
  buffEvents:         [{ type:"buff",              targetId, sourceId, amount, statName }],
  resourceEvents:     [{ type:"resourceGain"|"resourceSpend", targetId, sourceId, amount, resourceType:"ult" }],
  dialogEvents:       [{ type:"dialog",            message, blocking?, html?, damageDepth? }],
  redirectionEvents?: [{ type:"tauntRedirection",  attackerId, fromTargetId, toTargetId }],

  state: [
    { id, HP, maxHP, ultMeter, ultCap, runtime, statusEffects, alive, Attack, Defense, Speed, Evasion, Critical, LifeSteal }
  ]
}
```

> **Reações como envelopes separados**: cada `damageDepth > 0` gera um segundo `combatAction` distinto com `skillName: "X (Reação N)"`.

---

## 6. Gerenciamento de Sessão — GameMatch e Player

**Arquivos**: `shared/engine/match/GameMatch.js`, `shared/engine/match/Player.js`

Estas duas classes encapsulam todo o estado mútável de uma partida no servidor. O `server.js` mantém uma (ou mais) instâncias de `GameMatch` — uma por sala ativa — e nunca manipula `activeChampions`, `pendingActions`, timers ou scores diretamente; tudo passa pela interface pública de `GameMatch`.

---

### 6.1 Player

`Player` representa um jogador conectado. É um objeto de dados simples sem lógica de combate.

```js
// shared/engine/match/Player.js
new Player({ id, username, team });
```

#### Propriedades

| Propriedade            | Tipo           | Descrição                                            |
| ---------------------- | -------------- | ---------------------------------------------------- |
| `id`                   | `string`       | ID único do jogador (geralmente o socket.id inicial) |
| `username`             | `string`       | Nome exibido                                         |
| `team`                 | `1 \| 2`       | Time do jogador                                      |
| `socketId`             | `string\|null` | Socket atual (pode mudar em reconexão)               |
| `selectedChampionKeys` | `string[]`     | Keys dos campeões selecionados (em ordem)            |

#### Métodos

```js
player.setSocket(socketId); // atualiza socketId ativo
player.clearSocket(); // limpa socketId (desconexão)
player.setSelectedChampionKeys(keys); // define seleção de equipe
player.clearChampionSelection(); // limpa seleção
player.isTeamSelected(); // → boolean (seleção não-vazia)
```

---

### 6.2 GameMatch

`GameMatch` é o container mestre de uma partida. Internamente delega responsabilidades a duas classes privadas: **`LobbyState`** (gerencia sockets, timers e seleção) e **`CombatState`** (gerencia campeões, turnos, ações e placar). A API pública de `GameMatch` expõe os métodos de ambas, eliminando a necessidade de o `server.js` conhecer os sub-estados.

```js
const match = new GameMatch();
```

#### Estrutura Interna

```
GameMatch
├── players: [Player|null, Player|null]   ← slot 0 e slot 1
├── lobby: LobbyState                     ← sockets, timers de seleção e desconexão
└── combat: CombatState                   ← campeões, turnos, ações, placar
```

---

#### 6.2.1 LobbyState

Gerencia o ciclo de entrada/saída de jogadores: mapeamento socket↔slot, timers de seleção de campeão e timers de reconexão.

```js
// Mapeamento socket ↔ slot
match.assignSocketToSlot(socketId, slot); // registra socket no slot; atualiza player.socketId
match.getSlotBySocket(socketId); // → slot | undefined
match.removeSocket(socketId); // remove mapeamento (sem apagar o player)

// Timers de seleção de campeão (um por slot)
match.setSelectionTimer(slot, timerId); // substitui timer anterior se existir
match.clearSelectionTimer(slot); // cancela e remove

// Timers de desconexão (um por slot)
match.setDisconnectionTimer(slot, timerId);
match.getDisconnectionTimer(slot); // → timerId | undefined
match.clearDisconnectionTimer(slot); // cancela e remove
```

**Reset de lobby** (chamado em `clearPlayers` e ao reiniciar sala):

```js
match.lobby.reset();
// → limpa socketToSlot, todos os selectionTimers e disconnectionTimers
```

---

#### 6.2.2 CombatState

Gerencia todo o estado de combate de uma rodada/partida.

```js
// Estado interno
combat.currentTurn; // number — turno atual (começa em 1)
combat.pendingActions; // Action[] — ações enfileiradas no turno corrente
combat.activeChampions; // Map<id, Champion> — campeões vivos
combat.deadChampions; // Map<id, Champion> — campeões eliminados (mantidos para lookup)
combat.playerScores; // [number, number] — pontos por slot
combat.gameEnded; // boolean
combat.started; // boolean
combat.playersReadyToEndTurn; // Set<slot>
combat.finishedAnimationSockets; // Set<socketId>
combat.combatSnapshot; // array de { championKey, id, team } — cópia imutável da composição inicial
combat.turnHistory; // Map<turn, TurnData>
```

---

#### 6.2.3 API Pública de GameMatch — Referência Completa

Toda interação do `server.js` com o estado da partida usa os métodos abaixo. Não acesse `match.lobby.*` ou `match.combat.*` diretamente de fora de `GameMatch`.

**Jogadores**

```js
match.getPlayer(slot); // → Player | null
match.setPlayer(slot, player); // define Player no slot (null para limpar)
match.getOpponent(slot); // → Player do outro slot
match.areBothPlayersConnected(); // → boolean
match.getConnectedCount(); // → 0 | 1 | 2
match.getPlayerNamesEntries(); // → [[slot, username], ...]
match.isTeamSelected(slot); // → boolean
match.clearPlayers(); // reseta players + lobby + combat
```

**Campeões**

```js
match.registerChampion(champion, { trackSnapshot? })
// → adiciona a activeChampions; se trackSnapshot=true, adiciona a combatSnapshot

match.removeChampion(championId)
// → move de activeChampions para deadChampions; → Champion | null

match.getChampion(championId)
// → busca em activeChampions E deadChampions; → Champion | null

match.getAliveChampions()
// → Champion[] apenas os com champion.alive === true
```

**Turnos e Ações**

```js
match.getCurrentTurn(); // → number
match.nextTurn(); // incrementa currentTurn
match.enqueueAction(action); // push em pendingActions
match.clearActions(); // esvazia pendingActions

// Readiness (controle de "fim de turno")
match.addReadyPlayer(slot);
match.removeReadyPlayer(slot);
match.isPlayerReady(slot); // → boolean
match.getReadyPlayersCount(); // → number
match.clearTurnReadiness(); // limpa o Set

// Animação — sincronização de sockets
match.addFinishedAnimationSocket(socketId);
match.clearFinishedAnimationSockets();
match.getFinishedAnimationCount(); // → number
```

**Placar**

```js
match.addPointForSlot(slot, (maxScore = 3));
// → incrementa playerScores[slot]; se >= maxScore: gameEnded = true

match.setWinnerScore(slot, (maxScore = 3));
// → força playerScores[slot] = maxScore; gameEnded = true

match.getScorePayload();
// → { player1: number, player2: number }

match.isGameEnded(); // → boolean
```

**Ciclo de Combate**

```js
match.startCombat(); // combat.started = true
match.isCombatStarted(); // → boolean
match.resetCombat(); // reseta todo CombatState (nova rodada)
```

**Histórico de Turno**

```js
match.ensureTurnEntry();
// → cria entrada para currentTurn se não existir; → TurnData

match.logTurnEvent(eventType, eventData);
// → push em TurnData.events com timestamp
```

---

#### 6.2.4 Padrão de Uso no server.js

```js
// Inicialização
const match = new GameMatch();

// Login
match.setPlayer(slot, new Player({ id: socket.id, username, team }));
match.assignSocketToSlot(socket.id, slot);

// Seleção de campeão
match.setSelectionTimer(slot, setTimeout(autoSelect, 120_000));
// ...confirmação:
match.clearSelectionTimer(slot);
match.getPlayer(slot).setSelectedChampionKeys(championKeys);

// Combate
match.startCombat();
match.enqueueAction({ userId, skillKey, targetIds, priority, speed });

// Resolução de turno
const actions = match.combat.pendingActions; // leitura direta OK para iteração
match.clearActions();
match.nextTurn();
match.clearTurnReadiness();

// Campeão morreu
const dead = match.removeChampion(championId);
if (
  match.getAliveChampions().filter((c) => c.team === loserTeam).length === 0
) {
  match.addPointForSlot(winnerSlot);
}
if (match.isGameEnded()) {
  /* emitir gameOver */
}
```

---

## 7. Classe Champion

**Arquivo**: `shared/core/Champion.js`

É o objeto central de dados de um campeão, compartilhado entre server e client.

### Propriedades Principais

```js
// Identidade
champion.id          // string — ID único (ex: "ralia-uuid-...")
champion.name
champion.portrait    // path da imagem
champion.team        // 1 | 2
champion.entityType  // "champion"

// Stats Atuais
champion.HP
champion.maxHP
champion.Attack
champion.Defense
champion.Speed
champion.Evasion     // % de chance de evadir
champion.Critical    // % de chance de crítico
champion.LifeSteal   // % de roubo de vida

// Stats Base (referência; crítico respeita base)
champion.baseAttack, champion.baseDefense, champion.baseSpeed, ...

// Recurso
champion.ultMeter    // 0 … ultCap
champion.ultCap      // máximo de unidades (padrão: 15)

// Combate
champion.skills
champion.passive
champion.statusEffects    // Map<string, { expiresAtTurn, stacks?, ... }>
champion.alive            // boolean
champion.hasActedThisTurn // boolean
champion.elementalAffinities // string[]

// Modificadores
champion.damageModifiers
champion.statModifiers
champion.tauntEffects
champion.damageReductionModifiers

// Runtime (temporário)
champion.runtime = {
  shields: Shield[],
  hookEffects: HookEffect[],
  currentContext: object,
  fireStance?: string,
}

// DOM (apenas client)
champion.el
```

### Métodos de Instância

```js
Champion.fromBaseData(baseData, id, team); // Factory estática

champion.serialize();                       // → plain object para JSON/socket
champion.takeDamage(amount, context);
champion.heal(amount, context);             // → healed (quantidade real)

champion.addUlt({ amount, source?, context? });
champion.spendUlt(cost);                    // → boolean
champion.applyRegenFromDamage(context);
champion.getResourceState();                // → { type:"ult", current, max }
champion.getSkillCost(skill);

champion.applyStatusEffect(key, duration, context, metadata?);
champion.removeStatusEffect(name);
champion.hasStatusEffect(name);             // → boolean
champion.getStatusEffect(name);
champion.purgeExpiredStatusEffects(currentTurn);

champion.addDamageModifier(mod);
champion.getDamageModifiers();
champion.getTotalDamageReduction();         // → { flat, percent }
champion.purgeExpiredModifiers(currentTurn);

// UI (apenas client)
champion.render(container, handlers);
champion.updateUI(options);
champion.destroy();
```

---

## 8. Sistema de Ultômetro (ultMeter)

Todos os campeões usam o **ultômetro** como sistema unificado de recurso para ultimates.

### Representação Interna

- **Máximo visual**: 5 barras — **Unidades internas**: 15 (cada barra = 3 unidades)

```js
champion.ultMeter = 0; // 0-15
champion.ultCap = 15;
```

### Ganho de Ultômetro

| Ação                       | Ganho       |
| -------------------------- | ----------- |
| Causar dano (skill normal) | +2 unidades |
| Tomar dano                 | +1 unidade  |
| Curar aliado               | +1 unidade  |
| Bufar aliado               | +1 unidade  |

Skills AoE contam **uma única vez por ação**. Regen global: `+2 unidades` por turno para todos os campeões vivos.

### Custo de Ultimates

```js
{ isUltimate: true, ultCost: 4 } // barras; servidor converte: costUnits = ultCost * 3
```

---

## 9. Pipeline de Combate — DamageEvent

**Arquivo principal**: `shared/engine/DamageEvent.js`
**Etapas**: `shared/engine/pipeline/01_preChecks.js` … `09_resultBuilder.js`

`DamageEvent` é uma **classe instanciada por evento** (não singleton). Cada evento de dano cria uma instância independente, executa a pipeline numerada e retorna um resultado estruturado.

### Convenção Oficial de Papéis

| Camada               | Alias canônico              |
| -------------------- | --------------------------- |
| Skill layer          | `user`, `targets`           |
| CombatEvents/hooks   | `source`, `target`, `owner` |
| DamageEvent/pipeline | `attacker`, `defender`      |

Não cruzar aliases entre camadas.

### Uso

```js
const result = new DamageEvent({
  baseDamage,
  attacker: user,
  defender: target,
  skill,
  context,
  mode, // "standard" | "hybrid" | "absolute" (padrão: "standard")
  piercingPortion, // porção que ignora defesa (modo hybrid)
  critOptions, // { force?, disable? }
  allChampions, // Map ou array — necessário para hooks
}).execute();
```

### Estado Interno da Instância

Todos os campos abaixo existem em `this` e são mutáveis ao longo da pipeline:

```js
this.baseDamage; // valor original recebido no construtor (imutável após construção)
this.damage; // valor em transformação ao longo da pipeline
this.finalDamage; // foto tirada após composeDamage (antes de applyDamage)
this.preMitigationDamage; // foto antes da defesa ser aplicada
this.actualDmg; // dano efetivamente descontado do HP (hpBefore - hpAfter)
this.hpAfter; // HP do defender após applyDamage
this.crit; // { didCrit, bonus, roll, forced, critExtra, critBonusFactor }
this.lifesteal; // resultado de lifesteal ou null
this.beforeLogs; // string[] — logs de runBeforeHooks
this.afterLogs; // string[] — logs de runAfterHooks
this.extraResults; // resultados de DamageEvents extras (processExtraQueue)
this.damageDepth; // profundidade de recursão (0 = ação principal)
```

### Fluxo Completo (visão de alto nível)

```
skill.resolve({ user, targets, context })
  └── new DamageEvent(params).execute()
        ├── 1. preChecks()             [01_preChecks.js]
        ├── 2. prepareDamage()         [02_prepareDamage.js]
        ├── 3. composeDamage()         [03_composeDamage.js]
        ├── 4. runBeforeHooks()        [04_beforeHooks.js]
        ├── 5. applyDamage()           [05_applyDamage.js]
        ├── 6. processObliterate()     [06_obliterate.js]
        ├── 7. runAfterHooks()         [07_afterHooks.js]
        ├── 8. processExtraQueue()     [08_extraQueue.js]
        └── 9. buildFinalResult()      [09_resultBuilder.js]

emitCombatEnvelopesFromContext({ user, skill, context })
  ├── buildMainEnvelopeFromContext()       → damageDepth===0 → combatAction principal
  └── buildReactionEnvelopesFromContext()  → damageDepth>0   → combatAction por profundidade
```

---

### Etapas em Detalhe

#### `01_preChecks.js`

```
├── emitCombatEvent("onDamageIncoming", payload, allChampions)
│     → status-effects com onDamageIncoming (ex: imunidadeAbsoluta) podem retornar { cancel: true }
│     → se cancelado: context.registerDamage({ flags:{immune:true} }); retorna resultado imune
│
├── Evasão? (saltado se mode === "absolute" ou skill.cannotBeEvaded)
│     → _rollEvasion({ attacker, defender, context })
│     → se evadido: context.registerDamage({ flags:{evaded:true} }); retorna
│
└── [Shield Block — reservado, atualmente comentado]
```

#### `02_prepareDamage.js` (saltado se mode === "absolute")

```
├── processCrit()
│     → rola crítico; dispara emitCombatEvent("onCriticalHit") se acertou
│     → popula this.crit = { didCrit, bonus, roll, forced, critExtra, critBonusFactor }
│
├── applyDamageModifiers()
│     → chama attacker.purgeExpiredModifiers(currentTurn)
│     → itera attacker.getDamageModifiers(); cada mod.apply({ baseDamage, attacker, defender, skill })
│       retorna novo valor numérico → this.damage atualizado
│
└── applyAffinity()
      → verifica skill.element vs defender.elementalAffinities
      → weak:   this.damage = Math.floor(damage * 1.2 + 25)
      → resist: this.damage = Math.max(damage - 40, 0)
      → injeta dialogEvent em context.visual.dialogEvents
      → seta context.ignoreMinimumFloor = true se não-neutro
```

#### `03_composeDamage.js`

```
├── Foto: this.preMitigationDamage = this.damage
│
├── ABSOLUTE: retorna sem nenhuma modificação
│
├── Aplica crítico: this.damage += this.crit.critExtra  (se didCrit)
│
├── defenseUsed = crit.didCrit ? Math.min(baseDefense, currentDefense) : currentDefense
│   defensePercent = defenseToPercent(defenseUsed)  ← curva não-linear em 2 segmentos
│
├── STANDARD (ou piercingPortion <= 0):
│     damage -= damage * defensePercent  (mitiga pela curva)
│     damage *= 1 - reductionPercent/100 (redução % extra)
│     damage -= reductionFlat            (redução flat extra)
│
├── HYBRID (piercingPortion > 0):
│     standardPart → passa pela curva; piercingPart → ignora defesa%/percent, só paga flat
│     damage = standardAfter + piercingAfter
│
├── Floor: Math.max(damage, 10) — exceto se context.ignoreMinimumFloor
├── Cap:   Math.min(damage, GLOBAL_DMG_CAP=999)
├── Round: arredonda para múltiplo de 5
├── Override: context.editMode.damageOutput sobrescreve se definido
│
└── Foto: this.finalDamage = this.damage
```

#### `04_beforeHooks.js` (saltado se mode === "absolute")

```
├── emitCombatEvent("onBeforeDmgDealing", payload, allChampions)
└── emitCombatEvent("onBeforeDmgTaking",  payload, allChampions)

Retornos consolidados:
  r.damage  → sobrescreve this.damage
  r.crit    → sobrescreve this.crit
  r.log/logs → acumula em this.beforeLogs
  r.effects  → acumula em context.extraEffects
```

#### `05_applyDamage.js`

```
defender.takeDamage(this.damage, context)
  → consome escudos regulares (FIFO) antes de debitar HP
  → se HP ≤ 0: defender.alive = false

this.hpAfter   = defender.HP
this.actualDmg = hpBefore - hpAfter

context.registerDamage({
  target: defender,
  amount: this.damage,
  sourceId: attacker.id,
  isCritical: crit.didCrit,
})
```

#### `06_obliterate.js`

```
Se skill.obliterateRule existir && defender vivo && !runtime.preventObliterate:
  threshold = obliterateRule(this)        ← recebe a instância DamageEvent
  editMode.executionOverride?             ← threshold sobrescrito em debug
  se defender.HP/maxHP ≤ threshold && HP > 0:
    defender.HP = 0; defender.alive = false
    context.registerDamage({ flags:{ finishing:true, finishingType:"obliterate" } })
```

#### `07_afterHooks.js`

```
├── emitCombatEvent("onAfterDmgTaking", payload, allChampions)
├── emitCombatEvent("onAfterDmgDealing", payload, allChampions)  ← suprimido se context.isDot
└── _applyLifeSteal()
      → lsRate = attacker.LifeSteal; pula se lsRate<=0 ou actualDmg<=0 ou isDot
      → heal = roundToFive(actualDmg * lsRate / 100), mínimo 5
      → attacker.heal(effectiveHeal, { suppressHealEvents: true })
      → emitCombatEvent("onAfterLifeSteal", ...)
      → popula this.lifesteal = { amount, log, passiveLogs }
```

#### `08_extraQueue.js`

```
Para cada extra em context.extraDamageQueue:
  → context.extraDamageQueue = []  ← limpa fila antes de processar
  → new DamageEvent({
       ...extra,
       allChampions,
       context: { ...ctx, damageDepth: ctx.damageDepth + 1 }
     }).execute()
  → resultados acumulados em this.extraResults
```

#### `09_resultBuilder.js`

```js
// Retorno simples (sem reações):
{
  totalDamage, finalHP, targetId, userId,
  log,         // texto de combate composto
  crit,
  damageDepth,
  skill,
  journey: { base, mitigated, actual }
}

// Com reações (extraResults.length > 0):
[mainResult, ...extraResults]
```

---

### Damage Modes

| Mode         | Comportamento                                                                |
| ------------ | ---------------------------------------------------------------------------- |
| `"standard"` | Pipeline completa com defesa, crit, hooks                                    |
| `"absolute"` | Bypassa prepareDamage, beforeHooks, evasão, escudo — dano direto ao HP       |
| `"hybrid"`   | `piercingPortion` do dano ignora defesa%; o restante passa pela curva normal |

### `damageDepth` e Reações

`context.damageDepth` (padrão `0`) rastreia recursão:

- **`depth === 0`**: Ação principal — gera o envelope `combatAction` principal.
- **`depth >= 1`**: Reação/contra-ataque — gera envelope separado com `skillName: "X (Reação N)"`.

```js
// Passivas que geram dano de reação devem verificar depth:
onAfterDmgTaking({ context }) {
  if (context.damageDepth > 0) return;
  context.extraDamageQueue.push({ attacker: owner, defender: source, baseDamage: 50 });
}
```

### Flags de Skill

| Flag                                | Efeito                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| `cannotBeEvaded: true`              | Pula checagem de evasão em `preChecks`                    |
| `cannotBeBlocked: true`             | Pula checagem de shield block em `preChecks`              |
| `obliterateRule(dmgEvent) → number` | Se HP/maxHP ≤ threshold retornado → mata instantaneamente |

### `isDot` — Supressão de After Hooks

`context.isDot = true` suprime `onAfterDmgDealing`. Use em danos de tick de status-effects para evitar que passivas de "após causar dano" disparem.

---

## 10. Sistema de Contexto e Efeitos Estruturados

### O Objeto `context`

Criado por `createBaseContext()` no servidor a cada execução de skill. Serve como **acumulador de eventos de visualização** — todos os subsistemas registram eventos nos buffers `context.visual.*`.

```js
context = {
  currentTurn: number,
  editMode: object,
  allChampions: Map,
  aliveChampions: Champion[],

  visual: {
    damageEvents:      [],
    healEvents:        [],
    buffEvents:        [],
    resourceEvents:    [],
    shieldEvents:      [],
    dialogEvents:      [],
    redirectionEvents: [],
  },

  damageDepth: number,
  ignoreMinimumFloor: boolean,
  isDot: boolean,
  extraDamageQueue: [],
  extraEffects: [],
}
```

### Métodos de Registro

```js
context.registerDamage({ target, amount, sourceId, isCritical, flags: { evaded?, immune?, shieldBlocked?, obliterate?, isDot? } });
context.registerHeal({ target, amount, sourceId });
context.registerBuff({ target, amount, statName, sourceId });
context.registerShield({ target, amount, sourceId });
context.registerResourceChange({ target, amount, sourceId });
```

### Como os Envelopes São Construídos

```
emitCombatEnvelopesFromContext({ user, skill, context })
  ├── buildMainEnvelopeFromContext()
  │     → filtra context.visual.* onde damageDepth === 0
  │     → gera { action, damageEvents, healEvents, ..., state }
  │     → io.emit("combatAction", mainEnvelope)
  └── buildReactionEnvelopesFromContext()
        → para cada depth > 0:
        → gera envelope separado com skillName: "X (Reação N)"
        → io.emit("combatAction", reactionEnvelope)
```

---

## 11. Fórmulas de Dano e Defesa

### Fórmula de Dano Base

```
baseDamage = (user.Attack × BF / 100) + bonusFlat
```

### Defesa → Redução Percentual

Curva não linear em dois segmentos (`03_composeDamage.js → defenseToPercent`):

**Segmento 1 — Interpolação linear (Defense 0–220):**

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

**Segmento 2 — Cauda assintótica (Defense > 220):**

```
reduction = 0.75 + (0.95 - 0.75) × (1 - e^(-0.0045 × (defense - 220)))
```

Cap: nunca ultrapassa 95%.

### Crítico

- Chance máxima: `MAX_CRIT_CHANCE = 95%`
- Bônus padrão: `DEFAULT_CRIT_BONUS = 55%` (`critBonusOverride` pode sobrescrever)
- Crítico **ignora buffs de defesa**: usa `Math.min(baseDefense, currentDefense)`
- Pode ser forçado (`critOptions.force`) ou bloqueado (`critOptions.disable`)

### Dano Mínimo

`Math.max(damage, 10)`, exceto se `context.ignoreMinimumFloor = true`.

### Cap Global

`DamageEvent.GLOBAL_DMG_CAP = 999`.

---

## 12. Sistema de Afinidades Elementais

### Ciclo Elemental

```
fire → ice → earth → lightning → water → fire → ...
```

Cada elemento é forte contra o próximo e fraco contra o anterior.

### Cálculo

```
Relação         → Efeito
─────────────────────────────────────────────────
weak (fraqueza) → Math.floor(damage * 1.2 + 25)
resist          → Math.max(damage - 40, 0)
neutral         → sem modificação
```

### Declaração

```js
// Campeão:
elementalAffinities: ["lightning"];

// Skill:
element: "lightning";
```

---

## 13. Sistema de Hooks — CombatEvents

**Arquivo**: `shared/engine/combatEvents.js`

`emitCombatEvent(eventName, payload, champions)` itera sobre todos os campeões e dispara o hook em:

1. `champ.passive` — passiva permanente.
2. `champ.runtime.hookEffects` — efeitos temporários (inclui status-effects instalados).

### Tabela de Hooks

| Hook                     | Quando dispara                       | Quem recebe tipicamente   |
| ------------------------ | ------------------------------------ | ------------------------- |
| `onDamageIncoming`       | Antes de qualquer cálculo de dano    | Alvo (imunidades)         |
| `onStatusEffectIncoming` | Antes de aplicar um status-effect    | Alvo (imunidades de CC)   |
| `onValidateAction`       | Antes de o campeão executar uma ação | Usuário (CC que bloqueia) |
| `onBeforeDmgDealing`     | Antes do atacante causar dano        | Atacante                  |
| `onBeforeDmgTaking`      | Antes do alvo receber dano           | Alvo                      |
| `onAfterDmgDealing`      | Após o atacante causar dano          | Atacante                  |
| `onAfterDmgTaking`       | Após o alvo receber dano             | Alvo                      |
| `onAfterLifeSteal`       | Após lifesteal ser aplicado          | Atacante                  |
| `onCriticalHit`          | Quando um crítico ocorre             | Atacante                  |
| `onTurnStart`            | Início de turno                      | Todos                     |
| `onActionResolved`       | Após resolução completa de uma ação  | Todos                     |
| `onChampionDeath`        | Quando um campeão morre              | Todos                     |

### Contrato de Retorno de Hooks

```ts
{
  damage?: number,
  crit?: object,
  ignoreMinimumFloor?: boolean,
  log?: string | string[],
  logs?: string[],
  effects?: Effect[],
  deny?: boolean,      // (onValidateAction) nega a ação
  cancel?: boolean,    // (onDamageIncoming, onStatusEffectIncoming) cancela o evento
  immune?: boolean,    // (onDamageIncoming)
  message?: string,
}
```

### Scopes de Hook

```js
hookScope: {
  onBeforeDmgTaking: "target",
  onAfterDmgDealing: "source",
  onTurnStart: "source",
}
```

Scopes disponíveis: `"source"`, `"source"`, `"target"`, `"sourceOrTarget"`, `"allies"`, ou `undefined` (todos).

### Hook Effects Temporários (`runtime.hookEffects`)

```js
champion.runtime.hookEffects.push({
  key: "efeito_especial",
  expiresAtTurn: context.currentTurn + 2,
  onBeforeDmgTaking({ damage }) {
    return { damage: damage * 0.5 };
  },
});
```

Status-effects instalados via `applyStatusEffect` também chegam aqui (com `group: "statusEffect"`), sendo removidos automaticamente por `purgeExpiredStatusEffects`.

---

## 14. Sistema de StatusEffects

**Pasta**: `shared/data/statusEffects/`

StatusEffects são objetos de comportamento registrados em `effectsRegistry.js`. Quando aplicados, são instalados como `hookEffects` em `champion.runtime.hookEffects`.

### Registry

```js
export const StatusEffectsRegistry = {
  paralisado,
  atordoado,
  enraizado,
  inerte,
  gelado,
  congelado,
  queimando,
  imunidadeAbsoluta,
};
```

### Estrutura

```js
const queimando = {
  key: "queimando",
  name: "Queimando",
  type: "debuff",
  subtypes: ["dot"],

  onTurnStart({ self, context }) {
    const damage = 20;
    self.takeDamage(damage, context);
    context.registerDamage({
      target: self,
      amount: damage,
      sourceId: null,
      isDot: true,
    });
    return { log: `${self.name} sofre dano de Queimadura.` };
  },
};
```

### Ciclo de Vida

```
1. APLICAÇÃO: champion.applyStatusEffect(key, duration, context, metadata)
   ├── Valida registry
   ├── emitCombatEvent("onStatusEffectIncoming") — imunidades podem cancelar
   ├── Registra em champion.statusEffects: Map.set(key, { expiresAtTurn, ...metadata })
   └── Instala hookEffect em runtime.hookEffects
       → StatusIndicator.animateIndicatorAdd(champion, key)

2. DISPARO: emitCombatEvent itera hookEffects normalmente

3. EXPIRAÇÃO: champion.purgeExpiredStatusEffects(currentTurn)
   → statusEffects.delete(key)
   → hookEffects.filter(e => !(e.group==="statusEffect" && e.key===key))
   → StatusIndicator.animateIndicatorRemove(champion, key)
```

### Métodos

```js
champion.applyStatusEffect("queimando", 2, context); // duration=2 turnos
champion.removeStatusEffect("atordoado");
champion.hasStatusEffect("paralisado"); // → boolean
champion.getStatusEffect("gelado"); // → dados ou null
```

### Serialização

```js
// champion.serialize() converte Map para:
statusEffects: [["queimando", { expiresAtTurn: 5 }], ...]
// cliente reconstrói: new Map(snap.statusEffects)
```

---

## 15. Sistema de Escudos (Shields)

```js
// champion.runtime.shields
{
  amount: number,
  type: "regular" | "supremo" | "feitiço" | string,
  source: string,   // skill key
}
```

| Tipo                      | Comportamento                                                      |
| ------------------------- | ------------------------------------------------------------------ |
| `"regular"`               | Absorve HP de dano antes do HP do campeão (dentro de `takeDamage`) |
| `"supremo"` / `"feitiço"` | Bloqueia a **ação inteiramente** (verificado em `preChecks`)       |

Escudos regulares são consumidos em ordem FIFO.

---

## 16. Sistema de Modificadores de Dano

`champion.damageModifiers` — modifica o dano de saída:

```js
{
  name: string,
  apply({ baseDamage, user, target, skill }) → number,
  permanent: boolean,
  expiresAtTurn: number,
}
```

`champion.damageReductionModifiers` — reduz o dano recebido (mesmo formato; acessado via `getTotalDamageReduction()` → `{ flat, percent }`).

---

## 17. Gerenciador de Animações — AnimsAndLogManager

**Arquivo**: `public/js/animation/AnimsAndLogManager.js`

Factory `createCombatAnimationManager(deps)` instanciada em `main.js`.

### Filosofia: Fila Determinística

```
Server emits → handler enqueues → drainQueue() processa um por vez → animações → applyStateSnapshots → next
```

### API Pública

```js
manager.handleCombatAction(envelope);
manager.handleCombatLog(text);
manager.handleGameStateUpdate(gameState);
manager.handleTurnUpdate(turn);
manager.handleChampionRemoved(championId);
manager.handleGameOver(data);
manager.appendToLog(text);
manager.reset();
```

### Processamento de `combatAction`

```
1. handleActionDialog(action)
   └── resolve userName/targetName via activeChampions (fallback: action.*Name)
       → showBlockingDialog

2. for ([key, events] of Object.entries(eventGroups)):
   ├── "damageEvents"      → animateDamage(event)
   ├── "healEvents"        → animateHeal(event)
   ├── "shieldEvents"      → animateShield(event)
   ├── "buffEvents"        → animateBuff(event)
   ├── "resourceEvents"    → animateResourceChange(event)
   ├── "redirectionEvents" → animateTauntRedirection(event)
   └── "dialogEvents"      → showBlockingDialog / showNonBlockingDialog

3. applyStateSnapshots(state)
   └── syncChampionFromSnapshot(champion, snap)
   └── champion.updateUI(options)
   └── syncChampionVFX(champion)
```

### Lógica de `animateDamage`

```
1. evaded !== undefined → animateEvasion; se true: return
2. immune               → animateImmune; return
3. shieldBlocked        → animateShieldBlock; return
4. !obliterate && amount<=0 → return
5. isDot → showBlockingDialog pré-dano
6. Aplica .damage (shake + tint); cria float
7. obliterate → playObliterateEffect; championEl.dataset.obliterated="true"
   senão     → updateVisualHP; isCritical → dialog "CRÍTICO"
```

### `syncChampionFromSnapshot`

```js
function syncChampionFromSnapshot(champion, snap) {
  // HP, maxHP, Attack, Defense, Speed, Evasion, Critical, LifeSteal, ultMeter
  champion.runtime = { ...snap.runtime };
  champion.statusEffects = new Map(snap.statusEffects);
  champion.alive = snap.HP > 0;
}
```

### Damage Tier (Tamanho do Float)

```
>= 251 → tier 6 | >= 151 → tier 5 | >= 101 → tier 4
>= 61  → tier 3 | >= 31  → tier 2 | else   → tier 1
```

### Constantes de Timing

```js
FLOAT_LIFETIME: 1900ms | DEATH_ANIM: 2000ms | DIALOG_DISPLAY: 2350ms
DIALOG_LEAVE:    160ms | BETWEEN_EFFECTS: 60ms | BETWEEN_ACTIONS: 60ms
```

---

## 18. Sistema de VFX — vfxManager

**Arquivos**: `public/js/animation/vfx/`

VFX contínuos renderizados via canvas HTML5 sobre o retrato do campeão.

```
syncChampionVFX(champion)
  ├── Lê champion.runtime.*
  ├── Compara com champion._vfxState
  └── Liga/desliga canvas:
        shield:     runtime.shields.length > 0
        fireStance: runtime.fireStance === "postura" | "brasa_viva"
```

| VFX                | Arquivo               | Ativa quando                          |
| ------------------ | --------------------- | ------------------------------------- |
| `shield`           | `shieldCanvas.js`     | `runtime.shields.length > 0`          |
| `fireStanceIdle`   | `fireStanceCanvas.js` | `runtime.fireStance === "postura"`    |
| `fireStanceActive` | `fireStanceCanvas.js` | `runtime.fireStance === "brasa_viva"` |
| obliterate         | `obliterate.js`       | `playObliterateEffect(el)` — direto   |

```js
import { syncChampionVFX, playVFX, stopVFX } from "./vfx/vfxManager.js";
import { playObliterateEffect } from "./vfx/obliterate.js";

syncChampionVFX(champion);
await playObliterateEffect(championEl);
```

---

## 19. Indicadores de Status — StatusIndicator

**Arquivo**: `shared/ui/statusIndicator.js`

```js
StatusIndicator.updateChampionIndicators(champion);
StatusIndicator.animateIndicatorAdd(champion, key);
StatusIndicator.animateIndicatorRemove(champion, key);
StatusIndicator.startRotationLoop(champions);
StatusIndicator.clearIndicators(champion);
```

```js
statusEffectIcons["nome"] = {
  type: "emoji" | "image" | "text",
  value: string,
  background: string,
  color?: string,
}
```

---

## 20. Histórico de Turnos

Mantido em `match.combat.turnHistory: Map<number, TurnData>`:

```js
{
  events: [{ type, ...data, timestamp }],
  championsDeadThisTurn: [],
  skillsUsedThisTurn: {},    // { [championId]: skillKey[] }
  damageDealtThisTurn: {},   // { [championId]: totalDamage }
}
```

---

## 21. Modo de Edição / Debug

```js
const editMode = {
  enabled: true,
  autoLogin: true,
  autoSelection: false,
  actMultipleTimesPerTurn: false,
  unreleasedChampions: true,
  damageOutput: null, // força dano fixo. null = desativado
  alwaysCrit: false,
  alwaysEvade: false,
  executionOverride: null, // sobrescreve threshold de obliterateRule
};
```

`damageOutput`, `alwaysCrit`, `alwaysEvade` e `executionOverride` são aplicados dentro da pipeline e **não são enviados ao cliente**.

---

## 22. Como Criar um Novo Campeão

### 1. Criar a pasta e o `index.js`

```
shared/data/champions/meu_campeao/
└── index.js
```

### 2. Estrutura do `index.js`

```js
import { DamageEvent } from "../../../engine/DamageEvent.js"; // ← caminho correto

const meu_campeao = {
  name: "Meu Campeão",
  portrait: "/assets/champions/meu_campeao.png",
  unreleased: false,

  HP: 500,
  Attack: 80,
  Defense: 40,
  Speed: 70,
  Evasion: 0,
  Critical: 10,
  LifeSteal: 0,

  elementalAffinities: ["lightning"],

  skills: [
    {
      key: "minha_skill",
      name: "Nome da Skill",
      priority: 0,
      element: "fire",
      cannotBeEvaded: false,
      description() {
        return `Descrição.`;
      },
      targetSpec: ["enemy"],
      resolve({ user, targets, context }) {
        const { enemy } = targets;
        const baseDamage = (user.Attack * 80) / 100 + 30;
        return new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
      },
    },
  ],

  passive: {
    key: "passiva_meu_campeao",
    name: "Nome da Passiva",
    description: "Descrição.",

    hookScope: {
      onAfterDmgDealing: "source",
      onAfterDmgTaking: "target",
    },

    onAfterDmgDealing({
      source,
      target,
      owner,
      damage,
      crit,
      skill,
      context,
    }) {},
    onAfterDmgTaking({ source, target, owner, damage, context }) {},
    onBeforeDmgDealing({
      source,
      target,
      owner,
      damage,
      crit,
      skill,
      context,
    }) {
      return { damage: damage * 1.2 };
    },
    onBeforeDmgTaking({ source, target, owner, damage, crit, skill, context }) {
      return { damage: damage * 0.8 };
    },
    onTurnStart({ owner, context, allChampions }) {},
    onCriticalHit({ source, target, owner, context }) {},
  },
};

export default meu_campeao;
```

### 3. Registrar no índice

```js
// shared/data/champions/index.js
import meu_campeao from "./meu_campeao/index.js";
const championDB = { /* ... */ meu_campeao };
export default championDB;
```

### 4. Criar um Novo Status-Effect

```js
// shared/data/statusEffects/meu_efeito.js
const meuEfeito = {
  key: "meuEfeito", name: "Meu Efeito",
  type: "debuff", subtypes: ["cc"],

  onTurnStart({ self, context }) { ... },
  onDamageIncoming({ dmgReceiver }) { ... },
  onValidateAction({ user }) { ... },
};
export default meuEfeito;

// effectsRegistry.js:
import meuEfeito from "./meuEfeito.js";
export const StatusEffectsRegistry = { /* ... */ meuEfeito };

// statusIndicator.js:
StatusIndicator.statusEffectIcons["meuEfeito"] = {
  type: "emoji", value: "✨", background: "rgba(0,200,255,0.5)"
};
```

### 5. Boas Práticas

- **Dano sempre via `new DamageEvent(params).execute()`** — nunca debite HP diretamente.
- **Registros de cura/buff/escudo via `context.register*()`** — nunca escreva em `context.visual` diretamente.
- **Passivas devem verificar `damageDepth`** antes de enfileirar dano extra: `if (context.damageDepth > 0) return;`
- **`isDot = true`** em danos de tick de status-effects para suprimir `onAfterDmgDealing`.
- **`allChampions`** deve sempre ser passado ao `DamageEvent` se hooks de passivas precisam disparar.
- **Estado de sessão** — use a API de `GameMatch` em vez de acessar `match.combat.*` ou `match.lobby.*` diretamente no server.js.

---

## 23. Decisões de Design e Convenções

### Por que DamageEvent em vez de CombatResolver singleton?

- Cada evento tem seu próprio `this.damage`, `this.crit`, `this.actualDmg`.
- Pipeline linear e legível (`execute()` → etapas numeradas em arquivos separados).
- Recursão (`processExtraQueue`) cria novas instâncias isoladas — sem contaminação de estado.
- O campo `journey` torna debug trivial.

### Por que a pipeline é dividida em 9 arquivos numerados?

Cada arquivo é responsável por exatamente uma etapa. Isso permite:

- Localizar rapidamente onde um bug ocorre (ex: problema de crit → `02_prepareDamage.js`; problema de floor/cap → `03_composeDamage.js`).
- Adicionar/remover/reordenar etapas sem tocar no orquestrador (`DamageEvent.js`).
- Testar etapas individualmente se necessário.

### Por que GameMatch + LobbyState + CombatState?

O `server.js` antes gerenciava `activeChampions`, `pendingActions`, `playerScores` e timers como variáveis locais, dificultando resets limpos e múltiplas salas. Com `GameMatch`:

- O reset de uma partida é um único `match.resetCombat()`.
- LobbyState e CombatState têm responsabilidades claras e separadas.
- A interface pública de `GameMatch` é o único ponto de acesso — o `server.js` não precisa conhecer a estrutura interna.

### Por que status-effects como hookEffects?

Todo comportamento de um status-effect fica no próprio arquivo do efeito. O efeito responde a qualquer hook (`onTurnStart`, `onDamageIncoming`, `onValidateAction`, etc.) sem código especial no servidor ou no `DamageEvent`.

### Por que Server Authoritative?

Num jogo PvP, o cliente não pode ser confiado para computar estado final.

### Por que a fila de animações no cliente?

Socket.IO pode entregar múltiplos eventos em rajada. A fila garante sequencialidade total; `applyStateSnapshots` ao final de cada ação garante consistência visual.

### Convenção: Recursos arredondados para múltiplos de 5

HP, dano, cura e recurso arredondados para múltiplos de 5. Barras se encaixam, números ficam legíveis.

### Aliases de hooks canônicos

| Nome legado       | Nome canônico atual  |
| ----------------- | -------------------- |
| `onBeforeDealing` | `onBeforeDmgDealing` |
| `onBeforeTaking`  | `onBeforeDmgTaking`  |
| `onAfterDealing`  | `onAfterDmgDealing`  |
| `onAfterTaking`   | `onAfterDmgTaking`   |

### `editMode` separado entre server e client

Flags que afetam combate (`damageOutput`, `alwaysCrit`, `alwaysEvade`, `executionOverride`) não são enviadas ao cliente.
