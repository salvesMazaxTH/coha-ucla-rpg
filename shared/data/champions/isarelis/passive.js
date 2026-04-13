import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "punhada_pelas_costas",
  name: "Punhada pelas Costas",
  hookScope: {
    onValidateAction: "target",
  },
 
  description() {
    return `Sempre que Isarelis agir antes do alvo direto, o dano base é aumentado em 20% e 60% dele se torna Perfurante.`;
  },
};
