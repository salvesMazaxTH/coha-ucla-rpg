import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const eryonSkills = [
  // =========================
  // Disparo Básico (global)
  // =========================

  basicShot,
  // =========================
  // Habilidades Especiais
  // =========================

  {
    key: "equalizacao_convergente",
    name: "Equalização Convergente",

    priority: -1,
    description() {
      return `Ajusta o ultômetro de todos os aliados para a média atual +2 unidades.`;
    },
    targetSpec: ["self"],
    resolve({ user, context, resolver }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      if (!allies.length) return;

      const total = allies.reduce((sum, c) => sum + c.ultMeter, 0);
      const avg = Math.floor(total / allies.length);

      for (const ally of allies) {
        const targetValue = Math.min(ally.ultCap, avg + 2);
        const delta = targetValue - ally.ultMeter;

        if (delta !== 0) {
          resolver.applyResourceChange({
            target: ally,
            amount: delta,
            context,
            sourceId: user.id,
          });
        }
      }

      return {
        log: `${user.name} equalizou o fluxo de energia do time.`,
      };
    },
  },

  // =========================
  // Canalização Absoluta
  // =========================
  {
    key: "canalizacao_absoluta",
    name: "Canalização Absoluta",
    priority: 0,
    contact: false,
    description() {
      return `Drena todo o ultômetro dos aliados e transfere para um alvo aliado, concedendo +2 unidades bônus.`;
    },
    targetSpec: ["select:ally"],
    resolve({ user, targets, context }) {
      const [target] = targets;
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      let total = 0;
      console.log("[ERYON][canalizacao_absoluta] Início da skill");
      console.log(
        "[ERYON][canalizacao_absoluta] Alvo da canalização:",
        target?.name,
        "(ID:",
        target?.id,
        ")",
      );
      for (const ally of allies) {
        if (ally.id === target.id) {
          console.log(
            "[ERYON][canalizacao_absoluta] Pulando alvo principal:",
            ally.name,
          );
          continue;
        }
        const amount = ally.ultMeter;
        console.log(
          "[ERYON][canalizacao_absoluta] Drenando de:",
          ally.name,
          "ultMeter:",
          amount,
        );
        if (amount <= 0) {
          console.log(
            "[ERYON][canalizacao_absoluta] Nada a drenar de:",
            ally.name,
          );
          continue;
        }
        ally.spendUlt(amount);
        total += amount;
        console.log(
          "[ERYON][canalizacao_absoluta] Drenado:",
          amount,
          "de",
          ally.name,
          "Total acumulado:",
          total,
        );
      }
      const finalGain = total + 2;
      console.log(
        "[ERYON][canalizacao_absoluta] Total drenado:",
        total,
        "+ bônus: 2 =",
        finalGain,
      );
      target.addUlt({ amount: finalGain, context });
      console.log(
        "[ERYON][canalizacao_absoluta] Ult final do alvo após transferência:",
        target.ultMeter,
      );
      return {
        log: `${user.name} canalizou energia para ${target.name}.`,
      };
    },
  },

  // =========================
  // Colapso Eidólico (ULT)
  // =========================
  {
    key: "colapso_eryonico",
    name: "Colapso Eryônico",
    isUltimate: true,
    ultCost: 1,
    priority: -1,
    contact: false,
    targetSpec: ["all"],
    damagePerUnit: 25,
    maxConsume: 12,
    description() {
      return `Consome todo o ultômetro do time (máx. ${this.maxConsume} unidades) e converte cada unidade em ${this.damagePerUnit} de dano, distribuído aleatoriamente entre um inimigo e seus adjacentes.`;
    },
    resolve({ user, context }) {
      console.log("[ERYON][colapso_eidolico] Início da skill");
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      // 🔹 construir pool de unidades
      let pool = [];
      for (const ally of allies) {
        for (let i = 0; i < ally.ultMeter; i++) {
          pool.push(ally);
        }
      }
      console.log(
        "[ERYON][colapso_eidolico] Pool inicial de ultMeter (ids):",
        pool.map((a) => a.id),
      );
      let consumed = 0;
      const maxConsume = 12;
      while (pool.length > 0 && consumed < maxConsume) {
        const index = Math.floor(Math.random() * pool.length);
        const chosen = pool[index];
        chosen.spendUlt(1);
        pool.splice(index, 1);
        consumed++;
      }
      console.log("[ERYON][colapso_eidolico] Total consumido:", consumed);
      if (consumed === 0) return;
      // 🔹 selecionar alvo primário aleatório (inimigos)
      const enemies = context.aliveChampions.filter(
        (c) => c.team !== user.team,
      );
      if (!enemies.length) return;
      const primary = enemies[Math.floor(Math.random() * enemies.length)];
      console.log(
        "[ERYON][colapso_eidolico] Alvo primário:",
        primary?.name,
        "(ID:",
        primary?.id,
        ")",
      );
      const adjacent = context.getAdjacentChampions
        ? context.getAdjacentChampions(primary) || []
        : [];
      const targets = [primary, ...adjacent];
      console.log(
        "[ERYON][colapso_eidolico] Alvos finais:",
        targets.map((t) => t.name),
      );
      // 🔹 distribuição das porções
      const chunks = consumed; // cada chunk = 25
      const damageMap = new Map();
      for (const t of targets) damageMap.set(t.id, 0);
      for (let i = 0; i < chunks; i++) {
        const randomTarget =
          targets[Math.floor(Math.random() * targets.length)];
        damageMap.set(randomTarget.id, damageMap.get(randomTarget.id) + 25);
      }
      // 🔹 aplicar dano
      for (const target of targets) {
        const dmg = damageMap.get(target.id);
        if (!dmg || dmg <= 0) continue;
        console.log(
          "[ERYON][colapso_eidolico] Aplicando",
          dmg,
          "de dano em",
          target.name,
        );
        new DamageEvent({
          baseDamage: dmg,
          attacker: user,
          defender: target,
          skill: this,
          context,
          allChampions: context.allChampions,
        }).execute();
      }
      return {
        log: `${user.name} colapsou o fluxo eidólico (${consumed} unidades).`,
      };
    },
  },
];

export default eryonSkills;
