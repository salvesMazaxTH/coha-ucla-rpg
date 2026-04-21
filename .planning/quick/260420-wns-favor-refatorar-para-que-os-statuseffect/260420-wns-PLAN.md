# Quick Task 260420-wns - Plan

## Description

Refatorar os status effects para usar identificadores internos em inglês ponta a ponta (keys, arquivos, imports e chamadas), preservando nomes em português apenas no que é exibido ao jogador no DOM/logs/UI.

## Tasks

1. Canonicalizar nomes internos dos status effects.

- Files: `shared/data/statusEffects/*`, `shared/core/championStatus.js`, `shared/core/Champion.js`
- Action: renomear arquivos/exports/keys para inglês e garantir que a exibição use nomes localizados em português.
- Verify: registry resolve apenas pelas novas keys canônicas e os logs/UI continuam mostrando nomes em português.
- Done: completed

2. Atualizar integrações end-to-end.

- Files: `shared/data/champions/**`, `public/js/main.js`, `shared/ui/statusIndicator.js`, `shared/vfx/vfxManager.js`, `public/styles/vfx.css`
- Action: migrar chamadas `applyStatusEffect`/`hasStatusEffect`/`removeStatusEffect`, indicadores e VFX para as novas keys.
- Verify: referências a keys antigas deixam de existir nas camadas ativas do jogo.
- Done: completed

3. Validar e registrar.

- Files: diagnostics/test harnesses as needed, `STATE.md`, `.planning/quick/260420-wns-favor-refatorar-para-que-os-statuseffect/260420-wns-SUMMARY.md`
- Action: rodar checagens de import/diagnóstico e registrar o resultado.
- Verify: sem erros novos relacionados à refatoração.
- Done: completed

## Notes

- `init quick` reportou `roadmap_exists: false`; os artefatos desta quick task estão sendo mantidos manualmente em `.planning/quick/260420-wns-favor-refatorar-para-que-os-statuseffect/` para preservar rastreabilidade.
