import { preChecks } from "./pipeline/01_preChecks.js";
import { prepareDamage } from "./pipeline/02_prepareDamage.js";
import { composeDamage } from "./pipeline/03_composeDamage.js";
import { runBeforeHooks } from "./pipeline/04_beforeHooks.js";
import { runAfterHooks } from "./pipeline/07_afterHooks.js";
import { applyDamage } from "./pipeline/05_applyDamage.js";
import { processObliterate } from "./pipeline/06_obliterate.js";
import { processExtraQueue } from "./pipeline/08_extraQueue.js";
import { buildFinalResult } from "./pipeline/09_resultBuilder.js";

export class DamageEvent {
  static Modes = {
    STANDARD: "standard",
    HYBRID: "hybrid",
    ABSOLUTE: "absolute",
  };

  static GLOBAL_DMG_CAP = 999;

  static debugMode = true;

  constructor(params) {
    const { attacker, defender, skill, context, baseDamage } = params;

    if (!attacker && !context?.isDot) {
      throw new Error("DamageEvent precisa de attacker");
    }

    if (!defender) {
      throw new Error("DamageEvent precisa de defender");
    }

    this.mode = params.mode ?? DamageEvent.Modes.STANDARD;

    this.baseDamage = Number(baseDamage ?? 0);
    this.damage = this.baseDamage;

    this.piercingPortion = params.piercingPortion || 0;

    this.attacker = attacker;
    console.log(
      "[DamageEvent_constructor] Attacker in DamageEvent:",
      this.attacker,
    );
    this.defender = defender;
    console.log(
      "[DamageEvent_constructor] Defender in DamageEvent:",
      this.defender,
    );
    this.skill = skill;

    this.context = context ?? {};
    this.allChampions =
      params.allChampions instanceof Map
        ? [...params.allChampions.values()]
        : (params.allChampions ?? []);
    // console.log(
    //   "[DamageEvent_constructor] ALL-CHAMPIONS DEBUG allChampions in DamageEvent:",
    //   this.allChampions,
    // );
    this.critOptions = params.critOptions ?? [];

    this.damageDepth = this.context.damageDepth ?? 0;

    // 🔥 ESTADO INTERNO
    this.crit = { didCrit: false };
    this.actualDmg = 0;
    this.hpAfter = null;

    this.preMitigatedDamage = 0;
    this.finalDamage = 0;
    this.evasionAttempted = false;

    this.beforeLogs = [];
    this.afterLogs = [];
    this.extraResults = [];
    this.lifesteal = null;

    this.context.extraDamageQueue ??= [];
    /* this.context.extraLogs ??= []; */
  }

  execute() {
    const earlyExit = preChecks(this);
    if (earlyExit) return earlyExit;

    prepareDamage(this);

    composeDamage(this);

    runBeforeHooks(this);

    applyDamage(this);

    processObliterate(this);

    runAfterHooks(this);

    processExtraQueue(this);

    this.context.ignoreMinimumFloor = false;

    return buildFinalResult(this);
  }
}
