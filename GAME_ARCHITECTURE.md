GAME_ARCHITECTURE.md
Visão Geral
O projeto é um RPG tático online em turnos, com arquitetura client-server, onde o servidor gerencia o estado do jogo, lógica de combate e persistência, enquanto o cliente exibe a interface, animações e interage via sockets.

Estrutura de Pastas
server.js: Servidor principal (Node.js + Express + Socket.io)
shared/core/: Núcleo de lógica de combate, entidades e utilitários (usado por client e server)
shared/champions/: Dados, habilidades e passivas de cada campeão
public/js/: Código do cliente (UI, animações, comunicação)
animsAndLogManager.js: Sistema de animação de combate
public/index.html, styles/: Interface e estilos
Fluxo Principal
Inicialização

Servidor sobe, inicializa variáveis globais, carrega campeões e configura rotas.
Cliente conecta via Socket.io, recebe estado inicial.
Seleção de Campeões

Jogadores escolhem times; servidor valida e instancia campeões (ver assignChampionsToTeam).
Turnos

Jogadores enviam ações (skills) via socket.
Servidor armazena ações em pendingActions.
Ao final do turno, servidor executa pipeline de resolução (ver handleEndTurn).
Resolução de Combate

Funções principais: resolveSkillActions, performSkillExecution, CombatResolver.resolveDamage, emitCombatEvent.
Hooks e efeitos temporários são processados via runtime.hookEffects.
Sincronização e Animação

Servidor emite envelopes { action, effects[], log, state[] } via emitCombatAction.
Cliente processa fila de animações sequencialmente (animsAndLogManager.js).
Atualização de Estado

Após animações, cliente aplica snapshot do estado final dos campeões.
Componentes e Funções-Chave
Champion.js: Classe base dos campeões, métodos de status, recursos, keywords, runtime.
combatResolver.js: Lógica de cálculo de dano, críticos, evasão, aplicação de hooks, pipeline de combate.
combatEvents.js: Sistema de eventos/hook para passivas e efeitos temporários.
animsAndLogManager.js: Gerencia fila de animações, efeitos visuais, log e sincronização de estado.
server.js: Orquestra o ciclo de turnos, ações, morte de campeões, placar, e comunicação com clientes.
Comunicação
Socket.io: Eventos principais: combatAction, gameStateUpdate, turnUpdate, playerAssigned, etc.
Envelopes de combate: Estrutura { action, effects[], log, state[] } garante animação determinística e sincronização.
Pipeline de Turno (Resumo)
Coleta de ações dos jogadores
Ordenação por prioridade/velocidade
Execução de cada ação (performSkillExecution)
Resolução de efeitos, hooks, passivas
Emissão de efeitos para animação
Aplicação do estado final
