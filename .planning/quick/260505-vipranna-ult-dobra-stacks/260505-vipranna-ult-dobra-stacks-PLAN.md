---
mode: quick
quick_id: 260505-vpr
description: Ajustar Colapso Ofídico para dobrar Poisoned antes do dano e reduzir o ratio por stack para 12.5%
---

# Quick Task 260505-vpr Plan

## Task 1

files: shared/data/champions/tox_vipranna/skills.js
action: Remover a dobra reativa do Revestimento Tóxico e reworkar Colapso Ofídico para dobrar os stacks de Poisoned do alvo antes do dano, consumir o total dobrado e usar 12.5% da vida perdida por stack.
verify: Conferir que a H2 só aplica stacks por contato e que a ult calcula dano com stacks dobrados e ratio 0.125.
done: pending
