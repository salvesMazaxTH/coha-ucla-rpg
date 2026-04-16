import { preChecks } from "./pipeline/01_preChecks.js";
import { prepareDamage } from "./pipeline/02_prepareDamage.js";
import { composeDamage } from "./pipeline/03_composeDamage.js";
import { runBeforeHooks } from "./pipeline/04_beforeHooks.js";
import { runAfterHooks } from "./pipeline/07_afterHooks.js";
import { applyDamage } from "./pipeline/05_applyDamage.js";
import { processObliterate } from "./pipeline/06_obliterate.js";
import { processExtraQueue } from "./pipeline/08_extraQueue.js";
import { buildFinalResult } from "./pipeline/09_resultBuilder.js";

const DEFAULT_HOOK_POLICY = Object.freeze({
  allowOnDot: false,
  allowOnNestedDamage: false,
});

const REACTIVE_HOOKS = new Set([
  "onBeforeDmgDealing",
  "onBeforeDmgTaking",
  "onAfterDmgDealing",
  "onAfterDmgTaking",
]);

export class DamageEvent {
  static Modes = {
    STANDARD: "standard",
    PIERCING: "piercing",
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

    // piercingPercentage: % of the defender's defense to ignore (0-100).
    // Only used when mode === PIERCING. Defaults to 100 (full pierce).
    if (this.mode === DamageEvent.Modes.PIERCING) {
      this.piercingPercentage =
        params.piercingPercentage ??
        params.defenseIgnorePercent ??
        params.piercingPortion ??
        100;
    } else {
      this.piercingPercentage = 0;
    }

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
    this.flags = params.flags ?? {};

    this.damageDepth = this.context.damageDepth ?? 0;

    this.hookPolicy = DEFAULT_HOOK_POLICY;

    // 🔥 ESTADO INTERNO
    this.crit = { didCrit: false };
    this.actualDmg = 0;
    this.hpAfter = null;

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

    // SUPRIMIR log padrão se skill.suppressLog === true
    if (this.skill && this.skill.suppressLog) {
      // Retorna apenas o objeto de resultado, mas sem o campo 'log' padrão
      const result = buildFinalResult(this);
      if (Array.isArray(result)) {
        result.forEach((r) => {
          if (r && r.log) r.log = undefined;
        });
      } else if (result && result.log) {
        result.log = undefined;
      }
      return result;
    }

    return buildFinalResult(this);
  }

  canRunHook(eventName, champ, source) {
    if (!REACTIVE_HOOKS.has(eventName)) return true;

    const context = this.context;
    if (!context) return true;

    const isDot = !!context.isDot;
    const damageDepth = Number(context.damageDepth ?? 0);

    if (!isDot && damageDepth <= 0) return true;

    const policy = {
      ...this.hookPolicy,
      ...(champ?.combatHookPolicy || {}),
      ...(source?.combatHookPolicy || {}),
      ...(source?.hookPolicies?.[eventName] || {}),
    };

    if (damageDepth > 0) {
      if (!policy.allowOnNestedDamage) {
        return false;
      }

      // Dot é um caso específico dentro de dano aninhado.
      if (isDot && !policy.allowOnDot) {
        return false;
      }

      return true;
    }

    if (isDot && !policy.allowOnDot) {
      return false;
    }

    return true;
  }
}
