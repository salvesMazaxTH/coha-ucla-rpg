import skillsByChampion from "../champions/index.js";

export const championDB = {
  ralia: {
    name: "Rália",
    portrait: "assets/portraits/ralia.png",
    HP: 370,
    Attack: 45,
    Defense: 75,
    Speed: 40,
    Critical: 0,
    LifeSteal: 15,
    skills: skillsByChampion.ralia,
    passive: {
      name: "Desacreditar",
      description: `🧿 PASSIVA — Desacreditar
      Sempre que Rália sofrer um Acerto Crítico ou receber dano de qualquer fonte que não ela própria:
      O bônus de dano do crítico é reduzido em −45 (mínimo 0).
      Se o bônus for reduzido a 0, o atacante não ativa efeitos ligados a crítico neste acerto.
`,
      beforeTakingDamage({ crit, attacker, target }) {
        console.log(
          `[PASSIVA RÁLIA] Entrou | Crit=${crit.didCrit} | Bônus atual=${crit.bonus}% | Atacante=${attacker.name}`,
        );
        let { critExtra } = crit;
        critExtra = Number(critExtra) || 0;

        if (!crit.didCrit) return;
        const reducedBonus = Math.max(critExtra - 45, 0);
        if (reducedBonus === 0) {
          return {
            cancelCrit: true,
          };
        }
        return { critExtra: reducedBonus };
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
      afterTakingDamage({ target, damage }) {
        if (damage <= 0) return;

        let heal = Math.floor(damage / 25) * 5;

        heal = Math.min(heal, 35);

        if (heal <= 0) return;

        const self = target;

        const before = self.HP;
        self.heal(heal);

        console.log(
          `[PASSIVA NAELYS] Mar que Retorna → damage=${damage}, heal=${heal}, HP ${before} → ${self.HP}`,
        );

        return {
          log: `[PASSIVA — Mar que Retorna] ${self.name} recuperou ${heal} HP.`,
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
    HP: 385,
    Attack: 40,
    Defense: 65,
    Speed: 20,
    Critical: 0,
    LifeSteal: 0,
    skills: skillsByChampion.tharox,
    passive: {
      name: "Massa Inamolgável",
      description:
        "Sempre que Tharox sofrer Dano Bruto (não Direto), ele recebe +5 de Defesa e +5 de HP (cura e aumenta a vida máxima).",
      afterTakingDamage({ attacker, target, damage, damageType, context }) {
        const self = target;
        if (damageType === "raw" && damage > 0) {
          const statResult = self.modifyStat({
            statName: "Defense",
            amount: 5,
            duration: 1,
            context,
            isPermanent: true,
          });
          self.modifyHP(5, { affectMax: true });

          let log = `[Passiva - Massa Inamolgável] ${self.name} absorveu o impacto, ganhando +5 Defesa e +5 HP! (Defesa: ${self.Defense}, HP: ${self.HP}/${self.maxHP})`;

          if (statResult?.log) {
            log += `\n${statResult.log}`;
          }

          console.log(
            `${self.name} ganhou +5 Defesa e +5 HP por causa de Massa Inamolgável! Defesa atual: ${self.Defense}, HP atual: ${self.HP}/${self.maxHP}`,
          );
          return { log };
        }
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
      description: `Sempre que Voltexz causar dano, ela sofre 25% do dano efetivamente causado como recuo. Além disso, ao causar dano, ela marca o alvo com "Energizado". Ao atacar um alvo "Energizado", Voltexz causa 15% de dano adicional (consome o status) e tem 50% de chance de aplicar "Paralisado" (o alvo perde a próxima ação neste turno).`,

      afterDealingDamage({ attacker, target, damage, damageType, context }) {
        const self = attacker;
        if (self !== attacker) return;
        let log = "";

        if (damage > 0) {
          const recoilDamage = Math.round((damage * 0.25) / 5) * 5;

          if (recoilDamage > 0) {
            self.takeDamage(recoilDamage);
            log += `⚡ ${self.name} sofreu ${recoilDamage} de dano de recuo por Sobrecarga Instável!`;
          }
        }

        target.applyKeyword("energizado", 2, context);
        log += `\n⚡ ${target.name} foi marcado com "Energizado"!`;

        return { log };
      },

      beforeDealingDamage({ attacker, target, damage, context }) {
        if (!target.hasKeyword?.("energizado")) return;

        const bonusDamage = Math.ceil((damage * 15) / 100);

        target.removeKeyword("energizado");

        let log = `⚡ ACERTO ! ${attacker.name} explorou "Energizado" de ${target.name} (+15% dano)!`;

        const paralysisChance = Math.random();
        if (paralysisChance < 0.5) {
          target.applyKeyword("paralisado", 1, context, {});
          log += `\n⚡ ${target.name} foi PARALISADO e perderá sua próxima ação!`;
        }

        return {
          takeBonusDamage: bonusDamage,
          log,
        };
      },
    },
  },
};
