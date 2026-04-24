## [2026-04-23] Quick: Serene streak centralizada no passivo

- `shared/data/champions/serene/passive.js` agora registra `lastSereneSkillKey` em `onActionResolved`, usando a assinatura-contrato do hook em vez de espalhar marcação pelas skills.
- `shared/data/champions/serene/skills.js` perdeu a instrumentação temporária e passou a ler apenas o estado centralizado para decidir a streak do `Selo da Quietude`.
- A checagem confirmou que o contrato `onActionResolved` já cobre a necessidade de rastrear uso consecutivo sem depender de `currentTurn` global.

---

## [2026-04-22] Quick: API de recurso de ult unificada

- `shared/engine/combat/TurnResolver.js` deixou de expor `registerUltGain`; o contexto agora usa só `registerResourceChange()` para registrar ganho e gasto de ult pelo sinal do valor.
- A documentação de arquitetura foi alinhada para não manter o alias redundante como API pública.
- Validação local pendente após a edição.

---

## [2026-04-22] Quick: Lana ganha Escudo de Feitiço por turno

- `shared/data/champions/lana/passive.js` voltou a aplicar um `spell` shield no `onTurnStart` enquanto `owner.runtime.lana.triggered` ainda for `false`, mantendo o buff ativo só enquanto Tutu estiver vivo.
- `shared/core/championCombat.js` passou a decair escudos com `decayPerTurn` por turno e o `spellShield` agora bloqueia apenas dano `magical` no pre-check.
- `src/server.js` aplica o decaimento de escudos no início do turno, antes dos hooks de `onTurnStart`, para o escudo novo durar o turno corrente inteiro.
- Validação local pendente após a edição.

## [2026-04-21] Quick: Isarelis executa com teto absoluto de 80 HP

- `shared/data/champions/isarelis/skills.js` agora limita o finishing da ultimate ao menor valor entre 20% da vida máxima e 80 HP absolutos.
- A descrição da skill foi atualizada para refletir a nova regra.
- Validação local concluída: `get_errors` no arquivo tocado retornou sem erros.

---

## [2026-04-21] Quick: centralização do finishing da Isarelis

- A etapa 6 do combate foi renomeada de `06_obliterate.js` para `06_finishing.js`, e o processamento agora passa por `processFinishing`.
- `preventObliterate` foi substituído por `preventFinishing` no runtime da Serene, alinhando o bloqueio de sobrevivência ao gênero finishing.
- O pipeline agora serializa apenas `finishing` e `finishingType`; `obliterate` segue como tipo, mas sem flag booleana própria, e o acabamento `regular` fica como padrão reutilizável para personagens futuros.
- O código executável e a arquitetura atual foram sincronizados para eliminar `isObliterate` como nome de flag.
- Validação local: `get_errors` sem erros nos arquivos tocados e grep confirmou a saída de `preventObliterate` e `06_obliterate.js` do código executável.

---

## [2026-04-21] Quick: status effects canônicos em inglês internamente

- Histórico antigo consolidado em `STATE.archive.md` para manter este arquivo enxuto.

- Status effects passaram a usar keys internas em inglês ponta a ponta: `paralyzed`, `stunned`, `rooted`, `inert`, `chilled`, `frozen`, `burning`, `absoluteImmunity`, `conductor`, `invisible`.
- A pasta `shared/data/statusEffects/` foi renomeada para os novos nomes de arquivo em inglês, e o `effectsRegistry` agora importa/exporta apenas esses canônicos.
- `championStatus.js` ganhou normalização de aliases legados em português para manter compatibilidade defensiva em `applyStatusEffect`, `hasStatusEffect`, `getStatusEffect*` e `removeStatusEffect`, mas o `Map` autoritativo grava só a key em inglês.
- Call sites em campeões, `Champion`, `public/js/main.js`, `shared/ui/statusIndicator.js` e `shared/vfx/vfxManager.js` foram migrados para as novas keys; VFX/CSS também passaram a usar `frozen`/`invisible` internamente.
- Novo status `bleeding` implementado como stackable; `applyStatusEffect(..., stackCount)` agora suporta aplicar múltiplos stacks em uma chamada, com refresh de duração nas reaplicações.
- `shared/ui/statusIndicator.js` e `public/styles/animations.css` ganharam badge numérico para stacks de `bleeding` no próprio indicador de Sangramento.
- A UI continua em português: nomes exibidos, labels de indicador, glossary tags e descrições de skill permanecem localizados para o jogador.
- Validação local: diagnóstico do editor sem erros; import ESM de `effectsRegistry.js` e `championDB.js` bem-sucedido; aplicação/remoção por alias legado (`"congelado"`) confirmou armazenamento canônico em `"frozen"`; `bleeding` acumulou stacks e serializou `stacks/stackCount` corretamente.
- Artefatos: `.planning/quick/260420-wns-favor-refatorar-para-que-os-statuseffect/`.

---

## [2026-04-20] Quick: undoBtn volta a habilitar após skillApproved/useSkill

- Corrigido: o botão de desfazer ações (undo) agora é habilitado imediatamente após o servidor aprovar o uso de uma skill ("skillApproved") e após cada ação enfileirada, não apenas após escolher todas as ações do turno.
- Antes, o undo só era habilitado após preencher todos os slots de ação, o que não era o comportamento original nem o desejado.
- O fix garante que o undoBtn fique disponível assim que houver qualquer ação pendente, restaurando o fluxo esperado pré-centralização do ultMeter no servidor.
- Artefatos: `.planning/quick/260420-undoBtn-habilita-imediato-skillApproved/`.

---

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
