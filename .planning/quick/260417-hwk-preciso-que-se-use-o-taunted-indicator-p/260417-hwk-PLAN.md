# Quick Task 260417-hwk - Plan

## Description

Usar `taunted_indicator.png` exatamente no mesmo pipeline DOM/UI dos demais `statusIndicator`, mesmo sendo um efeito lógico fora de `statusEffects`, incluindo participação no `rotationLoop`.

## Tasks

1. Integrar provocação como pseudo-status no StatusIndicator.

- Files: `shared/ui/statusIndicator.js`
- Action: adicionar mapeamento de ícone para provocação e incluir `champion.tauntEffects` na fonte de estados ativos para criação/remoção de indicadores.
- Verify: quando `tauntEffects.length > 0`, o portrait recebe um `.status-indicator` de provocação com o mesmo fluxo de render dos demais status.
- Done: completed

2. Garantir participação da provocação no rotation loop sem tratamento especial.

- Files: `shared/ui/statusIndicator.js`
- Action: inserir o pseudo-status na mesma coleção iterada de status para que opacidade/rotação usem o mesmo algoritmo global já existente.
- Verify: com múltiplos indicadores ativos, provocação alterna visibilidade junto com os demais pelo `ROTATION_INTERVAL`.
- Done: completed

3. Rastreabilidade quick task.

- Files: `.planning/quick/260417-hwk-preciso-que-se-use-o-taunted-indicator-p/260417-hwk-SUMMARY.md`, `STATE.md`
- Action: registrar resultado no padrão quick usado no repositório.
- Verify: artefatos quick criados e entrada adicionada ao STATE.
- Done: completed
