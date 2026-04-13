import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const sengokuSkills = [
  // ========================
  // Bloqueio Básico (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "onda_de_ferro",
    name: "Onda de Ferro",
    bf: 80,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return `Sengoku desfere uma onda de energia metálica, causando dano ao inimigo e aplicando "Enraizado" por 1 turno.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
      if (!result?.evaded && !result?.immune) {
        enemy.applyStatusEffect("enraizado", 1, context);
      }
      return result;
    },
  },
  {
    key: "equilibrio_ancestral",
    name: "Equilíbrio Ancestral",
    priority: -1,
    description() {
      return `Sengoku equaliza o ultômetro de todos os aliados para a média atual +1 unidade.`;
    },
    targetSpec: ["self"],
    resolve({ user, context, resolver }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      if (!allies.length) return;
      const total = allies.reduce((sum, c) => sum + c.ultMeter, 0);
      const avg = Math.floor(total / allies.length);
      for (const ally of allies) {
        const targetValue = Math.min(ally.ultCap, avg + 1);
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
  {
    key: "golpe_do_destino",
    name: "Golpe do Destino",
    bf: 120,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    ultCost: 3,
    priority: 0,
    description() {
      return `Sengoku canaliza seu poder ancestral, causando dano massivo a todos os inimigos. O dano aumenta quanto menor o HP de Sengoku.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );
      const missingHP = user.maxHP - user.HP;
      const baseDamage =
        ((user.Attack * this.bf) / 100) * (1.2 + missingHP / 1200);
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

export default sengokuSkills;
