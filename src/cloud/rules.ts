import { applyOverrides, currentOverrides, type Overrides } from '../data/rules';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

// Regras do Sistema no Supabase: todo mundo lê; só a conta admin salva.
// Ao abrir, o site usa as últimas regras guardadas no aparelho (sem esperar a internet)
// e, em seguida, busca as do banco; se mudaram, aplica e redesenha.

const CACHE_KEY = 'circulos-regras';

interface RulesRow { dados: unknown; atualizado_em: string }

let savedAt = '';
/** Quando as regras atuais foram salvas (para mostrar no editor) */
export const rulesSavedAt = (): string => savedAt;

function readCache(): RulesRow | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RulesRow) : null;
  } catch {
    return null;
  }
}

function writeCache(row: RulesRow): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(row));
  } catch {
    // sem armazenamento: busca do banco de novo na próxima vez
  }
}

/** Aplica as regras guardadas no aparelho (antes do primeiro desenho) */
export function applyCachedRules(): void {
  const row = readCache();
  if (!row) return;
  applyOverrides(row.dados);
  savedAt = row.atualizado_em;
}

/** Busca as regras do banco; chama onChange se mudaram */
export async function fetchRules(onChange: () => void): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/regras?id=eq.atual&select=dados,atualizado_em`, {
      headers: { apikey: SUPABASE_KEY, Accept: 'application/json' }
    });
    if (!res.ok) return;
    const rows = (await res.json()) as RulesRow[];
    const row = rows[0];
    if (!row || row.atualizado_em === savedAt) return;
    applyOverrides(row.dados);
    savedAt = row.atualizado_em;
    writeCache(row);
    onChange();
  } catch {
    // sem internet: fica com as regras do aparelho (ou as do código)
  }
}

/** Depois de salvar pelo editor: guarda no aparelho também */
export function rememberRules(dados: Overrides, atualizadoEm: string): void {
  savedAt = atualizadoEm;
  writeCache({ dados, atualizado_em: atualizadoEm });
}

export const rulesNow = (): Overrides => currentOverrides();
