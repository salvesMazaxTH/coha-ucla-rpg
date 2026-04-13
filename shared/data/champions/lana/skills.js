import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const lanaSkills = [
  // ========================
  // Bloqueio Básico (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "nao_faz_isso",
    name: "Não Faz Isso!",

    priority: 3,

    description() {
      return `Lana bloqueia a próxima habilidade ativa do alvo. Falha se já foi usada no turno anterior.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const lastUsed = user.runtime.lastUsedNaoFazIsso ?? -Infinity; // Valor inicial para garantir que a habilidade possa ser usada no primeiro turno

      if (context.currentTurn - lastUsed <= 1) {
        return {
          message: `${formatChampionName(user)} tentou usar "Não Faz Isso!" novamente, mas falhou por ter sido usado no turno anterior!`,
        };
      }

      user.runtime.lastUsedNaoFazIsso = context.currentTurn;

      // Inicializar hookEffects se não existir
      enemy.runtime.hookEffects ??= [];

      const hookKey = `nao_faz_isso_${user.id}`;

      // Adicionar hook que bloqueia a próxima ação
      enemy.runtime.hookEffects.push({
        key: hookKey,
        group: "skill_effect",
        duration: 1,

        hookScope: {
          onValidateAction: "actionSource",
        },

        onValidateAction({ actionSource }) {
          // Remove o hook após bloquear a ação
          actionSource.runtime.hookEffects =
            actionSource.runtime.hookEffects.filter((h) => h.key !== hookKey);

          return {
            deny: true,
            message: `${formatChampionName(actionSource)} não consegue agir! Sua ação foi bloqueada!`,
          };
        },
      });

      return {
        message: `${formatChampionName(enemy)} teve sua próxima ação bloqueada!`,
      };
    },
  },

  {
    key: "arremesso_telecinetico",
    name: "Arremesso Telecinético",

    bf: 95,
    damageMode: "standard",
    contact: false,

    description() {
      return `Lana arremessa o alvo com força psíquica.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "surto_psiquico",
    name: "Surto Psíquico",

    bf: 110,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    ultCost: 3,

    priority: 0,
    description() {
      return `Lana libera um surto psíquico, causando dano massivo a todos os inimigos. O dano aumenta baseado em quanto de HP Lana perdeu. Se Tutu já morreu, o dano é aumentado em 15%.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const percentLost = (user.maxHP - user.HP) / user.maxHP;
      let baseDamage =
        ((user.Attack * this.bf) / 100) * (1 + percentLost * 0.6);

      // Se Tutu já morreu (Lana.runtime.lana.triggered === true e Lana está em campo), aumenta dano em 15%
      if (user.runtime?.lana?.triggered) {
        baseDamage *= 1.15;
      }

      const results = [];

      for (const enemy of enemies) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        results.push(damageResult);
      }

      return results;
    },
  },
];

export default lanaSkills;
