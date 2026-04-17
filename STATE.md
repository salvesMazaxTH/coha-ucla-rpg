## [2026-04-17] Quick: indicador de provocação no rotation loop de status

- `shared/ui/statusIndicator.js` agora trata provocação ativa (`champion.tauntEffects`) como pseudo-status de UI.
- Adicionados mapeamentos `provocado` e `taunted` usando `/assets/taunted_indicator.png`.
- O indicador de provocação entra na mesma pipeline de criação/remoção dos demais `.status-indicator`.
- Com múltiplos indicadores, provocação participa do mesmo `rotationLoop` global sem fluxo especial.
- Artefatos: `.planning/quick/260417-hwk-preciso-que-se-use-o-taunted-indicator-p/`.

---

## [2026-04-16] Quick: consistência de dano com escudo no intermediateSnapshot/UI

- Corrigido desalinhamento entre backend e client-side na exibição de dano com escudo.
- `shared/engine/combat/pipeline/05_applyDamage.js` agora registra dano visual como dano efetivo em HP (`actualDmg`) e inclui metadados: `rawAmount`, `absorbedByShield`, `remainingShield`.
- `shared/engine/combat/TurnResolver.js` passou a serializar esses novos campos no `damageEvents`.
- `public/js/animation/animsAndLogManager.js` agora aplica imediatamente o consumo de escudo no HUD durante `animateDamage` (float + barra + texto de HP/escudo), evitando efeito de HP "desce e sobe".
- `animateShield` também atualiza o escudo visual no momento da animação, sem depender apenas do snapshot final.
- Artefatos: `.planning/quick/260416-k87-shield-snapshot-consistency/`.

---

## [2026-04-16] Quick: punch_silouete sem rotação no impacto

- Corrigida a orientação da `punch_silouete.png` em `public/js/animation/skillAnimations.js` (`MeleePunchEffect`).
- `this.fistPrint.rotation.z` deixou de usar o `angle` do ataque e passou a ficar fixo em `0`.
- Resultado visual: o soco continua aparecendo no alvo correto, mas sem girar a imagem em orientações aleatórias.
- Artefatos: `.planning/quick/260416-jvq-favor-corrigir-a-posi-o-da-particle-alph/`.

---

## [2026-04-16] Quick: policy de hooks reativos centralizada em DamageEvent

- `combatEvents` voltou a ser dispatcher genérico (sem estado local de policy de dano reativo).
- `emitCombatEvent` agora aceita callback opcional `shouldRunHook(eventName, champ, source)`.
- `04_beforeHooks.js` delega gating de hooks para `event.shouldRunDamageReactiveHook(...)`.
- `07_afterHooks.js` delega gating de hooks para `event.shouldRunDamageReactiveHook(...)`.
- Resultado: a step da pipeline passa a usar exatamente a policy fixada em `DamageEvent` (`allowOnDot`, `allowOnNestedDamage`) sem duplicação de estado.
- Artefatos: `.planning/quick/260416-19h-favor-prosseguir-com-a-implementa-o-a-st/`.

---

## [2026-04-15] Quick: lifesteal separado de heal comum no visual

- `Champion.heal` agora aceita opção de tipo de cura e mantém o fluxo de HP centralizado para cura normal e lifesteal.
- Quando `type: "lifesteal"`, o backend registra em `registerLifesteal` (`lifestealEvents`) em vez de `registerHeal`.
- `_applyLifeSteal` em `07_afterHooks.js` continua curando via `heal`, mas agora marca explicitamente como lifesteal.
- `src/server.js` passou a incluir `lifestealEvents` no envelope emitido para o cliente.
- `animsAndLogManager.js` ganhou handler `lifestealEvents` com `animateLifesteal` dedicado.
- Lifesteal agora carrega `fromTargetId` desde o backend para permitir VFX de transferência origem->destino.
- Novo VFX one-shot em `shared/vfx/lifestealTransferCanvas.js`: feixe curvo energético + partículas viajando + burst em origem/destino.
- `animations.css` ganhou trilha visual reforçada de lifesteal e drenagem (`.lifesteal`, `.lifesteal-float`, `.lifesteal-drained`, `lifestealPulse`, `lifestealFloat`, `lifestealDrained`).

---

## [2026-04-15] Refactor: New Class StatusEffect

- Introduzida a classe `StatusEffect` em `shared/core/StatusEffect.js` para representar cada efeito como instância real.
- `StatusEffectsRegistry` migrou para factories `createInstance(...)`, preservando os mesmos hooks e assinaturas.
- `applyStatusEffect` passou a instanciar via `createInstance` e manter `Map<string, StatusEffect>` em `champion.statusEffects`.
- Compatibilidade preservada: hooks continuam diretos na instância, `expiresAtTurn` mantido, sem mudanças em `emitCombatEvent`, `DamageEvent` e `TurnResolver`.

---

## [2026-04-15] Refactor: expiração unificada de efeitos temporários

- Unificado o modelo temporal em `expiresAtTurn` para efeitos temporários (status, modifiers e hookEffects de runtime).
- Adicionado purge global de `runtime.hookEffects` por turno (`purgeExpiredHookEffects`) no ciclo de início de turno.
- Removidas limpezas manuais redundantes (`hookEffects.filter` puramente temporal) em skills/passivas, preservando lógica de gameplay e flags de runtime.
- Removida normalização redundante de nomes de status (`normalizeStatusEffectName`); consultas/remoções agora usam key canônica diretamente.
- `emitCombatEvent` passou a iterar também `statusEffects` ativos (Map), deixando hooks de status no próprio status e simplificando o runtime.

---

## [2026-04-14] Refactor: sistema de dano Piercing

- Removido modo `"hybrid"`. Agora existem apenas 3 modos: `"standard"`, `"piercing"` e `"absolute"`.
- `piercingPortion` (flat de dano perfurante) substituído por `piercingPercentage` (% da defesa do alvo a ignorar, 0-100).
- No modo `"piercing"`, todo o `baseDamage` é considerado perfurante. O `piercingPercentage` define quanto da defesa do alvo é ignorado antes de calcular a mitigação (ex: 60% ignora 60% da defesa, não 60% da mitigação).
- Se `piercingPercentage` não for passado no modo piercing, assume 100% (ignora toda a defesa).
- `defenseToPercent` renomeado para `defToMitPct` (nome mais preciso: converte defesa em % de mitigação).
- Hooks (`04_beforeHooks.js`) atualizados: payload e handler usam `piercingPercentage` em vez de `piercingPortion`.
- Campeões atualizados: blyskartri, kai, jeff_the_death, ralia, sengoku, serene, torren, voltexz, isarelis.
- Validado via `damageEventLab.js`: Isarelis (passiva on/off) e Ralia (ult piercing 90%).
- Patches: `DamageEvent.js`, `03_composeDamage.js`, `04_beforeHooks.js`, skills/passives de 9 campeões.

---

## [2026-04-13] Quick: finishing VFX fisico para execute da Isarelis

- `obliterate` (legado)
- `isarelis_finishing` (corte fisico, sangue e estilhaco sem flash azul magico)
- `DamageEvent` agora armazena `flags`
- `applyDamage` propaga `flags` no `registerDamage`
- `TurnResolver.registerDamage` serializa `finishing` e `finishingType`

## [2026-04-13] Quick: sistema genérico de transformações + Sengoku Primordial

- `transform` passou a ser aplicado imediatamente no `TurnResolver`, logo após o `resolve` da skill, em vez de esperar o fim do turno inteiro.
- `src/server.js` passou a processar uma camada única de mutações de campeão (`swap`, `restore`, `transform`, `revertTransform`) e a agendar reversões automáticas como `scheduledEffects`.
- `handleStartTurn()` agora aplica mutações agendadas do turno antes dos hooks de `onTurnStart`, evitando que a forma expirada ainda ative a passiva antiga por um turno extra.
- `Lana` e `lana_dino` foram migrados para a nova API sem perder o fluxo de swap/restore já existente.
- Novo campeão de forma: `shared/data/champions/sengoku_primordial/`.
- `sengoku/skills.js` agora implementa `Forma Primordial` de verdade e também corrige `bola_de_fogo`, que estava sem `bf`.
- Validação local por snippet Node confirmou: troca e reversão de `championKey`, `passive` e `skills`, além da preservação de deltas de stats/HP durante a transformação.
- Patches: `shared/engine/match/championTransformation.js`, `shared/engine/match/GameMatch.js`, `shared/engine/combat/TurnResolver.js`, `src/server.js`, `shared/data/champions/index.js`, `shared/data/champions/lana/passive.js`, `shared/data/champions/lana_dino/passive.js`, `shared/data/champions/sengoku/skills.js`, `shared/data/champions/sengoku_primordial/`, `.planning/quick/260413-h9x-implemente-transforma-es-no-jogo-deixand/`

---

## [2026-04-13] Quick: laboratorio isolado para DamageEvent (Theopetra)

- Adicionado `scripts/damageEventLab.js` para rodar simulacoes de dano sem subir partida completa (sem 2 clientes/abas/dispositivos).
- Novo script de atalho: `npm run damage-lab`.
- `damage-lab` passa a ser o harness oficial para validacao tecnica do pipeline de dano por agentes Copilot no fluxo GSD ("MCP" local de teste deterministico via CLI).
- Uso recomendado em automacao/agent loops: confirmar passivas, crit, mitigacao, thresholds de HP e comparativos de cenario antes de alterar pipeline ou skills.
- Modo de comparacao implementado (`--compare-passive`) para medir o impacto da passiva com e sem stacks no mesmo cenario.
- Validacao local com `Theopetra x Bruno` e `golpe_petreo` mostrou razao observada de dano final `1.800x` quando a passiva esta pronta, confirmando o bonus numerico no pipeline isolado.
- Patches: `scripts/damageEventLab.js`, `package.json`, `.planning/quick/260412-w50-pq-q-o-b-nus-dela-t-t-o-fraco-the-petra-/`

---

## [2026-04-12] Fix: Jeff revive agora preserva buffs/stacks acumulados

- Root cause: a passiva copiava `runtime` e arrays de modifiers do Jeff antigo, mas o novo Jeff nascia com `Attack`, `Defense`, `maxHP` e demais stats recriados a partir do baseData. Isso deixava os `statModifiers` preservados, porém desacoplados dos atributos efetivos.
- Fix: o revive agora restaura também os stats materializados (`maxHP`, `Attack`, `Defense`, `Speed`, `Evasion`, `Critical`, `LifeSteal`, `ultMeter`) junto com os modifiers e efeitos já copiados.
- Ajuste adicional: descrição de `A Morte Não Cessa` atualizada para refletir que Jeff retorna mantendo buffs e stacks acumulados.
- Patches: `shared/data/champions/jeff_the_death/passive.js`, `.planning/quick/260412-kcw-qnd-o-jeff-morre-e-revive-ele-perde-todo/`

---

## [2026-04-12] Fix/Refactor: Lana <-> Tutu swap/restore via inactiveChampions

- Arquitetura de substituição reestruturada para não reutilizar a mesma instância:
  - `swap`: campeão original sai de `activeChampions` e vai para `inactiveChampions` com estado completo preservado
  - `restore`: campeão original volta de `inactiveChampions` para `activeChampions`
- `replaceChampion` no backend passou a operar em dois modos explícitos (`swap`/`restore`) e ganhou logs de depuração padronizados com prefixo `[REPLACE DEBUG]`
- Correção crítica: no `swap`, o novo campeão criado (ex: Tutu) agora é registrado em `match.combat.activeChampions`; antes era criado mas não entrava no estado autoritativo, causando "slot vazio" no frontend
- Frontend (`processGameStateUpdate`) atualizado para o novo modelo de IDs distintos:
  - sincroniza/cria campeões por snapshot
  - remove do DOM campeões que não existem mais no `gameState` (swapped out)
  - mantém bloco de mismatch de `championKey` para futuras transformações de mesmo ID
- Runtime de vínculo entre substituto e substituído generalizado:
  - removido acoplamento específico `runtime.lana.originalId`
  - novo campo genérico `runtime.swappedFrom` (ID do campeão substituído)
  - passiva do `lana_dino` usa `runtime.swappedFrom` para solicitar `restore`
- Resultado: fluxo Lana -> Tutu -> Lana passa a usar objetos independentes, com restauração limpa do original e sem lógica hardcoded de personagem no servidor
- Patches: `src/server.js`, `shared/engine/match/GameMatch.js`, `shared/data/champions/lana/passive.js`, `shared/data/champions/lana_dino/passive.js`, `public/js/animation/animsAndLogManager.js`

---

## [2026-04-10] Refactor: Score system disabled; win condition now champion-presence-based

- `playerScores` array commented out (`CombatState.reset/resetProgress`); score methods (`addPointForSlot`, `setWinnerScore`, `getScorePayload`) commented out
- New win condition: game ends when a team's `activeChampions` has no entity where `!entityType || entityType === "champion"` — tokens and custom entityTypes do not count toward keeping a player alive
- `computeWinnerSlot()` added to `CombatState` (and delegated in `GameMatch`): uses existing `getAliveChampionsForTeam()`, returns slot of surviving team
- server.js: `MAX_SCORE` commented out; `scoreUpdate` emits, `setWinnerScore` calls, and score-based winner determination replaced with `computeWinnerSlot()`; surrender handler sets `gameEnded = true` directly
- Frontend untouched — `scoreUpdate` events simply no longer fire
- Patch: shared/engine/match/GameMatch.js, src/server.js

---

## [2026-04-06] Fix: Kai gancho_rapido animation always targets middle champion

- Root cause: `camera.updateMatrixWorld()` was never called after setting `camera.position.z = 15` — `Raycaster.setFromCamera()` used a stale identity matrix, so `screenToWorld()` always returned `(0,0,0)` (world center) regardless of the target element's actual screen position
- Fix: Added `camera.updateMatrixWorld()` immediately after positioning the camera, before computing world coordinates
- Patch: public/js/animation/skillAnimations.js

# STATE.md

## [2026-04-06] Fix Eryon passive not triggering on global per-turn ult regen

- Root cause: `applyGlobalTurnRegen` in server.js called `champion.addUlt(...)` directly, bypassing `applyResourceChange` entirely — so no `onResourceGain` event fired, and Eryon's passive never saw the +3 global regen each turn
- Fix: `applyGlobalTurnRegen` now accepts `resolver` param and routes through `resolver.applyResourceChange(...)` when available (direct `addUlt` fallback if no resolver). Call site in `handleStartTurn` passes the existing `resolver` instance.
- Patch: src/server.js

---

## [2026-04-05] Fix buff/debuff indicator detection (damageMod/statMod)

- Root cause: `serialize()` did not include modifier arrays → client champion objects always had empty `statModifiers`/`damageModifiers`/`damageReductionModifiers` → indicators never appeared
- Champion.serialize() now sends `statModifiers` (amount/statName/isPermanent), `damageModifiersCount`, `damageReductionModifiersCount`
- `syncChampionFromSnapshot()` in animsAndLogManager.js now syncs these fields to client champion objects
- StatusIndicator checks both full arrays (server-side) and count fields (client-side)
- Also fixed: code was checking `m.value` instead of `m.amount` on statModifiers
- Removed dead check for negative damageModifiers (all are buff-type with `apply()` pattern)
- Patch: shared/core/Champion.js, shared/ui/statusIndicator.js, public/js/animation/animsAndLogManager.js

---

## [2026-04-05] feat: add Bruno — ice carry champion

- New champion: Bruno (unreleased — `unreleased: true` in data.js)
- Role: carry; HP 315, Atk 320, Def 55 — glass cannon, ice affinity
- Patch: shared/data/champions/bruno/

---

## [2026-04-04] Skill Animation System + Gancho Rápido (Kai)

- Created `public/js/animation/skillAnimations.js`: registry-based system for one-shot skill animations using Three.js WebGL
- `animateSkill(skillKey, { targetEl, userEl })` — plays animation if registered, no-op otherwise
- Registered `gancho_rapido` animation: melee punch effect with swipe trail, fist impact mark (procedural texture), and directional smoke particles
- Renders in `#webgl-container` overlay, computes direction from user→target champion positions, auto-cleans up after 2s lifetime
- Wired into `animsAndLogManager.js` → `processCombatAction()` after action dialog, using `action.skillKey`

---

## [2026-04-03] Ult regen global nerfed

- Global per-turn ult regen reduced (commit `175e4ca`). Exact old→new values not documented in commit message.

---

## [2026-04-02] feat: Lana + Tutu (token) + Torren adicionados

- **Lana**: new champion — HP 305, Atk 220, Def 95, Spd 55.
- **Tutu** (`lana_dino`): token entity (`entityType: "token"`) invocada por Lana via skill effect. HP 180. Não aparece na seleção de time.
- **Torren**: new champion — HP 375, Atk 140, Def 195, Spd 45, Crit 10. Tank role.
- Patches: shared/data/champions/lana/, shared/data/champions/lana_dino/, shared/data/champions/torren/

---: Suppress dialog spam for 'não pode receber congelado' (Nythera bug)

- Fixed: Dialog message for 'não pode receber congelado' or similar is now suppressed if the effect is already present and not stackable (prevents spam when Nythera is present).
- Patch: championStatus.js (applyStatusEffect/\_canApplyStatusEffect)
- Confirmed: No errors after patch

---

## [2026-03-31] Fix sortTeamContainersByCombatSlot — champion DOM order after death

- Added `sortTeamContainersByCombatSlot()` to ensure `.champion` elements in `.team-X` containers are always ordered by logical `combatSlot` after champion removal or creation.
- When a champion dies or is added, DOM order is updated to match logical slot order — keeps actionBar and visual order consistent.
- Also: Ralia ult nerfed (no longer has priority).

---

## [2026-03-30] Dialog system overhaul

- Significant changes to dialog building and displaying logic (commit `eba625d`).
- Improved how combat dialogs are constructed and rendered for champion actions.

---

## [2026-03-29] deathClaim WebGL VFX (Jeff the Death) + SFX & music system

- New VFX: `shared/vfx/deathClaim.js` — cinematográfico WebGL effect for Jeff's ult "A Morte O Reclama". Full-screen canvas, independent of skillAnimations system.
- New system: `public/js/utils/AudioManager.js` — singleton managing SFX (heal, damage, victory, defeat) and background music (main, main2 playlist). Supports independent volume/enable controls per category and a master `globalVolume` multiplier.
- Integrated into `main.js` (preload + UI sliders/toggles) and `animsAndLogManager.js` (combat SFX triggers).

---

## [2026-03-27] feat: Eryon adicionado

- New champion: Eryon — HP 330, Atk 95, Def 130, Spd 75. Support/utility role.
- Passive: Ressonância Eryônica — acumula stacks ao longo da partida via hooks `onResourceGain`/`onResourceSpend` de aliados e inimigos.
- Patch: shared/data/champions/eryon/
