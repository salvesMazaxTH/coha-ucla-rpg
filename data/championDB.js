import skillsByChampion from "../champions/index.js";
import { formatChampionName } from "../core/formatters.js";

const editMode = false; // Ative para testar o recuo de Voltexz (dano: 0 ou 999), entre outras coisas. Lembre-se de desativar para o jogo normal!

export const championDB = {
  ralia: {
    name: "Rália",
    portrait: "assets/portraits/ralia.png",
    HP: 365,
    Attack: 45,
    Defense: 75,
    Speed: 40,
    Critical: 0,
    LifeSteal: 15,
    // entityType: "champion" // ex: pra teste, mas campeoes regulares nao vao declarar explicitamente essa propriedade, porque eh a excecao da excecao algum char daqui ser token
    skills: skillsByChampion.ralia,
    passive: {
      name: "Desacreditar",
      description: `🧿 PASSIVA — Desacreditar
      Sempre que Rália sofrer um Acerto Crítico ou receber dano de qualquer fonte que não ela própria:
      O bônus de dano do crítico é reduzido em −45 (mínimo 0).
      Se o bônus for reduzido a 0, o atacante não ativa efeitos ligados a crítico neste acerto.
`,
      beforeDamageTaken({ crit, attacker, target, self }) {
        if (self !== target) return;
        console.log(
          `[PASSIVA RÁLIA] Entrou | Crit=${crit.didCrit} | Bônus atual=${crit.bonus}% | Atacante=${attacker.name}`,
        );
        let { critExtra } = crit;
        critExtra = Number(critExtra) || 0;

        if (!crit.didCrit) return;
        const reducedBonus = Math.max(critExtra - 45, 0);
        if (reducedBonus === 0) {
          return {
            crit: {
              ...crit,
              didCrit: false,
              critExtra: 0,
            },
          };
        }
        return {
          crit: {
            ...crit,
            critExtra: reducedBonus,
          },
        };
      },
    },
  },

  naelys: {
    name: "Naelys",
    portrait: "assets/portraits/naelys.png",
    HP: 305,
    Attack: 40,
    Defense: 40,
    Speed: 35,
    Critical: 0,
    LifeSteal: 0,
    skills: skillsByChampion.naelys,
    passive: {
      name: "Mar que Retorna",
      description: `
        Sempre que Naelys receber dano,
        ele se cura em +5 para cada 25 de HP perdido neste acerto.
        (Máx. +35 por acerto)`,
      afterDamageTaken({ target, attacker, damage, self }) {
        if (damage <= 0) return;

        if (self !== target) return;

        let heal = Math.floor(damage / 25) * 5;

        heal = Math.min(heal, 35);

        if (heal <= 0) return;

        const before = self.HP;
        self.heal(heal);

        console.log(
          `[PASSIVA NAELYS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${self.HP}`,
        );

        const selfName = formatChampionName(self);
        return {
          log: `[PASSIVA — Mar que Retorna] ${selfName} recuperou ${heal} HP.`,
        };
      },
    },
  },

  vael: {
    name: "Vael",
    portrait: "assets/portraits/vael.png",
    HP: 290,
    Attack: 100,
    Defense: 20,
    Speed: 80,
    Critical: 25,
    LifeSteal: 0,
    skills: skillsByChampion.vael,
    passive: {
      name: "Sede de Sangue",
      description:
        "Cada acerto crítico aumenta a chance de crítico em +15% (máx. 95%). Quando a chance de crítico ultrapassa 50%, o bônus de crítico sobe para 1,85x.",
      onCriticalHit({ user, target, context }) {
        user.modifyStat({
          statName: "Critical",
          amount: 15,
          context,
          isPermanent: true,
        });
        if (user.Critical > 50) {
          user.critBonusOverride = 85;
        }
        console.log(
          `${user.name} ganhou +15% Critical por causa de Sede de Sangue! Critical atual: ${user.Critical}%` +
            (user.critBonusOverride === 85 ? ` | Bônus de crítico: 1.85x` : ``),
        );
      },
    },
  },

  tharox: {
    name: "Tharox",
    portrait: "assets/portraits/tharox.png",
    HP: 380,
    Attack: 40,
    Defense: 80,
    Speed: 20,
    Critical: 0,
    LifeSteal: 0,
    skills: skillsByChampion.tharox,
    passive: {
      name: "Massa Inamolgável",
      description:
        "Sempre que Tharox tomar dano, ele ganha 1 acúmulo de Inércia. Ao chegar a 2, consome ambos e ganha +10 Defesa e +10 HP (cura e aumenta a vida máxima).",
      afterDamageTaken({ target, damage, context, attacker, self }) {
        if (self !== target) return;
        if (damage <= 0) return;

        self.fake.tharoxInerciaStacks =
          (self.fake.tharoxInerciaStacks || 0) + 1;

        if (self.fake.tharoxInerciaStacks < 2) {
          return {
            log: `[Passiva - Massa Inamolgável] ${self.name} acumulou Inércia (${self.fake.tharoxInerciaStacks}/2).`,
          };
        }

        self.fake.tharoxInerciaStacks = 0;

        const statResult = self.modifyStat({
          statName: "Defense",
          amount: 10,
          duration: 1,
          context,
          isPermanent: true,
        });
        self.modifyHP(10, { affectMax: true });

        let log = `[Passiva - Massa Inamolgável] ${self.name} consumiu 2 Inércia e ganhou +10 Defesa e +10 HP! (Defesa: ${self.Defense}, HP: ${self.HP}/${self.maxHP})`;

        if (statResult?.log) {
          log += `\n${statResult.log}`;
        }

        return { log };
      },
    },
  },

  voltexz: {
    name: "Voltexz",
    portrait: "assets/portraits/voltexz.png",
    HP: 285,
    Attack: 110,
    Defense: 15,
    Speed: 85,
    Critical: 0,
    LifeSteal: 0,
    skills: skillsByChampion.voltexz,
    passive: {
      name: "Sobrecarga Instável",
      description: `Sempre que Voltexz causar dano, ela sofre 25% do dano efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Sobrecarga". Ao atacar um alvo com "Sobrecarga", Voltexz causa 15% de dano adicional (consome o status) (Dano adicional Mín. 15) e tem 50% de chance de aplicar "Paralisado" (o alvo perde a próxima ação neste turno).`,

      afterDamageTaken({
        attacker,
        target,
        damage,
        damageType,
        context,
        self,
      }) {
        if (self !== attacker) return;

        let log = "";

        if (damage > 0) {
          const recoilDamage = editMode
            ? 999
            : Math.round((damage * 0.25) / 5) * 5;

          if (recoilDamage > 0) {
            self.takeDamage(recoilDamage);
            log += `⚡ ${self.name} sofreu ${recoilDamage} de dano de recuo por Sobrecarga Instável!`;
          }
        }

        target.applyKeyword("sobrecarga", 2, context);
        log += `\n⚡ ${target.name} foi marcado com "Sobrecarga"!`;

        return { log };
      },

      beforeDamageDealt({ attacker, crit, target, damage, context, self }) {
        if (self !== attacker) return;

        if (!target.hasKeyword?.("sobrecarga")) return;

        const bonusDamage = Math.ceil((damage * 15) / 100);

        target.removeKeyword("sobrecarga");

        let log = `⚡ ACERTO ! ${attacker.name} explorou "Sobrecarga" de ${target.name} (+15% dano)!`;

        const paralysisChance = Math.random();
        if (paralysisChance < 0.5) {
          target.applyKeyword("paralisado", 1, context, {});
          log += `\n⚡ ${target.name} foi PARALISADO e perderá sua próxima ação!`;
        }

        return {
          damage: damage + bonusDamage,
          log,
        };
      },
    },
  },

  serene: {
    name: "Serene",
    portrait: "assets/portraits/serene.png",
    HP: 350,
    Attack: 40,
    Defense: 30,
    Speed: 40,
    Critical: 0,
    LifeSteal: 0,
    skills: skillsByChampion.serene,
    passive: {
      name: "Calmaria Protetora",
      description: `Sempre que Serene terminar um turno sem ter seu HP reduzido,
  ela cura 15% do seu HP máximo no início do próximo turno.`,

      // Marca dano recebido no turno
      afterDamageTaken({ target, attacker, context, self }) {
        if (self !== target) return;
        self.runtime.sereneDamagedTurn = context.currentTurn;
      },

      // Executa no início do turno
      onTurnStart({ target, context }) {
        const self = target;
        const lastDamaged = self.runtime.sereneDamagedTurn;

        if (self !== target) return;

        // Se NÃO tomou dano no turno anterior
        if (lastDamaged === context.currentTurn - 1) return;

        const heal = Math.round((target.maxHP * 0.15) / 5) * 5;
        if (heal <= 0 || target.HP >= target.maxHP) return;

        const before = target.HP;
        target.heal(heal);

        return {
          log: `[PASSIVA — Calmaria Protetora] ${formatChampionName(target)} recuperou ${heal} HP (${before} → ${target.HP}).`,
        };
      },
    },
  },

  reyskarone: {
    name: "Reyskarone",
    portrait: "assets/portraits/reyskarone.png",
    HP: 320,
    Attack: 50,
    Defense: 35,
    Speed: 30,
    Critical: 0,
    LifeSteal: 20,
    skills: skillsByChampion.reyskarone,
    passive: {
      name: "Ecos de Vitalidade",
      description: `
      Sempre que um aliado curar por Roubo de Vida,Reyskarone recupera 30% desse valor.`,

      onLifeSteal({ source, amount, self }) {
        // ✔ Só aliados, ignorar o próprio Reyskarone
        if (source.team !== self.team && source !== self) return;

        const heal = Math.round((amount * 0.3) / 5) * 5;
        if (heal <= 0 || self.HP >= self.maxHP) return;

        self.heal(heal);

        return {
          log: `[PASSIVA — Ecos de Vitalidade] ${formatChampionName(self)} absorveu ecos vitais de ${formatChampionName(source)} (+${heal} HP).`,
        };
      },

      beforeDamageDealt({ attacker, target, damage, self }) {
        // alvo não tem tributo
        if (!target.hasKeyword?.("tributo")) return;

        // só aliados do Reyskarone
        if (attacker.team !== self.team) return;

        // não buffa inimigos nem neutros
        if (damage <= 0) return;

        const bonus = 10;

        return {
          damage: damage + bonus,
          log: `🩸 Tributo amplificou o golpe de ${attacker.name} (+${bonus} dano)`,
        };
      },

      afterDamageDealt({ attacker, target, context, self }) {
        if (!target.hasKeyword?.("tributo")) return;

        // só aliados do Reyskarone
        if (attacker.team !== self.team) return;

        const heal = 15;
        if (heal <= 0 || attacker.HP >= attacker.maxHP) return;
        attacker.heal(heal);

        return {
          log: `🩸 Tributo: ${attacker.name} recuperou ${heal} HP.`,
        };
      },
    },
  },

  gryskarchu: {
    name: "Gryskarchu",
    portrait: "assets/portraits/gryskarchu.png",
    HP: 365,
    Attack: 35,
    Defense: 80,
  },
};
