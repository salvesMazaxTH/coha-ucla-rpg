# Quick Task: Nythera stacking incapacitated/congelado bug

## Description

“Já está incapacitado” TODA HORA, “não pode receber congelado” , isso acontece mt qnd a personagem Nythera está em campo, parece ser uma coisa dela, q fica stackando sla oq, sobrepondo, oq n deveria acontecer, isso q to te falando é dialog.

## Context

- Nythera appears to cause repeated stacking or reapplication of incapacitated/congelado (frozen) status effects.
- Effects are stacking or being reapplied when they should not, especially when Nythera is present.
- This results in dialog messages like “Já está incapacitado” and “não pode receber congelado” appearing too frequently.

## Goal

- Prevent status effects from stacking or being reapplied incorrectly, especially for Nythera.
- Ensure dialog messages only appear when a new effect is actually applied.

## Plan

1. Review Nythera’s passive and skills for logic that applies or re-applies incapacitated/congelado.
2. Check status effect application logic (statusEffects/ and championStatus.js) for stacking/overlap bugs.
3. Fix logic so effects do not stack or reapply if already present.
4. Ensure dialog only triggers on new effect application.
5. Test with Nythera in field to confirm fix.
