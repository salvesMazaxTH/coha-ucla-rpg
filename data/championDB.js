import skillsByChampion from "../champions/index.js";

export const championDB = {
  ralia: {
    name: "Rália",
    portrait: "assets/portraits/ralia.png",
    HP: 370,
    Attack: 30,
    Defense: 60,
    Speed: 40,
    Critical: 0,
    LifeSteal: 15, // Rália tem 15% de LifeSteal
    skills: skillsByChampion.ralia,
    passive: {
      name: "Desacreditar",
      description: `🧿 PASSIVA — Desacreditar
      Sempre que Rália sofrer um Acerto Crítico ou receber dano de qualquer fonte que não ela própria:
      O bônus de dano do crítico é reduzido em −45 (mínimo 0).
      Se o bônus for reduzido a 0, o atacante não ativa efeitos ligados a crítico neste acerto.
`,
      beforeDamage({ crit, critExtra, attacker, target }) {
        console.log(
          `[PASSIVA RÁLIA] Entrou | Crit=${crit.didCrit} | Bônus atual=${crit.bonus}% | Atacante=${attacker.name}`,
        );
        // Reduz o bônus de crítico em 45 (mínimo 0)
        if (!crit.didCrit) return; // Só ativa se for crítico
        const reducedBonus = Math.max(critExtra - 45, 0);
        if (reducedBonus === 0) {
          return {
            cancelCrit: true,
          };
        }
        return { reducedCritExtra: reducedBonus };
      },
    },
  },

  naelys: {
    name: "Naelys",
    portrait: "assets/portraits/naelys.png",
    HP: 305,
    Attack: 30,
    Defense: 20,
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
      afterDamage({ target, damage }) {
        if (damage <= 0) return;

        // +5 for every 25 damage taken
        let heal = Math.floor(damage / 25) * 5;

        // Cap at 35
        heal = Math.min(heal, 35);

        if (heal <= 0) return;

        const self = target; // "self" for clarity: this is the damage target, but also the owner of the passive

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
    Attack: 90,
    Defense: 15,
    Speed: 80,
    Critical: 2,
    LifeSteal: 0,
    skills: skillsByChampion.vael,
    passive: {
      name: "Sede de Sangue",
      description: "Cada acerto crítico eleva o stat Critical em +1 (Máx. 3x)",
      onCriticalHit({ user, target, context }) {
        user.Critical = Math.min(user.Critical + 1, 4);
        console.log(
          `${user.name} ganhou +1 Critical por causa de Sede de Sangue! Critical atual: ${user.Critical}`,
        );
      },
    },
  },

  tharox: {
    name: "Tharox",
    portrait: "assets/portraits/tharox.png",
    HP: 385,
    Attack: 30,
    Defense: 50,
    Speed: 20,
    Critical: 0,
    LifeSteal: 0,
    skills: skillsByChampion.tharox,
    passive: {
      name: "Massa Inamolgável",
      description:
        "Sempre que Tharox sofrer Dano Bruto (não Direto), ele recebe +5 de Defesa e +5 de HP (cura e aumenta a vida máxima).",
      afterDamage({ attacker, target, damage, damageType, context }) {
        // Renomear para clareza: target (do dano) = self (dono da passiva)
        const self = target;
        // Só ativa para Dano Bruto e se realmente tiver tomado dano
        if (damageType === "raw" && damage > 0) {
          self.Defense += 5;
          self.HP = Math.min(self.HP + 5, self.maxHP + 5); // Cura 5 de HP, aumentando o máximo também
          self.maxHP += 5;
          console.log(
            `${self.name} ganhou +5 Defesa e +5 HP por causa de Massa Inamolgável! Defesa atual: ${self.Defense}, HP atual: ${self.HP}/${self.maxHP}`,
          );
          return {
            log: `[Passiva - Massa Inamolgável] ${self.name} absorveu o impacto, ganhando +5 Defesa e +5 HP! (Defense: ${self.Defense}, HP: ${self.HP}/${self.maxHP})`,
          };
        }
      },
    },
  },
};
