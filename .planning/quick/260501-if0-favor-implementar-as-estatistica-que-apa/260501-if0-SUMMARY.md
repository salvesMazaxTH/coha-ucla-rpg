# Quick Task 260501-if0 Summary

## Goal

Implementar painel de estatisticas no pos-combate, exibido junto ao momento em que o botao de retorno ao login aparece, fixado no canto esquerdo com 4 abas.

## Implemented

- Adicionado painel de estatisticas no `timerOverlay` com 4 abas:
  - Dano Causado
  - Vida Recuperada
  - Cura Realizada
  - Dano Cru Recebido
- Implementado agregador de metricas por campeao em `animsAndLogManager`.
- Integracao feita sobre eventos de combate existentes:
  - `damageEvents`: soma dano causado e dano cru recebido (`rawAmount`, fallback para `amount`).
  - `healEvents`: soma vida recuperada e cura realizada (estrita, por `sourceId`).
  - `lifestealEvents`: soma apenas vida recuperada do alvo da drenagem.
- Tabelas ordenadas por valor decrescente com identificacao de time (`T1`, `T2`).
- Painel exibido quando `timerOverlay` ativa no `handleGameOver` e resetado no `combatAnimations.reset()`.
- Estilos responsivos adicionados para desktop e mobile.

## Files Changed

- public/js/animation/animsAndLogManager.js
- public/index.html
- public/styles/ui.css

## Notes

- O contador da aba de Cura Realizada exclui lifesteal por definicao (usa somente eventos de cura estrita com `sourceId`).
- O contador de Vida Recuperada inclui cura recebida e lifesteal recebido.
