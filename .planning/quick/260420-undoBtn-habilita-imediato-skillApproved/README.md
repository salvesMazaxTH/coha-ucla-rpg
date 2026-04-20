## [2026-04-20] Quick: undoBtn volta a habilitar após skillApproved/useSkill

- Corrigido: o botão de desfazer ações (undo) agora é habilitado imediatamente após o servidor aprovar o uso de uma skill ("skillApproved") e após cada ação enfileirada, não apenas após escolher todas as ações do turno.
- Antes, o undo só era habilitado após preencher todos os slots de ação, o que não era o comportamento original nem o desejado.
- O fix garante que o undoBtn fique disponível assim que houver qualquer ação pendente, restaurando o fluxo esperado pré-centralização do ultMeter no servidor.
- Artefatos: `.planning/quick/260420-undoBtn-habilita-imediato-skillApproved/`.

---
