import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "punhada_pelas_costas",
  name: "Punhada pelas Costas",
  hookScope: {
    onValidateAction: "target",
  },
 
  description() {
    return `Sempre que Isarelis agir antes do alvo direto, ela causa dano perfurante com um bônus de 20%.`;
  },
};
