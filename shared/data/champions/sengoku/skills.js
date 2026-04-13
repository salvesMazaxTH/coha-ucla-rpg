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
    bf: 95,
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
    duration: 3,
    transformInto: "sengoku_primordial",
    isUltimate: true,
    ultCost: 2,
    priority: 0,
    description() {
      return `Sengoku assume sua forma primordial dracônica por ${this.duration} turnos, alterando suas skills, passiva e atributos.`;
    },
    targetSpec: ["self"],
    resolve({ user, targets, context = {} }) {
      context.requestChampionMutation?.({
        mode: "transform",
        targetId: user.id,
        newChampionKey: this.transformInto,
        duration: this.duration,
        hpMode: "preserveRatio",
        statMode: "deltaFromBase",
      });

      return {
        log: `${formatChampionName(user)} despertou sua <b>Forma Primordial</b> por ${this.duration} turnos!`,
      };
    },
  },
];

export default sengokuSkills;
