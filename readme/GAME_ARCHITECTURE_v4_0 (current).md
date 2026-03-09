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
7. [Sistema de Ultômetro (ultMeter)](#7-sistema-de-ultômetro-ultmeter)
8. [Pipeline de Combate — DamageEvent](#8-pipeline-de-combate--damageevent)
9. [Sistema de Contexto e Efeitos Estruturados](#9-sistema-de-contexto-e-efeitos-estruturados)
10. [Fórmulas de Dano e Defesa](#10-fórmulas-de-dano-e-defesa)
11. [Sistema de Afinidades Elementais](#11-sistema-de-afinidades-elementais)
12. [Sistema de Hooks — CombatEvents](#12-sistema-de-hooks--combatevents)
13. [Sistema de StatusEffects](#13-sistema-de-statuseffects)
14. [Sistema de Escudos (Shields)](#14-sistema-de-escudos-shields)
15. [Sistema de Modificadores de Dano](#15-sistema-de-modificadores-de-dano)
16. [Gerenciador de Animações — AnimsAndLogManager](#16-gerenciador-de-animações--animsandlogmanager)
17. [Sistema de VFX — vfxManager](#17-sistema-de-vfx--vfxmanager)
18. [Indicadores de Status — StatusIndicator](#18-indicadores-de-status--statusindicator)
19. [Histórico de Turnos](#19-histórico-de-turnos)
20. [Modo de Edição / Debug](#20-modo-de-edição--debug)
21. [Como Criar um Novo Campeão](#21-como-criar-um-novo-campeão)
22. [Decisões de Design e Convenções](#22-decisões-de-design-e-convenções)

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
├── public/                     # Servido estaticamente pelo Express
│   ├── index.html              # Único HTML — SPA com múltiplas "telas" por classe CSS
│   ├── js/
│   │   ├── main.js             # Ponto de entrada do cliente; toda lógica de UI e socket
│   │   └── animation/
│   │       ├── AnimsAndLogManager.js   # Fila de animações e log de combate
│   │       └── vfx/
│   │           ├── vfxManager.js       # Orquestrador de canvas VFX
│   │           ├── shieldCanvas.js     # VFX de escudo
│   │           ├── fireStanceCanvas.js # VFX de postura de fogo
│   │           └── obliterate.js       # VFX de execução/instakill
│   └── styles/
│       ├── style.css           # Layout, componentes, telas
│       └── animations.css      # Keyframes, classes de efeito (damage, heal, buff…)
│
├── shared/                     # Código isomórfico (server + client)
│   ├── core/
│   │   ├── Champion.js         # Classe central do campeão
│   │   ├── DamageEvent.js      # Motor de cálculo de dano (substitui combatResolver.js)
│   │   ├── combatEvents.js     # Sistema de hooks de evento
│   │   ├── statusIndicator.js  # Gerenciador visual de ícones de status
│   │   ├── formatters.js       # HTML formatters (nomes com cor de time)
│   │   ├── id.js               # Gerador de IDs únicos
│   │   └── basicAttack.js      # Definição do ataque básico padrão
│   └── data/
│       ├── championDB.js       # Re-export do índice de campeões
│       ├── champions/
│       │   ├── index.js        # Índice de todos os campeões registrados
│       │   ├── ralia/          # Pasta por campeão
│       │   ├── naelthos/
│       │   └── ...             # (um diretório por campeão)
│       └── statusEffects/      # ← pasta de status-effects (nova)
│           ├── effectsRegistry.js  # Map de todos os status-effects registrados
│           ├── atordoado.js
│           ├── paralisado.js
│           ├── enraizado.js
│           ├── inerte.js
│           ├── gelado.js
│           ├── congelado.js
│           ├── queimando.js
│           └── imunidadeAbsoluta.js
│
└── server/
    └── server.js               # Servidor Express + Socket.IO + toda lógica de jogo
```

> **Nota sobre `DamageEvent`**: `shared/core/combatResolver.js` não existe mais. O motor de combate é agora a classe `DamageEvent` (instância por evento de dano). Qualquer skill ou passiva que antes chamava `CombatResolver.processDamageEvent(params)` agora instancia e executa `new DamageEvent(params).execute()`.

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
2. Cliente exibe grade de campeões. Jogador arrasta/clica para montar uma equipe de 3, definindo a **ordem** (primeiro = frontline, segundo e terceiro = reservas).
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
2. Processa cada ação em ordem via `performSkillExecution(action, context)`:
   - Verifica se o campeão usuário ainda está vivo.
   - Verifica se o alvo ainda está vivo.
   - Executa `skill.resolve({ user, targets, context })` → internamente chama `new DamageEvent(params).execute()`.
   - Emite envelopes `combatAction` para todos os clientes via `emitCombatEnvelopesFromContext`.
3. Aplica efeitos de início de turno: status-effects com `onTurnStart` (ex: `queimando`) disparam via `emitCombatEvent` normalmente.
4. Aplica regen de recurso global para todos os campeões vivos.
5. Aplica eventos do hook `onTurnStart` de passivas.
6. Purga status-effects expirados via `champion.purgeExpiredStatusEffects(currentTurn)`.
7. Limpa ações pendentes, incrementa `currentTurn`, emite `turnUpdate`.

### 4.4 Morte e Substituição

- Se o HP de um campeão chega a 0 dentro de `DamageEvent.applyDamage()`, `target.alive = false`.
- Ao final do processamento de uma ação, o servidor verifica campeões mortos e chama `removeChampionFromGame()`.
- `removeChampionFromGame()`:
  1. Emite `championRemoved` com delay de 2500ms (para animação no cliente).
  2. Remove do `activeChampions`.
  3. Se o time ainda tem campeões de reserva, instancia o próximo.
  4. Se o time ficou sem campeões, o time adversário marca 1 ponto (`playerScores`).
  5. Se algum time atingiu `MAX_SCORE = 2`, emite `gameOver`.
  6. Caso contrário, emite `roundOver` + `gameStateUpdate` + reinicia para nova rodada.

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
    userId: string,          // ID do campeão que agiu
    userName: string,        // Nome formatado (HTML) do atuante
    skillKey: string,
    skillName: string,
    targetId: string | null, // ID do alvo principal
    targetName: string | null// Nome formatado (HTML)
  },

  damageEvents: [
    {
      type: "damage",
      targetId: string,
      sourceId: string,
      amount: number,          // dano final (0 se evadido/imune/bloqueado)
      isCritical: boolean,
      damageDepth: number,     // 0 = ação principal; >0 = reação/contra-ataque
      evaded?: boolean,
      immune?: boolean,
      shieldBlocked?: boolean,
      obliterate?: boolean,    // true = morte instantânea via obliterateRule
      isDot?: boolean,         // true = dano de tick de status-effect
    }
  ],
  healEvents:         [{ type:"heal",              targetId, sourceId, amount }],
  shieldEvents:       [{ type:"shield",            targetId, sourceId, amount }],
  buffEvents:         [{ type:"buff",              targetId, sourceId, amount, statName, targetName?, sourceName? }],
  resourceEvents:     [{ type:"resourceGain"|"resourceSpend", targetId, sourceId, amount, resourceType:"ult" }],
  dialogEvents:       [{ type:"dialog",            message, blocking?, html?, damageDepth? }],
  redirectionEvents?: [{ type:"tauntRedirection",  attackerId, fromTargetId, toTargetId }],

  state: [            // Snapshots do estado pós-ação dos campeões afetados
    { id, HP, maxHP, ultMeter, ultCap, runtime, statusEffects, alive, Attack, Defense, Speed, Evasion, Critical, LifeSteal }
  ]
}
```

> **Sem campo `log` obrigatório no envelope**: logs de texto são emitidos via o evento `combatLog` do Socket.IO separadamente.

> **Reações como envelopes separados**: cada `damageDepth > 0` gera um **segundo `combatAction` distinto**. O cliente os recebe e anima sequencialmente como ações independentes, com `skillName: "X (Reação N)"`.

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
champion.baseAttack, champion.baseDefense, champion.baseSpeed, etc.

// Recurso — Ultômetro
champion.ultMeter    // number — unidades atuais (0 … ultCap)
champion.ultCap      // number — máximo de unidades (padrão: 15)

// Combate
champion.skills      // Skill[] — habilidades do campeão
champion.passive     // objeto passivo com hooks, ou null
champion.statusEffects    // Map<string, { expiresAtTurn, stacks?, ... }>
champion.alive       // boolean
champion.hasActedThisTurn  // boolean (reset a cada turno)
champion.elementalAffinities // string[] — elementos do campeão

// Modificadores
champion.damageModifiers          // DamageMod[]
champion.statModifiers            // StatMod[]
champion.tauntEffects             // TauntEffect[]
champion.damageReductionModifiers // ReductionMod[]

// Runtime (dados temporários de combate)
champion.runtime = {
  shields: Shield[],           // Escudos ativos
  hookEffects: HookEffect[],   // Efeitos temporários com hooks (inclui status-effects instalados)
  currentContext: object,      // Contexto do turno atual (injetado pelo servidor)
  fireStance?: string,         // "postura" | "brasa_viva" — estado do VFX de fogo
  // … campos customizados por campeão
}

// DOM (apenas client)
champion.el          // HTMLElement | null
```

### Métodos de Instância

```js
// Criação
Champion.fromBaseData(baseData, id, team); // Factory estática

// Serialização (para envio via socket)
champion.serialize(); // → plain object seguro para JSON
// statusEffects é serializado como array de entries: [["queimando", {...}], ...]

// HP
champion.takeDamage(amount, context); // Aplica dano, consome escudos regulares primeiro
champion.heal(amount, context);       // → healed (quantidade real curada)

// Recurso (ultMeter)
champion.addUlt({ amount, source?, context? }); // → applied (unidades adicionadas)
champion.spendUlt(cost);                         // → boolean
champion.applyRegenFromDamage(context);
champion.getResourceState();                     // → { type:"ult", current, max }
champion.getSkillCost(skill);                    // → unidades internas

// StatusEffects
champion.applyStatusEffect(key, duration, context, metadata?);
  // Valida via registry → verifica imunidades (onStatusEffectIncoming) → instala hookEffect
champion.removeStatusEffect(name);
champion.hasStatusEffect(name);      // → boolean
champion.getStatusEffect(name);      // → dados ou null
champion.purgeExpiredStatusEffects(currentTurn);
  // Remove expirados de statusEffects + hookEffects; anima remoção via StatusIndicator

// Modificadores
champion.addDamageModifier(mod);
champion.getDamageModifiers();
champion.getTotalDamageReduction(); // → { flat, percent }
champion.purgeExpiredModifiers(currentTurn);

// UI (apenas client)
champion.render(container, handlers); // Cria e insere o elemento DOM
champion.updateUI(options);           // Atualiza HP/ult/skills/escudos/indicadores
champion.destroy();                   // Remove o elemento do DOM

// Utilitário
champion.roundToFive(x);  // Arredonda para múltiplo de 5
```

---

## 7. Sistema de Ultômetro (ultMeter)

Todos os campeões usam o **ultômetro** como sistema unificado de recurso para ultimates.

### Representação Interna

- **Máximo visual**: 5 barras
- **Unidades internas**: 15 (cada barra = 3 unidades)
- **Tipo de dado**: inteiro (NUNCA float)

```js
champion.ultMeter = 0; // 0-15 unidades
champion.ultCap = 15;  // máximo padrão
```

### Ganho de Ultômetro

| Ação                       | Ganho       |
| -------------------------- | ----------- |
| Causar dano (skill normal) | +2 unidades |
| Tomar dano                 | +1 unidade  |
| Curar aliado               | +1 unidade  |
| Bufar aliado               | +1 unidade  |

Skills AoE ou multi-alvo contam **uma única vez por ação**.

### Regen Global

A cada início de turno, todos os campeões vivos recebem `+2 unidades` automaticamente.

### Custo de Ultimates

```js
{
  isUltimate: true,
  ultCost: 4,         // barras (não unidades)
}
// servidor converte: costUnits = ultCost * 3
```

---

## 8. Pipeline de Combate — DamageEvent

**Arquivo**: `shared/core/DamageEvent.js`

`DamageEvent` é uma **classe** (não singleton). Cada evento de dano cria uma instância independente, executa a pipeline completa e retorna um resultado estruturado. É o substituto direto de `CombatResolver.processDamageEvent()`.

### Uso

```js
// Dentro de skill.resolve():
const result = new DamageEvent({
  baseDamage,
  user,            // alias: attacker
  target,
  skill,
  context,
  mode,            // "standard" | "hybrid" | "absolute" (padrão: "standard")
  piercingPortion, // porção que ignora defesa (modo hybrid)
  critOptions,     // { force?, disable? }
  allChampions,    // Map ou array de todos os campeões (necessário para hooks)
}).execute();
```

### Visão de Alto Nível — Fluxo Completo

```
skill.resolve({ user, targets, context })
  └── new DamageEvent(params).execute()
        ├── 1. preChecks()           → imunidade (onDamageIncoming) / evasão / shield block
        ├── 2. prepareDamage()       → crit + modificadores de dano + afinidade elemental
        ├── 3. composeFinalDamage()  → aplica crítico + curva de defesa + piercingPortion + floor
        ├── 4. runBeforeHooks()      → onBeforeDmgDealing + onBeforeDmgTaking
        ├── 5. applyDamage()         → target.takeDamage() + context.registerDamage()
        ├── 6. processObliterateIfNeeded() → skill.obliterateRule?
        ├── 7. runAfterHooks()       → onAfterDmgTaking + onAfterDmgDealing + lifesteal
        ├── 8. processExtraQueue()   → new DamageEvent() recursivo com damageDepth+1
        └── 9. buildFinalResult()    → retorna resultado ou [main, ...extras]

emitCombatEnvelopesFromContext({ user, skill, context })
  ├── buildMainEnvelopeFromContext()    → damageDepth===0 → combatAction principal
  └── buildReactionEnvelopesFromContext() → damageDepth>0 → combatAction por profundidade
```

### Etapas em Detalhe

**1. `preChecks()`**

```
├── onDamageIncoming (via emitCombatEvent)
│     → status-effects com onDamageIncoming (ex: imunidadeAbsoluta) podem retornar { cancel: true }
│     → se cancelado: context.registerDamage({ flags:{immune:true} }); retorna resultado imune
│
├── Evasão? (saltado se mode === "absolute" ou skill.cannotBeEvaded)
│     → DamageEvent._rollEvasion({ attacker, target, context })
│     → se evadido: context.registerDamage({ flags:{evaded:true} }); retorna
│
└── Shield Block? (saltado se mode === "absolute" ou skill.cannotBeBlocked)
      → se bloqueado: context.registerDamage({ flags:{shieldBlocked:true} }); retorna
```

**2. `prepareDamage()`** (saltado se mode === "absolute")

```
├── _processCrit()           → rola crítico; dispara onCriticalHit se acertou
├── _applyDamageModifiers()  → aplica mods do atacante (purge de expirados antes)
└── _applyAffinity()         → verifica skill.element vs target.elementalAffinities
                                → +20%+25 flat (fraqueza) ou -40 flat (resistência)
                                → injeta dialogEvent em context.visual.dialogEvents
                                → seta context.ignoreMinimumFloor = true se não-neutro
```

**3. `composeFinalDamage()`**

```
├── ABSOLUTE: dano passa sem modificação alguma
│
├── STANDARD: aplica crítico (damage += crit.critExtra)
│             → defenseUsed = crit.didCrit ? min(baseDefense, Defense) : Defense
│             → defensePercent = _defenseToPercent(defenseUsed)
│             → damage -= damage * defensePercent   (mitiga pela curva)
│             → damage *= 1 - reductionPercent/100  (redução % extra)
│             → damage -= reductionFlat             (redução flat extra)
│
└── HYBRID:   porção piercing ignora defesa; restante passa pela curva
              → floor: Math.max(damage, 10) se !ignoreMinimumFloor
              → cap: Math.min(damage, GLOBAL_DMG_CAP=999)
              → roundToFive; editMode.damageOutput sobrescreve se definido
```

**4. `runBeforeHooks()`** (saltado se mode === "absolute")

```
├── _applyBeforeDealingPassive() → emitCombatEvent("onBeforeDmgDealing", payload, allChampions)
└── _applyBeforeTakingPassive()  → emitCombatEvent("onBeforeDmgTaking",  payload, allChampions)
    Retornos de hooks são consolidados:
      r.damage  → sobrescreve this.damage
      r.crit    → sobrescreve this.crit
      r.log/logs → acumula em this.beforeLogs
      r.effects  → acumula em context.extraEffects
```

**5. `applyDamage()`**

```
target.takeDamage(this.damage, this.context)
  → consome escudos regulares antes de debitar HP
  → se HP ≤ 0: target.alive = false

context.registerDamage({
  target, amount: this.damage, sourceId: attacker.id, isCritical: crit.didCrit
})
```

**6. `processObliterateIfNeeded()`**

```
Se skill.obliterateRule existir:
  threshold = obliterateRule(this)   ← recebe a instância DamageEvent
  editMode.executionOverride?        ← threshold pode ser sobrescrito em debug
  se target.HP/maxHP ≤ threshold && target.HP > 0:
    target.HP = 0; target.alive = false
    context.registerDamage({ flags:{ isObliterate:true } })
```

**7. `runAfterHooks()`**

```
├── _applyAfterTakingPassive() → onAfterDmgTaking
├── _applyAfterDealingPassive() → onAfterDmgDealing  ← suprimido se context.isDot === true
└── _applyLifeSteal()
      → dispara onAfterLifeSteal em passivas que reagem a lifesteal
```

**8. `processExtraQueue()`**

```
Para cada extra em context.extraDamageQueue:
  new DamageEvent({ ...extra, context: { ...ctx, damageDepth: ctx.damageDepth + 1 } }).execute()
  → resultados vão para this.extraResults
```

**9. `buildFinalResult()`**

```js
// Retorno simples (sem reações):
{ totalDamage, finalHP, targetId, userId, log, crit, damageDepth, skill, journey }

// Com reações:
[mainResult, ...extraResults]

// journey (para debug):
{ base: originalBaseDamage, mitigated: finalDamage, actual: actualDmg }
```

### Damage Modes

| Mode         | Comportamento                                                                  |
| ------------ | ------------------------------------------------------------------------------ |
| `"standard"` | Pipeline completa com defesa, crit, hooks                                      |
| `"absolute"` | Bypassa preChecks, crit, prepareDamage, hooks before — dano aplicado diretamente |
| `"hybrid"`   | `piercingPortion` do dano ignora defesa; o restante passa pela curva normal    |

### `damageDepth` e Reações

`context.damageDepth` (padrão `0`) rastreia recursão:

- **`depth === 0`**: Ação principal — gera o envelope `combatAction` principal.
- **`depth >= 1`**: Reação/contra-ataque — gera envelope separado com `skillName: "X (Reação N)"`.

Passivas que geram dano em reação devem verificar o depth:

```js
onAfterDmgTaking({ context }) {
  if (context.damageDepth > 0) return;
  context.extraDamageQueue.push({ user: owner, target: attacker, baseDamage: 50 });
}
```

### Flags de Skill

| Flag                           | Efeito                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| `cannotBeEvaded: true`         | Pula a checagem de evasão em `preChecks`                              |
| `cannotBeBlocked: true`        | Pula a checagem de shield block em `preChecks`                        |
| `obliterateRule(dmgEvent) → number` | Se HP/maxHP ≤ threshold retornado → mata instantaneamente        |

### `isDot` — Supressão de After Hooks

`context.isDot = true` suprime o disparo de `onAfterDmgDealing`. Use em danos de tick de status-effects (queimando, etc.) para evitar que passivas de "após causar dano" disparem.

---

## 9. Sistema de Contexto e Efeitos Estruturados

### O Objeto `context`

O `context` é criado por `createBaseContext()` no servidor a cada execução de skill. Serve como **acumulador de eventos de visualização** — todos os subsistemas registram seus eventos nos buffers `context.visual.*`.

```js
context = {
  currentTurn: number,
  editMode: object,
  allChampions: Map,        // todos os campeões
  aliveChampions: Champion[], // snapshot de vivos no início da ação

  // ========================
  // VISUAL EVENT BUFFERS
  // ========================
  visual: {
    damageEvents:      [],  // { type:"damage", targetId, sourceId, amount, isCritical, damageDepth,
                            //   evaded?, immune?, shieldBlocked?, isObliterate?, isDot? }
    healEvents:        [],  // { type:"heal",   targetId, sourceId, amount }
    buffEvents:        [],  // { type:"buff",   targetId, sourceId, amount, statName }
    resourceEvents:    [],  // { type:"resourceGain"|"resourceSpend", targetId, sourceId, amount, resourceType:"ult" }
    shieldEvents:      [],  // { type:"shield", targetId, sourceId, amount }
    dialogEvents:      [],  // { type:"dialog", message, blocking?, html?, damageDepth? }
    redirectionEvents: [],  // { type:"tauntRedirection", attackerId, fromTargetId, toTargetId }
  },

  // Flags de comportamento
  damageDepth: number,       // 0 = ação principal; >0 = reação
  ignoreMinimumFloor: boolean,
  isDot: boolean,
  extraDamageQueue: [],      // fila de DamageEvent extras a executar em cascata
  extraEffects: [],          // effects de hooks passados externamente
}
```

### Métodos de Registro no Context

```js
// Registra dano (chamado pelo DamageEvent.applyDamage())
context.registerDamage({
  target,          // objeto Champion
  amount,          // dano final
  sourceId,        // ID do atacante
  isCritical,      // boolean
  flags: {
    evaded?,       // true se evasão bem-sucedida
    immune?,       // true se imunidade absoluta
    shieldBlocked?,
    obliterate?,   // true se morte por obliterateRule
    isObliterate?, // alias de obliterate
    isDot?,        // true se dano de tick
  }
});
// → push em context.visual.damageEvents[]

// Registra cura
context.registerHeal({ target, amount, sourceId });
// → push em context.visual.healEvents[] + dispara onAfterHealing hook

// Registra buff de stat
context.registerBuff({ target, amount, statName, sourceId });
// → push em context.visual.buffEvents[]

// Registra escudo
context.registerShield({ target, amount, sourceId });
// → push em context.visual.shieldEvents[]

// Registra mudança de recurso (ult)
context.registerResourceChange({ target, amount, sourceId });
// → add/spend no ultMeter + push em context.visual.resourceEvents[]
```

### Como os Envelopes São Construídos

Após `skill.resolve()`, o servidor chama `emitCombatEnvelopesFromContext`:

```
emitCombatEnvelopesFromContext({ user, skill, context })
  ├── buildMainEnvelopeFromContext()
  │     → filtra context.visual.* onde damageDepth === 0
  │     → resolve targetName/targetId via activeChampions
  │     → gera { action, damageEvents, healEvents, ..., state }
  │     → io.emit("combatAction", mainEnvelope)
  │
  └── buildReactionEnvelopesFromContext()
        → para cada depth > 0 nos eventos:
        → gera envelope separado com { action:{skillName:"X (Reação N)"}, ... }
        → io.emit("combatAction", reactionEnvelope)
```

> **Por que `context.visual`?** Separa claramente dados de combate (damageDepth, extraDamageQueue, flags) de intenções de animação (eventos de UI). O `DamageEvent` escreve em `context.visual.*` apenas via `context.register*()` — nunca diretamente.

---

## 10. Fórmulas de Dano e Defesa

### Fórmula de Dano Base

```
baseDamage = (user.Attack × BF / 100) + bonusFlat
```

Onde `BF` (Battle Factor) é um parâmetro da skill.

### Defesa → Redução Percentual (`_defenseToPercent`)

Curva não linear em dois segmentos:

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
- `editMode.alwaysCrit` força crítico em todos os ataques

### Dano Mínimo

Após toda a pipeline: `Math.max(damage, 10)`, exceto se `context.ignoreMinimumFloor = true`.

### Cap Global

`DamageEvent.GLOBAL_DMG_CAP = 999`. Nenhum evento de dano singular ultrapassa esse valor.

---

## 11. Sistema de Afinidades Elementais

Camada adicional de modificação de dano aplicada em `prepareDamage()` (após crit e modificadores, antes de `composeFinalDamage`).

### Ciclo Elemental

```
fire → ice → earth → lightning → water → fire → ...
```

Cada elemento é forte contra o próximo e fraco contra o anterior no ciclo.

### Cálculo de Afinidade (`_applyAffinity`)

```
Relação         → Efeito no dano
─────────────────────────────────────────────────
weak (fraqueza) → Math.floor(damage * 1.2 + 25)  (+20% + 25 flat)
resist          → Math.max(damage - 40, 0)        (-40 flat)
neutral         → sem modificação
```

Quando não-neutro: injeta um `dialogEvent` em `context.visual.dialogEvents` e seta `context.ignoreMinimumFloor = true`.

### Declaração em Campeão e Skill

```js
// Campeão:
elementalAffinities: ["lightning"]  // array — pode ter múltiplos

// Skill:
element: "lightning"  // elemento do dano desta skill
```

---

## 12. Sistema de Hooks — CombatEvents

**Arquivo**: `shared/core/combatEvents.js`

`emitCombatEvent(eventName, payload, champions)` itera sobre todos os campeões e dispara o hook correspondente em:

1. `champ.passive` — passiva permanente do campeão.
2. `champ.runtime.hookEffects` — efeitos temporários (incluindo status-effects instalados).

### Tabela de Hooks

| Hook                      | Quando dispara                         | Quem recebe tipicamente  |
| ------------------------- | -------------------------------------- | ------------------------ |
| `onDamageIncoming`        | Antes de qualquer cálculo de dano      | Alvo (imunidades)        |
| `onStatusEffectIncoming`  | Antes de aplicar um status-effect      | Alvo (imunidades de CC)  |
| `onValidateAction`        | Antes de o campeão executar uma ação   | Usuário (CC que bloqueia)|
| `onBeforeDmgDealing`      | Antes do atacante causar dano          | Atacante                 |
| `onBeforeDmgTaking`       | Antes do alvo receber dano             | Alvo                     |
| `onAfterDmgDealing`       | Após o atacante causar dano            | Atacante                 |
| `onAfterDmgTaking`        | Após o alvo receber dano               | Alvo                     |
| `onAfterLifeSteal`        | Após lifesteal ser aplicado            | Atacante                 |
| `onCriticalHit`           | Quando um crítico ocorre               | Atacante                 |
| `onTurnStart`             | Início de turno                        | Todos (status-effects)   |
| `onActionResolved`        | Após resolução completa de uma ação    | Todos                    |
| `onChampionDeath`         | Quando um campeão morre                | Todos                    |

### Contrato de Retorno de Hooks

```ts
{
  damage?: number,              // Override do dano calculado até aqui
  crit?: object,                // Override do resultado de crítico
  ignoreMinimumFloor?: boolean,
  log?: string | string[],      // Texto(s) para o log
  logs?: string[],              // Alias de log[]
  effects?: Effect[],           // Efeitos visuais estruturados para o client
  // hooks de validação/cancelamento:
  deny?: boolean,               // (onValidateAction) nega a ação
  cancel?: boolean,             // (onDamageIncoming, onStatusEffectIncoming) cancela o evento
  immune?: boolean,             // (onDamageIncoming) marca como imune
  message?: string,             // mensagem de log para cancelamentos
}
```

### Scopes de Hook

Cada hook pode declarar `hookScope` para limitar a quais chamadas responde:

```js
hookScope: {
  onBeforeDmgTaking: "target",        // só dispara quando este champ é o alvo
  onAfterDmgDealing: "source",        // só dispara quando este champ é o atacante
  onTurnStart: "self",                // sempre é chamado pelo próprio
}
```

Scopes disponíveis: `"self"`, `"source"`, `"target"`, `"sourceOrTarget"`, `"allies"`, ou `undefined` (todos).

### Hook Effects Temporários (`runtime.hookEffects`)

Skills podem adicionar efeitos temporários diretamente:

```js
champion.runtime.hookEffects.push({
  key: "efeito_especial",
  expiresAtTurn: context.currentTurn + 2,
  onBeforeDmgTaking({ damage }) {
    return { damage: damage * 0.5 };
  }
});
```

Status-effects instalados via `applyStatusEffect` também chegam aqui (com `group: "statusEffect"`), sendo removidos automaticamente por `purgeExpiredStatusEffects`.

---

## 13. Sistema de StatusEffects

**Pasta**: `shared/data/statusEffects/`
**Arquivo de entrada**: `effectsRegistry.js`

StatusEffects são objetos de comportamento registrados num mapa central. Quando aplicados a um campeão, são instalados como `hookEffects` em `champion.runtime.hookEffects`, participando do sistema de hooks exatamente como qualquer outro efeito temporário.

### Registry

```js
// effectsRegistry.js
export const StatusEffectsRegistry = {
  paralisado,
  atordoado,
  enraizado,
  inerte,
  gelado,
  congelado,
  queimando,
  imunidadeAbsoluta,
  // envenenado, sangramento  (a implementar)
};
```

### Estrutura de um Status-Effect

```js
// Exemplo: queimando.js
const queimando = {
  key: "queimando",
  name: "Queimando",
  type: "debuff",          // "buff" | "debuff"
  subtypes: ["dot"],       // categorias opcionais: "cc", "hardCC", "immunity", "dot", ...

  // Hooks — mesma interface de qualquer hookEffect
  onTurnStart({ self, context }) {
    const damage = 20;
    self.takeDamage(damage, context);
    context.registerDamage({ target: self, amount: damage, sourceId: null, isDot: true });
    return { log: `${self.name} sofre dano de Queimadura.` };
  },
};
```

```js
// Exemplo: imunidadeAbsoluta.js
const imunidadeAbsoluta = {
  key: "imunidadeAbsoluta",
  type: "buff",
  subtypes: ["immunity"],

  onDamageIncoming({ dmgReceiver }) {
    return { cancel: true, immune: true, message: `${dmgReceiver.name} é imune a dano!` };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.type !== "debuff") return;
    return { cancel: true, message: `${target.name} é imune a efeitos negativos!` };
  },
};
```

```js
// Exemplo: atordoado.js
const atordoado = {
  key: "atordoado",
  type: "debuff",
  subtypes: ["cc", "hardCC"],

  onValidateAction({ user }) {
    return { deny: true, log: `${user.name} está Atordoado e não pode agir!` };
  },
};
```

### Ciclo de Vida Completo

```
1. APLICAÇÃO: champion.applyStatusEffect(key, duration, context, metadata)
   │
   ├── Valida: StatusEffectsRegistry[key] existe?
   │
   ├── _canApplyStatusEffect():
   │     → emitCombatEvent("onStatusEffectIncoming", { target, statusEffect: behavior }, allChampions)
   │     → imunidadeAbsoluta (ou outra imunidade) pode retornar { cancel: true }
   │     → verifica também se o alvo possui escudos supremos bloqueando CCs
   │
   ├── Registra em champion.statusEffects: Map.set(key, { expiresAtTurn, stacks?, ...metadata })
   │
   └── _attachStatusEffectBehavior():
         → cria effectInstance = { ...behavior, group: "statusEffect", source: key }
         → remove hookEffect anterior com mesmo key (substituição em vez de stack)
         → champion.runtime.hookEffects.push(effectInstance)
         → StatusIndicator.animateIndicatorAdd(champion, key)

2. DISPARO: todo evento de combate (onTurnStart, onDamageIncoming, etc.)
   → emitCombatEvent itera hookEffects normalmente
   → status-effects respondem como qualquer outro hookEffect

3. EXPIRAÇÃO: champion.purgeExpiredStatusEffects(currentTurn)
   → para cada entry em statusEffects cujo expiresAtTurn ≤ currentTurn:
      → statusEffects.delete(key)
      → hookEffects.filter(e => !(e.group==="statusEffect" && e.key===key))
      → StatusIndicator.animateIndicatorRemove(champion, key)
```

### Métodos de Aplicação/Remoção

```js
// Aplicar
champion.applyStatusEffect("queimando", 2, context);
// → duration=2 turnos; expiresAtTurn = currentTurn + duration

// Remover manualmente
champion.removeStatusEffect("atordoado");
// → deleta de statusEffects; remove hookEffect; anima remoção visual

// Verificar
champion.hasStatusEffect("paralisado"); // → boolean
champion.getStatusEffect("gelado");     // → dados do map ou null
```

### StatusEffects com Indicador Visual

| StatusEffect         | Ícone         | Cor de fundo     |
| -------------------- | ------------- | ---------------- |
| `paralisado`         | ⚡🚫⚡        | Laranja          |
| `atordoado`          | 💫            | Branco           |
| `inerte`             | 🔒            | Cinza            |
| `imunidadeAbsoluta`  | (imagem)      | Ciano            |
| `queimando`          | 🔥            | Laranja-vermelho |
| `enraizado`          | 🌱            | Verde            |

Para adicionar ícone a um novo status-effect, adicione entry em `StatusIndicator.statusEffectIcons`.

### Serialização

`champion.serialize()` converte o Map para array de entries:

```js
statusEffects: [["queimando", { expiresAtTurn: 5, stacks: 1 }], ...]
```

O cliente reconstrói com `new Map(snap.statusEffects)` em `syncChampionFromSnapshot`.

---

## 14. Sistema de Escudos (Shields)

Escudos são armazenados em `champion.runtime.shields` como array de objetos:

```js
{
  amount: number,   // HP de escudo restante
  type: "regular" | "supremo" | "feitiço" | string,
  source: string,   // skill key que criou o escudo
}
```

### Tipos de Escudo

| Tipo                      | Comportamento                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `"regular"`               | Absorve HP de dano antes de chegar ao HP do campeão (dentro de `takeDamage`)            |
| `"supremo"` / `"feitiço"` | Bloqueia a **ação inteiramente** (verificado em `preChecks`); não absorve HP             |

Escudos regulares são consumidos em ordem (FIFO). Escudos com `amount <= 0` são removidos em `updateUI()`.

---

## 15. Sistema de Modificadores de Dano

`champion.damageModifiers` modifica o dano de saída do campeão:

```js
{
  name: string,
  apply({ baseDamage, user, target, skill }) → number,
  permanent: boolean,
  expiresAtTurn: number,
}
```

`champion.damageReductionModifiers` reduz o dano recebido (mesmo formato, retornado via `getTotalDamageReduction()` → `{ flat, percent }`).

---

## 16. Gerenciador de Animações — AnimsAndLogManager

**Arquivo**: `public/js/animation/AnimsAndLogManager.js`

Exporta `createCombatAnimationManager(deps)` — factory function instanciada em `main.js` com injeção de dependências.

### Dependências Injetadas (`deps`)

```js
{
  activeChampions: Map,         // campeões ativos no cliente
  createNewChampion: Function,  // factory para instanciar campeão na UI
  getCurrentTurn: Function,
  setCurrentTurn: Function,
  updateTurnDisplay: Function,
  applyTurnUpdate: Function,
  startStatusIndicatorRotation: Function,
  combatDialog: Element,        // elemento DOM do balão de diálogo
  combatDialogText: Element,    // texto interno do balão
  editMode: object,
  onQueueEmpty: Function,       // callback disparado quando a fila esvazia
}
```

### Filosofia: Fila Determinística

**Todos** os eventos de combate passam pela fila antes de serem exibidos:

```
Server emits → handler enqueues → drainQueue() processa um por vez → animações → applyStateSnapshots → next
```

### API Pública

```js
const manager = createCombatAnimationManager(deps);

manager.handleCombatAction(envelope);     // → enqueue("combatAction", envelope)
manager.handleCombatLog(text);            // → enqueue("combatLog", text)
manager.handleGameStateUpdate(gameState); // → enqueue("gameStateUpdate", gameState)
manager.handleTurnUpdate(turn);           // → enqueue("turnUpdate", turn)
manager.handleChampionRemoved(championId);// → enqueue("championRemoved", championId)
manager.handleGameOver(data);             // → enqueue("gameOver", data)
manager.appendToLog(text);               // Acrescenta ao log sem fila (uso pontual)
manager.reset();                         // Limpa a fila e reseta estado
```

### Tipos na Fila

| Tipo              | Handler                     |
| ----------------- | --------------------------- |
| `combatAction`    | `processCombatAction()`     |
| `gameStateUpdate` | `processGameStateUpdate()`  |
| `turnUpdate`      | `processTurnUpdate()`       |
| `championRemoved` | `processChampionRemoved()`  |
| `combatLog`       | `processCombatLog()`        |
| `gameOver`        | `handleGameOver()`          |

### Processamento de `combatAction`

O envelope é desestruturado em `{ action, log, state, ...eventGroups }`. O cliente itera `eventGroups` por chave:

```
1. handleActionDialog(action)
   └── Monta texto "X usou Y em Z" com formatChampionName()
       → resolve userName via activeChampions.get(userId) (preferencial ao nome cru)
       → resolve targetName via activeChampions.get(targetId) ou action.targetName (fallback)
       → showBlockingDialog(dialogText)

2. for ([key, events] of Object.entries(eventGroups)):
   ├── "damageEvents"      → animateDamage(event)
   ├── "healEvents"        → animateHeal(event)
   ├── "shieldEvents"      → animateShield(event)
   ├── "buffEvents"        → animateBuff(event)
   ├── "resourceEvents"    → animateResourceChange(event)
   ├── "redirectionEvents" → animateTauntRedirection(event)
   └── "dialogEvents"      → showBlockingDialog / showNonBlockingDialog + wait(770)

3. applyStateSnapshots(state)
   └── syncChampionFromSnapshot(champion, snap)
   └── champion.updateUI(options)
   └── syncChampionVFX(champion)    ← atualiza canvas VFX com novo runtime
```

### Lógica de `animateDamage`

É o handler mais complexo, pois lida com vários casos especiais na ordem:

```
1. Guarda de evasão: se effect.evaded !== undefined → animateEvasion(effect)
   └── se evaded === true: .evasion CSS + dialog → return (não há dano)
   └── se evaded === false: dialog "falhou em esquivar" → continua

2. Guarda de imunidade: se effect.immune → animateImmune(effect) + return

3. Guarda de shield block: se effect.shieldBlocked → animateShieldBlock(effect) + return

4. Guarda de dano zero: se !obliterate && amount <= 0 → return

5. Se isDot → showBlockingDialog pré-dano

6. Aplica .damage no .champion (shake + tint)
   Cria float: obliterate ? "999" : `-${amount}`
   Classe do float: obliterate ? "obliterate" : `damage-tier-${getDamageTier(amount)}`

7. Se obliterate:
   → updateVisualHP(targetId, -champion.currentHp, 0)
   → playObliterateEffect(championEl)   ← VFX canvas de execução
   → championEl.dataset.obliterated = "true"

8. Senão:
   → updateVisualHP(targetId, -amount, champion.currentHp)
   → se isCritical: showBlockingDialog "UM ACERTO CRÍTICO!"
   → waitForAnimation(championEl, 600) + wait(450) + remove .damage
```

### `syncChampionFromSnapshot`

Função auxiliar que aplica um snapshot de estado do servidor ao Champion local:

```js
function syncChampionFromSnapshot(champion, snap) {
  // Stats
  champion.HP, maxHP, Attack, Defense, Speed, Evasion, Critical, LifeSteal, ultMeter

  // Runtime (shields, hookEffects, fireStance, etc.)
  champion.runtime = { ...snap.runtime };

  // StatusEffects: reconstruído como Map
  champion.statusEffects = new Map(snap.statusEffects);

  // Alive derivado de HP
  champion.alive = snap.HP > 0;
}
```

### `applyStateSnapshots` — Sincronização Final

Após todas as animações de uma ação, para cada campeão no array `state`:

1. `syncChampionFromSnapshot(champion, snap)` — aplica estado autoritativo
2. `champion.updateUI(options)` — recalcula barras, botões, indicadores
3. `syncChampionVFX(champion)` — compara `champion.runtime.*` com `_vfxState` e liga/desliga canvas

### Efeitos Animados — Referência Rápida

| Grupo                             | CSS aplicado                                | Float               |
| --------------------------------- | ------------------------------------------- | ------------------- |
| `damageEvents` (normal)           | `.damage` no `.champion`                    | `-N` tier 1–6       |
| `damageEvents.obliterate`         | `.damage` + `playObliterateEffect()`        | `999`               |
| `damageEvents.evaded=true`        | `.evasion`                                  | —                   |
| `damageEvents.immune`             | Dialog "Imunidade Absoluta!"                | —                   |
| `damageEvents.shieldBlocked`      | Dialog "escudo bloqueou"                    | —                   |
| `healEvents`                      | `.heal` no `.champion`                      | `+N` `.heal-float`  |
| `shieldEvents`                    | `syncChampionVFX` → shieldCanvas            | `🛡️ N`             |
| `buffEvents`                      | `.buff` no `.champion`                      | `+BUFF`             |
| `resourceEvents`                  | —                                           | `±N` barras         |
| `dialogEvents`                    | Dialog blocking ou non-blocking             | —                   |

### Damage Tier (Tamanho do Float)

```js
amount >= 251 → tier 6
amount >= 151 → tier 5
amount >= 101 → tier 4
amount >= 61  → tier 3
amount >= 31  → tier 2
else          → tier 1
```

### Constantes de Timing

```js
FLOAT_LIFETIME:   1900ms  // vida de floats
DEATH_ANIM:       2000ms  // espera pela animação de morte
DIALOG_DISPLAY:   2350ms  // tempo que o dialog fica visível
DIALOG_LEAVE:      160ms  // fade out do dialog
BETWEEN_EFFECTS:    60ms  // gap entre eventos consecutivos
BETWEEN_ACTIONS:    60ms  // gap entre ações
```

### `handleActionDialog` — Resolução de Nomes

O dialog de anúncio de skill resolve nomes **sempre pelo estado local** quando possível:

```js
// Preferência: activeChampions.get(userId) → formatChampionName()
// Fallback:    action.userName (pré-formatado pelo servidor)
const resolvedUserName = userChampion ? formatChampionName(userChampion) : userName;

// Para o alvo: activeChampions.get(targetId) → formatChampionName()
// Fallback:    action.targetName
const resolvedTargetName = targetName || (targetChampion ? formatChampionName(targetChampion) : "Alvo");
```

O `targetId` no cliente é usado **para encontrar o elemento DOM** e para resolver nomes no dialog — nunca para buscar stats ou outros dados.

---

## 17. Sistema de VFX — vfxManager

**Arquivos**: `public/js/animation/vfx/vfxManager.js`, `shieldCanvas.js`, `fireStanceCanvas.js`, `obliterate.js`

VFX contínuos são renderizados via canvas HTML5 sobre o retrato do campeão. Existem enquanto a condição persiste — não apenas na duração de uma animação pontual.

### Arquitetura

```
syncChampionVFX(champion)          ← chamado em applyStateSnapshots e animateShield
  ├── Lê champion.runtime.*
  ├── Compara com champion._vfxState (estado anterior)
  └── Liga/desliga canvas conforme mudanças:
        shield:     runtime.shields.length > 0
        fireStance: runtime.fireStance === "postura" | "brasa_viva"
```

Canvas é criado dentro de `.portrait-wrapper` com classes `vfx-canvas vfx-layer vfx-{type}` e `z-index: 10`.

### VFX Disponíveis

| VFX                | Arquivo               | Ativa quando                          |
| ------------------ | --------------------- | ------------------------------------- |
| `shield`           | `shieldCanvas.js`     | `runtime.shields.length > 0`          |
| `fireStanceIdle`   | `fireStanceCanvas.js` | `runtime.fireStance === "postura"`    |
| `fireStanceActive` | `fireStanceCanvas.js` | `runtime.fireStance === "brasa_viva"` |
| (obliterate)       | `obliterate.js`       | `playObliterateEffect(el)` — chamado diretamente, não via syncChampionVFX |

### API Pública

```js
import { syncChampionVFX, playVFX, stopVFX } from "./vfx/vfxManager.js";
import { playObliterateEffect } from "./vfx/obliterate.js";

syncChampionVFX(champion);          // uso padrão — sincroniza baseado em runtime
playVFX("shield", canvasElement);   // inicia VFX manualmente
stopVFX(canvasElement);             // para e limpa canvas

// Para execução/instakill (chamado por animateDamage quando obliterate=true):
await playObliterateEffect(championEl);
```

### Adicionando Novos VFX

1. Criar `xyzCanvas.js` exportando `startXyz(canvas, data)` → retorna `{ stop() }`.
2. Importar em `vfxManager.js`.
3. Adicionar `case "xyz": controller = startXyz(canvas, data); break;` no `switch` de `playVFX`.
4. Adicionar lógica de detecção em `syncChampionVFX` comparando `champion.runtime.*`.

---

## 18. Indicadores de Status — StatusIndicator

**Arquivo**: `shared/core/statusIndicator.js`

Singleton responsável por criar, atualizar e animar os ícones de status sobre o retrato do campeão.

### API Principal

```js
StatusIndicator.updateChampionIndicators(champion);    // Recria todos com base em statusEffects
StatusIndicator.animateIndicatorAdd(champion, key);    // Pulsa o novo ícone
StatusIndicator.animateIndicatorRemove(champion, key); // Fade out + remoção (1500ms)
StatusIndicator.startRotationLoop(champions);          // Alterna ícones múltiplos a cada 1750ms
StatusIndicator.clearIndicators(champion);             // Remove todos sem animação
```

### Estrutura do Ícone

```js
statusEffectIcons["nome"] = {
  type: "emoji" | "image" | "text",
  value: string,         // emoji, path de imagem, ou texto
  background: string,    // cor rgba do fundo circular
  color?: string,        // cor do texto (para type "text")
}
```

---

## 19. Histórico de Turnos

O servidor mantém `turnHistory: Map<number, TurnData>`:

```js
{
  events: [{ type, ...data, timestamp }],
  championsDeadThisTurn: [],
  skillsUsedThisTurn: {},    // { [championId]: skillKey[] }
  damageDealtThisTurn: {},   // { [championId]: totalDamage }
}
```

---

## 20. Modo de Edição / Debug

```js
const editMode = {
  enabled: true,
  autoLogin: true,
  autoSelection: false,
  actMultipleTimesPerTurn: false,
  unreleasedChampions: true,
  damageOutput: null,          // força dano fixo (ex: 999). null = desativado
  alwaysCrit: false,           // força crítico em todos os ataques
  alwaysEvade: false,          // força evasão bem-sucedida
  executionOverride: null,     // sobrescreve threshold de obliterateRule (number)
};
```

`damageOutput`, `alwaysCrit`, `alwaysEvade` e `executionOverride` são aplicados dentro de `DamageEvent` e **não são enviados ao cliente** por segurança.

---

## 21. Como Criar um Novo Campeão

### 1. Criar a pasta e o `index.js`

```
shared/data/champions/meu_campeao/
└── index.js
```

### 2. Estrutura do `index.js`

```js
import { DamageEvent } from "../../core/DamageEvent.js"; // ← importação correta

const meu_campeao = {
  // === IDENTIDADE ===
  name: "Meu Campeão",
  portrait: "/assets/champions/meu_campeao.png",
  unreleased: false,

  // === STATS BASE ===
  HP: 500, Attack: 80, Defense: 40, Speed: 70,
  Evasion: 0, Critical: 10, LifeSteal: 0,

  // === AFINIDADES (opcional) ===
  elementalAffinities: ["lightning"], // "fire"|"ice"|"earth"|"lightning"|"water"

  // === SKILLS ===
  skills: [
    {
      key: "minha_skill",
      name: "Nome da Skill",
      priority: 0,
      contact: true,
      element: "fire",           // opcional
      cannotBeEvaded: false,
      cannotBeBlocked: false,
      description() { return `Descrição.`; },
      targetSpec: ["enemy"],
      resolve({ user, targets, context }) {
        const { enemy } = targets;
        const baseDamage = (user.Attack * 80) / 100 + 30;

        // ← novo padrão: instanciar DamageEvent
        return new DamageEvent({
          baseDamage,
          user,
          target: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
      },
    },
  ],

  // === ULTIMATE ===
  // {
  //   key: "minha_ultimate",
  //   isUltimate: true,
  //   ultCost: 4,              // barras (não unidades)
  //   description() { return `Custo: ${this.ultCost} barras\nDescrição.`; },
  //   targetSpec: ["enemy"],
  //   resolve({ user, targets, context }) { ... }
  // }

  // === PASSIVA ===
  passive: {
    key: "passiva_meu_campeao",
    name: "Nome da Passiva",
    description: "Descrição.",

    // Scopes opcionais (limita a quem o hook responde):
    hookScope: {
      onAfterDmgDealing: "source",
      onAfterDmgTaking: "target",
    },

    onAfterDmgDealing({ attacker, target, damage, crit, skill, context }) {
      // chamado após causar dano (NÃO dispara se context.isDot)
    },
    onAfterDmgTaking({ attacker, target, damage, context }) {
      // chamado após receber dano
    },
    onBeforeDmgDealing({ attacker, target, damage, crit, skill, context }) {
      return { damage: damage * 1.2 }; // pode retornar modificações
    },
    onBeforeDmgTaking({ dmgSrc, dmgReceiver, damage, crit, skill, context }) {
      return { damage: damage * 0.8, ignoreMinimumFloor: false };
    },
    onTurnStart({ self, owner, context, allChampions }) {
      // chamado no início do turno
    },
    onCriticalHit({ attacker, critSrc, target, context }) {
      // chamado quando este campeão acerta um crítico
    },
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

### 4. Como Criar um Novo Status-Effect

```js
// shared/data/statusEffects/meu_efeito.js
const meuEfeito = {
  key: "meuEfeito",
  name: "Meu Efeito",
  type: "debuff",          // "buff" | "debuff"
  subtypes: ["cc"],        // opcional

  // Qualquer hook da tabela do sistema de hooks pode ser usado:
  onTurnStart({ self, context }) { ... },
  onDamageIncoming({ dmgReceiver }) { ... },
  onValidateAction({ user }) { ... },
};
export default meuEfeito;

// Registrar em effectsRegistry.js:
import meuEfeito from "./meuEfeito.js";
export const StatusEffectsRegistry = { /* ... */ meuEfeito };

// Adicionar ícone em statusIndicator.js:
StatusIndicator.statusEffectIcons["meuEfeito"] = {
  type: "emoji", value: "✨", background: "rgba(0,200,255,0.5)"
};
```

### 5. Boas Práticas

- **Dano sempre via `new DamageEvent(params).execute()`** — nunca debite HP diretamente. O DamageEvent lida com escudos, evasão, crítico, lifesteal, hooks, obliterateRule etc.
- **Registros de cura/buff/escudo via `context.register*()`** — nunca modifique `context.visual` diretamente.
- **Passivas devem verificar `damageDepth`** antes de enfileirar dano extra: `if (context.damageDepth > 0) return;`
- **`isDot = true`** em danos de tick de status-effects para suprimir `onAfterDmgDealing`.
- **Status-effects**: use `champion.applyStatusEffect(key, duration, context)` — o sistema cuida de imunidades, instalação de hooks e animação visual automaticamente.
- **Escudos regulares**: `champion.runtime.shields.push({ amount: X, type: "regular", source: skill.key })` + `context.registerShield({ target, amount })` para notificar o cliente.
- **Ultimates**: declare `isUltimate: true` e `ultCost: N` em barras — o servidor valida e debita via `spendUlt()` automaticamente.
- **allChampions** deve sempre ser passado ao DamageEvent se hooks de passivas precisam ser disparados (praticamente sempre).

---

## 22. Decisões de Design e Convenções

### Por que DamageEvent em vez de CombatResolver singleton?

O `CombatResolver` era um objeto com métodos estáticos que mantinham estado via closures e variáveis locais — o que tornava difícil rastrear o estado de um evento de dano individual. `DamageEvent` como classe instanciada por evento:

- Cada evento tem seu próprio `this.damage`, `this.crit`, `this.actualDmg`, etc.
- A pipeline de execução é linear e legível (`execute()` → etapas numeradas).
- Recursão (`processExtraQueue`) cria novas instâncias isoladas, evitando contaminação de estado entre evento principal e reações.
- O campo `journey` (`{ base, mitigated, actual }`) torna debug trivial.

### Por que status-effects como hookEffects?

O sistema antigo tinha `statusEffectTurnEffects.js` — um arquivo separado que mapeava keys para funções de `onTurnStart`. Isso significava que a lógica de um status-effect estava fragmentada em dois lugares: definição e efeito por turno.

A abordagem atual coloca **todo comportamento** de um status-effect no próprio arquivo do efeito (hooks de qualquer tipo: `onTurnStart`, `onDamageIncoming`, `onValidateAction`, etc.). O efeito é instalado como `hookEffect` em `runtime.hookEffects` e automaticamente participal de `emitCombatEvent` como qualquer outro hookEffect. Isso significa:

- `queimando` com `onTurnStart` → dispara no início de turno sem código especial no servidor.
- `imunidadeAbsoluta` com `onDamageIncoming` → cancela dano sem código especial no `DamageEvent`.
- `atordoado` com `onValidateAction` → bloqueia ação sem código especial na validação de skills.

### Por que Server Authoritative?

Num jogo PvP, permitir que o cliente compute o estado final criaria espaço para trapaça. Toda validação ocorre no servidor.

### Por que a fila de animações no cliente?

Socket.IO pode entregar múltiplos eventos em rajada. A fila garante sequencialidade total e `applyStateSnapshots` ao final de cada ação garante consistência visual mesmo se uma animação pulou etapas.

### Convenção: Recursos arredondados para múltiplos de 5

Todos os valores de HP, dano, cura e recurso são arredondados para múltiplos de 5. Segmentos de barra se encaixam, números ficam legíveis, balanceamento simplificado.

### Aliases de hooks e migração de nomes

| Nome antigo (legado)  | Nome canônico atual  |
| --------------------- | -------------------- |
| `onBeforeDealing`     | `onBeforeDmgDealing` |
| `onBeforeTaking`      | `onBeforeDmgTaking`  |
| `onAfterDealing`      | `onAfterDmgDealing`  |
| `onAfterTaking`       | `onAfterDmgTaking`   |

Migração incremental: `emitCombatEvent` suporta ambos os nomes enquanto campeões são atualizados individualmente. Novos campeões e status-effects sempre usam os nomes canônicos.

### Aliases de payload e `self`/`owner`

`onTurnStart` e alguns outros hooks recebem `{ self, owner, champion }` como aliases para o mesmo campeão (por compatibilidade histórica). Novos hooks devem usar `self` como alias canônico.

### O servidor envia nomes; o cliente não resolve texto a partir de IDs

O servidor envia `targetName` e `sourceName` prontos em cada event onde são necessários para texto. O `targetId` no cliente é usado **exclusivamente** para encontrar o elemento DOM — nunca para resolver nomes ou stats.

### `editMode` separado entre server e client

Flags que afetam o resultado do combate (`damageOutput`, `alwaysCrit`, `alwaysEvade`, `executionOverride`) não são enviadas ao cliente. O cliente só recebe flags de UI (`enabled`, `actMultipleTimesPerTurn`, `unreleasedChampions`, `freeCostSkills`).
