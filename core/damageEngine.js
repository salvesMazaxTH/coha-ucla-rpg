let editMode = false;
let debugMode = true; // 🔍 ADICIONAR PARA CONTROLAR LOGS

export const DamageEngine = {
  // arredondamentos globais da engine
  roundToFive(x) {
    return Math.round(x / 5) * 5;
  },

  // -------------------------------------------------
  // Crit. related
  // Tabela de crítico
  critTable: {
    1: { bonus: 45, chance: 1 / 6 },
    2: { bonus: 55, chance: 1 / 4 },
    3: { bonus: 65, chance: 2 / 3 },
    4: { bonus: 75, chance: 5 / 6 },
  },

  rollCrit(user, context, options = {}) {
    const { force = false, disable = false } = options;

    const level = user.Critical || 0;
    const entry = this.critTable[level] || { bonus: 0, chance: 0 };

    let { bonus, chance } = entry;

    let didCrit = false;
    let roll = null;

    // 🚫 1. Crítico completamente bloqueado
    if (disable) {
      if (debugMode) {
        console.log(`🚫 CRÍTICO BLOQUEADO`);
      }

      return {
        didCrit: false,
        bonus: 0,
        roll: null,
        forced: false,
        disabled: true,
      };
    }

    // ✅ 2. Crítico forçado
    if (force) {
      if (debugMode) {
        console.log(`✅ CRÍTICO FORÇADO`);
      }

      return {
        didCrit: true,
        bonus,
        roll: null,
        forced: true,
        disabled: false,
      };
    }

    // 🎲 3. Roll normal
    roll = Math.random();
    didCrit = roll < chance;

    if (debugMode) {
      console.log(`🎯 Roll: ${roll.toFixed(4)}`);
      console.log(`🎲 Chance necessária: ${(chance * 100).toFixed(2)}%`);
      console.log(`${didCrit ? "✅ CRÍTICO!" : "❌ Sem crítico"}`);
    }

    return {
      didCrit,
      bonus: didCrit ? bonus : 0,
      roll,
      forced: false,
      disabled: false,
    };
  },

  processCrit({ baseDamage, user, target, context, options = {} }) {
    let crit = {
      level: user?.Critical || 0,
      didCrit: false,
      bonus: 0,
      roll: null,
      forced: false,
    };
    if (crit.level > 0 || options.force || options.disable) {
      crit = this.rollCrit(user, context, options);
    }
    const critBonusFactor = crit.bonus / 100;
    const critExtra = baseDamage * critBonusFactor;

    if (crit.didCrit && user?.passive?.onCriticalHit) {
      if (debugMode) console.log(`🔥 Executando passiva onCriticalHit`);
      user.passive.onCriticalHit({
        user,
        target,
        context,
        forced: crit.forced,
      });
      return crit
    }
  },

  // -------------------------------------------------

  defenseToPercent(defense) {
    if (debugMode) console.group(`🛡️ [DEFENSE DEBUG]`);

    if (!defense) {
      if (debugMode) {
        console.log(`Defense: ${defense} (ou 0)`);
        console.log(`Redução percentual: 0%`);
        console.groupEnd();
      }
      return 0;
    }

    const K = defense >= 25 && defense <= 45 ? 61 : 38;
    const effective = defense / (defense + K);

    if (debugMode) {
      console.log(`Defense value: ${defense}`);
      console.log(
        `K constant: ${K} (defense ${defense >= 25 && defense <= 45 ? "between 25-45" : "outside 25-45"})`,
      );
      console.log(
        `Cálculo: ${defense} / (${defense} + ${K}) = ${defense} / ${defense + K}`,
      );
      console.log(`Redução percentual: ${(effective * 100).toFixed(2)}%`);
      console.log(`Dano que PASSA: ${((1 - effective) * 100).toFixed(2)}%`);
      console.groupEnd();
    }

    return effective;
  },

  // ----------------
  // Modificadores
  _applyDamageModifiers(damage,user,target,skill,context){
  if (!user?.getDamageModifiers) return damage;

  user.purgeExpiredModifiers(context.currentTurn);

  for(const mod of user.getDamageModifiers()){
    if(mod.apply){
      const out = mod.apply({ baseDamage:damage,user,target,skill });
      if(typeof out==="number") damage = out;
    }
  }
  return damage;
},
    
    _applyBeforePassive(mode,damage,crit,user,target,context){
  if(!target.passive?.beforeTakingDamage)
    return { damage, didCrit:crit.didCrit, critExtra:crit.critExtra };

  const r = target.passive.beforeTakingDamage({
    attacker:user,
    target,
    damage,
    critExtra:crit.critExtra,
    damageType:mode,
    crit,
    context
  });

  if(r?.cancelCrit){
    crit.didCrit=false;
    crit.critExtra=0;
  }

  if(r?.reducedCritExtra!==undefined)
    crit.critExtra=Math.max(r.reducedCritExtra,0);

  if(r?.takeBonusDamage)
    damage+=r.takeBonusDamage;

  return { damage, didCrit:crit.didCrit, critExtra:crit.critExtra };
},
    
    _composeFinalDamage(mode,damage,crit,direct,target,context){
  let final = crit.didCrit ? damage + crit.critExtra : damage;

  if(editMode) return 999;

  const defPct=this.defenseToPercent(target.Defense||0);
  const flat=target.getTotalDamageReduction?.()||0;

  if(mode==="raw"){
    final = Math.max(final-final*defPct-flat,0);
  }else{
    const d=Math.min(direct,final);
    const r=final-d;
    final = Math.max(d-flat,0) + Math.max(r-r*defPct-flat,0);
  }

  final=Math.max(final,10);
  return this.roundToFive(final);
},
    
    _applyDamage(target,val){
  target.takeDamage(val);
  return target.HP;
},
    
    _applyAfterPassive(mode,val,user,target,context){
  if(!target.passive?.afterTakingDamage || target.HP<=0) return null;

  const r=target.passive.afterTakingDamage({
    attacker:user,
    target,
    damage:val,
    damageType:mode,
    context
  });

  return r?.log||null;
},
    
    _buildLog(user,target,skill,dmg,crit,hpAfter,passiveLog){
  let log=`${user.name} usou ${skill} e causou ${dmg} a ${target.name}`;

  if(crit.didCrit)
    log+=` (CRÍTICO ${(1+crit.critBonusFactor).toFixed(2)}x)`;

  log+=`\nHP: ${hpAfter}/${target.maxHP}`;

  if(passiveLog) log+=`\n${passiveLog}`;

  return log;
},
    
    _applyLifeSteal(user,dmg,log){
  if(user.LifeSteal>0 && dmg>0){
    const heal=Math.max(5,this.roundToFive(dmg*user.LifeSteal/100));
    user.heal(heal);
    log+=`\nRoubo de vida: ${heal}`;
  }
},
    
    _triggerAfterAttack(user,target,dmg,mode,crit,context,log){
  if(!user.passive?.afterDoingDamage || dmg<=0) return;

  const r=user.passive.afterDoingDamage({
    attacker:user,
    target,
    damage:dmg,
    damageType:mode,
    crit,
    context
  });

  if(r?.log) log+=`\n${r.log}`;
}
    
    

  // ------------------------------------------------- 
  // Calculadora e aplicadora de dano real
resolveDamage(params) {
  const {
    mode = "raw",
    baseDamage,
    directDamage = 0,
    user,
    target,
    skill,
    context,
    options = {},
  } = params;

  if (this._isImmune(target))
    return this._buildImmuneResult(baseDamage, user, target);

  const crit = this._computeCrit(mode, baseDamage, directDamage, user, target, context, options);

  let damage = this._applyDamageModifiers(baseDamage, user, target, skill, context);

  const passiveBefore = this._applyBeforePassive(
    mode, damage, crit, user, target, context
  );

  damage = passiveBefore.damage;
  crit.didCrit = passiveBefore.didCrit;
  crit.critExtra = passiveBefore.critExtra;

  let finalDamage = this._composeFinalDamage(
    mode,
    damage,
    crit,
    directDamage,
    target,
    context
  );

  const hpAfter = this._applyDamage(target, finalDamage);

  const passiveLog = this._applyAfterPassive(
    mode, finalDamage, user, target, context
  );

  const log = this._buildLog(
    user,
    target,
    skill,
    finalDamage,
    crit,
    hpAfter,
    passiveLog
  );

  this._applyLifeSteal(user, finalDamage, log);
  this._triggerAfterAttack(user, target, finalDamage, mode, crit, context, log);

  return {
    baseDamage,
    totalDamage: finalDamage,
    finalHP: target.HP,
    log,
    crit: {
      level: user.Critical || 0,
      didCrit: crit.didCrit,
      bonus: crit.bonus,
      roll: crit.roll,
    },
  };
},
    
    _isImmune(target){
  return target.hasKeyword?.("imunidade absoluta");
},

_buildImmuneResult(baseDamage,user,target){
  return {
    baseDamage,
    totalDamage:0,
    finalHP:target.HP,
    log:`${target.name} está com Imunidade Absoluta!`,
    crit:{ level:0,didCrit:false,bonus:0,roll:null }
  };
},
    
    