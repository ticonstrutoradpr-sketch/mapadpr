// GET /api/saude: diz se a planilha (Apps Script) esta configurada e respondendo, e se o projeto esta
// em modo demonstracao. Nunca devolve valores de variaveis.
import { planilhaConfigurada, consultarPlanilha } from '../lib/planilha.js';
import { preflight, json } from '../lib/http.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  const configurada = planilhaConfigurada();
  const saida = { ok: true, planilha: configurada, planilhaResponde: false, demo: !configurada };
  if (configurada) {
    try {
      const r = await consultarPlanilha('saude');
      saida.planilhaResponde = Boolean(r && r.ok);
      if (r && r.ok) saida.linhas = r.linhas;
      else saida.motivo = (r && r.motivo) || 'resposta';
    } catch (e) {
      saida.motivo = 'rede';
    }
  }
  return json(res, 200, saida);
}
