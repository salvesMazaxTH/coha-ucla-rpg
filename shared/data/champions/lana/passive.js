import { formatChampionName } from "../../../ui/formatters.js";

function clearLanaSpellShield(owner) {
  if (!Array.isArray(owner.runtime?.shields)) return;

  owner.runtime.shields = owner.runtime.shields.filter(
    (shield) => shield?.type !== "spell",
  );
}

export default {
  key: "amigo_imaginario",
  name: "Amigo Imaginário",

  hpThreshold: 0.35, // 35% do HP

  description() {
    return `Enquanto Tutu estiver vivo, Lana recebe um Escudo de Feitiço no início de cada turno.
    Quando Lana cair abaixo de ${this.hpThreshold * 100}% de HP, ela é substituída por Tutu. Quando Tutu morre, Lana volta 
    para a batalha com o HP que estava antes. Esta habilidade só pode ser ativada uma vez por batalha.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ owner, defender, context }) {
    owner.runtime.lana ??= {
      triggered: false,
    };

    if (owner.runtime.lana.triggered) {
      return;
    }

    const ratio = owner.HP / owner.maxHP;
    if (ratio > this.hpThreshold) {
      return;
    }

    owner.runtime.lana.triggered = true;

    if (!context)
      throw new Error(
        `ERRO: context é undefined ao tentar registrar replaceRequest em ${owner.name}`,
      );

    // Registra intenção de swap (Lana → Tutu)
    // Estado completo de Lana será preservado em inactiveChampions
    context.requestChampionMutation?.({
      targetId: owner.id,
      newChampionKey: "lana_dino",
      mode: "swap",
    });

    return {
      log: `${owner.name} liberou seu Dinossauro de Pelúcia!`,
    };
  },

  onTurnStart({ owner, context }) {
    owner.runtime.lana ??= {
      triggered: false,
    };

    if (owner.runtime.lana.triggered) return;

    clearLanaSpellShield(owner);

    owner.addShield(1, 0, context, "spell");

    return {
      log: `${formatChampionName(owner)} recebeu um Escudo de Feitiço.`,
    };
  },
};
