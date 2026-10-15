import type { Preset } from '../core/types';
import saved from './failed-spells.json';

// Magias Falhas: as versões antigas das magias que tinham erros pelas regras atuais,
// guardadas como estavam (o desenho não muda). A versão corrigida fica no Livro de Magias.

const SER_ALVO = 'O Ser foi usado como alvo vivo ("um Ser"); o Ser agrupa as runas anteriores num conjunto (um ser).';
const AREA_ZONA = 'A Área foi usada como zona em volta ("todos na área"); a Área leva a magia, ou a parte anterior, à superfície mais distante.';
const ESTADO_COL = 'O Estado (no Col □) vinha logo depois de uma forma sem objeto nem elemento antes dele para manter.';
const PROJETIL = 'O Projétil não estava no lugar recomendado: último passo antes de voltar ao Prisma ou logo depois dos formatos.';
const SEM_VINCULO = 'A Intenção estava sem palavra ou números de vínculo.';

const ERRORS: Record<string, string[]> = {
  ex5: [
    'A Tríade estava errada: a conexão entre runas estruturais (ex.: Projétil + Ser ➔ Órbita) chega a um resultado que liga os dois conceitos, não a uma mistura deles.',
    'Órbita, Área e Ligação ficavam soltas, sem fonte (✕ Forma sem Fonte).',
    'O Projétil vinha logo depois do Prisma, sem formatos antes.',
    SEM_VINCULO
  ],
  m_descarga: [AREA_ZONA, 'O Projétil vinha logo depois do Prisma, sem formatos para unir.'],
  m_cubo_gelo: [SER_ALVO, 'O Estado mantinha o congelamento, mas o Ser não era o que estava preso.'],
  m_grito: [AREA_ZONA, 'O Ser foi usado como "os Seres" atingidos pela onda.'],
  m_passo: [
    SER_ALVO + ' O Toque foi usado como "tocar um Ser".',
    '"Ser + Toque formam Ligação" vinha da Tríade errada.',
    ESTADO_COL
  ],
  m_falsa_acao: [SEM_VINCULO, 'A Intenção aparecia como centro da Tríade; ela põe a vontade de quem lança na runa anterior.', 'O Toque vinha logo depois do Ser e foi lido como "tocar o alvo".'],
  m_meteoro: [PROJETIL + ' Ele vinha logo depois do Prisma do Fogo e seguia para a Estrela.'],
  m_tempestade: [AREA_ZONA, PROJETIL + ' No círculo do Raio ele não tinha formatos antes.'],
  m_escudo_agua: ['A Esfera orbitava "o Ser" (Ser como alvo); a Órbita gira em volta da magia, numa linha paralela ao círculo.', ESTADO_COL],
  m_orbita_chamas: ['As esferas giravam "em volta de um Ser" (Ser como alvo); a Órbita gira em volta da magia.', 'Falava em várias esferas, mas há um ser só na órbita.'],
  m_prensa: [AREA_ZONA],
  m_mistura: [SER_ALVO + ' ("atinge um Ser")', 'O Projétil vinha logo depois do Prisma, sem formatos para unir.'],
  m_supressao: [AREA_ZONA + ' Aqui como um campo em volta.', SER_ALVO, ESTADO_COL, SEM_VINCULO + ' ("só energia hostil" deveria ser a palavra).'],
  m_erupcao: [AREA_ZONA + ' ("estoura em Área")'],
  m_pele_pedra: [ESTADO_COL + ' Ele vinha depois do Sal △, que vinha depois da Direção Contrária.']
};

export const FAILED: Record<string, Preset> = Object.fromEntries(
  Object.entries(saved as unknown as Record<string, Preset>).map(([key, p]) => [
    `falha_${key}`,
    { ...p, info: { ...p.info, kind: 'falha', errors: ERRORS[key] ?? [], fixedIn: key } }
  ])
);
