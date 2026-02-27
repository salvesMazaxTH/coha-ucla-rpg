# Refatoração do Sistema de Recursos → Ultômetro (ultMeter)

Documento técnico detalhado para guiar a migração do sistema atual de
**Mana/Energia + custo de skills** para o novo sistema unificado de
**Ultômetro (ultMeter)**.

Este documento foca em:

-   O que existe atualmente
-   O que deve ser removido
-   O que deve ser reaproveitado
-   O que deve ser criado
-   Pontos críticos onde bugs podem surgir
-   Ajustes necessários na UI
-   Ordem segura de execução da migração

------------------------------------------------------------------------

# 1. Objetivo da Refatoração

Substituir completamente:

-   `mana`
-   `energy`
-   `resourceCap`
-   `manaCost`
-   `energyCost`
-   `BASE_REGEN`
-   Economia geral de recurso por turno

Por:

-   `ultMeter` (internamente numérico)
-   `ultCap` fixo
-   `isUltimate` + `ultCost` nas skills
-   Ganho por interação (dano, cura, buff, tomar dano)
-   Regen global estabilizador
-   Cashback reduzido para ultimates

------------------------------------------------------------------------

# 2. Novo Modelo Econômico

## 2.1 Representação Interna

-   Máximo: **5 barras**
-   Cada barra = 3 unidades internas
-   Máximo interno: 15 unidades
-   Armazenamento interno: inteiro (NUNCA float)

``` js
champion.ultMeter = 0
champion.ultCap = 15
```

Unidades:

-   1 unidade = 1/3 de barra
-   3 unidades = 1 barra

------------------------------------------------------------------------

# 3. Ganho de Ultômetro

## 3.1 Ganho por AÇÃO (não por hit)

Importante: AoE ou multi-hit contam **uma única vez por ação**.

### Regras

-   Causar dano (skill normal) → +2 unidades
-   Tomar dano → +1 unidade
-   Curar → +1 unidade
-   Buffar → +1 unidade
-   Ultimate que causa dano → +1 unidade
-   Ultimate que não causa dano → 0

Regen global:

-   +2 unidades por turno (recomendado para estabilidade macro)

------------------------------------------------------------------------

# 4. O que DELETAR

## 4.1 Da Classe Champion

Remover completamente:

``` js
champion.mana
champion.energy
champion.resourceCap
champion.addResource()
champion.spendResource()
champion.getResourceState()
champion.applyResourceChange()
```

Se mantidos temporariamente durante migração, marcar como DEPRECATED.

------------------------------------------------------------------------

## 4.2 Do Servidor

Remover:

-   `BASE_REGEN` relacionado a mana/energia
-   `applyGlobalTurnRegen()` antigo
-   `applyRegenFromDamage()` baseado em resourceRegenOnDamage
-   Qualquer validação baseada em `manaCost` ou `energyCost`

------------------------------------------------------------------------

## 4.3 Das Skills

Remover completamente:

``` js
manaCost
energyCost
cost
```

------------------------------------------------------------------------

# 5. O que ADICIONAR

## 5.1 Na Classe Champion

``` js
champion.ultMeter = 0
champion.ultCap = 15

champion.addUlt(amount) {
  this.ultMeter = Math.min(this.ultMeter + amount, this.ultCap);
}

champion.spendUlt(amount) {
  if (this.ultMeter < amount) return false;
  this.ultMeter -= amount;
  return true;
}
```

------------------------------------------------------------------------

## 5.2 Nas Skills

Adicionar:

``` js
isUltimate: true | false,
ultCost: number // em barras (inteiro)
```

Conversão interna no servidor:

``` js
const costUnits = skill.ultCost * 3;
```

------------------------------------------------------------------------

# 6. Validação no Servidor

Em `performSkillExecution`:

Substituir validação antiga por:

``` js
if (skill.isUltimate) {
   const costUnits = skill.ultCost * 3;

   if (!user.spendUlt(costUnits)) {
      denySkill("Ultômetro insuficiente");
      return;
   }
}
```

------------------------------------------------------------------------

# 7. Registro de Ganho no Context

Adicionar ao contexto:

``` js
context.registerUltGain({ target, amount });
```

Transformar em effect:

``` js
{
  type: "resourceGain",
  targetId,
  amount,
  resourceType: "ult"
}
```

------------------------------------------------------------------------

# 8. Ordem Correta de Ganho

IMPORTANTE para evitar double counting:

1.  Resolver skill
2.  Determinar se ação gerou dano/cura/buff
3.  Registrar ganho uma única vez
4.  Aplicar regen global ao final do turno

Nunca registrar por hit individual.

------------------------------------------------------------------------

# 9. Bugs a Evitar

## 9.1 AoE Inflacionando Medidor

Não iterar por alvo ao conceder ganho. Ação deve ser avaliada uma única
vez.

------------------------------------------------------------------------

## 9.2 Cashback Excessivo

Ultimate deve gerar no máximo +1 unidade. Nunca +2.

------------------------------------------------------------------------

## 9.3 Float Drift

Nunca usar float para 1/3. Sempre inteiro 0--15.

------------------------------------------------------------------------

## 9.4 Snapshot de Estado

Não usar snapshot estático para ultMeter. Sempre operar diretamente na
instância real.

------------------------------------------------------------------------

## 9.5 Ordem de Execução

Não aplicar regen global antes da resolução da ação. Deve ser aplicado
após todas as ações do turno.

------------------------------------------------------------------------

# 10. UI -- Ajustes Necessários

## 10.1 Barra Visual

Substituir barra de Mana/Energia por barra de Ultômetro.

Requisitos:

-   5 segmentos visuais
-   Cada segmento representa 3 unidades
-   Preenchimento parcial deve ser visualmente representável (1/3, 2/3)

Sugestão:

-   Usar 15 sub-segmentos internos
-   Ou usar largura proporcional baseada em porcentagem

------------------------------------------------------------------------

## 10.2 Label

Substituir:

Mana / Energy

Por:

Ultômetro

------------------------------------------------------------------------

## 10.3 Cores

Recomendado:

-   Roxo intenso ou dourado
-   Diferenciar claramente de HP

------------------------------------------------------------------------

# 11. Migração em Etapas Seguras

1.  Criar ultMeter mantendo mana ainda funcional
2.  Migrar uma única skill para usar ultCost
3.  Implementar spendUlt
4.  Implementar addUlt
5.  Adaptar UI
6.  Remover mana/energy do Champion
7.  Remover BASE_REGEN antigo
8.  Remover custos antigos das skills

Nunca fazer tudo de uma vez.

------------------------------------------------------------------------

# 12. Resultado Esperado

-   Economia mais coesa com 1 ação por turno
-   Ult inevitável mas controlada
-   Incentivo ofensivo
-   Sem snowball infinito
-   Espaço real para ult de custo 3 e 4 barras
-   Sistema estável e previsível

------------------------------------------------------------------------

Fim do Documento.
