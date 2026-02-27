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
9. [Sistema de Contexto e Efeitos Estruturados](#9-sistema-de-contexto-e-efeitos-estruturados)
10. [Fórmulas de Dano e Defesa](#10-fórmulas-de-dano-e-defesa)
11. [Sistema de Afinidades Elementais](#11-sistema-de-afinidades-elementais)
12. [Sistema de Hooks — CombatEvents](#12-sistema-de-hooks--combatevents)
13. [Sistema de Keywords](#13-sistema-de-keywords)
14. [Sistema de Escudos (Shields)](#14-sistema-de-escudos-shields)
15. [Sistema de Modificadores de Dano](#15-sistema-de-modificadores-de-dano)
16. [Gerenciador de Animações — AnimsAndLogManager](#16-gerenciador-de-animações--animsandlogmanager)
17. [Indicadores de Status — StatusIndicator](#17-indicadores-de-status--statusindicator)
18. [Histórico de Turnos](#18-histórico-de-turnos)
19. [Modo de Edição / Debug](#19-modo-de-edição--debug)
20. [Como Criar um Novo Campeão](#20-como-criar-um-novo-campeão)
21. [Decisões de Design e Convenções](#21-decisões-de-design-e-convenções)

---

## 1. Visão Geral

**Champion Arena** é um jogo de arena turn-based multiplayer 1v1, jogado no browser. Dois jogadores se conectam via Socket.IO, selecionam equipes de 3 campeões cada, e alternam turnos usando habilidades até que um time seja eliminado. O formato é melhor-de-3 rodadas (primeiro a 2 pontos vence).

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
   - Executa `skill.execute({ user, targets, context })` → acumula eventos no `context.*Events`.
   - Chama `buildEffectsFromContext(context)` → transforma todos os eventos acumulados num único `effects[]` estruturado.
   - Chama `emitCombatEnvelopesFromResults(results, context)` → emite envelopes `combatAction` para todos os clientes.
3. Aplica efeitos de início de turno (keywords: `queimando`, `envenenado`).
4. Aplica regen de recurso global (`BASE_REGEN = 80`) para todos os campeões vivos.
5. Aplica eventos do hook `onTurnStart` de passivas.
6. Limpa ações pendentes, incrementa `currentTurn`, emite `turnUpdate`.

### 4.4 Morte e Substituição

- Se o HP de um campeão chega a 0 dentro de `processDamageEvent`, `target.alive = false`.
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

O envelope é o contrato principal entre servidor e cliente para comunicar o resultado de uma skill. **O servidor é responsável por incluir toda a informação necessária para a renderização — o cliente não precisa fazer lookups no `activeChampions` Map para montar nomes ou contexto.**

```js
{
  action: {
    userId: string,         // ID do campeão que agiu
    skillKey: string,       // Chave da skill usada
    skillName: string,      // Nome legível
    targetId: string | null // ID do alvo principal (para diálogo)
  },
  effects: [                // Lista de efeitos visuais, em ordem — gerados por buildEffectsFromContext()
    {
      // --- Campos presentes em todos os tipos ---
      type: "damage" | "heal" | "shield" | "buff" | "evasion" | "resourceGain"
            | "keywordApplied" | "keywordRemoved" | "immune" | "gameOver"
            | "shieldBlock" | "taunt" | "bonusAttack" | "dialog",
      targetId: string,       // ID do campeão afetado
      sourceId?: string,      // ID do campeão que originou o efeito
      targetName?: string,    // ✅ Nome legível do alvo (enviado pelo servidor)
      sourceName?: string,    // ✅ Nome legível da fonte (enviado pelo servidor)

      // --- Campos do tipo "damage" ---
      amount?: number,        // Dano causado (após escudos e defesa)
      isCritical?: boolean,   // Se foi golpe crítico
      evaded?: boolean,       // Se o alvo evadiu
      immune?: boolean,       // Se o alvo estava imune
      shieldBlocked?: boolean,// Se um escudo supremo/feitiço bloqueou a ação
      damageDepth?: number,   // 0 = ação principal, >0 = reação/contra-ataque

      // --- Campos do tipo "dialog" ---
      message?: string,       // Texto do diálogo
      blocking?: boolean,     // true = aguarda exibição (padrão); false = não bloqueante
      html?: boolean,         // true = renderiza innerHTML em vez de textContent
    }
  ],
  log: string,              // Texto completo HTML do log de combate
  state: [                  // Snapshots de estado dos campeões afetados
    { id, HP, maxHP, mana?, energy?, runtime, keywords, ... }
  ]
}
```

> **Nota arquitetural**: `targetName` e `sourceName` são enviados pelo servidor com os nomes já formatados. O cliente os usa diretamente para exibir texto — sem precisar resolver IDs no `activeChampions` Map.

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
champion.elementalAffinities // string[] — elementos do campeão (ex: ["lightning"])

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

## 7. Sistema de Ultômetro (ultMeter)

Todos os campeões usam o **ultômetro** como sistema unificado de recurso para habilidades definitivas (ultimates).

### Representação Interna

- **Máximo**: 5 barras visuais
- **Unidades internas**: 15 (cada barra = 3 unidades)
- **Tipo de dado**: inteiro (NUNCA float)
- **Cor visual**: Dourado (#d4af37)

```js
champion.ultMeter = 0;      // Valor atual (0-15 unidades)
champion.ultCap = 15;        // Máximo (padrão: 15)
```

### Ganho de Ultômetro

O ganho ocorre **por ação** (não por hit individual):

| Ação                          | Ganho      |
| ----------------------------- | ---------- |
| Causar dano (skill normal)    | +2 unidades |
| Causar dano (ultimate)        | +1 unidade  |
| Tomar dano                    | +1 unidade  |
| Curar aliado                  | +1 unidade  |
| Bufar aliado                  | +1 unidade  |
| Ultimate que não causa dano   | 0 unidades  |

**Importante**: Skills AoE ou multi-alvo contam **uma única vez por ação**, não uma vez por alvo atingido.

### Regen Global

A cada **início de turno**, todos os campeões vivos recebem `+2 unidades` de ultômetro automaticamente (via `applyGlobalTurnRegen`). Isso garante economia estável e progressão previsível.

### Custo de Ultimates

Ultimates são identificadas por:

```js
{
  key: "ultimate_skill",
  name: "Nome da Ultimate",
  isUltimate: true,        // Flag obrigatória
  ultCost: 4,              // Custo em BARRAS (não unidades)
  execute({ user, targets, context }) { ... }
}
```

O servidor converte barras para unidades internas:

```js
const costUnits = skill.ultCost * 3;  // 4 barras = 12 unidades
```

### Validação no Servidor

Quando um jogador tenta usar uma skill:

```js
// 1. Verificar se é ultimate
if (skill.isUltimate) {
  const cost = getSkillCost(skill);  // ultCost * 3
  
  // 2. Verificar ultômetro
  if (user.ultMeter < cost) {
    return denySkill("Ultômetro insuficiente");
  }
  
  // 3. Debitar custo
  user.spendUlt(cost);
}
```

### Métodos da Classe Champion

```js
// Adicionar ultômetro
champion.addUlt(amount);
champion.addUlt({ amount, source, context });

// Gastar ultômetro
champion.spendUlt(cost);  // retorna false se insuficiente

// Alterar diretamente
champion.applyUltChange({ amount, mode: "add" | "set" });

// Obter estado
champion.getResourceState();  // → { type: "ult", current, max }

// Obter custo de skill (client-side)
champion.getSkillCost(skill);  // converte barras → unidades
```

### Diferenças do Sistema Antigo (Mana/Energia)

| Sistema Antigo                    | Sistema Novo (ultMeter)              |
| --------------------------------- | ------------------------------------ |
| Mana (azul) ou Energia (amarelo)  | Ultômetro (dourado) - único recurso  |
| Regen de 50-80 por turno          | Regen fixo de +2 unidades por turno |
| Regen variável ao causar dano     | Ganho fixo por tipo de ação          |
| `skill.manaCost` / `energyCost`   | `skill.isUltimate` + `skill.ultCost` |
| Skills comuns custam recurso      | Skills comuns não custam recurso     |
| Todas skills custam recurso       | Apenas ultimates custam ultômetro    |

### Economia de Jogo

Com o sistema de ultômetro:

- **Inevitabilidade**: Todos os jogadores chegam à primeira ultimate naturalmente (regen global + ganhos por ação)
- **Incentivo ofensivo**: Ações agressivas (causar dano) geram mais ultômetro que defensivas
- **Controle de ritmo**: Ultimates de 5 barras (15 unidades) levam ~6-8 turnos para carregar
- **Sem snowball**: Ganhos são fixos por ação, não escalam exponencialmente
- **Espaço de design**: Permite ultimates de 3-5 barras com timing bem diferenciado
---

## 8. Pipeline de Combate — CombatResolver

**Arquivo**: `shared/core/combatResolver.js`

O `CombatResolver` é um objeto singleton (não uma classe) com todos os métodos de cálculo de dano. O método central é `processDamageEvent()`.

### Visão de Alto Nível — Fluxo Completo de uma Ação

```
performSkillExecution(action, context)
  └── skill.execute({ user, targets, context })
        └── CombatResolver.processDamageEvent({ ... })
              ├── [pipeline de dano — ver abaixo]
              ├── registerDamage(context, { ... })   ← acumula em context.damageEvents[]
              ├── lifesteal / regen → context.resourceEvents[]
              └── extraDamageQueue → processDamageEvent() recursivo (damageDepth++)

  ← resultado(s) retornados para performSkillExecution

  └── buildEffectsFromContext(context)
        ├── context.damageEvents[]   → effects type "damage"
        ├── context.healEvents[]     → effects type "heal"
        ├── context.buffEvents[]     → effects type "buff"
        ├── context.resourceEvents[] → effects type "resourceGain"
        ├── context.keywordEvents[]  → effects type "keywordApplied" / "keywordRemoved"
        ├── context.shieldEvents[]   → effects type "shield"
        └── extraEffects de hooks    → mesclados na ordem correta

  └── emitCombatEnvelopesFromResults(results, context)
        └── io.emit("combatAction", { action, effects, log, state })
```

> **⚠️ Antes (sistema antigo, removido)**: O servidor extraía efeitos via `extractEffectsFromResult()` lendo os campos do resultado ou fazendo parsing de strings de log. Esse sistema foi **completamente substituído** por acumulação programática no `context`. Nenhum efeito é mais extraído de texto.

### `processDamageEvent(params)` — Etapas em Ordem

```
params = {
  mode,           // "raw" | "direct" | "magic" | etc.
  baseDamage,     // dano antes de qualquer cálculo
  directDamage,   // dano adicional direto (ignora defesa)
  user,           // Champion atacante
  target,         // Champion alvo
  skill,          // objeto Skill
  context,        // contexto do turno — acumula *Events
  options,        // { force: bool, disable: bool } para crítico
  allChampions    // Map ou Array de todos os campeões
}
```

```
1. PRÉ-CHECAGENS
   ├── Imunidade absoluta?
   │     → registra context.damageEvents[]{immune:true}; retorna
   ├── Shield Block? → consome escudo supremo/feitiço
   │     → registra context.damageEvents[]{shieldBlocked:true}; retorna
   └── Esquiva? → roll aleatório vs target.Evasion%
         → registra context.damageEvents[]{evaded:true}; retorna

2. CÁLCULO DO DANO
   ├── processCrit()                  → { didCrit, bonus, critExtra }
   ├── _applyDamageModifiers()        → aplica mods do atacante
   ├── _applyBeforeDealingPassive()   → hook onBeforeDmgDealing
   │     pode retornar: { damage?, crit?, logs?, effects? }
   └── _composeFinalDamage()          → aplica defesa e crítico

3. APLICAÇÃO DO DANO  ← beforeTake opera sobre o finalDamage já composto
   ├── _applyBeforeTakingPassive()    → hook onBeforeDmgTaking
   │     pode retornar: { damage?, crit?, ignoreMinimumFloor?, logs?, effects? }
   ├── _getAffinityDamage()           → ajuste elemental (weak +20%+25 | resist -40)
   ├── _applyDamage()                 → debita HP, consome escudos regulares
   └── registerDamage(context, {      ← ✅ acumula no contexto (não constrói log)
         targetId, sourceId,
         targetName, sourceName,
         amount, isCritical,
         damageDepth, skill
       })

4. AFTER HOOKS
   ├── _applyAfterTakingPassive()    → hook onAfterDmgTaking
   │     pode retornar: { logs?, effects? }
   └── _applyAfterDealingPassive()   → hook onAfterDmgDealing
         pode retornar: { logs?, effects? }

5. EFEITOS SECUNDÁRIOS
   ├── applyRegenFromDamage()  → context.resourceEvents[]
   ├── _applyLifeSteal()       → champion.heal(); context.healEvents[]
   └── extraDamageQueue        → processDamageEvent() recursivo com damageDepth+1

6. RETORNO
   → {
       baseDamage, totalDamage, finalHP, totalHeal, heal,
       targetId, userId, evaded, log, crit, skill,
       damageDepth,             // 0 = ação principal; >0 = reação
       extraEffects?: Effect[]  // effects de hooks, mesclados por buildEffectsFromContext
     }
   → Ou array [mainResult, ...extraResults] se houver dano extra via extraDamageQueue
```

> **⚠️ Atenção: ordem do pipeline** — `_applyBeforeTakingPassive` é chamado **depois** de `_composeFinalDamage`. O hook do alvo recebe e pode modificar o `finalDamage` já calculado com defesa e crítico, não o `baseDamage` bruto.

### `damageDepth` — Ações Principais vs Reações

`context.damageDepth` (padrão `0`) rastreia quantos níveis de profundidade o dano atual está:

- **`depth === 0`**: Ação principal iniciada pelo jogador.
- **`depth >= 1`**: Reação — contra-ataque, dano refletido, passiva que causa dano secundário.

Passivas que geram dano extra devem verificar o `damageDepth` antes de enfileirar em `context.extraDamageQueue` para evitar recursão infinita:

```js
onAfterDmgTaking({ damage, context }) {
  if (context.damageDepth > 0) return; // evita cascata infinita
  context.extraDamageQueue = context.extraDamageQueue || [];
  context.extraDamageQueue.push({ user: self, target: attacker, baseDamage: 50, ... });
}
```

O `damageDepth` também é propagado para o effect `"damage"` enviado ao cliente, permitindo que a UI distinga animações de ações principais de reações.

### Damage Modes

| Mode       | Comportamento                              |
| ---------- | ------------------------------------------ |
| `"raw"`    | Dano base passando pela defesa normalmente |
| `"direct"` | Ignora defesa inteiramente                 |
| `"magic"`  | Pode ter tratamento especial por passivas  |

---

## 9. Sistema de Contexto e Efeitos Estruturados

Esta seção documenta o sistema que substitui completamente a extração de efeitos a partir de resultados ou parsing de logs.

### O Objeto `context`

O `context` é um objeto criado pelo servidor no início de cada execução de skill e passado por toda a pipeline. Ele serve como **acumulador de eventos** — em vez de retornar efeitos em estruturas aninhadas ou extraí-los de logs de texto, cada subsistema registra seus eventos diretamente no contexto:

```js
context = {
  currentTurn: number,
  allChampions: Map | Champion[],
  damageDepth: number,          // profundidade de recursão de dano

  // Arrays de eventos — preenchidos durante a execução
  damageEvents: [],             // { targetId, sourceId, targetName, sourceName, amount, isCritical, evaded, immune, shieldBlocked, damageDepth }
  healEvents: [],               // { targetId, sourceId, targetName, sourceName, amount }
  buffEvents: [],               // { targetId, sourceId, buffName, ... }
  resourceEvents: [],           // { targetId, sourceId, amount, resourceType }
  keywordEvents: [],            // { targetId, keyword, action: "add"|"remove" }
  shieldEvents: [],             // { targetId, amount, shieldType }
  extraEffects: [],             // effects extras vindos de hooks (type livre)

  // Flags de comportamento
  ignoreMinimumFloor: boolean,
  isDot: boolean,               // true = dano de tick (DoT); suprime onAfterDmgDealing
  extraDamageQueue: [],         // fila de processDamageEvent() a executar em cascata
  extraLogs: [],                // logs extras para o log de combate
}
```

### `registerDamage(context, payload)`

Função chamada pelo `CombatResolver` após `_applyDamage()` para acumular o evento de dano no contexto:

```js
registerDamage(context, {
  targetId: target.id,
  sourceId: user.id,
  targetName: target.name, // nome puro (sem HTML)
  sourceName: user.name,
  amount: finalDamage,
  isCritical: crit.didCrit,
  evaded: false,
  immune: false,
  shieldBlocked: false,
  damageDepth: context.damageDepth ?? 0,
  skill,
});
// → push em context.damageEvents[]
```

Para casos especiais (Esquiva, imunidade, bloqueio de escudo), os campos booleanos correspondentes são `true` e `amount` é `0`.

### `buildEffectsFromContext(context)`

Chamada pelo servidor **após** `skill.execute()` retornar, transforma todos os arrays de eventos do contexto num único `Effect[]` ordenado:

```js
function buildEffectsFromContext(context) {
  const effects = [];

  for (const ev of context.damageEvents) {
    effects.push({
      type: "damage",
      targetId: ev.targetId,
      sourceId: ev.sourceId,
      targetName: ev.targetName,
      sourceName: ev.sourceName,
      amount: ev.amount,
      isCritical: ev.isCritical,
      evaded: ev.evaded,
      immune: ev.immune,
      shieldBlocked: ev.shieldBlocked,
      damageDepth: ev.damageDepth,
    });
  }

  for (const ev of context.healEvents) {
    effects.push({ type: "heal", targetId: ev.targetId, amount: ev.amount, ... });
  }

  for (const ev of context.resourceEvents) {
    effects.push({ type: "resourceGain", targetId: ev.targetId, amount: ev.amount, resourceType: ev.resourceType });
  }

  // ... idem para buffEvents, keywordEvents, shieldEvents

  // Mescla extraEffects de hooks na posição correta
  effects.push(...context.extraEffects);

  return effects;
}
```

A ordem dos effects no array resultante determina a ordem de animação no cliente. Effects de dano da ação principal (`damageDepth === 0`) vêm antes de reações (`damageDepth > 0`).

### `emitCombatEnvelopesFromResults(results, context)`

Após `buildEffectsFromContext`, o servidor monta e emite os envelopes:

```js
function emitCombatEnvelopesFromResults(results, context) {
  const effects = buildEffectsFromContext(context);
  const state = buildStateSnapshots(context.affectedChampions);
  const log = buildCombatLog(context);

  io.emit("combatAction", {
    action: { userId, skillKey, skillName, targetId },
    effects,
    log,
    state,
  });
}
```

### Por que este modelo?

| Sistema antigo (removido)                                              | Sistema atual                                             |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| `extractEffectsFromResult(result)` — lia campos do objeto de resultado | `buildEffectsFromContext(context)` — lê arrays acumulados |
| Parsing de strings de log para detectar imunidade/bloqueio             | Flags booleanas estruturadas no evento                    |
| `resultsGroup` — agrupamento intermediário de resultados               | Sem agrupamento — um único `context` acumula tudo         |
| Cliente resolvia `targetName` via `activeChampions.get(id).name`       | Servidor envia `targetName` / `sourceName` prontos        |

> **Regra**: nenhum novo código deve extrair informação de strings de log ou fazer parsing textual de resultados. Todo efeito deve ser registrado programaticamente nos arrays do `context`.

---

## 10. Fórmulas de Dano e Defesa

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

## 11. Sistema de Afinidades Elementais

O sistema elemental é uma camada adicional de modificação de dano aplicada **após** `_composeFinalDamage` e **após** `_applyBeforeTakingPassive`, imediatamente antes de `_applyDamage`.

### Ciclo Elemental

Os elementos seguem um ciclo de força/fraqueza circular:

```
fire → ice → earth → lightning → water → fire → ...
```

Cada elemento é **forte** contra o próximo no ciclo e **fraco** contra o anterior:

```
fire     é forte contra ice,       fraco contra water
ice      é forte contra earth,     fraco contra fire
earth    é forte contra lightning, fraco contra ice
lightning é forte contra water,    fraco contra earth
water    é forte contra fire,      fraco contra lightning
```

### Como Declarar Afinidade em um Campeão

```js
const voltexz = {
  name: "Voltexz",
  // ...stats...
  elementalAffinities: ["lightning"], // array — pode ter múltiplas afinidades
};
```

### Como Declarar Elemento em uma Skill

```js
{
  key: "minha_skill",
  name: "Relâmpago",
  element: "lightning",   // elemento do dano desta skill
  execute({ user, targets, context }) { ... }
}
```

### Cálculo de Afinidade (`_getAffinityDamage`)

```
Relação         → Efeito no dano final
─────────────────────────────────────────────────────
weak (fraqueza) → Math.floor(damage * 1.2 + 25)   (+20% + 25 flat)
resist          → Math.max(damage - 40, 0)         (-40 flat)
neutral         → sem modificação
```

Quando a relação é `weak` ou `resist`, o sistema automaticamente seta `context.ignoreMinimumFloor = true`, permitindo que dano resistido chegue a 0 sem o piso mínimo de 5/10.

### Múltiplas Afinidades

Se um campeão tiver mais de uma afinidade (`elementalAffinities: ["fire", "lightning"]`), o sistema itera até encontrar a primeira relação não-neutra (`weak` tem prioridade sobre `resist`). Apenas a primeira relação relevante é aplicada.

### Skills sem Elemento

Se a skill não tiver `skill.element` definido, `_getAffinityDamage` retorna o dano sem modificação. Isso é o comportamento esperado para skills físicas ou mágicas genéricas.

---

## 12. Sistema de Hooks — CombatEvents

**Arquivo**: `shared/core/combatEvents.js`

O sistema de hooks permite que passivas e efeitos temporários reajam a eventos de combate sem acoplamento direto com o `CombatResolver`.

Todos os hooks seguem o padrão `on<EventName><Phase>`. O prefixo `on` é obrigatório.

| Hook canônico        | Fase                    | Quem recebe |
| -------------------- | ----------------------- | ----------- |
| `onBeforeDmgDealing` | Antes de causar dano    | Atacante    |
| `onBeforeDmgTaking`  | Antes de receber dano   | Alvo        |
| `onAfterDmgDealing`  | Após causar dano        | Atacante    |
| `onAfterDmgTaking`   | Após receber dano       | Alvo        |
| `onCriticalHit`      | Quando acerta crítico   | Atacante    |
| `onActionResolved`   | Após resolução completa | Todos       |
| `onTurnStart`        | Início de turno         | Todos       |
| `onChampionDeath`    | Morte de um campeão     | Todos       |

> **Legado**: Nomes anteriores `onBeforeDealing`, `onBeforeTaking`, `onAfterDealing`, `onAfterTaking` podem ainda existir em campeões não migrados. A migração é incremental — ambas as formas são suportadas enquanto o refactor avança.

### Contrato de Retorno de Hooks

Hooks podem retornar um objeto estruturado com qualquer combinação das seguintes propriedades:

```ts
{
  damage?: number,              // Override do dano calculado até aqui
  crit?: object,                // Override do resultado de crítico
  ignoreMinimumFloor?: boolean, // Remove o piso mínimo de 5 de dano
  log?: string | string[],      // Texto(s) para o log de combate
  logs?: string[],              // Alias de log[] (compatibilidade)
  effects?: Effect[]            // 🔥 Efeitos visuais estruturados para o client
}
```

Os `effects[]` retornados por hooks são **agregados pelo `CombatResolver`** ao longo de toda a pipeline e propagados no campo `extraEffects` do resultado de `processDamageEvent()`. O servidor então os mescla com os demais effects do envelope `combatAction` antes de emitir ao cliente. O cliente os processa sequencialmente via `animateEffect()`, exatamente como effects gerados diretamente pelo servidor.

Isso permite que passivas e efeitos temporários gerem eventos visuais completamente customizados — incluindo diálogos, buffs, keywords, ou qualquer outro tipo de effect — sem necessitar de lógica especial fora do próprio hook.

### Hooks Disponíveis — Payloads

| Hook                 | Quando dispara                | Payload principal                                                   |
| -------------------- | ----------------------------- | ------------------------------------------------------------------- |
| `onBeforeDmgDealing` | Antes do atacante causar dano | `{ attacker/user, target, damage, crit, skill, context }`           |
| `onBeforeDmgTaking`  | Antes do alvo receber dano    | `{ dmgSrc/user, dmgReceiver/target, damage, crit, skill, context }` |
| `onAfterDmgDealing`  | Após o atacante causar dano   | `{ attacker, target, damage, crit, skill, context }`                |
| `onAfterDmgTaking`   | Após o alvo receber dano      | `{ attacker, target, damage, crit, skill, context }`                |
| `onCriticalHit`      | Quando um crítico ocorre      | `{ attacker, critSrc, target, context }`                            |
| `onTurnStart`        | Início de cada turno          | `{ champion/self/owner, context, allChampions }`                    |
| `onChampionDeath`    | Quando um campeão morre       | `{ deadChampion, killer, context }`                                 |

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

## 13. Sistema de Keywords

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

## 14. Sistema de Escudos (Shields)

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

## 15. Sistema de Modificadores de Dano

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

## 16. Gerenciador de Animações — AnimsAndLogManager

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
   └── usa action.userId / action.targetId apenas para o diálogo de anúncio
2. Para cada effect em effects[]:
   └── animateEffect(effect) → aguarda animação CSS
       ├── effect.targetName / effect.sourceName → usados diretamente (sem lookup)
       └── effect.isCritical, effect.evaded, etc. → lidos do effect
3. applyStateSnapshots(state) → sincroniza dados com a verdade do servidor
4. appendToLog(log) → exibe texto no painel lateral
```

> **Importante**: O cliente **não faz** `activeChampions.get(effect.targetId).name` para montar textos. Os campos `targetName` e `sourceName` já chegam prontos no effect, enviados pelo servidor. O `targetId` é usado apenas para encontrar o **elemento DOM** a animar.

### Efeitos Animados

| Tipo de Effect   | Animação CSS                                        | Float                                     |
| ---------------- | --------------------------------------------------- | ----------------------------------------- |
| `damage`         | `.damage` + shake                                   | `.damage-float` + tier 1-6 por quantidade |
| `heal`           | `.heal` + brilho verde                              | `.heal-float`                             |
| `shield`         | `.has-shield` + bolha                               | `.shield-float`                           |
| `buff`           | `.buff` + brilho dourado                            | `.buff-float`                             |
| `evasion`        | `.evasion` + slide                                  | "Esquiva!" como float                     |
| `resourceGain`   | —                                                   | `.resource-float-mana` ou `-energy`       |
| `keywordApplied` | `animateIndicatorAdd()`                             | `.taunt-float` se taunt                   |
| `keywordRemoved` | `animateIndicatorRemove()`                          | —                                         |
| `immune`         | —                                                   | "IMUNE!" como float                       |
| `shieldBlock`    | —                                                   | "BLOQUEADO!" como float                   |
| `gameOver`       | overlay de vitória                                  | —                                         |
| `dialog`         | `showBlockingDialog()` ou `showNonBlockingDialog()` | —                                         |

#### Campos do effect `"damage"` usados pelo cliente

```js
animateDamage(effect) {
  const el = getChampionElement(effect.targetId); // DOM lookup por ID
  // Textos e metadados vêm prontos — sem lookups adicionais:
  effect.isCritical   // → adiciona classe visual de crítico
  effect.evaded       // → animação de Esquiva em vez de dano
  effect.immune       // → float "IMUNE!"
  effect.shieldBlocked// → float "BLOQUEADO!"
  effect.amount       // → determina damage tier (tamanho do float)
  effect.damageDepth  // → pode ser usado para diferenciar animação de reação
  effect.targetName   // → texto do float ou log (sem lookup)
  effect.sourceName   // → idem
}
```

### Tipo `dialog` — Diálogos Customizados de Hooks

O cliente suporta o tipo `"dialog"` nativamente em `animateEffect()`:

```js
case "dialog":
  if (effect.blocking === false) {
    showNonBlockingDialog(effect.message, effect.html ?? false);
  } else {
    await showBlockingDialog(effect.message, effect.html ?? false);
  }
  break;
```

Isso permite que o servidor (via retorno de hooks de passiva) envie diálogos excepcionais que não se enquadram nos padrões de dano, cura, escudo ou recurso — como narração de passivas, avisos de efeito especial, ou flavor text contextual. Por padrão o diálogo é **blocking** (aguarda exibição completa antes de continuar a fila).

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

## 17. Indicadores de Status — StatusIndicator

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

## 18. Histórico de Turnos

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

## 19. Modo de Edição / Debug

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

## 20. Como Criar um Novo Campeão

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

  // === AFINIDADES ELEMENTAIS (opcional) ===
  elementalAffinities: ["lightning"], // elementos que este campeão possui
  // Elementos disponíveis: "fire" | "ice" | "earth" | "lightning" | "water"
  // Determina fraqueza/resistência ao receber dano elemental de skills com `element`

  // === SKILLS ===
  skills: [
    {
      key: "minha_skill_1",
      name: "Nome da Skill",
      manaCost: 50, // ou energyCost: 30
      priority: 0, // maior = age primeiro no turno
      contact: true, // ataque físico (relevante para passivas)
      element: "fire", // opcional — ativa sistema de afinidade elemental
      description() {
        return `Custo: ${this.manaCost} MP\nDescrição da skill.`;
      },
      targetSpec: ["enemy"], // ["enemy"], ["ally"], ["self"], ["any"], etc.
      execute({ user, targets, context }) {
        const { enemy } = targets;
        const baseDamage = (user.Attack * 80) / 100 + 30;
        return CombatResolver.processDamageEvent({
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

    // Hooks opcionais — use os nomes canônicos:
    onAfterDmgDealing({ attacker, target, damage, crit, skill, context }) {
      // chamado após o campeão causar dano
    },
    onAfterDmgTaking({ attacker, target, damage, context }) {
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
- **Sempre use `CombatResolver.processDamageEvent()`** para dano — nunca debite HP diretamente em skills, pois o resolver lida com escudos, Esquiva, crítico, lifesteal, hooks, log, etc.
- **Passivas devem verificar `damageDepth`** antes de gerar dano extra para evitar recursão infinita: `if (context.damageDepth > 0) return;`.
- **Keywords**: Use `champion.keywords.set("nome", { duration: N })` para aplicar. O servidor deve emitir `keywordApplied` no array de effects para que o cliente anime.
- **Escudos**: Adicione em `champion.runtime.shields.push({ amount: X, type: "regular", source: skill.key })`.

---

## 21. Decisões de Design e Convenções

### Por que Server Authoritative?

Num jogo PvP, permitir que o cliente compute o estado final criaria espaço para trapaça. Toda validação ocorre no servidor: tem recurso suficiente? Campeão ainda vivo? Alvo válido? O cliente só exibe o que o servidor determina.

### Por que a fila de animações no cliente?

Socket.IO pode entregar múltiplos eventos em rajada (várias ações num turno). Sem fila, animações se sobreporiam e o estado visual ficaria inconsistente. A fila garante sequencialidade total e a `applyStateSnapshots` ao final de cada ação garante que o visual está correto mesmo se uma animação pulou etapas.

### Por que código compartilhado (`/shared`)?

A classe `Champion` precisa existir no servidor (para gerenciar estado real) e no cliente (para renderizar a UI e calcular custos de skill localmente). Evitar duplicação elimina divergências. O `CombatResolver` compartilhado garante que a UI do cliente pode fazer estimativas locais antes da confirmação do servidor.

### Convenção: Recursos arredondados para múltiplos de 5

Todos os valores de HP, dano, cura e recurso são arredondados para múltiplos de 5. Isso facilita a leitura visual (os segmentos das barras se encaixam), reduz "números feios" e simplifica o balanceamento.

### Aliases de hooks e migração de nomes

Os hooks passaram por uma padronização de nomenclatura:

| Nome antigo (legado) | Nome canônico atual  |
| -------------------- | -------------------- |
| `onBeforeDealing`    | `onBeforeDmgDealing` |
| `onBeforeTaking`     | `onBeforeDmgTaking`  |
| `onAfterDealing`     | `onAfterDmgDealing`  |
| `onAfterTaking`      | `onAfterDmgTaking`   |

A migração é **incremental**: o `emitCombatEvent` suporta ambos os nomes enquanto os campeões são atualizados individualmente. Ao criar um campeão novo ou atualizar um existente, use sempre os nomes canônicos com prefixo `on`.

Os aliases de payload (`self` / `owner` no `onTurnStart`, `user` / `attacker` no before/after) existem pelo mesmo motivo histórico e serão unificados gradualmente.

### Efeitos estruturados vs. parsing de logs (sistema antigo removido)

O sistema original extraía informações de efeitos lendo campos de objetos de resultado ou fazendo parsing de strings de log (`extractEffectsFromResult`, `resultsGroup`). Esse padrão foi **completamente removido**. As razões:

- Parsing de string é frágil — qualquer mudança no texto do log quebrava a extração de efeitos.
- `resultsGroup` criava um nível extra de indireção desnecessário.
- O cliente precisava resolver nomes fazendo `activeChampions.get(id)` em vez de usar dados já disponíveis.

O sistema atual (`context.*Events → buildEffectsFromContext`) é totalmente programático e tipado. Cada subsistema escreve diretamente no contexto; nenhum parsing acontece.

### O servidor envia nomes, o cliente não faz lookups para texto

Antes o cliente fazia `activeChampions.get(effect.targetId)?.name` para montar textos de log e floats. Agora o servidor envia `targetName` e `sourceName` prontos em cada effect. O `targetId` no cliente é usado **exclusivamente** para encontrar o elemento DOM a animar — nunca para resolver nomes ou outros dados.

### `editMode` separado entre server e client

O servidor tem flags adicionais (`damageOutput`, `alwaysCrit`) que não são enviadas ao cliente por segurança. O cliente não deve conhecer valores de output de dano forçado ou flags que mudem o resultado do combate — apenas flags que afetam a UI (mostrar campeões não lançados, permitir múltiplas ações por turno visualmente, etc.).