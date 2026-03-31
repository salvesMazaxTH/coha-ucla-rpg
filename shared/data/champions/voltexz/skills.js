/* import { CombatResolver } from "../../engine/combat/combatResolver.js"; */
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicBlock from "../basicBlock.js";

const voltexzSkills = [
  // ========================
  // Bloqueio Básico (global)
  // ========================
  basicBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "relampagos_gemeos",
    name: "Relâmpagos Gêmeos",
    bf: 45,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "lightning",
    description() {
      return `Causa dano em até dois inimigos (pode escolher o mesmo alvo para ambos).`;
    },
    targetSpec: [{ type: "enemy" }, { type: "enemy" }],

    resolve({ user, targets, context = {} }) {
      const [primary, secondary] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      if (primary) {
        /* console.log(
          "🌊 ALL-CHAMPIONS DEBUG, allChampions in context (Voltexz 1st skill):",
          context?.allChampions,
        );
        */

        const primaryResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: primary,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        // console.log("🌊 Target affinities:", primary.elementalAffinities);
        results.push(primaryResult);
      }

      if (secondary) {
        const secondaryResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: secondary,
          skill: this,
          context,
          allChampions: context?.allChampions,
        }).execute();
        // console.log("🌊 Target affinities:", secondary.elementalAffinities);
        results.push(secondaryResult);
      }

      return results;
    },
  },
  {
    key: "choque_estatico",
    name: "Choque Estático",
    bf: 20,
    paralyzeDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 1,
    element: "lightning",
    description() {
      return `Causa dano (BF ${this.bf}) e deixa o alvo {paralisado} por ${this.paralyzeDuration} turno(s), fazendo-o perder a próxima ação.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(damageResult);

      const damageArray = Array.isArray(damageResult)
        ? damageResult
        : [damageResult];

      const mainDamage = damageArray[0];

      let paralyzed;

      console.log(
        "[Votexz - Choque Estático] DamageResult (mainDamage):",
        mainDamage,
        "mainDamage.totalDamage:",
        mainDamage?.totalDamage,
      );

      // Aplica o efeito de paralisia (só se o golpe chegou)
      if (!mainDamage?.evaded && !mainDamage?.immune && mainDamage?.totalDamage > 0) {
        paralyzed = enemy.applyStatusEffect(
          "paralisado",
          this.paralyzeDuration,
          context,
        );
      }

      if (paralyzed) {
        /* console.log(
          `${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`,
        );
        */
        // if (paralyzed && paralyzed.log && damageResult?.log) {
        //   damageResult.log += `\n${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`;
        // } else if (paralyzed && paralyzed.log) {
        //   damageResult.log = `${formatChampionName(enemy)} foi PARALISADO por Choque Estático e perderá sua próxima ação!`;
        // }
      }

      return results;
    },
  },

  {
    key: "descarga_cataclismica",
    name: "Descarga Cataclísmica",
    bf: 185,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    ultCost: 3,
    priority: 0,
    element: "lightning",
    description() {
      return `Causa dano massivo ao inimigo.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];
      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(damageResult);

      return results;
    },
  },
];

export default voltexzSkills;
