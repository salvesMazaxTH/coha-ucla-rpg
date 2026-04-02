import { formatChampionName } from "../../../ui/formatters.js";

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
      storedHP: null,
    };

    if (owner.runtime.lana.triggered) return;

    const ratio = owner.HP / owner.maxHP;
    if (ratio > this.hpThreshold) return;

    owner.runtime.lana.triggered = true;
    owner.runtime.lana.storedHP = owner.HP;

    // 👇 NÃO executa, só registra intenção
    context.flags ??= {};
    context.flags.replaceRequests ??= [];

    context.flags.replaceRequests.push({
      targetId: owner.id,
      newChampionKey: "lana_dino",
      preserveRuntime: true,
    });

    return {
      log: `${owner.name} liberou seu Dinossauro de Pelúcia!`,
    };
  },

  onTurnStart({ owner, context }) {
    if (owner.runtime.lana?.triggered) return;
    
  }
};

