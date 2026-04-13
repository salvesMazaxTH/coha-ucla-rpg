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
    key: "golpe_furioso",
    name: "Golpe Furioso",
    bf: 80,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return `Sengoku desfere um golpe furioso, causando dano ao inimigo.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "bola_de_fogo",
    name: "Bola de Fogo",
    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Sengoku lança uma bola de fogo, causando dano ao inimigo.`;
    },

    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "forma_primordial",
    name: "Forma Primordial",
    isUltimate: true,
    ultCost: 2,
    priority: 0,
    description() {
      return `Sengoku se transforma em sua forma primordial dracônica por 3 turnos.`;
    },
    targetSpec: ["self"],
    resolve({ user, targets, context = {} }) {
      // implementação da transformação
    },
  },
];

export default sengokuSkills;
