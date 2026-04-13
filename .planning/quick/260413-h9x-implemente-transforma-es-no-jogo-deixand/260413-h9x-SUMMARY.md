# Quick Task 260413-h9x Summary

## Implemented

- Criei uma infraestrutura genérica de transformação em `shared/engine/match/championTransformation.js`.
- O `TurnResolver` agora expõe `context.requestChampionMutation(...)`, removendo a necessidade de skills/passivas mexerem direto em arrays internos de flags.
- O servidor passou a processar uma mutation layer única com os modos `swap`, `restore`, `transform` e `revertTransform`.
- `transform` agora é aplicado imediatamente dentro do `TurnResolver`, logo após o `resolve` da skill, para que o snapshot da própria ação e as ações seguintes do turno já enxerguem a nova forma.
- `handleStartTurn` ganhou um pre-pass para mutations agendadas do turno atual, para que reversões de forma ocorram antes dos hooks de início de turno.
- Lana/Tutu foi migrado para a nova API sem mudar o comportamento existente.
- Sengoku ganhou a ultimate `Forma Primordial`, que troca `championKey`, stats, passive e skills por 3 turnos, com reversão automática.

## Validation

- `get_errors` sem erros nos arquivos alterados.
- Snippet Node confirmou transformação e reversão de Sengoku com troca de `championKey`, `passive` e `skills`.
- Snippet Node via `TurnResolver.resolveTurn()` confirmou que o snapshot intermediário da ação do Sengoku já sai com `championKey = sengoku_primordial`.
- Snippet Node confirmou preservação de deltas materiais de stats e HP na ida e volta da transformação.

## Notes

- `Player.js` não precisou de alteração: a seleção de time continua independente da forma ativa do campeão em combate.
- Não houve commit automático. O workspace já tinha mudanças locais pré-existentes e a política da sessão prioriza não comitar sem pedido explícito do usuário.
