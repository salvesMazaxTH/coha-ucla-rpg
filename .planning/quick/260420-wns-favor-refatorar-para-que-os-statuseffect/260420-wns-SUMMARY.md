# Quick Task 260420-wns - Summary

## Description

Refatorar os status effects para usar identificadores internos em inglês ponta a ponta, preservando português apenas no que é exibido ao jogador.

## Changes Implemented

- Renomeados os arquivos em `shared/data/statusEffects/` para nomes canônicos em inglês: `paralyzed`, `stunned`, `rooted`, `inert`, `chilled`, `frozen`, `burning`, `absoluteImmunity`, `conductor`, `invisible`.
- Atualizadas as próprias definições dos status effects para usar `key` e símbolo interno em inglês, mantendo `name` em português para UI/logs.
- `shared/core/championStatus.js` passou a:
  - normalizar aliases legados em português para as keys canônicas;
  - usar o `name` da definição para exibição em vez de derivar texto da key;
  - garantir que o `Map` de `statusEffects` armazene apenas a key canônica em inglês.
- `shared/core/Champion.js` foi alinhado com parâmetros nomeados como `statusEffectKey`.
- Todos os call sites ativos de `applyStatusEffect`, `hasStatusEffect`, `getStatusEffect` e `removeStatusEffect` nas skills/passivas foram migrados para as novas keys em inglês.
- `shared/ui/statusIndicator.js` agora mapeia ícones pelas keys internas em inglês, mas exibe `label` em português no DOM.
- Implementado `bleeding` como status effect stackable: cada stack causa 8% do HP máximo no início do turno, reaplicações acumulam stacks e renovam a duração para a mais recente.
- `applyStatusEffect`/`Champion.applyStatusEffect` agora aceitam `stackCount` opcional, permitindo aplicar múltiplos stacks em uma única chamada autoritativa.
- O indicador visual de `bleeding` usa o emoji `🩸` e ganhou badge numérico no canto superior direito para mostrar a quantidade atual de stacks.
- `shared/vfx/vfxManager.js` e `public/styles/vfx.css` foram migrados para `frozen` e `invisible` nas triggers/classes internas.
- Atualizada a arquitetura atual em `readme/GAME_ARCHITECTURE_v5_3 (current).md` para refletir os novos nomes canônicos.

## Validation

- Diagnóstico do editor: sem erros em `shared/`, `public/` e `src/`.
- Busca de resíduo por identificadores antigos: sem ocorrências de keys portuguesas em código ativo, exceto aliases defensivos e texto de UI/documentação em português.
- Validação ESM local:
  - import de `shared/data/statusEffects/effectsRegistry.js` OK;
  - import de `shared/data/championDB.js` OK;
  - `applyStatusEffect("congelado", ...)` armazena `"frozen"` no `Map` e `removeStatusEffect("congelado")` remove corretamente via alias.
  - `applyStatusEffect("bleeding", ..., {}, 3)` cria 3 stacks; reaplicação via alias `"sangramento"` com `stackCount=2` acumulou para 5 stacks e refrescou `expiresAtTurn`;
  - `Champion.serialize()` preservou `stacks` e `stackCount` no snapshot do `bleeding`, viabilizando o badge visual no cliente.

## Notes

- `init quick` reportou `roadmap_exists: false`; por isso os artefatos quick desta tarefa foram registrados manualmente.
- Não foi criado commit automático porque o repositório já tinha alterações locais não relacionadas e a tarefa não pediu commit explícito.
