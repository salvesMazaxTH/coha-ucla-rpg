# Quick Task 260417-hwk - Summary

## Description

Fazer a provocação usar `taunted_indicator.png` com comportamento idêntico aos demais status indicators no DOM/UI, inclusive rotação.

## Changes Implemented

- `shared/ui/statusIndicator.js`
  - Adicionado mapeamento de ícone para `provocado` e alias `taunted`, ambos apontando para `/assets/taunted_indicator.png`.
  - Introduzida detecção de taunt ativo via `champion.tauntEffects`.
  - Quando existe taunt ativo, o pseudo-status `provocado` entra no conjunto de status ativos (`activeStatuses`) para participar da rotina padrão de remoção.
  - A iteração de criação de indicadores passou a usar uma lista composta por `statusEffects` + pseudo-status `provocado` quando aplicável.

## Behavioral Result

- Com `tauntEffects.length > 0`, o champion exibe o indicador de provocação no portrait via o mesmo bloco de criação de `.status-indicator` dos efeitos reais.
- Quando a provocação expira (`tauntEffects` vazio), o indicador é removido pela mesma regra de limpeza dos demais status.
- Em cenários com múltiplos indicadores ativos, provocação entra no mesmo `rotationLoop` e alterna opacidade exatamente com a mesma lógica global.

## Validation

- Verificado no editor: sem erros em `shared/ui/statusIndicator.js`.
- Asset confirmado: `public/assets/taunted_indicator.png` existe.

## Notes

- `init quick` retornou `roadmap_exists: false`; os artefatos quick foram mantidos em `.planning/quick/260417-hwk-preciso-que-se-use-o-taunted-indicator-p/` para preservar rastreabilidade do pedido.
