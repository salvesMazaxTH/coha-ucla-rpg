---
mode: quick
quick_id: 260503-isz
description: Atualizar GAME_ARCHITECTURE para refletir remocao de basicAttack e adocao de basicStrike/basicShot/totalBlock; revisar docs de damageMode e DamageEvent mode; corrigir referencias desatualizadas no mesmo markdown.
---

# Quick Task 260503-isz Plan

## Task 1

files: readme/GAME_ARCHITECTURE_v6_2 (current).md
action: Atualizar todas as secoes que citam basicAttack para o modelo atual com basicStrike (contato melee), basicShot (ranged) e totalBlock (defensiva), mantendo nomenclatura e semantica alinhadas aos modulos em shared/data/champions/\*.js.
verify: `rg -n "basicAttack|ataque basico generico" "readme/GAME_ARCHITECTURE_v6_2 (current).md"` nao retorna referencias obsoletas ao modulo removido.
done: completed

## Task 2

files: readme/GAME_ARCHITECTURE_v6_2 (current).md
action: Revisar e corrigir a documentacao de damageMode/mode para refletir o comportamento atual do DamageEvent (modes standard, piercing, absolute) e o uso pratico nas skills (basicStrike/basicShot com damageMode standard; totalBlock sem fluxo de dano direto).
verify: `rg -n "damageMode|DamageEvent\.Modes|mode" "readme/GAME_ARCHITECTURE_v6_2 (current).md"` mostra definicoes coerentes com shared/engine/combat/DamageEvent.js.
done: completed

## Task 3

files: readme/GAME_ARCHITECTURE_v6_2 (current).md
action: Fazer passagem final de consistencia no markdown, corrigindo referencias internas desatualizadas e texto contraditorio dentro do mesmo documento, sem alterar escopo tecnico fora dos itens solicitados.
verify: Validacao manual do diff para confirmar que somente o arquivo de arquitetura foi alterado e que os trechos atualizados batem com basicStrike.js, basicShot.js, totalBlock.js e DamageEvent.js.
done: completed
