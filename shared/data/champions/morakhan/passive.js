import { formatChampionName } from "../../../ui/formatters.js";

export default {
    key: "primeiro_sutra_coracao_adamantino",
    name: "Primeiro Sutra: Coração Adamantino",

    description() {
        return `Reduz o dano sofrido em 10% (exceto absoluto), se for um ataque de contato, também recebe 25 de redução adicional. Além disso, Morakhan ganha um acúmulo de Estabilidade (máx. 3) a cada vez que sofre dano de contato, cada acúmulo reduz o próximo dano recebido em 10%. Após ser atingido, consome todos os acúmulos.`;
    },

    hookScope: {
        onBeforeDmgTaking: "defender"
    },

    onBeforeDmgTaking({ defender, damage, skill, context, owner }) {
        const isContact = skill?.contact;

        let finalDamage = damage;
        let log = "";

        if (isContact) {
            finalDamage = Math.max(0, damage - 25); // Redução fixa de 25 para ataques de contato
        }

        finalDamage = finalDamage * 0.9; // Redução de 10% para todos os ataques

        // Aplica redução adicional por acúmulos de Estabilidade
        const stabilityStacks = owner.runtime?.stabilityStacks || 0;
        if (stabilityStacks > 0) {
            finalDamage = finalDamage * (1 - 0.1 * stabilityStacks); // Reduz 10% por acúmulo
            owner.runtime.stabilityStacks = 0; // Consome todos os acúmulos após ser atingido

            context.registerDialog?.({
                message: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} consumiu ${stabilityStacks} acúmulo(s) de Estabilidade para reduzir o dano!`,
                sourceId: owner.id,
                targetId: defender.id,
            });

            log = `[Passiva - <b>${this.name}</b>] ${formatChampionName(owner)} consumiu ${stabilityStacks} acúmulo(s) de Estabilidade para reduzir o dano.`;
        }

        return {damage: finalDamage, log};
    },
    
}