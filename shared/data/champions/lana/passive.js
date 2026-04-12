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
      originalId: owner.id, // Guardar ID original de Lana antes de qualquer swap
    };

    console.log(
      `[replaceChampionDebug] onAfterDmgTaking disparado em ${owner.name} | HP: ${owner.HP}/${owner.maxHP} (ratio: ${(owner.HP / owner.maxHP).toFixed(3)}) | threshold: ${this.hpThreshold} | já triggerado: ${owner.runtime.lana.triggered}`,
    );

    if (owner.runtime.lana.triggered) {
      console.log(
        `[replaceChampionDebug] Passiva já foi ativada antes — ignorando.`,
      );
      return;
    }

    const ratio = owner.HP / owner.maxHP;
    if (ratio > this.hpThreshold) {
      console.log(
        `[replaceChampionDebug] HP ainda acima do threshold (${(ratio * 100).toFixed(1)}% > ${this.hpThreshold * 100}%) — não ativa.`,
      );
      return;
    }

    owner.runtime.lana.triggered = true;

    console.log(
      `[replaceChampionDebug] Threshold atingido! Registrando replaceRequest: targetId=${owner.id}, newChampionKey="lana_dino", mode="swap"`,
    );

    if (!context)
      throw new Error(
        `[replaceChampionDebug] ERRO: context é undefined ao tentar registrar replaceRequest em ${owner.name}`,
      );

    // Registra intenção de swap (Lana → Tutu)
    // Estado completo de Lana será preservado em inactiveChampions
    context.flags ??= {};
    context.flags.replaceRequests ??= [];

    context.flags.replaceRequests.push({
      targetId: owner.id,
      newChampionKey: "lana_dino",
      mode: "swap",
    });

    console.log(
      `[replaceChampionDebug] replaceRequest registrado (swap Lana→Tutu). Total na fila: ${context.flags.replaceRequests.length}`,
    );

    return {
      log: `${owner.name} liberou seu Dinossauro de Pelúcia!`,
    };
  },

  /* onTurnStart({ owner, context }) {
    if (owner.runtime.lana?.triggered) return;
    owner.addShield();
    // amount, decayPerTurn = 0, context, type = "regular"
  }, */
};
