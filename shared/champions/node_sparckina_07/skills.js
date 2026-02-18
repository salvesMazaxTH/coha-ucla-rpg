import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";

const nodeSparckina07Skills = [
    {
        key: "ataque_basico",
        name: "Ataque Básico",
        bf: 60,
        contact: true,
        manaCost: 0,
        priority: 0,
        description() {
            return `Custo: ${this.manaCost} MP
Ataque básico genérico (BF ${this.bf}).
Contato: ${this.contact ? "✅" : "❌"}`;
        },
        targetSpec: ["enemy"],
        execute({ user, targets, context = {} }) {
            const { enemy } = targets;
            const baseDamage = (user.Attack * this.bf) / 100;
            return CombatResolver.resolveDamage({
                baseDamage,
                user,
                target: enemy,
                skill: this.name,
                context,
                allChampions: context?.allChampions
            });
        }
    },

    {
        key: "sparkling_slash",
        name: "Sparkling Slash",
        bf: 85,
        contact: true,
        manaCost: 140,
        priority: 0,
        description() {
            return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
Efeitos:
Dano Bruto = BF ${this.bf}`;
        },
        targetSpec: ["enemy"],
        execute({ user, targets, context = {} }) {
            const { enemy } = targets;
            const baseDamage = (user.Attack * this.bf) / 100;
            return CombatResolver.resolveDamage({
                baseDamage,
                user,
                target: enemy,
                skill: this.name,
                context,
                allChampions: context?.allChampions
            });
        }
    },

    {
        key: "radiant_Rush",
        name: "Radiant Rush",
        speedBuff: 15,
        evasionPercent: 10,
        buffDuration: 2,
        contact: false,
        manaCost: 100,
        priority: 0,
        description() {
            return `Custo: ${this.manaCost} MP
Efeitos:
Ganha +${this.speedBuff} VEL e ${this.evasionPercent}% da VEL como ESQ.`;
        },
        targetSpec: ["self"],
        execute({ user, context = {} }) {
            user.modifyStat({
                statName: "Speed",
                amount: this.speedBuff,
                duration: this.buffDuration,
                context
            });

            // buffar a ESQ depois de buffar a VEL para garantir que o aumento de ESQ seja baseado na VEL atualizada
            const evasionBuff = Math.round(
                user.Speed * (this.evasionPercent / 100)
            );

            user.modifyStat({
                statName: "Evasion",
                amount: evasionBuff,
                duration: this.buffDuration,
                context
            });

            return {
                log: `${formatChampionName(user)} acelera radiante (+${this.speedBuff} VEL, +${evasionBuff} ESQ).`
            };
        }
    },

    {
        // Ultimate
        key: "radiant_burst",
        name: "Radiant Burst",
        bf: 135,
        paralyzeDuration: 2,
        contact: true,
        manaCost: 420,
        priority: 0,
        description() {
            return `Custo: ${this.manaCost} MP
Contato: ${this.contact ? "✅" : "❌"}
Efeitos:
Dano Bruto = BF ${this.bf}
100% de chance de aplicar "Paralisado" por ${this.paralyzeDuration} turnos no alvo inimigo.`;
        },
        targetSpec: ["enemy"],
        execute({ user, targets, context = {} }) {
            const { enemy } = targets;
            const baseDamage = (user.Attack * this.bf) / 100;

            const paralyzed = enemy.applyKeyword(
                "paralisado",
                this.paralyzeDuration,
                context
            );

            if (!paralyzed) {
                console.log(
                    `[HABILIDADE — Radiant Burst] ${formatChampionName(user)} tentou aplicar "Paralisado" em ${formatChampionName(enemy)}, mas falhou.`
                );
            }

            return CombatResolver.resolveDamage({
                baseDamage,
                user,
                target: enemy,
                skill: this.name,
                context,
                allChampions: context?.allChampions
            });
        }
    }
];

export default nodeSparckina07Skills;
