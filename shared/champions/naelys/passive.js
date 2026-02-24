export default {
    // nome: coração das marés, efeito: Ao causar dano, cura 10 HP. Cada cura concede 1 stack de Maré. Cada stack concede +10 de dano flat. Máx 4 stacks. Os stacks são permanentes. Máximo bônus total: +36 dano.
    name: "Coração das Marés",
    healPerHit: 10,
    dmgPerStack: 15,
    maxStacks: 8,
    description() {
        return `Ao causar dano, cura ${this.healPerHit} HP. Cada cura concede 1 acúmulo de Maré. Cada stack concede +${this.dmgPerStack} de dano flat. Máx ${this.maxStacks} acúmulos. Os acúmulos são permanentes. Máximo bônus total: +${this.dmgPerStack * this.maxStacks} de dano.`;
    }
    // IMPLEMENTAR A LÓGICA PROPRIAMENTE DITA AQUI, POR ENQUANTO É SÓ A DESCRIÇÃO E OS VALORES onAfterDmgDealing e onAfterHealing
};
