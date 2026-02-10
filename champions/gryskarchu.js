import { DamageEngine } from "../core/damageEngine.js";
import { formatChampionName } from "../core/formatters.js";

const gryskarchuSkills = [
  // =========================
  // Ataque Básico
    // =========================
    {
        key: "ataque_basico",
        name: "Ataque Básico",
        description: `Ataque padrão (100% ATQ).`,
        cooldown: 0,
        priority: 0,
        targetSpec: ["enemy"],
        execute({ user, targets, context }) {
            const { enemy } = targets;
            return DamageEngine.resolveDamage({
                baseDamage: user.Attack,
                user,
                target: enemy,
                skill: this.name,
                context,
            });
        },
    },

    {
        
    }
];
export default gryskarchuSkills;