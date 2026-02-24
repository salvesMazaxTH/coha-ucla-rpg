// shared/core/keywordTurnEffects.js

export const KeywordTurnEffects = {
    queimando: {
        onTurnStart({ champion, context, allChampions }) {
            const damage = 25;

            return {
                type: "damage",
                mode: "direct",
                amount: damage,
                skill: { key: "burn_tick", name: "Queimadura" }
            };
        }
    },

    envenenado: {
        onTurnStart({ champion }) {
            const damage = 15;

            return {
                type: "damage",
                mode: "direct",
                amount: damage,
                skill: { key: "poison_tick", name: "Veneno" }
            };
        }
    }
};
