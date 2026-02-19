COMBAT_RULES.md
Regras Gerais de Combate
Turnos alternados: Cada jogador executa ações em ordem de prioridade/velocidade.
Skills: Cada skill define custo, alvo, efeitos, hooks e descrição.
Recursos: Mana/Energia, HP, buffs/debuffs, keywords.
Pipeline de Resolução de Combate
Execução de Skill

Função: performSkillExecution(user, skill, targets, ...)
Valida recursos, aplica custo, resolve alvos.
Resolução de Dano

Função: CombatResolver.resolveDamage
Passos:
Checagem de imunidade/escudo
Evasão
Cálculo de crítico
Modificadores de dano
Hooks: beforeDamageDealt, beforeDamageTaken
Aplicação de dano (mínimo, arredondamento)
Hooks: afterDamageTaken, afterDamageDealt
Efeitos secundários (regen, lifesteal, keywords)
Eventos/Hooks

Sistema de hooks via emitCombatEvent(eventName, payload, champions)
Hooks podem alterar dano, aplicar efeitos, logar mensagens.
Efeitos e Animações

Resultados de combate são convertidos em efeitos visuais (extractEffectsFromResult)
Enviados ao cliente via envelope
Cliente processa fila de efeitos, animações e log (animsAndLogManager.js)
Tipos de animação: dano, cura, escudo, buffs, debuffs, morte, etc.
Sincronização

Após animações, cliente aplica snapshot do estado final dos campeões.
Funções e Variáveis Importantes
CombatResolver.resolveDamage: Função central de cálculo e aplicação de dano.
emitCombatEvent: Dispara hooks de passivas/efeitos temporários.
Champion.runtime.hookEffects: Lista de efeitos temporários ativos.
extractEffectsFromResult: Converte resultado de combate em efeitos animáveis.
animsAndLogManager.js: Fila de animação, métodos enqueue, drainQueue, animateEffect, etc.
Animações
Pipeline: Cliente recebe envelope, processa cada efeito sequencialmente.
Efeitos suportados: Dano, cura, escudo, buffs, debuffs, morte, evasion, recursos, log visual.
Sincronização: Estado final só é aplicado após todas as animações.