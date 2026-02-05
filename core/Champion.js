export class Champion {
  constructor({
    id,
    name,
    portrait,
    HP,
    Attack,
    Defense,
    Speed,
    Critical,
    LifeSteal,
    skills,
    team,
    passive,
  }) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.portrait = portrait;

    this.maxHP = HP;
    this.HP = HP;
    this.baseAttack = Attack;
    this.Attack = Attack;
    this.Defense = Defense;
    this.baseDefense = Defense;
    this.Speed = Speed;
    this.baseSpeed = Speed;
    this.Critical = Critical;
    this.baseCritical = Critical;
    this.LifeSteal = LifeSteal;
    this.baseLifeSteal = LifeSteal;

    this.skills = skills;
    this.passive = passive || null;

    console.log(`[Champion] Passive recebida:`, this.passive);
    console.log(
      `[Champion] onCriticalHit existe?`,
      typeof this.passive?.onCriticalHit,
    );

    this.damageModifiers = [];
    this.statModifiers = []; // New array to track temporary stat changes
    this.provokeEffects = []; // New array to track provoke effects applied to this champion
    this.damageReductionModifiers = []; // New array to track temporary damage reduction

    this.alive = true;
    this.cooldowns = new Map();
    this.hasActedThisTurn = false; // New property to track if the champion has acted this turn
    // 🔥 ULTIMATE LOCK (cooldown inicial)
    this.initUltimateLock();
  }

  // Método para inicializar o bloqueio da ultimate no início do combate
  initUltimateLock() {
    if (!this.skills || this.skills.length === 0) return;

    // Convenção: última skill = ultimate
    const ultimate = this.skills[this.skills.length - 1];

    if (!ultimate.cooldown || ultimate.cooldown <= 0) return;

    const availableAt = ultimate.cooldown;

    this.cooldowns.set(ultimate.key, {
      availableAt,
      duration: ultimate.cooldown,
      isUltimateLock: true, // só pra debug
    });

    console.log(
      `[ULT LOCK] ${this.name} → ${ultimate.name} bloqueada até o turno ${availableAt}`,
    );
  }

  // Method to mark that the champion has acted
  markActionTaken() {
    this.hasActedThisTurn = true;
  }

  // Method to reset the action status for a new turn
  resetActionStatus() {
    this.hasActedThisTurn = false;
  }

  modifyStat(statName, amount, duration, context) {
    if (!(statName in this)) {
      console.warn(`Attempted to modify non-existent stat: ${statName}`);
      return;
    }

    // Apply the stat change
    this[statName] += amount;

    // Store the modification for later reversion
    this.statModifiers.push({
      statName: statName,
      amount: amount, // Store the amount applied, so we can revert it
      expiresAtTurn: context.currentTurn + duration,
    });
    console.log(
      `[Champion] ${this.name} ${statName} changed by ${amount}. Will revert at turn ${context.currentTurn + duration}.`,
    );
  }

  applyProvoke(provokerId, duration, context) {
    this.provokeEffects.push({
      provokerId: provokerId,
      expiresAtTurn: context.currentTurn + duration,
    });
    console.log(
      `[Champion] ${this.name} provoked by ${provokerId}. Will expire at turn ${context.currentTurn + duration}.`,
    );
  }

  isProvokedBy(provokerId) {
    return this.provokeEffects.some(
      (effect) => effect.provokerId === provokerId,
    );
  }

  applyDamageReduction(amount, duration, context) {
    this.damageReductionModifiers.push({
      amount: amount,
      expiresAtTurn: context.currentTurn + duration,
    });
    console.log(
      `[Champion] ${this.name} gained ${amount} damage reduction. Will expire at turn ${context.currentTurn + duration}.`,
    );
  }

  getTotalDamageReduction() {
    return this.damageReductionModifiers.reduce(
      (total, mod) => total + mod.amount,
      0,
    );
  }

  purgeExpiredStatModifiers(currentTurn) {
    const revertedStats = [];
    this.statModifiers = this.statModifiers.filter((modifier) => {
      if (modifier.expiresAtTurn <= currentTurn) {
        // Revert the stat change
        this[modifier.statName] -= modifier.amount;
        revertedStats.push({
          championId: this.id,
          statName: modifier.statName,
          revertedAmount: -modifier.amount,
          newValue: this[modifier.statName],
        });
        console.log(
          `[Champion] ${this.name} ${modifier.statName} reverted by ${-modifier.amount}. New value: ${this[modifier.statName]}.`,
        );
        return false; // Remove expired modifier
      }
      return true; // Keep active modifier
    });

    this.provokeEffects = this.provokeEffects.filter((effect) => {
      if (effect.expiresAtTurn <= currentTurn) {
        console.log(
          `[Champion] Provoke effect from ${effect.provokerId} on ${this.name} expired.`,
        );
        return false;
      }
      return true;
    });

    this.damageReductionModifiers = this.damageReductionModifiers.filter(
      (modifier) => {
        if (modifier.expiresAtTurn <= currentTurn) {
          console.log(
            `[Champion] Damage reduction of ${modifier.amount} on ${this.name} expired.`,
          );
          return false;
        }
        return true;
      },
    );

    return revertedStats; // Return any stats that were reverted
  }

  // 🖥️ Cria o HTML e se “materializa” no mundo
  render(container, handlers = {}) {
    const div = this.createChampionElement();

    this.bindChampionHandlers(div, handlers);

    this.el = div;
    /*   console.log(
      `[Client] render() - Setting this.el for ${this.name} (ID: ${this.id})`,
    ); */
    /*     console.log(`[Client] this.el:`, this.el); */
    container.appendChild(div);
  }

  createChampionElement() {
    const div = document.createElement("div");
    div.classList.add("champion");
    div.dataset.championId = this.id;
    div.dataset.team = this.team;

    div.innerHTML = this.buildChampionHTML();

    return div;
  }

  buildChampionHTML() {
    const statRow = (label, className, value) => `
    <div class="stat-row" data-stat="${className}" data-id="${this.id}">
      <span class="stat-label">${label}:</span>
      <span class="${className}">${value}</span>
    </div>
  `;

    const skillsHTML = this.buildSkillsHTML();

    return `
    <img 
      class="portrait"
      data-id="${this.id}"
      src="${this.portrait}"
    >
    <h3 class="champion-name">${this.name}</h3>

    <p>HP: <span class="hp">${this.HP}/${this.maxHP}</span></p>

    <div class="hp-bar">
      <div class="hp-fill"></div>
    </div>


    ${statRow("Ataque", "Attack", this.Attack)}
    ${statRow("Defesa", "Defense", this.Defense)}
    ${statRow("Velocidade", "Speed", this.Speed)}
    ${this.Critical > 0 ? statRow("Crítico", "Critical", this.Critical) : ""}
    ${this.LifeSteal > 0 ? statRow("Roubo de Vida", "LifeSteal", this.LifeSteal) : ""}

    <div class="skills-bar">
      ${skillsHTML}
    </div>

    <div class="delete">
      <button class="delete-btn" data-id="${this.id}">
        <i class='bx bx-trash'></i>
      </button>
    </div>
  `;
  }

  buildSkillsHTML() {
    return this.skills
      .map((skill, index) => {
        const isUlt = index === this.skills.length - 1;
        const isBasicAttack = index === 0;
        const label = isUlt ? "ULT" : isBasicAttack ? "AB" : `Hab.${index}`;

        return `
        <button 
          class="skill-btn ${isUlt ? "ultimate" : ""}"
          data-champion-id="${this.id}"
          data-skill-key="${skill.key}"
          data-skill-index="${index}"
          title="${skill.name}\n${skill.description || ""}"
        >
          <span class="skill-label">${label}</span>
        </button>
      `;
      })
      .join("");
  }

  bindChampionHandlers(div, handlers = {}) {
    const { onSkillClick, onDelete } = handlers;

    // botões das skills
    div.querySelectorAll(".skill-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        onSkillClick?.(btn);
      });
    });
    // botão de deletar
    div.querySelector(".delete-btn")?.addEventListener("click", () => {
      onDelete?.(this.id);
    });
    // abrir o overlay do card do campeão
    div.querySelector(".portrait")?.addEventListener("click", (e) => {
      handlers.onPortraitClick?.(this);
    });
  }

  // 🔄 Atualiza UI sem buscar no DOM toda vez
  updateUI() {
    /*  console.log(`[Client] updateUI called for ${this.name} (ID: ${this.id})`); */
    if (!this.el) {
      /*       console.error(
        `[Client] No DOM element (this.el) found for ${this.name} (ID: ${this.id}).`,
      ); */
      return;
    }
    console.log(
      `[Client] Updating HP for ${this.name}: ${this.HP}/${this.maxHP}`,
    );
    // HP
    this.el.querySelector(".hp").textContent = `${this.HP}/${this.maxHP}`;

    const fill = this.el.querySelector(".hp-fill");

    const percent = (this.HP / this.maxHP) * 100;
    fill.style.width = `${percent}%`;

    // cores dinâmicas
    if (percent <= 19) {
      fill.style.background = "#ff2a2a"; // vermelho
    } else if (percent <= 49) {
      fill.style.background = "#ffcc00"; // amarelo
    } else {
      fill.style.background = "#00ff66"; // verde
    }
    // 🔥 Função genérica pra stats
    const updateStat = (name) => {
      const el = this.el.querySelector(`.${name}`);
      if (!el) return;

      const current = this[name];
      const base = this[`base${name}`];

      el.textContent = current;

      if (current > base) {
        el.style.color = "#00ff66"; // verde
      } else if (current < base) {
        el.style.color = "#ff2a2a"; // vermelho
      } else {
        el.style.color = "#ffffff"; // neutro
      }
    };

    updateStat("Attack");
    updateStat("Defense");
    updateStat("Speed");
    updateStat("Critical");
    updateStat("LifeSteal");

    this.el.classList.toggle("dead", !this.alive);
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.HP -= amount;

    if (this.HP <= 0) {
      this.HP = 0;
      this.alive = false;
    }
  }

  heal(amount) {
    if (!this.alive) return;

    this.HP = Math.min(this.HP + amount, this.maxHP);
  }

  // inútil, pois remove do DOM é feito diretamente pelo Client ao receber o evento do Server
  /* die() { 
    this.alive = false;
    this.HP = 0;
    console.log(
      `[Server Champion.die() called for ${this.name} (ID: ${this.id})`,
    );
    // Fallback for client-side testing or if io is not available
    this.destroy();
  } */

  destroy() {
    console.log(
      `[Server Champion.destroy() called for ${this.name} (ID: ${this.id})`,
    );
    console.log(`[Client] this.el value:`, this.el);
    console.log(`[Client] typeof this.el:`, typeof this.el);
    // Remove do DOM
    if (this.el) {
      this.el.remove();
      this.el = null;
      console.log(
        `[Client] Removed DOM element for ${this.name} (ID: ${this.id}).`,
      );
    } else {
      console.log(
        `[Client] No DOM element (this.el) found for ${this.name} (ID: ${this.id}) to remove.`,
      );
    }
    // No longer directly removing from activeChampions here, as server will handle it
    // and send a championRemoved event.
  }

  addDamageModifier(mod) {
    this.damageModifiers.push(mod);
  }

  purgeExpiredModifiers(currentTurn) {
    this.damageModifiers = this.damageModifiers.filter((m) => {
      if (m.permanent) return true; // permanente 
      // temporário
      return m.expiresAtTurn > currentTurn;
    });
  }

  getDamageModifiers() {
    return this.damageModifiers || [];
  }
}
