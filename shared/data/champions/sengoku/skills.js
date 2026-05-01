import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const sengokuSkills = [
  // ========================
  // Bloqueio Total (global)
  // ========================
  totalBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "golpe_furioso",
    name: "Golpe Furioso",
    bf: 70,
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "bola_de_fogo",
    name: "Bola de Fogo",
    bf: 45,
    contact: false,
    damageMode: "piercing",
    piercingPercentage: 50,
    priority: 0,
    element: "fire",

    description() {
      return `Sengoku lança uma bola de fogo, causando dano perfurante ao inimigo (${this.piercingPercentage}% de perfuração).`;
    },

    targetSpec: ["enemy"],
    resolve({ user, targets, context }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      return new DamageEvent({
        baseDamage,
        mode: DamageEvent.Modes.PIERCING,
        piercingPercentage: this.piercingPercentage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
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
    ultCost: 3,
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
