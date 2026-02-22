import { CombatResolver } from "../../core/combatResolver.js";
import { formatChampionName } from "../../core/formatters.js";
import basicAttack from "../basicAttack.js";

const blyskartriSkills = [
    basicAttack,
    {
        key: "fluxo_restaurador",
        name: "Fluxo Restaurador",
        manaGiven: 60,
        contact: false,
        manaRestored: 50,
        description() {
            return `Concede ${this.manaGiven} a si ou de um aliado escolhido.`;
        },
        targetSpec: ["select:ally"],
        execute({ user, targets, context = {} }) {
            const { ally } = targets;
            ally.addResource({
                amount: this.manaGiven,
                resourceType: "mana",
                source: user,
                context
            });
            return {
                log: `${formatChampionName(user)} restaurou mana de ${formatChampionName(ally)}.`
            };
        },
    },
];

export default blyskartriSkills;
