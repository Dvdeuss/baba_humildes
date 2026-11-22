import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// ==============================================================================
// BABA HUMILDES / BABA TROPICANA MANAGER - CORE ENGINE (ULTRON)
// ==============================================================================

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const money = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const id = () => crypto.randomUUID();

let db = null;
let session = null;
let isAdmin = false;
let currentAthlete = null;
let currentPage = 'inicio';

// Estado global do aplicativo
let state = {
  temporadas: [
    { id: 1, ano: 2026, valor_mensalidade_padrao: 25.00, ativa: true }
  ],
  teams: [
    { id: 'team-a', nome: 'Internacional', cor: '#e52329', badge: 'INT', logo_url: './public/escudo-internacional.svg', temporada_id: 1 },
    { id: 'team-b', nome: 'Grêmio', cor: '#0d80bf', badge: 'GRE', logo_url: './public/escudo-gremio.svg', temporada_id: 1 }
  ],
  athletes: [],
  athletes_temporada: [],
  juizes: [],
  matches: [],
  goals: [],
  assistencias: [],
  cards: [],
  presencas: [],
  mensalidades: [],
  despesas: [],
  avisos: []
};

const demo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ------------------------------------------------------------------------------
// 1. INICIALIZAÇÃO E CARREGAMENTO DE DADOS
// ------------------------------------------------------------------------------

async function init() {
  if (localStorage.getItem('bh-admin-logged') === 'true') {
    isAdmin = true;
  }

  const activeSeason = getActiveTemporada();
  if ($('#topbarSeasonBadge')) {
    $('#topbarSeasonBadge').textContent = `Temporada ${activeSeason ? activeSeason.ano : new Date().getFullYear()}`;
  }
  if ($('#sidebarSeasonLabel')) {
    $('#sidebarSeasonLabel').textContent = `Temporada Ativa: ${activeSeason ? activeSeason.ano : new Date().getFullYear()}`;
  }

  // Garante carregamento da base local e elencos
  loadLocal();

  if (!demo) {
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: { session: s } } = await db.auth.getSession();
      session = s;
      if (session) {
        try {
          const { data: isAdminUser } = await db.rpc('is_admin');
          isAdmin = !!isAdminUser || localStorage.getItem('bh-admin-logged') === 'true';
        } catch (e) {
          isAdmin = localStorage.getItem('bh-admin-logged') === 'true';
        }
      } else {
        isAdmin = localStorage.getItem('bh-admin-logged') === 'true';
      }
      db.auth.onAuthStateChange(async (event, s) => {
        session = s;
        if (session) {
          try {
            const { data: isAdminUser } = await db.rpc('is_admin');
            isAdmin = !!isAdminUser || localStorage.getItem('bh-admin-logged') === 'true';
          } catch (e) {
            isAdmin = localStorage.getItem('bh-admin-logged') === 'true';
          }
        } else {
          isAdmin = localStorage.getItem('bh-admin-logged') === 'true';
        }
        updateAdminStatus();
        if (event === 'PASSWORD_RECOVERY') showPasswordReset();
      });
      await loadRemote();
    } catch (err) {
      console.warn('Falha na conexão Supabase, mantendo modo local:', err);
    }
  }

  updateAdminStatus();
  bindNavigation();
  renderPage('inicio');
}

function getActiveTemporada() {
  return state.temporadas.find(t => t.ativa) || state.temporadas[0] || { id: 1, ano: 2026, valor_mensalidade_padrao: 25.00, ativa: true };
}

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem('bh-demo-data-v2'));
    if (saved && saved.athletes && saved.athletes.length > 0) {
      state = { ...state, ...saved };
      if (!state.goals || state.goals.length === 0) {
        state.goals = [
          { id: 'g-1', match_id: 'm-1', athlete_id: state.athletes[0]?.id || 'a-1', minute: 15, team_id: 'team-a' },
          { id: 'g-2', match_id: 'm-1', athlete_id: state.athletes[2]?.id || 'a-3', minute: 28, team_id: 'team-a' },
          { id: 'g-3', match_id: 'm-1', athlete_id: state.athletes[0]?.id || 'a-1', minute: 42, team_id: 'team-a' },
          { id: 'g-4', match_id: 'm-1', athlete_id: state.athletes[1]?.id || 'a-2', minute: 30, team_id: 'team-b' },
          { id: 'g-5', match_id: 'm-1', athlete_id: state.athletes[7]?.id || 'a-8', minute: 50, team_id: 'team-b' },
          { id: 'g-6', match_id: 'm-2', athlete_id: state.athletes[1]?.id || 'a-2', minute: 20, team_id: 'team-b' },
          { id: 'g-7', match_id: 'm-2', athlete_id: state.athletes[9]?.id || 'a-10', minute: 45, team_id: 'team-a' }
        ];
      }
      if (!state.assistencias || state.assistencias.length === 0) {
        state.assistencias = [
          { id: 'as-1', match_id: 'm-1', athlete_id: state.athletes[9]?.id || 'a-10' },
          { id: 'as-2', match_id: 'm-1', athlete_id: state.athletes[0]?.id || 'a-1' },
          { id: 'as-3', match_id: 'm-1', athlete_id: state.athletes[8]?.id || 'a-9' },
          { id: 'as-4', match_id: 'm-2', athlete_id: state.athletes[2]?.id || 'a-3' }
        ];
      }
      ensureInterGremioTeams();
      return;
    }
  } catch (e) {}
  populateDemoData();
  saveLocal();
}

function ensureInterGremioTeams() {
  const teamA = state.teams.find(t => t.id === 'team-a');
  if (teamA) {
    teamA.nome = 'Internacional';
    teamA.cor = '#e52329';
    teamA.badge = 'INT';
    teamA.logo_url = './public/escudo-internacional.svg';
  }
  const teamB = state.teams.find(t => t.id === 'team-b');
  if (teamB) {
    teamB.nome = 'Grêmio';
    teamB.cor = '#0d80bf';
    teamB.badge = 'GRE';
    teamB.logo_url = './public/escudo-gremio.svg';
  }
}

function saveLocal() {
  localStorage.setItem('bh-demo-data-v2', JSON.stringify(state));
}

function populateDemoData() {
  state.temporadas = [
    { id: 1, ano: 2026, valor_mensalidade_padrao: 25.00, ativa: true }
  ];

  state.teams = [
    { id: 'team-a', nome: 'Internacional', cor: '#e52329', badge: 'INT', logo_url: './public/escudo-internacional.svg', temporada_id: 1 },
    { id: 'team-b', nome: 'Grêmio', cor: '#0d80bf', badge: 'GRE', logo_url: './public/escudo-gremio.svg', temporada_id: 1 }
  ];

  state.juizes = [
    { id: 'j-1', nome: 'Jorge da Federação', telefone: '(71) 98877-6655', foto_url: '', ativo: true },
    { id: 'j-2', nome: 'Carlos Árbitro', telefone: '(71) 99123-4567', foto_url: '', ativo: true }
  ];

  state.athletes = [
    { id: 'a-1', apelido: 'Deivide', nome_completo: 'Deivide Silva', telefone: '(71) 99999-1111', posicao: 'Atacante', numero_camisa: 10, is_diretoria: true, team_id: 'team-a' },
    { id: 'a-2', apelido: 'Dão', nome_completo: 'Edvaldo Santos', telefone: '(71) 99999-2222', posicao: 'Meio-campo', numero_camisa: 8, is_diretoria: true, team_id: 'team-b' },
    { id: 'a-3', apelido: 'Vitinho', nome_completo: 'Vitor Hugo', telefone: '(71) 99999-3333', posicao: 'Atacante', numero_camisa: 9, is_diretoria: false, team_id: 'team-a' },
    { id: 'a-4', apelido: 'Neguinho', nome_completo: 'Antonio Carlos', telefone: '(71) 99999-4444', posicao: 'Goleiro', numero_camisa: 1, is_diretoria: false, team_id: 'team-a' },
    { id: 'a-5', apelido: 'Rodrigo Paredão', nome_completo: 'Rodrigo Lima', telefone: '(71) 99999-5555', posicao: 'Goleiro', numero_camisa: 12, is_diretoria: false, team_id: 'team-b' },
    { id: 'a-6', apelido: 'Luquinhas', nome_completo: 'Lucas Ferreira', telefone: '(71) 99999-6666', posicao: 'Lateral', numero_camisa: 6, is_diretoria: false, team_id: 'team-a' },
    { id: 'a-7', apelido: 'Marcelo', nome_completo: 'Marcelo Oliveira', telefone: '(71) 99999-7777', posicao: 'Zagueiro', numero_camisa: 3, is_diretoria: false, team_id: 'team-b' },
    { id: 'a-8', apelido: 'Binho', nome_completo: 'Fabio Barreto', telefone: '(71) 99999-8888', posicao: 'Volante', numero_camisa: 5, is_diretoria: false, team_id: 'team-b' },
    { id: 'a-9', apelido: 'Paulinho', nome_completo: 'Paulo Souza', telefone: '(71) 99999-9999', posicao: 'Lateral', numero_camisa: 2, is_diretoria: false, team_id: 'team-b' },
    { id: 'a-10', apelido: 'Bruninho', nome_completo: 'Bruno Andrade', telefone: '(71) 99999-0000', posicao: 'Meio-campo', numero_camisa: 7, is_diretoria: false, team_id: 'team-a' }
  ];

  state.athletes_temporada = state.athletes.map(a => ({
    id: `at-${a.id}`,
    ativo: true,
    atleta_id: a.id,
    temporada_id: 1,
    time_id: a.team_id
  }));

  const pastDate1 = '2026-11-08';
  const pastDate2 = '2026-11-15';
  const nextSunday = '2026-11-22';

  state.matches = [
    {
      id: 'm-1',
      data: pastDate1,
      hora: '07:30',
      tipo: 'Domingo',
      time_a: 'team-a',
      time_b: 'team-b',
      placar_a: 3,
      placar_b: 2,
      status: 'Finalizada',
      juiz_id: 'j-1',
      temporada_id: 1
    },
    {
      id: 'm-2',
      data: pastDate2,
      hora: '07:30',
      tipo: 'Domingo',
      time_a: 'team-b',
      time_b: 'team-a',
      placar_a: 1,
      placar_b: 1,
      status: 'Finalizada',
      juiz_id: 'j-2',
      temporada_id: 1
    },
    {
      id: 'm-3',
      data: nextSunday,
      hora: '07:30',
      tipo: 'Domingo',
      time_a: 'team-a',
      time_b: 'team-b',
      placar_a: 0,
      placar_b: 0,
      status: 'Agendada',
      juiz_id: 'j-1',
      temporada_id: 1
    }
  ];

  state.goals = [
    { id: 'g-1', match_id: 'm-1', athlete_id: 'a-1', minute: 15, team_id: 'team-a' },
    { id: 'g-2', match_id: 'm-1', athlete_id: 'a-3', minute: 28, team_id: 'team-a' },
    { id: 'g-3', match_id: 'm-1', athlete_id: 'a-1', minute: 42, team_id: 'team-a' },
    { id: 'g-4', match_id: 'm-1', athlete_id: 'a-2', minute: 30, team_id: 'team-b' },
    { id: 'g-5', match_id: 'm-1', athlete_id: 'a-8', minute: 50, team_id: 'team-b' },
    { id: 'g-6', match_id: 'm-2', athlete_id: 'a-2', minute: 20, team_id: 'team-b' },
    { id: 'g-7', match_id: 'm-2', athlete_id: 'a-10', minute: 45, team_id: 'team-a' }
  ];

  state.assistencias = [
    { id: 'as-1', match_id: 'm-1', athlete_id: 'a-10' },
    { id: 'as-2', match_id: 'm-1', athlete_id: 'a-1' },
    { id: 'as-3', match_id: 'm-1', athlete_id: 'a-9' },
    { id: 'as-4', match_id: 'm-2', athlete_id: 'a-3' }
  ];

  state.cards = [
    { id: 'c-1', match_id: 'm-1', athlete_id: 'a-7', type: 'Amarelo' },
    { id: 'c-2', match_id: 'm-2', athlete_id: 'a-7', type: 'Amarelo' },
    { id: 'c-3', match_id: 'm-2', athlete_id: 'a-8', type: 'Amarelo' }
  ];

  state.presencas = [
    { id: 'p-1', match_id: 'm-3', athlete_id: 'a-1', confirmado: true },
    { id: 'p-2', match_id: 'm-3', athlete_id: 'a-2', confirmado: true },
    { id: 'p-3', match_id: 'm-3', athlete_id: 'a-3', confirmado: true },
    { id: 'p-4', match_id: 'm-3', athlete_id: 'a-4', confirmado: true }
  ];

  // Mensalidades: Diretoria isenta. Outros atletas têm histórico.
  state.mensalidades = [
    { id: 'men-1', atleta_id: 'a-3', mes: 10, valor: 25.00, pago: true, forma_pagamento: 'Pix', temporada_id: 1 },
    { id: 'men-2', atleta_id: 'a-3', mes: 11, valor: 25.00, pago: true, forma_pagamento: 'Pix', temporada_id: 1 },
    { id: 'men-3', atleta_id: 'a-6', mes: 10, valor: 25.00, pago: true, forma_pagamento: 'Dinheiro', temporada_id: 1 },
    { id: 'men-4', atleta_id: 'a-6', mes: 11, valor: 25.00, pago: false, temporada_id: 1 },
    { id: 'men-5', atleta_id: 'a-9', mes: 9, valor: 25.00, pago: false, temporada_id: 1 }, // Inadimplente (> 1 mês e 10 dias)
    { id: 'men-6', atleta_id: 'a-9', mes: 10, valor: 25.00, pago: false, temporada_id: 1 }
  ];

  state.despesas = [
    { id: 'd-1', descricao: 'Taxa de Arbitragem - Rodada 1', categoria: 'Árbitro', valor: 80.00, data: pastDate1, juiz_id: 'j-1', temporada_id: 1 },
    { id: 'd-2', descricao: 'Gelo e Água Mineral', categoria: 'Material', valor: 35.00, data: pastDate1, temporada_id: 1 },
    { id: 'd-3', descricao: 'Taxa de Arbitragem - Rodada 2', categoria: 'Árbitro', valor: 80.00, data: pastDate2, juiz_id: 'j-2', temporada_id: 1 }
  ];

  state.avisos = [
    {
      id: 'av-1',
      titulo: 'Temporada 2026 Iniciada • Resenha e Disciplina',
      conteudo: 'Atenção atletas: os jogos de domingo começam rigorosamente às 07h30 na Palestina. O acúmulo de 3 cartões amarelos ou vermelho direto gera suspensão automática para o jogo seguinte!',
      tipo: 'Regra',
      data_publicacao: '2026-11-01T10:00:00Z',
      ativo: true,
      destaque: true
    },
    {
      id: 'av-2',
      titulo: 'Contribuição Mensal R$ 25,00',
      conteudo: 'Lembramos a todos os atletas que o valor padrão da mensalidade é R$ 25,00. Mantenham os pagamentos em dia via Pix ou em mãos com a diretoria para garantir a presença nos jogos.',
      tipo: 'Financeiro',
      data_publicacao: '2026-11-05T12:00:00Z',
      ativo: true,
      destaque: false
    }
  ];
}

async function loadRemote() {
  if (!db) return;

  // Mapa: chave do state local → nome da tabela no Supabase
  const tableMap = {
    temporadas:        'temporadas',
    teams:             'times',
    athletes:          'atletas',
    athletes_temporada:'atletas_temporada',
    juizes:            'juizes',
    matches:           'partidas',
    goals:             'gols',
    assistencias:      'assistencias',
    cards:             'cartoes',
    presencas:         'presencas',
    mensalidades:      'mensalidades',
    despesas:          'despesas',
    avisos:            'avisos',
  };

  for (const [stateKey, tableName] of Object.entries(tableMap)) {
    try {
      const { data, error } = await db.from(tableName).select('*');
      if (!error && data && data.length > 0) {
        state[stateKey] = data;
      }
      // 404 / table not found: ignora silenciosamente, mantém dados locais
    } catch (e) {
      // Supabase inacessível ou tabela inexistente — continua com dados locais
    }
  }
  ensureInterGremioTeams();
}

// Mapa reverso: chave local → tabela Supabase (para saveRecord)
const SUPABASE_TABLE_MAP = {
  temporadas:        'temporadas',
  teams:             'times',
  athletes:          'atletas',
  athletes_temporada:'atletas_temporada',
  juizes:            'juizes',
  matches:           'partidas',
  goals:             'gols',
  assistencias:      'assistencias',
  cards:             'cartoes',
  presencas:         'presencas',
  mensalidades:      'mensalidades',
  despesas:          'despesas',
  avisos:            'avisos',
};

async function saveRecord(table, row, remove = false) {
  // Sempre persiste localmente primeiro (nunca bloqueia o usuário)
  let arr = state[table];
  if (!arr) state[table] = arr = [];
  if (remove) {
    state[table] = arr.filter(x => x.id !== row.id);
  } else {
    const i = arr.findIndex(x => x.id === row.id);
    if (i >= 0) arr[i] = row;
    else arr.push(row);
  }
  saveLocal();

  // Tenta sincronizar com Supabase se disponível (sem bloquear UI em caso de falha)
  if (db && session) {
    const supabaseTable = SUPABASE_TABLE_MAP[table] || table;
    try {
      const { error } = remove
        ? await db.from(supabaseTable).delete().eq('id', row.id)
        : await db.from(supabaseTable).upsert(row);
      if (error) console.warn('Supabase sync warning:', error.message);
    } catch (e) {
      console.warn('Falha na sincronização Supabase (dados salvos localmente):', e);
    }
  }
}

function notify(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ------------------------------------------------------------------------------
// 2. REGRAS DE NEGÓCIO E ALGORITMOS (SEÇÃO 4 DO SUMÁRIO)
// ------------------------------------------------------------------------------

/**
 * 4.2 Motor de Disciplina e Suspensões
 * - 3 amarelos acumulados = 1 suspensão automática
 * - Vermelho direto = 1 suspensão automática
 * - 2 amarelos na mesma partida = vermelho automático
 * - Ao cumprir em partida finalizada SEM presença, zera os 3 amarelos da punição
 */
function calculateDisciplinaryStatus(athleteId) {
  const sortedMatches = [...state.matches].sort((a, b) => new Date(a.data) - new Date(b.data));
  let accumulatedYellows = 0;
  let hasPendingSuspension = false;
  let suspensionReason = '';
  let suspensionsServed = 0;

  for (const match of sortedMatches) {
    if (hasPendingSuspension) {
      if (match.status === 'Finalizada') {
        const attendance = state.presencas.find(p => p.match_id === match.id && p.atleta_id === athleteId);
        const wasPresent = attendance && attendance.confirmado;
        if (!wasPresent) {
          // Suspensão cumprida! Limpa a punição e abate 3 amarelos
          hasPendingSuspension = false;
          suspensionsServed++;
          accumulatedYellows = Math.max(0, accumulatedYellows - 3);
          suspensionReason = '';
        } else {
          // Jogou suspenso irregularmente: punição permanece ativa
          suspensionReason = 'Jogou irregularmente: suspensão continua ativa para o próximo jogo!';
        }
      }
    }

    // Processa os cartões da partida
    const matchCards = state.cards.filter(c => c.match_id === match.id && c.atleta_id === athleteId);
    let yellowInMatch = 0;

    for (const card of matchCards) {
      if (card.type === 'Amarelo') {
        yellowInMatch++;
        accumulatedYellows++;
        if (yellowInMatch === 2) {
          // 2º amarelo no mesmo jogo = vermelho automático
          hasPendingSuspension = true;
          suspensionReason = 'Suspenso: 2 Cartões Amarelos na mesma partida (Vermelho automático)';
        } else if (accumulatedYellows >= 3) {
          hasPendingSuspension = true;
          suspensionReason = 'Suspenso: Acúmulo de 3 Cartões Amarelos';
        }
      } else if (card.type === 'Vermelho') {
        hasPendingSuspension = true;
        suspensionReason = 'Suspenso: Cartão Vermelho Direto';
      }
    }
  }

  const totalYellows = state.cards.filter(c => c.atleta_id === athleteId && c.type === 'Amarelo').length;
  const totalReds = state.cards.filter(c => c.atleta_id === athleteId && c.type === 'Vermelho').length;

  return {
    athleteId,
    isSuspended: hasPendingSuspension,
    reason: suspensionReason,
    accumulatedYellows,
    totalYellows,
    totalReds,
    suspensionsServed
  };
}

/**
 * 4.3 Inadimplência e Bloqueio de Presença
 * - Carência: 1 mês e 10 dias de tolerância
 * - Diretoria: Isenta de mensalidade
 */
function checkInadimplencia(athleteId) {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return { isInadimplente: false, pendingMonths: [], totalDue: 0 };
  if (athlete.is_diretoria) {
    return { isInadimplente: false, pendingMonths: [], totalDue: 0, isDiretoria: true };
  }

  const now = new Date();
  // Tolerância de 1 mês e 10 dias
  const toleranceDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() - 10);
  const thresholdMonth = toleranceDate.getMonth() + 1; // 1 a 12

  const activeSeason = getActiveTemporada();
  const dues = state.mensalidades.filter(m => m.atleta_id === athleteId && (!m.temporada_id || m.temporada_id === activeSeason.id));
  const pendingMonths = [];
  let totalDue = 0;

  for (const due of dues) {
    if (!due.pago && due.mes <= thresholdMonth) {
      pendingMonths.push(due.mes);
      totalDue += Number(due.valor || activeSeason.valor_mensalidade_padrao || 25);
    }
  }

  return {
    isInadimplente: pendingMonths.length > 0,
    pendingMonths,
    totalDue,
    thresholdMonth
  };
}

/**
 * 4.4 Classificação e Pontuação dos Times
 * Apenas partidas Finalizadas.
 * Ordem: Pontos DESC, Vitórias DESC, Saldo de Gols DESC, Gols Pró DESC.
 */
function calculateStandings() {
  const activeSeason = getActiveTemporada();
  const seasonTeams = state.teams.filter(t => !t.temporada_id || t.temporada_id === activeSeason.id);
  const table = seasonTeams.map(t => ({
    team: t,
    jogos: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    golsPro: 0,
    golsContra: 0,
    saldoGols: 0,
    pontos: 0
  }));

  const finishedMatches = state.matches.filter(m => m.status === 'Finalizada' && (!m.temporada_id || m.temporada_id === activeSeason.id));

  for (const m of finishedMatches) {
    const tA = table.find(x => x.team.id === m.time_a);
    const tB = table.find(x => x.team.id === m.time_b);
    if (!tA || !tB) continue;

    tA.jogos++;
    tB.jogos++;
    tA.golsPro += m.placar_a;
    tA.golsContra += m.placar_b;
    tB.golsPro += m.placar_b;
    tB.golsContra += m.placar_a;

    if (m.placar_a > m.placar_b) {
      tA.vitorias++;
      tA.pontos += 3;
      tB.derrotas++;
    } else if (m.placar_b > m.placar_a) {
      tB.vitorias++;
      tB.pontos += 3;
      tA.derrotas++;
    } else {
      tA.empates++;
      tA.pontos += 1;
      tB.empates++;
      tB.pontos += 1;
    }
  }

  for (const row of table) {
    row.saldoGols = row.golsPro - row.golsContra;
  }

  table.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
    if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
    return b.golsPro - a.golsPro;
  });

  return table;
}

/**
 * 4.5 Cálculo Dinâmico de Placar da Súmula
 */
function recalculateMatchScore(matchId) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const matchGoals = state.goals.filter(g => g.match_id === matchId);
  let scoreA = 0;
  let scoreB = 0;

  for (const goal of matchGoals) {
    let teamId = goal.team_id;
    if (!teamId) {
      const athlete = state.athletes.find(a => a.id === goal.athlete_id);
      teamId = athlete ? athlete.team_id : null;
    }
    if (teamId === match.time_a) scoreA += (goal.quantidade || 1);
    else if (teamId === match.time_b) scoreB += (goal.quantidade || 1);
  }

  match.placar_a = scoreA;
  match.placar_b = scoreB;
  saveLocal();
}

// ------------------------------------------------------------------------------
// 3. NAVEGAÇÃO E CONTROLE DE TELAS
// ------------------------------------------------------------------------------

function bindNavigation() {
  $$('#navigation .nav-item').forEach(btn => {
    btn.onclick = () => renderPage(btn.dataset.page);
  });

  if ($('#adminButton')) {
    $('#adminButton').onclick = () => {
      if (isAdmin || session) {
        showAdminControlPanel();
      } else {
        showLogin();
      }
    };
  }

  if ($('#athleteButton')) {
    $('#athleteButton').onclick = showAthleteSelector;
  }

  if ($('#mobileMenu')) {
    $('#mobileMenu').onclick = () => {
      $('#sidebar').classList.toggle('open');
    };
  }

  document.addEventListener('click', e => {
    const goto = e.target.closest('[data-goto]');
    if (goto) {
      renderPage(goto.dataset.goto);
    }
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      const dialog = closeBtn.closest('dialog');
      if (dialog) dialog.close();
    }
  });
}

function setTitle(title) {
  if ($('#pageTitle')) $('#pageTitle').textContent = title;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === currentPage));
  if ($('#sidebar')) $('#sidebar').classList.remove('open');
}

function renderPage(page) {
  currentPage = page;
  const titles = {
    inicio: 'Visão geral',
    atletas: 'Atletas & Elenco',
    times: 'Times & Tabela de Classificação',
    partidas: 'Partidas & Súmula Digital',
    estatisticas: 'Estatísticas & Disciplina',
    financeiro: 'Financeiro & Transparência',
    avisos: 'Avisos Oficiais',
    juizes: 'Quadro de Árbitros',
    atleta: 'Área do Atleta'
  };
  setTitle(titles[page] || 'Visão geral');

  switch (page) {
    case 'inicio': renderHome(); break;
    case 'atletas': renderAthletes(); break;
    case 'times': renderTeams(); break;
    case 'partidas': renderMatches(); break;
    case 'estatisticas': renderStats(); break;
    case 'financeiro': renderFinance(); break;
    case 'avisos': renderAvisos(); break;
    case 'juizes': renderJuizes(); break;
    default: renderHome(); break;
  }
}

function updateAdminStatus() {
  const el = $('#adminStatus');
  if (!el) return;
  if (isAdmin || session) {
    el.innerHTML = '<span style="color:#81bd91;">● Painel Admin →</span>';
  } else {
    el.textContent = 'Entrar →';
  }
}

// ------------------------------------------------------------------------------
// 4. MÓDULOS DE RENDERIZAÇÃO
// ------------------------------------------------------------------------------

/**
 * 4.1 VISÃO GERAL (renderHome)
 */
function renderHome() {
  const activeSeason = getActiveTemporada();
  const nextMatchData = getNextMatch();
  const standings = calculateStandings();
  const topScorers = getTopScorers(4);
  const topAssists = getTopAssists(4);
  const featuredNotice = state.avisos.find(a => a.ativo && a.destaque) || state.avisos.find(a => a.ativo);

  const totalAthletes = state.athletes.length;
  const finishedMatchesCount = state.matches.filter(m => m.status === 'Finalizada').length;
  const totalGoals = state.goals.reduce((acc, g) => acc + (g.quantidade || 1), 0);
  const avgGoals = finishedMatchesCount ? (totalGoals / finishedMatchesCount).toFixed(1) : '0.0';

  const totalPaid = state.mensalidades.filter(m => m.pago).reduce((acc, m) => acc + Number(m.valor || 25), 0);
  const totalExpenses = state.despesas.reduce((acc, d) => acc + Number(d.valor || 0), 0);
  const balance = totalPaid - totalExpenses;

  $('#appContent').innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <div class="hero-kicker">⚽ BABA HUMILDES • TEMPORADA ${activeSeason.ano}</div>
        <h1>O futebol nos une.<br><em>A resenha nos fortalece.</em></h1>
        <p>Portal esportivo oficial do baba de domingo da Palestina, Salvador - BA. Gestão completa de elenco, pontuação, disciplina e transparência financeira.</p>
        <div class="hero-actions">
          <button class="btn btn-gold" data-goto="partidas">Ver súmula do próximo jogo <span>↗</span></button>
          <button class="btn btn-outline" data-goto="atletas">Conhecer o elenco</button>
        </div>
      </div>
      <div class="hero-watermark">HUMILDES</div>
    </section>

    ${featuredNotice ? `
      <div class="featured-home-notice">
        <div style="display:flex; align-items:center; gap:12px;">
          <span class="pin">📌</span>
          <div>
            <div style="font-size:10px; color:var(--gold); font-weight:700; letter-spacing:1px;">COMUNICADO OFICIAL • ${esc(featuredNotice.tipo.toUpperCase())}</div>
            <div style="font:700 16px var(--display); color:#fff;">${esc(featuredNotice.titulo)}</div>
            <div style="font-size:11px; color:#c5d5cb; margin-top:3px;">${esc(featuredNotice.conteudo.slice(0, 140))}${featuredNotice.conteudo.length > 140 ? '...' : ''}</div>
          </div>
        </div>
        <button class="btn btn-secondary" data-goto="avisos" style="flex-shrink:0;">Mural de avisos →</button>
      </div>
    ` : ''}

    <!-- O GRANDE CONFRONTO - CLÁSSICO GRENAL DO BABA -->
    <section class="home-matchup">
      <div class="matchup-heading">
        <span class="eyebrow">NOSSA RIVALIDADE HISTÓRICA</span>
        <h2>O Grande Clássico do Baba</h2>
        <p>Dois lados. Uma só paixão todo domingo na Palestina.</p>
      </div>

      <div class="matchup-teams">
        <div class="matchup-team">
          <div class="matchup-logo">
            <img src="./public/escudo-internacional.svg" alt="Escudo Internacional">
          </div>
          <h3 style="color:#e52329;">Internacional</h3>
          <span style="color:#e52329;">COLORADO • TIME A</span>
        </div>

        <div class="matchup-vs">VS</div>

        <div class="matchup-team">
          <div class="matchup-logo">
            <img src="./public/escudo-gremio.svg" alt="Escudo Grêmio">
          </div>
          <h3 style="color:#0d80bf;">Grêmio</h3>
          <span style="color:#0d80bf;">TRICOLOR • TIME B</span>
        </div>
      </div>

      <button class="text-button" data-goto="times">Ver histórico e elencos dos dois times →</button>
    </section>

    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">ELENCO DA TEMPORADA</div>
        <div class="stat-value">${totalAthletes} <small style="font-size:12px; color:var(--muted);">atletas</small></div>
        <div class="stat-icon">👥</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">JOGOS REALIZADOS</div>
        <div class="stat-value">${finishedMatchesCount} <small style="font-size:12px; color:var(--muted);">rodadas</small></div>
        <div class="stat-icon">⏱</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">GOLS NA TEMPORADA</div>
        <div class="stat-value">${totalGoals} <small style="font-size:12px; color:var(--muted); font-weight:400;">(${avgGoals}/jogo)</small></div>
        <div class="stat-icon">⚽</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">CAIXA DO BABA</div>
        <div class="stat-value" style="color:${balance >= 0 ? 'var(--gold)' : '#dc7772'};">${money(balance)}</div>
        <div class="stat-icon">＄</div>
      </div>
    </section>

    <section class="section-grid">
      <div class="panel next-match">
        <div class="panel-heading">
          <div><span class="eyebrow">AGENDA DO DOMINGO</span><h2>Próximo baba</h2></div>
          <span class="tag tag-green">${nextMatchData ? esc(nextMatchData.tipo.toUpperCase()) : 'DOMINGO'}</span>
        </div>
        ${renderNextMatchCard(nextMatchData)}
      </div>

      <div class="panel contribution">
        <div class="panel-heading">
          <div><span class="eyebrow">CONTRIBUIÇÃO DA TEMPORADA</span><h2>Mensalidade</h2></div>
          <span class="coin-icon">R$</span>
        </div>
        <div class="contribution-value">${money(activeSeason.valor_mensalidade_padrao)}<span>/mês</span></div>
        <p>Contribuição mensal por atleta (isenção para membros da diretoria). Tolerância de carência de <strong>1 mês e 10 dias</strong> antes do bloqueio de presença.</p>
        <button class="text-button" data-goto="financeiro">Prestação de contas e pagamentos →</button>
      </div>
    </section>

    <section class="section-grid lower-grid">
      <div class="panel">
        <div class="panel-heading">
          <div><span class="eyebrow">RANKINGS</span><h2>Artilharia & Garçons</h2></div>
          <button class="text-button" data-goto="estatisticas">Ver todos →</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div>
            <div style="font-size:10px; font-weight:700; color:var(--gold); margin-bottom:8px;">⚽ ARTILHEIROS</div>
            ${topScorers.length ? topScorers.map((s, i) => `
              <div class="rank-row">
                <span class="rank-number">${String(i+1).padStart(2,'0')}</span>
                <span class="rank-name">${esc(s.athlete.apelido)}</span>
                <span class="rank-meta">${s.goals} gol(s)</span>
              </div>
            `).join('') : '<div class="empty-state compact">Sem gols registrados ainda.</div>'}
          </div>
          <div>
            <div style="font-size:10px; font-weight:700; color:var(--gold); margin-bottom:8px;">🎯 ASSISTÊNCIAS</div>
            ${topAssists.length ? topAssists.map((s, i) => `
              <div class="rank-row">
                <span class="rank-number">${String(i+1).padStart(2,'0')}</span>
                <span class="rank-name">${esc(s.athlete.apelido)}</span>
                <span class="rank-meta">${s.assists} assist.</span>
              </div>
            `).join('') : '<div class="empty-state compact">Sem assistências registradas.</div>'}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-heading">
          <div><span class="eyebrow">CAMPEONATO</span><h2>Classificação dos Times</h2></div>
          <button class="text-button" data-goto="times">Tabela completa →</button>
        </div>
        <div class="table-wrap">
          <table class="standings-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Pts</th>
                <th>J</th>
                <th>V</th>
                <th>SG</th>
              </tr>
            </thead>
            <tbody>
              ${standings.map((row, idx) => {
                const logo = row.team.logo_url || (row.team.nome && row.team.nome.toLowerCase().includes('inter') ? './public/escudo-internacional.svg' : './public/escudo-gremio.svg');
                return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <span class="standings-pos" style="min-width:18px;">${idx + 1}º</span>
                      <div style="width:26px; height:26px; min-width:26px; display:flex; align-items:center; justify-content:center;">
                        ${logo ? `<img src="${esc(logo)}" alt="${esc(row.team.nome)}" style="width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">` : `<span class="team-badge" style="border:1px solid ${row.team.cor}; color:${row.team.cor};">${row.team.badge}</span>`}
                      </div>
                      <strong style="font-size:14px; color:#fff;">${esc(row.team.nome)}</strong>
                    </div>
                  </td>
                  <td class="standings-pts">${row.pontos}</td>
                  <td>${row.jogos}</td>
                  <td>${row.vitorias}</td>
                  <td style="color:${row.saldoGols > 0 ? '#8ce4a6' : row.saldoGols < 0 ? '#f78d88' : 'inherit'}; font-weight:600;">
                    ${row.saldoGols > 0 ? '+' : ''}${row.saldoGols}
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function getNextMatch() {
  const nowStr = new Date().toISOString().split('T')[0];
  const upcoming = state.matches
    .filter(m => m.status === 'Agendada' && m.data >= nowStr)
    .sort((a, b) => new Date(a.data) - new Date(b.data));
  return upcoming[0] || state.matches.find(m => m.status === 'Agendada');
}

function renderNextMatchCard(match) {
  if (!match) {
    return `<div class="empty-state compact">Nenhuma partida agendada no momento.<br><small>A administração agendará a próxima rodada.</small></div>`;
  }

  const teamA = state.teams.find(t => t.id === match.time_a) || { nome: 'Time A', cor: '#75a88a' };
  const teamB = state.teams.find(t => t.id === match.time_b) || { nome: 'Time B', cor: '#d5b46a' };
  const juiz = state.juizes.find(j => j.id === match.juiz_id);
  const confirmedPlayers = state.presencas.filter(p => p.match_id === match.id && p.confirmado);

  const formattedDate = new Date(match.data + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return `
    <div style="padding:10px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <span style="font-size:12px; color:var(--gold); font-weight:700;">📅 ${formattedDate} • ${match.hora || '07:30'}</span>
        ${juiz ? `<span class="badge-tag info">⚖ Árbitro: ${esc(juiz.nome)}</span>` : ''}
      </div>

      <div style="display:flex; align-items:center; justify-content:space-around; background:#0f1a14; padding:18px; border-radius:10px; border:1px solid var(--line); margin-bottom:15px;">
        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          ${teamA.logo_url ? `<img src="${esc(teamA.logo_url)}" alt="${esc(teamA.nome)}" style="width:52px; height:52px; object-fit:contain; filter:drop-shadow(0 4px 6px #0007);">` : ''}
          <strong style="font:800 20px var(--display); color:${teamA.cor};">${esc(teamA.nome)}</strong>
          <span style="font-size:9px; color:var(--muted); letter-spacing:1px;">MANDANTE</span>
        </div>
        <div style="font:800 28px var(--display); color:var(--gold);">VS</div>
        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          ${teamB.logo_url ? `<img src="${esc(teamB.logo_url)}" alt="${esc(teamB.nome)}" style="width:52px; height:52px; object-fit:contain; filter:drop-shadow(0 4px 6px #0007);">` : ''}
          <strong style="font:800 20px var(--display); color:${teamB.cor};">${esc(teamB.nome)}</strong>
          <span style="font-size:9px; color:var(--muted); letter-spacing:1px;">VISITANTE</span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:11px; color:var(--muted);">
          ⚽ <strong>${confirmedPlayers.length}</strong> atleta(s) confirmados para este jogo.
        </div>
        <button class="btn btn-gold" onclick="openPublicAttendanceModal('${match.id}')">
          Confirmar minha presença →
        </button>
      </div>
    </div>
  `;
}

function getTopScorers(limit = 10) {
  const counts = {};
  for (const g of state.goals) {
    counts[g.athlete_id] = (counts[g.athlete_id] || 0) + (g.quantidade || 1);
  }
  return Object.entries(counts)
    .map(([aid, goals]) => ({ athlete: state.athletes.find(a => a.id === aid), goals }))
    .filter(x => x.athlete)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);
}

function getTopAssists(limit = 10) {
  const counts = {};
  for (const as of state.assistencias) {
    counts[as.athlete_id] = (counts[as.athlete_id] || 0) + (as.quantidade || 1);
  }
  return Object.entries(counts)
    .map(([aid, assists]) => ({ athlete: state.athletes.find(a => a.id === aid), assists }))
    .filter(x => x.athlete)
    .sort((a, b) => b.assists - a.assists)
    .slice(0, limit);
}

function getOverallStats(limit = 50) {
  const map = {};
  for (const a of state.athletes) {
    map[a.id] = { athlete: a, goals: 0, assists: 0, total: 0 };
  }
  for (const g of state.goals) {
    if (!map[g.athlete_id]) {
      const a = state.athletes.find(x => x.id === g.athlete_id);
      if (a) map[g.athlete_id] = { athlete: a, goals: 0, assists: 0, total: 0 };
    }
    if (map[g.athlete_id]) {
      map[g.athlete_id].goals += (g.quantidade || 1);
    }
  }
  for (const as of state.assistencias) {
    if (!map[as.athlete_id]) {
      const a = state.athletes.find(x => x.id === as.athlete_id);
      if (a) map[as.athlete_id] = { athlete: a, goals: 0, assists: 0, total: 0 };
    }
    if (map[as.athlete_id]) {
      map[as.athlete_id].assists += (as.quantidade || 1);
    }
  }
  const all = Object.values(map).map(x => ({ ...x, total: x.goals + x.assists }));
  const withStats = all.filter(x => x.total > 0 || x.goals > 0 || x.assists > 0);
  const result = withStats.length > 0 ? withStats : all;
  return result
    .sort((a, b) => b.total - a.total || b.goals - a.goals || b.assists - a.assists || a.athlete.apelido.localeCompare(b.athlete.apelido))
    .slice(0, limit);
}

/**
 * 4.2 ATLETAS & ELENCO (renderAthletes)
 */
function renderAthletes() {
  const activeSeason = getActiveTemporada();
  let filter = 'todos';
  let searchTerm = '';

  const teamA = state.teams.find(t => t.id === 'team-a') || state.teams[0] || { id: 'team-a', nome: 'Internacional', cor: '#e52329' };
  const teamB = state.teams.find(t => t.id === 'team-b') || state.teams[1] || { id: 'team-b', nome: 'Grêmio', cor: '#0d80bf' };

  function draw() {
    let list = state.athletes.filter(a => {
      const matchSearch = (a.apelido || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (filter === 'team-a') return a.team_id === teamA.id || a.team_id === 'team-a';
      if (filter === 'team-b') return a.team_id === teamB.id || a.team_id === 'team-b';
      if (filter === 'diretoria') return !!a.is_diretoria;
      return true;
    });

    const athletesHtml = list.length ? list.map(a => {
      const team = state.teams.find(t => t.id === a.team_id);
      const disc = calculateDisciplinaryStatus(a.id);
      const fin = checkInadimplencia(a.id);

      return `
        <div class="athlete-row">
          <div style="display:flex; align-items:center; gap:10px; min-width:200px; flex:1.2;">
            <div class="avatar" style="width:34px; height:34px; min-width:34px; font:700 14px var(--display); color:var(--gold); border:1px solid var(--line); border-radius:50%; display:flex; align-items:center; justify-content:center;">
              ${a.foto_url ? `<img src="${a.foto_url}" alt="${esc(a.apelido)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : esc(a.apelido.charAt(0))}
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <strong style="font-size:14px; color:#fff;">${esc(a.apelido)}</strong>
                ${a.numero_camisa ? `<span style="font-size:11px; color:var(--gold); font-weight:700;">#${a.numero_camisa}</span>` : ''}
                ${a.is_diretoria ? `<span class="badge-tag gold" style="padding:1px 5px; font-size:9px;">★ DIRETORIA</span>` : ''}
              </div>
              <small style="color:var(--muted); font-size:11px;">${a.posicao || 'Jogador'}${a.nome_completo ? ` • ${esc(a.nome_completo)}` : ''}</small>
            </div>
          </div>

          <div style="min-width:130px; flex:0.8;">
            ${team ? `
              <span class="badge-tag" style="background:${team.cor}18; color:${team.cor}; border:1px solid ${team.cor}44; padding:3px 8px; font-size:11px; display:inline-flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${team.cor};"></span>
                ${esc(team.nome)}
              </span>
            ` : '<span class="badge-tag" style="opacity:0.5; font-size:11px;">Sem time</span>'}
          </div>

          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1;">
            ${disc.isSuspended ? `<span class="badge-tag danger" style="padding:2px 7px; font-size:10px;">🔴 SUSPENSO: ${esc(disc.reason)}</span>` : `<span class="badge-tag success" style="padding:2px 7px; font-size:10px;">🟢 APTO PARA O BABA</span>`}
            ${fin.isInadimplente ? `<span class="badge-tag warning" style="padding:2px 7px; font-size:10px;">⚠️ MENSALIDADE PENDENTE</span>` : ''}
          </div>

          <div style="font-size:12px; color:var(--muted); white-space:nowrap; min-width:85px; text-align:center;">
            🟨 <strong>${disc.totalYellows}</strong> <span style="opacity:0.3; margin:0 3px;">|</span> 🟥 <strong>${disc.totalReds}</strong>
          </div>

          ${isAdmin ? `
            <div style="display:flex; align-items:center; gap:6px; margin-left:auto; white-space:nowrap;">
              <button class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="editAthleteModal('${a.id}')">Editar</button>
              <button class="btn btn-outline" style="padding:3px 8px; font-size:11px; color:#e57373; border-color:#e5737344;" onclick="deleteAthleteAction('${a.id}')">Excluir</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('') : `<div class="empty-state full">Nenhum atleta encontrado com estes filtros.</div>`;

    $('#athletesList').innerHTML = athletesHtml;
  }

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">TEMPORADA ${activeSeason.ano}</div>
        <h1>Atletas & Elenco Oficial</h1>
        <p>Catálogo de atletas, vínculos com os times, membros da diretoria e status disciplinar para o próximo jogo.</p>
      </div>
      ${isAdmin ? `<button class="btn btn-gold" id="btnNewAthlete">+ Novo Atleta</button>` : ''}
    </div>

    <div class="subtabs" id="athletesSubtabs">
      <button class="tab-btn active" data-filter="todos">Todos (${state.athletes.length})</button>
      <button class="tab-btn" data-filter="team-a">${esc(teamA.nome)}</button>
      <button class="tab-btn" data-filter="team-b">${esc(teamB.nome)}</button>
      <button class="tab-btn" data-filter="diretoria">Diretoria</button>
    </div>

    <div class="filter-row">
      <input type="search" id="athleteSearch" placeholder="Buscar atleta por apelido ou nome..." />
    </div>

    <div class="athletes-list" id="athletesList"></div>
  `;

  $('#athleteSearch').oninput = e => {
    searchTerm = e.target.value;
    draw();
  };

  $$('#athletesSubtabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#athletesSubtabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      draw();
    };
  });

  if ($('#btnNewAthlete')) {
    $('#btnNewAthlete').onclick = () => editAthleteModal();
  }

  draw();
}

function editAthleteModal(athleteId = '') {
  const a = athleteId ? state.athletes.find(x => x.id === athleteId) : {};
  showEdit(`
    <h2>${a.id ? 'Editar Atleta' : 'Novo Atleta do Baba'}</h2>
    <p>Preencha a ficha cadastral do atleta para a temporada ativa.</p>
    <form id="athleteForm">
      <div class="form-grid">
        <div class="field">
          <label>Apelido no Baba (Público) *</label>
          <input name="apelido" required value="${esc(a.apelido || '')}" placeholder="Ex: Deivide">
        </div>
        <div class="field">
          <label>Nome Completo (Restrito à Diretoria)</label>
          <input name="nome_completo" value="${esc(a.nome_completo || '')}" placeholder="Ex: Deivide Silva">
        </div>
        <div class="field">
          <label>Telefone / WhatsApp (Restrito)</label>
          <input name="telefone" value="${esc(a.telefone || '')}" placeholder="Ex: (71) 98888-7777">
        </div>
        <div class="field">
          <label>Posição Principal</label>
          <select name="posicao">
            <option value="">Selecione</option>
            ${['Goleiro', 'Zagueiro', 'Lateral', 'Meio-campo', 'Volante', 'Atacante'].map(p => `
              <option ${a.posicao === p ? 'selected' : ''}>${p}</option>
            `).join('')}
          </select>
        </div>
        <div class="field">
          <label>Número da Camisa</label>
          <input type="number" name="numero_camisa" min="1" max="99" value="${a.numero_camisa || ''}">
        </div>
        <div class="field">
          <label>Time Vinculado</label>
          <select name="team_id">
            <option value="">Sem time definido</option>
            ${state.teams.map(t => `<option value="${t.id}" ${a.team_id === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="field full">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="is_diretoria" ${a.is_diretoria ? 'checked' : ''} style="width:auto;">
            <span>Membro da Diretoria</span>
          </label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button class="btn-primary" type="submit">Salvar Atleta</button>
      </div>
    </form>
  `);

  $('#athleteForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const athleteData = {
      id: a.id || id(),
      apelido: f.get('apelido').trim(),
      nome_completo: f.get('nome_completo') ? f.get('nome_completo').trim() : null,
      telefone: f.get('telefone') ? f.get('telefone').trim() : null,
      posicao: f.get('posicao') || null,
      numero_camisa: f.get('numero_camisa') ? Number(f.get('numero_camisa')) : null,
      team_id: f.get('team_id') || null,
      is_diretoria: f.get('is_diretoria') === 'on'
    };

    try {
      await saveRecord('athletes', athleteData);
      $('#editDialog').close();
      notify('Atleta salvo com sucesso!');
      renderPage('atletas');
    } catch (err) {
      notify(err.message);
    }
  };
}

async function deleteAthleteAction(aid) {
  if (!confirm('Tem certeza que deseja excluir este atleta do cadastro?')) return;
  try {
    await saveRecord('athletes', { id: aid }, true);
    notify('Atleta excluído.');
    renderPage('atletas');
  } catch (err) {
    notify(err.message);
  }
}

/**
 * 4.3 TIMES & TABELA (renderTeams)
 */
function renderTeams() {
  const activeSeason = getActiveTemporada();
  const standings = calculateStandings();

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">TEMPORADA ${activeSeason.ano}</div>
        <h1>Classificação Oficial dos Times</h1>
        <p>Pontos corridos: Vitória = 3 pts, Empate = 1 pt, Derrota = 0. Desempate: Pontos > Vitórias > Saldo de Gols > Gols Pró.</p>
      </div>
      ${isAdmin ? `<button class="btn btn-secondary" onclick="editTeamModal()">+ Adicionar / Editar Time</button>` : ''}
    </div>

    <div class="table-wrap" style="margin-bottom:25px;">
      <table class="standings-table">
        <thead>
          <tr>
            <th style="width:50px;">Pos</th>
            <th>Time</th>
            <th>Pontos</th>
            <th>Jogos</th>
            <th>Vitórias</th>
            <th>Empates</th>
            <th>Derrotas</th>
            <th>GP</th>
            <th>GC</th>
            <th>Saldo (SG)</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((row, idx) => {
            const logo = row.team.logo_url || (row.team.nome && row.team.nome.toLowerCase().includes('inter') ? './public/escudo-internacional.svg' : './public/escudo-gremio.svg');
            return `
            <tr>
              <td class="standings-pos">${idx + 1}º</td>
              <td>
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
                    ${logo ? `<img src="${esc(logo)}" alt="${esc(row.team.nome)}" style="width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">` : `<span class="team-badge" style="border:1px solid ${row.team.cor}; color:${row.team.cor};">${row.team.badge}</span>`}
                  </div>
                  <div>
                    <strong style="font-size:13px; color:${row.team.cor};">${esc(row.team.nome)}</strong>
                  </div>
                </div>
              </td>
              <td class="standings-pts" style="color:var(--gold); font-size:18px;">${row.pontos}</td>
              <td>${row.jogos}</td>
              <td style="color:#8ce4a6; font-weight:600;">${row.vitorias}</td>
              <td>${row.empates}</td>
              <td style="color:#f78d88;">${row.derrotas}</td>
              <td>${row.golsPro}</td>
              <td>${row.golsContra}</td>
              <td style="font-weight:700; color:${row.saldoGols > 0 ? '#8ce4a6' : row.saldoGols < 0 ? '#f78d88' : 'inherit'};">
                ${row.saldoGols > 0 ? '+' : ''}${row.saldoGols}
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="page-header" style="margin-top:20px;">
      <div>
        <div class="eyebrow">ELENCO POR TIME</div>
        <h2>Escalação dos Dois Quadros</h2>
      </div>
    </div>

    <div class="cards-grid">
      ${state.teams.map(t => {
        const teamAthletes = state.athletes.filter(a => a.team_id === t.id);
        return `
          <div class="panel">
            <div class="panel-heading" style="border-bottom:1px solid var(--line); padding-bottom:12px;">
              <div style="display:flex; align-items:center; gap:14px;">
                <div style="width:52px; height:52px; display:flex; align-items:center; justify-content:center;">
                  ${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="${esc(t.nome)}" style="width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 4px 6px #0007);">` : `<span class="team-badge" style="border:1px solid ${t.cor}; color:${t.cor};">${t.badge}</span>`}
                </div>
                <div>
                  <h3 style="margin:0; font:800 22px var(--display); color:${t.cor};">${esc(t.nome)}</h3>
                  <small style="color:var(--muted);">${teamAthletes.length} atletas inscritos</small>
                </div>
              </div>
            </div>

            <div class="list-wrap" style="margin-top:12px;">
              ${teamAthletes.map(a => `
                <div class="rank-row">
                  <span style="font-weight:700; width:25px; color:var(--muted);">${a.numero_camisa ? `#${a.numero_camisa}` : '—'}</span>
                  <span class="rank-name">${esc(a.apelido)} ${a.is_diretoria ? '★' : ''}</span>
                  <span class="rank-meta">${a.posicao || 'Jogador'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 4.4 PARTIDAS & SÚMULA DIGITAL (renderMatches)
 */
function renderMatches() {
  const activeSeason = getActiveTemporada();
  let filter = 'todas';

  function draw() {
    let list = [...state.matches].sort((a, b) => new Date(b.data) - new Date(a.data));
    if (filter === 'Agendada') list = list.filter(m => m.status === 'Agendada');
    if (filter === 'Finalizada') list = list.filter(m => m.status === 'Finalizada');
    if (filter === 'Cancelada') list = list.filter(m => m.status === 'Cancelada');

    $('#matchesList').innerHTML = list.length ? list.map(m => {
      const tA = state.teams.find(t => t.id === m.time_a) || { nome: 'Time A', cor: '#75a88a' };
      const tB = state.teams.find(t => t.id === m.time_b) || { nome: 'Time B', cor: '#d5b46a' };
      const juiz = state.juizes.find(j => j.id === m.juiz_id);
      const isFin = m.status === 'Finalizada';
      const mGoals = state.goals.filter(g => g.match_id === m.id);

      return `
        <div class="panel" style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <span class="tag ${isFin ? 'tag-green' : (m.status === 'Cancelada' ? 'tag' : 'tag-gold')}" style="${m.status === 'Cancelada' ? 'background:#3b2323; color:#f78d88; border:1px solid #f78d8844;' : ''}">
                ${esc(m.status.toUpperCase())}
              </span>
              <span style="font-size:11px; color:var(--muted); margin-left:8px;">
                📅 ${new Date(m.data + 'T12:00:00Z').toLocaleDateString('pt-BR')} • ${m.hora || '07:30'} • ${esc(m.tipo)}
              </span>
            </div>
            ${juiz ? `<span style="font-size:11px; color:var(--gold);">⚖ Árbitro: ${esc(juiz.nome)}</span>` : ''}
          </div>

          <div class="scoreline" style="background:#0e1913; border:1px solid var(--line); border-radius:10px;">
            <div style="flex:1; display:flex; align-items:center; justify-content:flex-end; gap:12px;">
              <span style="font:800 24px var(--display); color:${tA.cor};">${esc(tA.nome)}</span>
              ${tA.logo_url ? `<img src="${esc(tA.logo_url)}" alt="${esc(tA.nome)}" style="width:38px; height:38px; object-fit:contain; filter:drop-shadow(0 4px 6px #0006);">` : ''}
            </div>
            <strong style="font:800 38px var(--display); padding:0 20px; color:${isFin ? '#fff' : 'var(--muted)'};">
              ${m.placar_a} <span style="font-size:20px; color:var(--muted);">×</span> ${m.placar_b}
            </strong>
            <div style="flex:1; display:flex; align-items:center; justify-content:flex-start; gap:12px;">
              ${tB.logo_url ? `<img src="${esc(tB.logo_url)}" alt="${esc(tB.nome)}" style="width:38px; height:38px; object-fit:contain; filter:drop-shadow(0 4px 6px #0006);">` : ''}
              <span style="font:800 24px var(--display); color:${tB.cor};">${esc(tB.nome)}</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; flex-wrap:wrap; gap:8px;">
            <div style="font-size:11px; color:var(--muted);">
              ⚽ ${mGoals.length} gol(s) anotado(s) na súmula
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <button class="btn btn-secondary" onclick="openSumulaModal('${m.id}')">
                Abrir Súmula Digital ↗
              </button>
              ${isAdmin ? `
                <button class="btn btn-outline" onclick="editMatchSchedule('${m.id}')">Editar</button>
                <button class="btn btn-outline" style="color:#e57373; border-color:#e5737344;" onclick="deleteMatchAction('${m.id}')" title="Retirar partida da súmula e calendário">Excluir</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty-state">Nenhuma partida encontrada nesta categoria.</div>`;
  }

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">TEMPORADA ${activeSeason.ano}</div>
        <h1>Partidas & Súmula Eletrônica</h1>
        <p>Acompanhe todos os confrontos, gols, assistências, cartões e confirme presenças nos jogos agendados.</p>
      </div>
      ${isAdmin ? `<button class="btn btn-gold" id="btnNewMatch">+ Agendar Nova Partida</button>` : ''}
    </div>

    <div class="subtabs" id="matchSubtabs">
      <button class="tab-btn active" data-filter="todas">Todas as Partidas</button>
      <button class="tab-btn" data-filter="Agendada">Agendadas</button>
      <button class="tab-btn" data-filter="Finalizada">Finalizadas</button>
      <button class="tab-btn" data-filter="Cancelada">Canceladas</button>
    </div>

    <div id="matchesList"></div>
  `;

  $$('#matchSubtabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#matchSubtabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filter = btn.dataset.filter;
      draw();
    };
  });

  if ($('#btnNewMatch')) {
    $('#btnNewMatch').onclick = () => editMatchSchedule();
  }

  draw();
}

function editMatchSchedule(matchId = '') {
  const m = matchId ? state.matches.find(x => x.id === matchId) : {};
  showEdit(`
    <h2>${m.id ? 'Editar Partida' : 'Agendar Nova Partida'}</h2>
    <form id="matchScheduleForm">
      <div class="form-grid">
        <div class="field">
          <label>Time A (Mandante)</label>
          <select name="time_a" required>
            ${state.teams.map(t => `<option value="${t.id}" ${m.time_a === t.id ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Time B (Visitante)</label>
          <select name="time_b" required>
            ${state.teams.map(t => `<option value="${t.id}" ${m.time_b === t.id ? 'selected' : (t.id === 'team-b' ? 'selected' : '')}>${esc(t.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Data da Partida *</label>
          <input type="date" name="data" required value="${m.data || ''}">
        </div>
        <div class="field">
          <label>Horário</label>
          <input type="time" name="hora" value="${m.hora || '07:30'}">
        </div>
        <div class="field">
          <label>Tipo de Partida</label>
          <select name="tipo">
            <option ${m.tipo === 'Domingo' ? 'selected' : ''}>Domingo</option>
            <option ${m.tipo === 'Feriado' ? 'selected' : ''}>Feriado</option>
            <option ${m.tipo === 'Especial' ? 'selected' : ''}>Especial</option>
          </select>
        </div>
        <div class="field">
          <label>Árbitro Escalado</label>
          <select name="juiz_id">
            <option value="">Sem árbitro escalado</option>
            ${state.juizes.map(j => `<option value="${j.id}" ${m.juiz_id === j.id ? 'selected' : ''}>${esc(j.nome)}</option>`).join('')}
          </select>
        </div>
        <div class="field full">
          <label>Status da Partida</label>
          <select name="status">
            <option ${m.status === 'Agendada' ? 'selected' : ''}>Agendada</option>
            <option ${m.status === 'Finalizada' ? 'selected' : ''}>Finalizada</option>
            <option ${m.status === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
          </select>
        </div>
      </div>
      <div class="modal-actions" style="display:flex; justify-content:space-between; align-items:center;">
        ${m.id ? `
          <button type="button" class="btn btn-outline" style="color:#e57373; border-color:#e5737344;" onclick="deleteMatchAction('${m.id}')">
            🗑 Retirar Partida da Súmula
          </button>
        ` : '<div></div>'}
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn-secondary" data-close>Cancelar</button>
          <button type="submit" class="btn-primary">Salvar Partida</button>
        </div>
      </div>
    </form>
  `);

  $('#matchScheduleForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const tA = f.get('time_a');
    const tB = f.get('time_b');
    if (tA === tB) return notify('Selecione dois times distintos para o confronto.');

    const matchData = {
      id: m.id || id(),
      data: f.get('data'),
      hora: f.get('hora') || '07:30',
      tipo: f.get('tipo') || 'Domingo',
      time_a: tA,
      time_b: tB,
      juiz_id: f.get('juiz_id') || null,
      status: f.get('status') || 'Agendada',
      placar_a: m.placar_a || 0,
      placar_b: m.placar_b || 0,
      temporada_id: getActiveTemporada().id
    };

    try {
      await saveRecord('matches', matchData);
      $('#editDialog').close();
      notify('Partida agendada com sucesso!');
      renderPage('partidas');
    } catch (err) {
      notify(err.message);
    }
  };
}

async function deleteMatchAction(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  const dateFormatted = m.data ? new Date(m.data + 'T12:00:00Z').toLocaleDateString('pt-BR') : '';
  if (!confirm(`Deseja realmente retirar e excluir esta partida (${dateFormatted}) da lista e da súmula?`)) return;

  try {
    // 1. Limpa gols vinculados
    const mGoals = state.goals.filter(g => g.match_id === matchId);
    for (const g of mGoals) {
      await saveRecord('goals', { id: g.id }, true);
    }
    // 2. Limpa assistências vinculadas
    const mAssists = state.assistencias.filter(as => as.match_id === matchId);
    for (const as of mAssists) {
      await saveRecord('assistencias', { id: as.id }, true);
    }
    // 3. Limpa cartões vinculados
    const mCards = state.cards.filter(c => c.match_id === matchId);
    for (const c of mCards) {
      await saveRecord('cards', { id: c.id }, true);
    }
    // 4. Limpa presenças vinculadas
    const mPresencas = state.presencas.filter(p => p.match_id === matchId);
    for (const p of mPresencas) {
      await saveRecord('presencas', { id: p.id }, true);
    }
    // 5. Exclui a partida
    await saveRecord('matches', { id: matchId }, true);

    if ($('#editDialog')) $('#editDialog').close();
    if ($('#adminDialog')) $('#adminDialog').close();

    notify('Partida retirada do calendário e da súmula com sucesso!');
    renderPage('partidas');
  } catch (err) {
    notify(err.message);
  }
}

/**
 * 4.5 MODAL DE SÚMULA DIGITAL
 */
function openSumulaModal(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  const tA = state.teams.find(t => t.id === m.time_a) || { nome: 'Time A', cor: '#75a88a' };
  const tB = state.teams.find(t => t.id === m.time_b) || { nome: 'Time B', cor: '#d5b46a' };
  const juiz = state.juizes.find(j => j.id === m.juiz_id);

  const mGoals = state.goals.filter(g => g.match_id === matchId);
  const mCards = state.cards.filter(c => c.match_id === matchId);
  const mPresencas = state.presencas.filter(p => p.match_id === matchId);

  showEdit(`
    <div style="border-bottom:1px solid var(--line); padding-bottom:12px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span class="tag ${m.status === 'Finalizada' ? 'tag-green' : 'tag-gold'}">${esc(m.status.toUpperCase())}</span>
          <span style="font-size:11px; color:var(--muted); margin-left:8px;">
            ${new Date(m.data + 'T12:00:00Z').toLocaleDateString('pt-BR')} • ${m.hora || '07:30'}
          </span>
        </div>
        ${juiz ? `<span class="badge-tag info">⚖ ${esc(juiz.nome)}</span>` : ''}
      </div>

      <div class="scoreline" style="margin:12px 0 6px;">
        <div style="flex:1; display:flex; align-items:center; justify-content:flex-end; gap:10px;">
          <span style="color:${tA.cor}; font:800 22px var(--display);">${esc(tA.nome)}</span>
          ${tA.logo_url ? `<img src="${esc(tA.logo_url)}" alt="${esc(tA.nome)}" style="width:34px; height:34px; object-fit:contain;">` : ''}
        </div>
        <strong style="font:800 36px var(--display); padding:0 16px;">${m.placar_a} × ${m.placar_b}</strong>
        <div style="flex:1; display:flex; align-items:center; justify-content:flex-start; gap:10px;">
          ${tB.logo_url ? `<img src="${esc(tB.logo_url)}" alt="${esc(tB.nome)}" style="width:34px; height:34px; object-fit:contain;">` : ''}
          <span style="color:${tB.cor}; font:800 22px var(--display);">${esc(tB.nome)}</span>
        </div>
      </div>
      <div style="text-align:center; font-size:10px; color:var(--muted);">
        O placar é atualizado automaticamente conforme os gols são adicionados.
      </div>
    </div>

    ${isAdmin ? `
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
        <button class="btn btn-secondary" onclick="addGoalModal('${matchId}')">⚽ + Registrar Gol</button>
        <button class="btn btn-secondary" onclick="addCardModal('${matchId}')">🟨 + Registrar Cartão</button>
        ${m.status === 'Agendada' ? `
          <button class="btn btn-primary" onclick="toggleFinishMatch('${matchId}', true)" style="margin-left:auto;">
            ✓ Finalizar Partida
          </button>
        ` : `
          <button class="btn btn-outline" onclick="toggleFinishMatch('${matchId}', false)" style="margin-left:auto;">
            Reabrir Partida
          </button>
        `}
        <button class="btn btn-outline" style="color:#e57373; border-color:#e5737344;" onclick="deleteMatchAction('${matchId}')" title="Retirar partida da súmula e calendário">
          🗑 Retirar da Súmula
        </button>
      </div>
    ` : ''}

    <div class="sumula-events-container">
      <div class="sumula-team-column">
        <h3><span>⚽ Gols Anotados</span> <small style="font-size:11px; color:var(--muted);">${mGoals.length} gol(s)</small></h3>
        ${mGoals.length ? mGoals.map(g => {
          const author = state.athletes.find(a => a.id === g.athlete_id);
          const assist = state.assistencias.find(as => as.match_id === matchId && as.goal_id === g.id);
          const garcom = assist ? state.athletes.find(a => a.id === assist.athlete_id) : null;
          return `
            <div class="event-item">
              <div>
                <span class="author">⚽ ${author ? esc(author.apelido) : 'Atleta'}</span>
                ${g.minuto ? `<small style="color:var(--muted);"> (${g.minuto}')</small>` : ''}
                ${garcom ? `<span class="assist">🎯 Passe: ${esc(garcom.apelido)}</span>` : ''}
              </div>
              ${isAdmin ? `<button class="btn-remove" onclick="removeGoalAction('${g.id}', '${matchId}')">✕</button>` : ''}
            </div>
          `;
        }).join('') : '<div style="font-size:11px; color:var(--muted);">Nenhum gol anotado.</div>'}
      </div>

      <div class="sumula-team-column">
        <h3><span>🟨 Disciplina & Cartões</span> <small style="font-size:11px; color:var(--muted);">${mCards.length} cartão(ões)</small></h3>
        ${mCards.length ? mCards.map(c => {
          const author = state.athletes.find(a => a.id === c.athlete_id);
          const isRed = c.type === 'Vermelho';
          return `
            <div class="event-item">
              <div>
                <span style="font-weight:700; color:${isRed ? '#f78d88' : '#ffd874'};">
                  ${isRed ? '🟥 Vermelho' : '🟨 Amarelo'}
                </span>
                <span class="author" style="margin-left:6px;">${author ? esc(author.apelido) : 'Atleta'}</span>
              </div>
              ${isAdmin ? `<button class="btn-remove" onclick="removeCardAction('${c.id}', '${matchId}')">✕</button>` : ''}
            </div>
          `;
        }).join('') : '<div style="font-size:11px; color:var(--muted);">Sem cartões nesta partida.</div>'}
      </div>
    </div>

    <div style="margin-top:20px; border-top:1px solid var(--line); padding-top:14px;">
      <h3 style="font:700 18px var(--display); margin-bottom:10px;">Presenças Confirmadas (${mPresencas.filter(p => p.confirmado).length})</h3>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${mPresencas.filter(p => p.confirmado).map(p => {
          const athlete = state.athletes.find(a => a.id === p.atleta_id);
          return athlete ? `
            <span class="badge-tag success">
              ✓ ${esc(athlete.apelido)}
              ${isAdmin ? `<button onclick="toggleAttendanceAdmin('${matchId}','${athlete.id}', false)" style="background:none; border:0; color:#fff; cursor:pointer; margin-left:4px;">✕</button>` : ''}
            </span>
          ` : '';
        }).join('') || '<div style="font-size:11px; color:var(--muted);">Nenhuma presença confirmada.</div>'}
      </div>
    </div>
  `);
}

function addGoalModal(matchId) {
  showAdmin(`
    <h2>Registrar Gol</h2>
    <form id="goalForm">
      <div class="field">
        <label>Autor do Gol *</label>
        <select name="athlete_id" required>
          <option value="">Selecione o atleta</option>
          ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)} (${a.posicao || 'Jogador'})</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Assistência / Passe (Opcional)</label>
        <select name="assist_id">
          <option value="">Sem assistência (gol individual / rebote)</option>
          ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Minuto do Gol (Opcional)</label>
        <input type="number" name="minuto" min="1" max="150" placeholder="Ex: 24">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Gol</button>
      </div>
    </form>
  `);

  $('#goalForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const athleteId = f.get('athlete_id');
    const assistId = f.get('assist_id');
    const goalId = id();

    const goal = {
      id: goalId,
      match_id: matchId,
      athlete_id: athleteId,
      minuto: f.get('minuto') ? Number(f.get('minuto')) : null,
      quantidade: 1
    };

    try {
      await saveRecord('goals', goal);
      if (assistId && assistId !== athleteId) {
        await saveRecord('assistencias', {
          id: id(),
          match_id: matchId,
          athlete_id: assistId,
          goal_id: goalId,
          quantidade: 1
        });
      }
      recalculateMatchScore(matchId);
      $('#adminDialog').close();
      notify('Gol registrado!');
      openSumulaModal(matchId);
      renderPage('partidas');
    } catch (err) {
      notify(err.message);
    }
  };
}

function addCardModal(matchId) {
  showAdmin(`
    <h2>Registrar Cartão</h2>
    <form id="cardForm">
      <div class="field">
        <label>Atleta Punido *</label>
        <select name="athlete_id" required>
          <option value="">Selecione o atleta</option>
          ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Tipo de Cartão</label>
        <select name="type">
          <option value="Amarelo">🟨 Cartão Amarelo</option>
          <option value="Vermelho">🟥 Cartão Vermelho Direto</option>
        </select>
      </div>
      <div class="notice">
        <strong>Atenção às regras de disciplina:</strong>
        <br>• Se o atleta receber o 2º amarelo nesta partida, o sistema emitirá automaticamente um cartão vermelho e suspensão para a próxima rodada.
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Registrar Cartão</button>
      </div>
    </form>
  `);

  $('#cardForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const athleteId = f.get('athlete_id');
    let type = f.get('type');

    // Regra do 2º amarelo no mesmo jogo
    if (type === 'Amarelo') {
      const existingYellows = state.cards.filter(c => c.match_id === matchId && c.atleta_id === athleteId && c.type === 'Amarelo');
      if (existingYellows.length >= 1) {
        type = 'Vermelho';
        notify('2º Amarelo no jogo! Cartão convertido em VERMELHO automático.');
      }
    }

    try {
      await saveRecord('cards', {
        id: id(),
        match_id: matchId,
        atleta_id: athleteId,
        type
      });
      $('#adminDialog').close();
      notify('Cartão registrado com sucesso!');
      openSumulaModal(matchId);
      renderPage('partidas');
    } catch (err) {
      notify(err.message);
    }
  };
}

async function removeGoalAction(goalId, matchId) {
  if (!confirm('Remover este gol da súmula?')) return;
  try {
    await saveRecord('goals', { id: goalId }, true);
    // Remove também a assistência associada, se houver
    const assist = state.assistencias.find(as => as.goal_id === goalId);
    if (assist) await saveRecord('assistencias', { id: assist.id }, true);

    recalculateMatchScore(matchId);
    notify('Gol removido.');
    openSumulaModal(matchId);
    renderPage('partidas');
  } catch (err) {
    notify(err.message);
  }
}

async function removeCardAction(cardId, matchId) {
  if (!confirm('Remover este cartão?')) return;
  try {
    await saveRecord('cards', { id: cardId }, true);
    notify('Cartão removido.');
    openSumulaModal(matchId);
    renderPage('partidas');
  } catch (err) {
    notify(err.message);
  }
}

async function toggleFinishMatch(matchId, shouldFinish) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;
  m.status = shouldFinish ? 'Finalizada' : 'Agendada';
  try {
    await saveRecord('matches', m);
    notify(shouldFinish ? 'Partida finalizada! Suspensões e classificação atualizadas.' : 'Partida reaberta.');
    openSumulaModal(matchId);
    renderPage('partidas');
  } catch (err) {
    notify(err.message);
  }
}

/**
 * 4.6 CONFIRMAÇÃO DE PRESENÇA COM TRAVAS DE SEGURANÇA
 */
function openPublicAttendanceModal(matchId) {
  const m = state.matches.find(x => x.id === matchId);
  if (!m) return;

  showEdit(`
    <h2>Confirmar Presença no Baba</h2>
    <p>Selecione seu nome para confirmar presença na partida de <strong>${new Date(m.data + 'T12:00:00Z').toLocaleDateString('pt-BR')}</strong>.</p>
    
    <div class="field">
      <label>Escolha o Atleta</label>
      <select id="attendanceAthleteSelect" style="font-size:14px; padding:12px;">
        <option value="">Selecione seu nome na lista...</option>
        ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)} (${a.posicao || 'Jogador'})</option>`).join('')}
      </select>
    </div>

    <div id="attendanceStatusFeedback" style="margin:14px 0;"></div>

    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Cancelar</button>
      <button type="button" class="btn-primary" id="btnConfirmAttendance" disabled>Confirmar Presença</button>
    </div>
  `);

  $('#attendanceAthleteSelect').onchange = e => {
    const aid = e.target.value;
    const btn = $('#btnConfirmAttendance');
    const fb = $('#attendanceStatusFeedback');

    if (!aid) {
      btn.disabled = true;
      fb.innerHTML = '';
      return;
    }

    const disc = calculateDisciplinaryStatus(aid);
    const fin = checkInadimplencia(aid);

    // Validação de Suspensão
    if (disc.isSuspended) {
      btn.disabled = true;
      fb.innerHTML = `
        <div class="presence-lock-alert">
          <span>🚫</span>
          <div>
            <strong>PRESENÇA BLOQUEADA POR SUSPENSÃO</strong><br>
            Motivo: ${esc(disc.reason)}. O atleta deve cumprir a suspensão automática neste jogo.
          </div>
        </div>
      `;
      return;
    }

    // Validação de Inadimplência (> 1 mês e 10 dias)
    if (fin.isInadimplente) {
      btn.disabled = true;
      fb.innerHTML = `
        <div class="presence-lock-alert">
          <span>⚠️</span>
          <div>
            <strong>PRESENÇA BLOQUEADA POR PENDÊNCIA FINANCEIRA</strong><br>
            Consta(m) mensalidade(s) em aberto do(s) mês(es): ${fin.pendingMonths.join(', ')} (anterior ao prazo de carência de 1 mês e 10 dias).
            Valor total devido: <strong>${money(fin.totalDue)}</strong>.
            Regularize com a diretoria para liberar sua presença.
          </div>
        </div>
      `;
      return;
    }

    // Apto
    btn.disabled = false;
    const alreadyConfirmed = state.presencas.some(p => p.match_id === matchId && p.atleta_id === aid && p.confirmado);
    fb.innerHTML = `
      <div style="padding:10px; border-radius:8px; background:#183222; border:1px solid #2d553b; color:#a2e4b4; font-size:11px;">
        ✓ ${esc(state.athletes.find(a => a.id === aid).apelido)} está regular e <strong>APTO</strong> para o baba!
        ${alreadyConfirmed ? '<br><em>(Você já confirmou presença nesta partida.)</em>' : ''}
      </div>
    `;

    btn.onclick = async () => {
      try {
        const existing = state.presencas.find(p => p.match_id === matchId && p.atleta_id === aid);
        const presencaRecord = {
          id: existing ? existing.id : id(),
          match_id: matchId,
          atleta_id: aid,
          confirmado: true
        };
        await saveRecord('presencas', presencaRecord);
        $('#editDialog').close();
        notify('Presença confirmada com sucesso! Bom jogo!');
        renderPage(currentPage);
      } catch (err) {
        notify(err.message);
      }
    };
  };
}

async function toggleAttendanceAdmin(matchId, athleteId, status) {
  try {
    const existing = state.presencas.find(p => p.match_id === matchId && p.atleta_id === athleteId);
    const presencaRecord = {
      id: existing ? existing.id : id(),
      match_id: matchId,
      atleta_id: athleteId,
      confirmado: status
    };
    await saveRecord('presencas', presencaRecord);
    notify('Presença atualizada.');
    openSumulaModal(matchId);
  } catch (err) {
    notify(err.message);
  }
}

// ------------------------------------------------------------------------------
// 4.7 GERENCIAMENTO RÁPIDO DE ESTATÍSTICAS E DISCIPLINA (ADMIN)
// ------------------------------------------------------------------------------

function getTargetMatch() {
  const activeSeason = getActiveTemporada();
  let m = state.matches.find(x => x.status === 'Finalizada') || state.matches[0];
  if (!m) {
    m = {
      id: id(),
      data: new Date().toISOString().split('T')[0],
      hora: '07:30',
      tipo: 'Domingo',
      time_a: 'team-a',
      time_b: 'team-b',
      placar_a: 0,
      placar_b: 0,
      status: 'Finalizada',
      temporada_id: activeSeason.id
    };
    state.matches.push(m);
    saveLocal();
  }
  return m;
}

async function quickAddGoalForAthlete(athleteId) {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  const match = getTargetMatch();

  const newGoal = {
    id: id(),
    match_id: match.id,
    athlete_id: athleteId,
    quantidade: 1,
    team_id: athlete.team_id || match.time_a
  };

  try {
    await saveRecord('goals', newGoal);
    recalculateMatchScore(match.id);
    notify(`⚽ +1 Gol adicionado para ${athlete.apelido}!`);
    renderPage('estatisticas');
  } catch (err) {
    notify(err.message);
  }
}

async function quickRemoveGoalForAthlete(athleteId) {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  const goals = state.goals.filter(g => g.athlete_id === athleteId);
  if (!goals.length) {
    notify(`${athlete.apelido} não possui gols registrados.`);
    return;
  }
  const lastGoal = goals[goals.length - 1];
  if (!confirm(`Remover 1 gol de ${athlete.apelido}?`)) return;

  try {
    await saveRecord('goals', { id: lastGoal.id }, true);
    const assist = state.assistencias.find(as => as.goal_id === lastGoal.id);
    if (assist) await saveRecord('assistencias', { id: assist.id }, true);

    recalculateMatchScore(lastGoal.match_id);
    notify(`Gol de ${athlete.apelido} removido.`);
    renderPage('estatisticas');
  } catch (err) {
    notify(err.message);
  }
}

async function quickAddAssistForAthlete(athleteId) {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  const match = getTargetMatch();

  const newAssist = {
    id: id(),
    match_id: match.id,
    athlete_id: athleteId,
    quantidade: 1
  };

  try {
    await saveRecord('assistencias', newAssist);
    notify(`🎯 +1 Assistência adicionada para ${athlete.apelido}!`);
    renderPage('estatisticas');
  } catch (err) {
    notify(err.message);
  }
}

async function quickRemoveAssistForAthlete(athleteId) {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  const assists = state.assistencias.filter(as => as.athlete_id === athleteId);
  if (!assists.length) {
    notify(`${athlete.apelido} não possui assistências registradas.`);
    return;
  }
  const lastAssist = assists[assists.length - 1];
  if (!confirm(`Remover 1 assistência de ${athlete.apelido}?`)) return;

  try {
    await saveRecord('assistencias', { id: lastAssist.id }, true);
    notify(`Assistência de ${athlete.apelido} removida.`);
    renderPage('estatisticas');
  } catch (err) {
    notify(err.message);
  }
}

async function quickAddCardForAthlete(athleteId, type = 'Amarelo') {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  const match = getTargetMatch();

  if (type === 'Amarelo') {
    const yellowsInMatch = state.cards.filter(c => c.match_id === match.id && c.atleta_id === athleteId && c.type === 'Amarelo');
    if (yellowsInMatch.length >= 1) {
      type = 'Vermelho';
      notify('2º Amarelo no jogo: convertido automaticamente em VERMELHO!');
    }
  }

  const newCard = {
    id: id(),
    match_id: match.id,
    atleta_id: athleteId,
    type
  };

  try {
    await saveRecord('cards', newCard);
    notify(`${type === 'Vermelho' ? '🟥 Cartão Vermelho' : '🟨 Cartão Amarelo'} aplicado para ${athlete.apelido}!`);
    renderPage('estatisticas');
  } catch (err) {
    notify(err.message);
  }
}

async function quickRemoveCardForAthlete(athleteId) {
  const athlete = state.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  const cards = state.cards.filter(c => c.atleta_id === athleteId);
  if (!cards.length) {
    notify(`${athlete.apelido} não possui cartões registrados.`);
    return;
  }
  const lastCard = cards[cards.length - 1];
  if (!confirm(`Remover último cartão (${lastCard.type}) de ${athlete.apelido}?`)) return;

  try {
    await saveRecord('cards', { id: lastCard.id }, true);
    notify(`Cartão de ${athlete.apelido} removido.`);
    renderPage('estatisticas');
  } catch (err) {
    notify(err.message);
  }
}

function openStatsEntryModal(defaultType = 'gol') {
  showAdmin(`
    <h2>⚡ Lançar Estatística / Disciplina</h2>
    <p>Adicione rapidamente gols, assistências ou cartões para qualquer atleta:</p>

    <form id="quickStatsForm">
      <div class="field">
        <label>Tipo de Lançamento *</label>
        <select name="entry_type" id="statsEntryTypeSelect" onchange="toggleStatsModalFields(this.value)">
          <option value="gol" ${defaultType === 'gol' ? 'selected' : ''}>⚽ Gol Marcado</option>
          <option value="assistencia" ${defaultType === 'assistencia' ? 'selected' : ''}>🎯 Assistência (Passe)</option>
          <option value="cartao_amarelo" ${defaultType === 'cartao' ? 'selected' : ''}>🟨 Cartão Amarelo</option>
          <option value="cartao_vermelho">🟥 Cartão Vermelho</option>
        </select>
      </div>

      <div class="field">
        <label>Atleta *</label>
        <select name="athlete_id" required>
          <option value="">Selecione o atleta</option>
          ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)} (${a.posicao || 'Jogador'}${a.numero_camisa ? ` • #${a.numero_camisa}` : ''})</option>`).join('')}
        </select>
      </div>

      <div class="field" id="assistFieldGroup" style="${defaultType === 'gol' ? 'display:block;' : 'display:none;'}">
        <label>Assistência / Passe para o Gol (Opcional)</label>
        <select name="assist_athlete_id">
          <option value="">Nenhum (Gol individual / sem assistência)</option>
          ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label>Partida Associada</label>
        <select name="match_id">
          ${state.matches.map(m => {
            const tA = state.teams.find(t => t.id === m.time_a)?.nome || 'Internacional';
            const tB = state.teams.find(t => t.id === m.time_b)?.nome || 'Grêmio';
            return `<option value="${m.id}">${new Date(m.data + 'T12:00:00Z').toLocaleDateString('pt-BR')} • ${tA} × ${tB} (${m.status})</option>`;
          }).join('')}
        </select>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Confirmar Lançamento</button>
      </div>
    </form>
  `);

  window.toggleStatsModalFields = function(val) {
    const g = $('#assistFieldGroup');
    if (g) g.style.display = val === 'gol' ? 'block' : 'none';
  };

  $('#quickStatsForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const entryType = f.get('entry_type');
    const athleteId = f.get('athlete_id');
    const assistAthleteId = f.get('assist_athlete_id');
    const matchId = f.get('match_id') || getTargetMatch().id;
    const athlete = state.athletes.find(a => a.id === athleteId);

    try {
      if (entryType === 'gol') {
        const goalId = id();
        await saveRecord('goals', {
          id: goalId,
          match_id: matchId,
          athlete_id: athleteId,
          quantidade: 1,
          team_id: athlete?.team_id || 'team-a'
        });
        if (assistAthleteId && assistAthleteId !== athleteId) {
          await saveRecord('assistencias', {
            id: id(),
            match_id: matchId,
            athlete_id: assistAthleteId,
            goal_id: goalId,
            quantidade: 1
          });
        }
        recalculateMatchScore(matchId);
        notify(`⚽ Gol registrado para ${athlete ? athlete.apelido : 'atleta'}!`);
      } else if (entryType === 'assistencia') {
        await saveRecord('assistencias', {
          id: id(),
          match_id: matchId,
          athlete_id: athleteId,
          quantidade: 1
        });
        notify(`🎯 Assistência registrada para ${athlete ? athlete.apelido : 'atleta'}!`);
      } else if (entryType === 'cartao_amarelo' || entryType === 'cartao_vermelho') {
        let type = entryType === 'cartao_vermelho' ? 'Vermelho' : 'Amarelo';
        if (type === 'Amarelo') {
          const y = state.cards.filter(c => c.match_id === matchId && c.atleta_id === athleteId && c.type === 'Amarelo');
          if (y.length >= 1) type = 'Vermelho';
        }
        await saveRecord('cards', {
          id: id(),
          match_id: matchId,
          atleta_id: athleteId,
          type
        });
        notify(`Cartão ${type} registrado com sucesso!`);
      }

      $('#adminDialog').close();
      renderPage('estatisticas');
    } catch (err) {
      notify(err.message);
    }
  };
}

/**
 * 4.7 ESTATÍSTICAS (renderStats)
 */
function renderStats() {
  const activeSeason = getActiveTemporada();
  let tab = 'geral';

  function draw() {
    const container = $('#statsContentArea');

    if (tab === 'geral') {
      const overall = getOverallStats(50);
      const topScorer = getTopScorers(1)[0];
      const topAssist = getTopAssists(1)[0];
      const topOverall = overall[0];

      container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px;">
          <div class="stat-card" style="border:1px solid var(--line); background:var(--panel);">
            <div class="stat-label">👑 ARTILHEIRO LÍDER</div>
            <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
              <div class="avatar" style="width:42px; height:42px; font:700 16px var(--display); color:var(--gold); border:1px solid var(--line);">
                ${topScorer ? esc(topScorer.athlete.apelido.charAt(0)) : '—'}
              </div>
              <div>
                <strong style="font-size:15px; display:block;">${topScorer ? esc(topScorer.athlete.apelido) : 'A definir'}</strong>
                <span style="color:var(--gold); font:800 18px var(--display);">${topScorer ? `${topScorer.goals} gol(s)` : '0 gols'}</span>
              </div>
            </div>
          </div>

          <div class="stat-card" style="border:1px solid var(--line); background:var(--panel);">
            <div class="stat-label">🎯 LÍDER EM PASSES (GARÇOM)</div>
            <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
              <div class="avatar" style="width:42px; height:42px; font:700 16px var(--display); color:#8ce4a6; border:1px solid var(--line);">
                ${topAssist ? esc(topAssist.athlete.apelido.charAt(0)) : '—'}
              </div>
              <div>
                <strong style="font-size:15px; display:block;">${topAssist ? esc(topAssist.athlete.apelido) : 'A definir'}</strong>
                <span style="color:#8ce4a6; font:800 18px var(--display);">${topAssist ? `${topAssist.assists} assist.` : '0 assist.'}</span>
              </div>
            </div>
          </div>

          <div class="stat-card" style="border:1px solid var(--line); background:var(--panel);">
            <div class="stat-label">🔥 MAIS PARTICIPAÇÕES (G+A)</div>
            <div style="display:flex; align-items:center; gap:12px; margin-top:8px;">
              <div class="avatar" style="width:42px; height:42px; font:700 16px var(--display); color:#ffd874; border:1px solid var(--line);">
                ${topOverall ? esc(topOverall.athlete.apelido.charAt(0)) : '—'}
              </div>
              <div>
                <strong style="font-size:15px; display:block;">${topOverall ? esc(topOverall.athlete.apelido) : 'A definir'}</strong>
                <span style="color:#ffd874; font:800 18px var(--display);">${topOverall ? `${topOverall.total} ações (${topOverall.goals}G + ${topOverall.assists}A)` : '0 ações'}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:50px;">Pos</th>
                <th>Atleta</th>
                <th>Time</th>
                <th>Posição</th>
                <th style="text-align:center;">⚽ Gols</th>
                <th style="text-align:center;">🎯 Assistências</th>
                <th style="text-align:center;">🔥 Total (G+A)</th>
                ${isAdmin ? '<th style="text-align:right;">Ações Rápidas</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${overall.length ? overall.map((s, idx) => {
                const team = state.teams.find(t => t.id === s.athlete.team_id);
                const logo = team ? (team.logo_url || (team.nome && team.nome.toLowerCase().includes('inter') ? './public/escudo-internacional.svg' : './public/escudo-gremio.svg')) : null;
                return `
                  <tr>
                    <td class="standings-pos">${idx + 1}º</td>
                    <td>
                      <div style="display:flex; align-items:center; gap:8px;">
                        <strong>${esc(s.athlete.apelido)}</strong>
                        ${s.athlete.numero_camisa ? `<small style="color:var(--muted);">#${s.athlete.numero_camisa}</small>` : ''}
                      </div>
                    </td>
                    <td>
                      ${team ? `
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="width:20px; height:20px; min-width:20px; display:flex; align-items:center; justify-content:center;">
                            ${logo ? `<img src="${esc(logo)}" alt="${esc(team.nome)}" style="width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">` : `<span class="team-badge" style="border:1px solid ${team.cor}; color:${team.cor}; font-size:9px;">${team.badge}</span>`}
                          </div>
                          <span style="color:${team.cor}; font-weight:600; font-size:12px;">${esc(team.nome)}</span>
                        </div>
                      ` : '—'}
                    </td>
                    <td>${s.athlete.posicao || '—'}</td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; align-items:center; gap:4px;">
                        <span style="font:800 16px var(--display); color:var(--gold); min-width:18px; text-align:center;">${s.goals}</span>
                        ${isAdmin ? `
                          <button class="btn-badge-action" onclick="quickAddGoalForAthlete('${s.athlete.id}')" title="Adicionar 1 Gol">+</button>
                          <button class="btn-badge-action danger" onclick="quickRemoveGoalForAthlete('${s.athlete.id}')" title="Remover 1 Gol" ${s.goals === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>-</button>
                        ` : ''}
                      </div>
                    </td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; align-items:center; gap:4px;">
                        <span style="font:800 16px var(--display); color:#8ce4a6; min-width:18px; text-align:center;">${s.assists}</span>
                        ${isAdmin ? `
                          <button class="btn-badge-action" onclick="quickAddAssistForAthlete('${s.athlete.id}')" title="Adicionar 1 Assistência">+</button>
                          <button class="btn-badge-action danger" onclick="quickRemoveAssistForAthlete('${s.athlete.id}')" title="Remover 1 Assistência" ${s.assists === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>-</button>
                        ` : ''}
                      </div>
                    </td>
                    <td style="text-align:center; font:800 18px var(--display); color:#ffd874;">${s.total}</td>
                    ${isAdmin ? `
                      <td style="text-align:right;">
                        <div style="display:flex; justify-content:flex-end; gap:4px;">
                          <button class="btn-badge-action" style="min-width:28px;" onclick="quickAddCardForAthlete('${s.athlete.id}', 'Amarelo')" title="Aplicar Cartão Amarelo">+🟨</button>
                          <button class="btn-badge-action" style="min-width:28px;" onclick="quickAddCardForAthlete('${s.athlete.id}', 'Vermelho')" title="Aplicar Cartão Vermelho">+🟥</button>
                          <button class="btn-badge-action danger" style="min-width:28px;" onclick="quickRemoveCardForAthlete('${s.athlete.id}')" title="Remover Último Cartão">-🎴</button>
                        </div>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : '<tr><td colspan="8" class="empty-table">Nenhuma participação registrada nesta temporada.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (tab === 'artilharia') {
      const scorers = getTopScorers(30);
      container.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:50px;">Pos</th>
                <th>Atleta</th>
                <th>Time</th>
                <th>Posição</th>
                <th style="text-align:center;">Gols Marcados</th>
                ${isAdmin ? '<th style="text-align:right;">Ações</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${scorers.length ? scorers.map((s, idx) => {
                const team = state.teams.find(t => t.id === s.athlete.team_id);
                const logo = team ? (team.logo_url || (team.nome && team.nome.toLowerCase().includes('inter') ? './public/escudo-internacional.svg' : './public/escudo-gremio.svg')) : null;
                return `
                  <tr>
                    <td class="standings-pos">${idx + 1}º</td>
                    <td><strong>${esc(s.athlete.apelido)}</strong></td>
                    <td>
                      ${team ? `
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="width:20px; height:20px; min-width:20px; display:flex; align-items:center; justify-content:center;">
                            ${logo ? `<img src="${esc(logo)}" alt="${esc(team.nome)}" style="width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">` : `<span class="team-badge" style="border:1px solid ${team.cor}; color:${team.cor}; font-size:9px;">${team.badge}</span>`}
                          </div>
                          <span style="color:${team.cor}; font-weight:600; font-size:12px;">${esc(team.nome)}</span>
                        </div>
                      ` : '—'}
                    </td>
                    <td>${s.athlete.posicao || '—'}</td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; align-items:center; gap:6px;">
                        <span style="font:800 18px var(--display); color:var(--gold); min-width:20px;">${s.goals}</span>
                        ${isAdmin ? `
                          <button class="btn-badge-action" onclick="quickAddGoalForAthlete('${s.athlete.id}')" title="Adicionar 1 Gol">+</button>
                          <button class="btn-badge-action danger" onclick="quickRemoveGoalForAthlete('${s.athlete.id}')" title="Remover 1 Gol" ${s.goals === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>-</button>
                        ` : ''}
                      </div>
                    </td>
                    ${isAdmin ? `
                      <td style="text-align:right;">
                        <button class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="quickRemoveGoalForAthlete('${s.athlete.id}')">Remover Gol</button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : `<tr><td colspan="${isAdmin ? 6 : 5}" class="empty-table">Nenhum gol registrado nesta temporada.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (tab === 'assistencias') {
      const assists = getTopAssists(30);
      container.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:50px;">Pos</th>
                <th>Atleta</th>
                <th>Time</th>
                <th>Posição</th>
                <th style="text-align:center;">Assistências</th>
                ${isAdmin ? '<th style="text-align:right;">Ações</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${assists.length ? assists.map((s, idx) => {
                const team = state.teams.find(t => t.id === s.athlete.team_id);
                const logo = team ? (team.logo_url || (team.nome && team.nome.toLowerCase().includes('inter') ? './public/escudo-internacional.svg' : './public/escudo-gremio.svg')) : null;
                return `
                  <tr>
                    <td class="standings-pos">${idx + 1}º</td>
                    <td><strong>${esc(s.athlete.apelido)}</strong></td>
                    <td>
                      ${team ? `
                        <div style="display:flex; align-items:center; gap:8px;">
                          <div style="width:20px; height:20px; min-width:20px; display:flex; align-items:center; justify-content:center;">
                            ${logo ? `<img src="${esc(logo)}" alt="${esc(team.nome)}" style="width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">` : `<span class="team-badge" style="border:1px solid ${team.cor}; color:${team.cor}; font-size:9px;">${team.badge}</span>`}
                          </div>
                          <span style="color:${team.cor}; font-weight:600; font-size:12px;">${esc(team.nome)}</span>
                        </div>
                      ` : '—'}
                    </td>
                    <td>${s.athlete.posicao || '—'}</td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; align-items:center; gap:6px;">
                        <span style="font:800 18px var(--display); color:#8ce4a6; min-width:20px;">${s.assists}</span>
                        ${isAdmin ? `
                          <button class="btn-badge-action" onclick="quickAddAssistForAthlete('${s.athlete.id}')" title="Adicionar 1 Assistência">+</button>
                          <button class="btn-badge-action danger" onclick="quickRemoveAssistForAthlete('${s.athlete.id}')" title="Remover 1 Assistência" ${s.assists === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>-</button>
                        ` : ''}
                      </div>
                    </td>
                    ${isAdmin ? `
                      <td style="text-align:right;">
                        <button class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="quickRemoveAssistForAthlete('${s.athlete.id}')">Remover Assistência</button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : `<tr><td colspan="${isAdmin ? 6 : 5}" class="empty-table">Nenhuma assistência registrada nesta temporada.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    } else if (tab === 'disciplina') {
      const athletesDisc = state.athletes.map(a => ({
        athlete: a,
        ...calculateDisciplinaryStatus(a.id)
      })).sort((a, b) => (b.isSuspended ? 1 : 0) - (a.isSuspended ? 1 : 0) || b.totalYellows - a.totalYellows);

      container.innerHTML = `
        <div class="notice" style="margin-bottom:16px;">
          <strong>Regras do Tribunal Disciplinar do Baba:</strong>
          <br>• 3 Cartões Amarelos acumulados = 1 jogo de suspensão automática.
          <br>• Cartão Vermelho Direto = 1 jogo de suspensão automática.
          <br>• 2 Cartões Amarelos no mesmo jogo = Cartão Vermelho automático.
          <br>• O cumprimento da suspensão exige ausência na partida finalizada.
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Status Atual</th>
                <th>Amarelos Acumulados</th>
                <th>Total Amarelos</th>
                <th>Total Vermelhos</th>
                <th>Suspensões Cumpridas</th>
                ${isAdmin ? '<th style="text-align:right;">Ações Disciplinares</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${athletesDisc.map(d => `
                <tr>
                  <td><strong>${esc(d.athlete.apelido)}</strong></td>
                  <td>
                    ${d.isSuspended ? `
                      <span class="badge-tag danger">🔴 SUSPENSO: ${esc(d.reason)}</span>
                    ` : `
                      <span class="badge-tag success">🟢 APTO</span>
                    `}
                  </td>
                  <td style="font-weight:700; color:${d.accumulatedYellows >= 2 ? '#ffd874' : 'inherit'};">
                    <div style="display:flex; align-items:center; gap:6px;">
                      <span>${d.accumulatedYellows} / 3</span>
                    </div>
                  </td>
                  <td>${d.totalYellows}</td>
                  <td style="color:#f78d88; font-weight:600;">${d.totalReds}</td>
                  <td>${d.suspensionsServed}</td>
                  ${isAdmin ? `
                    <td style="text-align:right;">
                      <div style="display:flex; justify-content:flex-end; gap:4px;">
                        <button class="btn btn-outline" style="padding:3px 7px; font-size:10px; color:#ffd874; border-color:#ffd874;" onclick="quickAddCardForAthlete('${d.athlete.id}', 'Amarelo')">+ 🟨</button>
                        <button class="btn btn-outline" style="padding:3px 7px; font-size:10px; color:#f78d88; border-color:#f78d88;" onclick="quickAddCardForAthlete('${d.athlete.id}', 'Vermelho')">+ 🟥</button>
                        <button class="btn btn-outline" style="padding:3px 7px; font-size:10px; color:#e57373;" onclick="quickRemoveCardForAthlete('${d.athlete.id}')" ${d.totalYellows + d.totalReds === 0 ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>Remover</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">TEMPORADA ${activeSeason.ano}</div>
        <h1>Rankings Esportivos & Disciplinares</h1>
        <p>Acompanhe a artilharia, ranking de assistências (garçons) e o controle de cartões e suspensões.</p>
      </div>
      ${isAdmin ? `
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button class="btn btn-gold" onclick="openStatsEntryModal('gol')">⚽ + Adicionar Gol</button>
          <button class="btn btn-secondary" onclick="openStatsEntryModal('assistencia')">🎯 + Adicionar Assistência</button>
          <button class="btn btn-secondary" onclick="openStatsEntryModal('cartao')">🟨/🟥 + Aplicar Cartão</button>
        </div>
      ` : ''}
    </div>

    <div class="subtabs" id="statsSubtabs">
      <button class="tab-btn active" data-tab="geral">📊 Classificação Geral (G+A)</button>
      <button class="tab-btn" data-tab="artilharia">⚽ Artilharia (Gols)</button>
      <button class="tab-btn" data-tab="assistencias">🎯 Garçons (Assistências)</button>
      <button class="tab-btn" data-tab="disciplina">🟨 Quadro Disciplinar & Suspensões</button>
    </div>

    <div id="statsContentArea"></div>
  `;

  $$('#statsSubtabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#statsSubtabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tab = btn.dataset.tab;
      draw();
    };
  });

  draw();
}

/**
 * 4.8 FINANCEIRO & INADIMPLÊNCIA (renderFinance)
 */
function renderFinance() {
  const activeSeason = getActiveTemporada();
  let subtab = 'mensalidades';

  const totalPaid = state.mensalidades.filter(m => m.pago).reduce((acc, m) => acc + Number(m.valor || 25), 0);
  const totalExpenses = state.despesas.reduce((acc, d) => acc + Number(d.valor || 0), 0);
  const balance = totalPaid - totalExpenses;
  const totalPending = state.mensalidades.filter(m => !m.pago).reduce((acc, m) => acc + Number(m.valor || 25), 0);

  function draw() {
    const area = $('#financeContentArea');

    if (subtab === 'mensalidades') {
      area.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-size:12px; color:var(--muted);">Controle individual de arrecadação por competência mensal.</div>
          ${isAdmin ? `<button class="btn btn-secondary" onclick="batchGenerateDuesModal()">⚡ Gerar Mensalidades do Mês em Lote</button>` : ''}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Atleta</th>
                <th>Mês/Ano</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Forma</th>
                <th>Comprovante</th>
                ${isAdmin ? '<th style="text-align:right;">Ação</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${state.mensalidades.length ? state.mensalidades.map(m => {
                const a = state.athletes.find(x => x.id === m.atleta_id);
                return `
                  <tr>
                    <td><strong>${a ? esc(a.apelido) : 'Atleta'}</strong></td>
                    <td>Mês ${String(m.mes).padStart(2,'0')}/${activeSeason.ano}</td>
                    <td>${money(m.valor || 25)}</td>
                    <td>
                      ${isAdmin
                        ? `<button class="pill ${m.pago ? '' : 'pending'}" style="border:none; cursor:pointer; background:none; padding:0;" onclick="togglePaymentStatus('${m.id}')" title="${m.pago ? 'Clique para reverter' : 'Clique para registrar pagamento'}">
                            ${m.pago ? '✅ Pago' : '⏳ Pendente'}
                          </button>`
                        : `<span class="pill ${m.pago ? '' : 'pending'}">${m.pago ? '✅ Pago' : 'Pendente'}</span>`
                      }
                    </td>
                    <td>${m.forma_pagamento || '—'}</td>
                    <td>${m.comprovante_url ? `<a href="${m.comprovante_url}" target="_blank" style="color:var(--gold);">Ver arquivo ↗</a>` : '—'}</td>
                    ${isAdmin ? `
                      <td style="text-align:right;">
                        <button class="btn btn-outline" style="padding:4px 10px; font-size:11px;" onclick="togglePaymentStatus('${m.id}')">
                          ${m.pago ? '↩ Reverter' : '✅ Dar Baixa'}
                        </button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : '<tr><td colspan="7" class="empty-table">Nenhuma mensalidade registrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (subtab === 'despesas') {
      area.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-size:12px; color:var(--muted);">Prestação de contas das saídas da temporada (árbitros, aluguel, material e resenha).</div>
          ${isAdmin ? `<button class="btn btn-secondary" onclick="newExpenseModal()">+ Registrar Nova Despesa</button>` : ''}
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Árbitro Vinculado</th>
                <th style="text-align:right;">Valor</th>
                ${isAdmin ? '<th style="text-align:right;">Ações</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${state.despesas.length ? state.despesas.map(d => {
                const juiz = state.juizes.find(j => j.id === d.juiz_id);
                return `
                  <tr>
                    <td>${new Date(d.data + 'T12:00:00Z').toLocaleDateString('pt-BR')}</td>
                    <td><strong>${esc(d.descricao)}</strong></td>
                    <td><span class="badge-tag info">${esc(d.categoria)}</span></td>
                    <td>${juiz ? esc(juiz.nome) : '—'}</td>
                    <td style="text-align:right; font-weight:700; color:#f78d88;">-${money(d.valor)}</td>
                    ${isAdmin ? `
                      <td style="text-align:right;">
                        <button onclick="deleteExpenseAction('${d.id}')" style="background:none; border:0; color:#e57373; cursor:pointer;">Excluir</button>
                      </td>
                    ` : ''}
                  </tr>
                `;
              }).join('') : '<tr><td colspan="6" class="empty-table">Nenhuma despesa registrada.</td></tr>'}
            </tbody>
          </table>
        </div>
      `;
    } else if (subtab === 'inadimplentes') {
      const debtors = state.athletes.map(a => ({
        athlete: a,
        fin: checkInadimplencia(a.id)
      })).filter(x => x.fin.isInadimplente);

      area.innerHTML = `
        <div class="notice">
          <strong>Critério de Inadimplência com Carência Humanizada:</strong>
          <br>O Baba adota tolerância de <strong>1 mês e 10 dias</strong>. Apenas débitos com vencimento anterior a esse prazo configuram inadimplência e bloqueio de presença em partidas.
        </div>

        <div class="cards-grid">
          ${debtors.length ? debtors.map(d => `
            <div class="panel" style="border:1px solid #755925;">
              <div class="panel-heading">
                <div>
                  <h3 style="margin:0; font:800 20px var(--display);">${esc(d.athlete.apelido)}</h3>
                  <small style="color:var(--muted);">Mês(es) pendente(s): <strong>${d.fin.pendingMonths.join(', ')}</strong></small>
                </div>
                <span class="badge-tag danger">INADIMPLENTE</span>
              </div>
              <div style="font:800 24px var(--display); color:#f78d88; margin:8px 0;">
                Débito: ${money(d.fin.totalDue)}
              </div>
              <p style="font-size:11px; color:var(--muted); line-height:1.5;">
                O atleta está com a confirmação de presença automaticamente bloqueada para as próximas rodadas.
              </p>
              <button class="btn btn-secondary" style="width:100%; margin-top:8px;" onclick="openWhatsAppCardModal('${d.athlete.id}')">
                📱 Copiar Card de Cobrança WhatsApp
              </button>
            </div>
          `).join('') : '<div class="empty-state full" style="grid-column:1/-1;">Parabéns! Nenhum atleta está em situação de inadimplência fora do prazo de carência.</div>'}
        </div>
      `;
    } else if (subtab === 'transparencia') {
      area.innerHTML = `
        <div class="panel" style="background:#111c16;">
          <h2 style="font:700 24px var(--display); margin-bottom:6px;">Balanço Geral da Temporada ${activeSeason.ano}</h2>
          <p style="color:var(--muted); font-size:12px; margin-bottom:18px;">
            Prestação de contas aberta a todos os atletas e torcedores do Baba Humildes.
          </p>

          <div class="stats-grid" style="margin-bottom:20px;">
            <div class="stat-card">
              <div class="stat-label">TOTAL ARRECADADO</div>
              <div class="stat-value" style="color:#8ce4a6;">${money(totalPaid)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">TOTAL DE DESPESAS</div>
              <div class="stat-value" style="color:#f78d88;">${money(totalExpenses)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">SALDO LÍQUIDO</div>
              <div class="stat-value" style="color:${balance >= 0 ? 'var(--gold)' : '#dc7772'};">${money(balance)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">PENDENTE DE COBRANÇA</div>
              <div class="stat-value" style="color:#ffd874;">${money(totalPending)}</div>
            </div>
          </div>
        </div>
      `;
    }
  }

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">TRANSPARÊNCIA E GESTÃO FINANCEIRA</div>
        <h1>Controle Financeiro do Baba</h1>
        <p>Acompanhamento de mensalidades arrecadadas, despesas gerais da temporada e lista de pendências.</p>
      </div>
    </div>

    <section class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card">
        <div class="stat-label">ARRECADADO</div>
        <div class="stat-value" style="color:#8ce4a6;">${money(totalPaid)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">DESPESAS</div>
        <div class="stat-value" style="color:#f78d88;">${money(totalExpenses)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">SALDO ATUAL</div>
        <div class="stat-value" style="color:${balance >= 0 ? 'var(--gold)' : '#dc7772'};">${money(balance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">A RECEBER</div>
        <div class="stat-value" style="color:#ffd874;">${money(totalPending)}</div>
      </div>
    </section>

    <div class="subtabs" id="finSubtabs">
      <button class="tab-btn active" data-sub="mensalidades">💳 Mensalidades</button>
      <button class="tab-btn" data-sub="despesas">🧾 Despesas</button>
      <button class="tab-btn" data-sub="inadimplentes">⚠️ Inadimplentes & WhatsApp</button>
      <button class="tab-btn" data-sub="transparencia">📊 Prestação de Contas</button>
    </div>

    <div id="financeContentArea"></div>
  `;

  $$('#finSubtabs .tab-btn').forEach(btn => {
    btn.onclick = () => {
      $$('#finSubtabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      subtab = btn.dataset.sub;
      draw();
    };
  });

  draw();
}

async function togglePaymentStatus(duesId) {
  const due = state.mensalidades.find(m => m.id === duesId);
  if (!due) return;
  if (due.pago) {
    // Reverter para pendente — confirmação simples
    if (!confirm('Reverter este pagamento para Pendente?')) return;
    due.pago = false;
    due.data_pagamento = null;
    due.forma_pagamento = null;
    await saveRecord('mensalidades', due);
    notify('Status revertido para pendente.');
    renderPage('financeiro');
  } else {
    // Abrir modal de confirmação de pagamento com forma e data
    registerPaymentModal(duesId);
  }
}

function registerPaymentModal(duesId) {
  const due = state.mensalidades.find(m => m.id === duesId);
  if (!due) return;
  const a = state.athletes.find(x => x.id === due.atleta_id);
  const activeSeason = getActiveTemporada();
  const today = new Date().toISOString().split('T')[0];

  showAdmin(`
    <h2>✅ Registrar Pagamento</h2>
    <p>
      <strong>${a ? esc(a.apelido) : 'Atleta'}</strong> —
      Mês ${String(due.mes).padStart(2,'0')}/${activeSeason.ano} •
      <span style="color:var(--gold); font-weight:700;">${money(due.valor || 25)}</span>
    </p>

    <form id="paymentForm">
      <div class="field">
        <label>Forma de Pagamento *</label>
        <select name="forma" required>
          <option value="Pix">💳 Pix</option>
          <option value="Dinheiro">💵 Dinheiro</option>
        </select>
      </div>
      <div class="field">
        <label>Data do Pagamento *</label>
        <input type="date" name="data" required value="${today}">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">✅ Confirmar Pagamento</button>
      </div>
    </form>
  `);

  $('#paymentForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    due.pago = true;
    due.data_pagamento = f.get('data');
    due.forma_pagamento = f.get('forma');
    await saveRecord('mensalidades', due);
    $('#adminDialog').close();
    notify(`✅ Pagamento de ${a ? a.apelido : 'atleta'} confirmado via ${f.get('forma')}!`);
    renderPage('financeiro');
  };
}

function batchGenerateDuesModal() {
  const activeSeason = getActiveTemporada();
  const currentMonth = new Date().getMonth() + 1;

  showAdmin(`
    <h2>Gerar Mensalidades do Mês em Lote</h2>
    <p>Esta rotina cria as cobranças de mensalidade para todos os atletas ativos da temporada, <strong>isentando automaticamente membros da diretoria</strong>.</p>
    <form id="batchDuesForm">
      <div class="field">
        <label>Competência (Mês) *</label>
        <select name="mes" required>
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
            <option value="${m}" ${m === currentMonth ? 'selected' : ''}>Mês ${String(m).padStart(2,'0')} / ${activeSeason.ano}</option>
          `).join('')}
        </select>
      </div>
      <div class="field">
        <label>Valor Padrão da Mensalidade (R$)</label>
        <input type="number" step="0.50" name="valor" value="${activeSeason.valor_mensalidade_padrao || 25.00}" required>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Gerar para o Elenco</button>
      </div>
    </form>
  `);

  $('#batchDuesForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const mes = Number(f.get('mes'));
    const valor = Number(f.get('valor'));

    // Filtra atletas que não são diretoria
    const nonBoardAthletes = state.athletes.filter(a => !a.is_diretoria);
    let count = 0;

    for (const a of nonBoardAthletes) {
      const exists = state.mensalidades.some(m => m.atleta_id === a.id && m.mes === mes && (!m.temporada_id || m.temporada_id === activeSeason.id));
      if (!exists) {
        state.mensalidades.push({
          id: id(),
          atleta_id: a.id,
          temporada_id: activeSeason.id,
          mes,
          valor,
          pago: false
        });
        count++;
      }
    }

    saveLocal();
    $('#adminDialog').close();
    notify(`${count} mensalidade(s) gerada(s) com sucesso!`);
    renderPage('financeiro');
  };
}

function newExpenseModal() {
  const activeSeason = getActiveTemporada();
  showAdmin(`
    <h2>Registrar Nova Despesa</h2>
    <form id="expenseForm">
      <div class="field">
        <label>Descrição do Gasto *</label>
        <input name="descricao" required placeholder="Ex: Taxa do juiz Jorge / Compra de bolas">
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Categoria</label>
          <select name="categoria">
            <option>Árbitro</option>
            <option>Material</option>
            <option>Aluguel de Campo</option>
            <option>Confraternização</option>
            <option>Outros</option>
          </select>
        </div>
        <div class="field">
          <label>Valor (R$) *</label>
          <input type="number" step="0.50" name="valor" required placeholder="Ex: 80.00">
        </div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Data</label>
          <input type="date" name="data" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="field">
          <label>Árbitro Associado (Se houver)</label>
          <select name="juiz_id">
            <option value="">Nenhum árbitro</option>
            ${state.juizes.map(j => `<option value="${j.id}">${esc(j.nome)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Despesa</button>
      </div>
    </form>
  `);

  $('#expenseForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const exp = {
      id: id(),
      descricao: f.get('descricao').trim(),
      categoria: f.get('categoria'),
      valor: Number(f.get('valor')),
      data: f.get('data'),
      juiz_id: f.get('juiz_id') || null,
      temporada_id: activeSeason.id
    };

    try {
      await saveRecord('despesas', exp);
      $('#adminDialog').close();
      notify('Despesa registrada com sucesso!');
      renderPage('financeiro');
    } catch (err) {
      notify(err.message);
    }
  };
}

async function deleteExpenseAction(expId) {
  if (!confirm('Excluir este registro de despesa?')) return;
  try {
    await saveRecord('despesas', { id: expId }, true);
    notify('Despesa excluída.');
    renderPage('financeiro');
  } catch (err) {
    notify(err.message);
  }
}

function openWhatsAppCardModal(athleteId) {
  const a = state.athletes.find(x => x.id === athleteId);
  const fin = checkInadimplencia(athleteId);
  if (!a) return;

  const msg = `⚽ *BABA HUMILDES - PALESTINA* ⚽\n` +
              `Olá, *${a.apelido}*!\n\n` +
              `Constatamos pendência(s) de mensalidade no baba referente ao(s) mês(es): *${fin.pendingMonths.join(', ')}*.\n` +
              `Valor total pendente: *${money(fin.totalDue)}*.\n\n` +
              `Conforme o regulamento, débitos anteriores ao prazo de tolerância (1 mês e 10 dias) geram bloqueio de confirmação para os jogos de domingo.\n\n` +
              `Por favor, envie o comprovante de pagamento Pix para a diretoria regularizar sua presença no próximo baba! Valeu pela força! 🤝`;

  showEdit(`
    <h2>Card de Cobrança WhatsApp</h2>
    <p>Mensagem educada pré-formatada pronta para envio ao atleta <strong>${esc(a.apelido)}</strong>:</p>
    <div class="whatsapp-box" id="whatsappTextBox">${esc(msg)}</div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Fechar</button>
      <button type="button" class="btn-primary" id="btnCopyWhatsApp">📋 Copiar Mensagem</button>
    </div>
  `);

  $('#btnCopyWhatsApp').onclick = () => {
    navigator.clipboard.writeText(msg).then(() => {
      notify('Mensagem copiada para a área de transferência!');
    });
  };
}

/**
 * 4.9 AVISOS OFICIAIS (renderAvisos)
 */
function renderAvisos() {
  const notices = [...state.avisos].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || new Date(b.data_publicacao) - new Date(a.data_publicacao));

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">COMUNICAÇÃO COM A COMUNIDADE</div>
        <h1>Mural de Avisos Oficiais</h1>
        <p>Comunicados da diretoria, alterações de horário, convocações e informes financeiros para os atletas.</p>
      </div>
      ${isAdmin ? `<button class="btn btn-gold" id="btnNewNotice">+ Publicar Novo Aviso</button>` : ''}
    </div>

    <div class="notices-grid">
      ${notices.length ? notices.map(n => `
        <div class="notice-card ${n.destaque ? 'featured' : ''}">
          <div class="notice-header">
            <div>
              <div class="badge-tag ${n.destaque ? 'gold' : 'info'}">${esc(n.tipo.toUpperCase())} ${n.destaque ? '★ FIXADO' : ''}</div>
              <h3 class="notice-title" style="margin-top:6px;">${esc(n.titulo)}</h3>
              <div class="notice-date">📅 ${new Date(n.data_publicacao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
            </div>
          </div>
          <div class="notice-body">${esc(n.conteudo)}</div>
          ${isAdmin ? `
            <div class="notice-footer">
              <span style="font-size:10px; color:${n.ativo ? '#8ce4a6' : 'var(--muted)'};">
                ${n.ativo ? '● Visível ao público' : '○ Oculto'}
              </span>
              <div class="row-actions">
                <button onclick="editNoticeModal('${n.id}')">Editar</button> •
                <button onclick="deleteNoticeAction('${n.id}')" style="color:#e57373;">Excluir</button>
              </div>
            </div>
          ` : ''}
        </div>
      `).join('') : '<div class="empty-state full" style="grid-column:1/-1;">Nenhum aviso publicado no momento.</div>'}
    </div>
  `;

  if ($('#btnNewNotice')) {
    $('#btnNewNotice').onclick = () => editNoticeModal();
  }
}

function editNoticeModal(noticeId = '') {
  const n = noticeId ? state.avisos.find(x => x.id === noticeId) : {};
  showEdit(`
    <h2>${n.id ? 'Editar Comunicado' : 'Publicar Novo Aviso'}</h2>
    <form id="noticeForm">
      <div class="field">
        <label>Título do Aviso *</label>
        <input name="titulo" required value="${esc(n.titulo || '')}" placeholder="Ex: Horário do Baba de Domingo">
      </div>
      <div class="field">
        <label>Tipo de Comunicado</label>
        <select name="tipo">
          <option ${n.tipo === 'Geral' ? 'selected' : ''}>Geral</option>
          <option ${n.tipo === 'Financeiro' ? 'selected' : ''}>Financeiro</option>
          <option ${n.tipo === 'Regra' ? 'selected' : ''}>Regra</option>
          <option ${n.tipo === 'Convocação' ? 'selected' : ''}>Convocação</option>
        </select>
      </div>
      <div class="field">
        <label>Conteúdo da Mensagem *</label>
        <textarea name="conteudo" rows="5" required placeholder="Digite os detalhes do comunicado para os atletas...">${esc(n.conteudo || '')}</textarea>
      </div>
      <div class="form-grid">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" name="destaque" ${n.destaque ? 'checked' : ''} style="width:auto;">
          <span>Fixar em Destaque na Página Inicial</span>
        </label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" name="ativo" ${n.ativo !== false ? 'checked' : ''} style="width:auto;">
          <span>Ativo / Visível ao Público</span>
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Comunicado</button>
      </div>
    </form>
  `);

  $('#noticeForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const noticeData = {
      id: n.id || id(),
      titulo: f.get('titulo').trim(),
      tipo: f.get('tipo'),
      conteudo: f.get('conteudo').trim(),
      destaque: f.get('destaque') === 'on',
      ativo: f.get('ativo') === 'on',
      data_publicacao: n.data_publicacao || new Date().toISOString()
    };

    try {
      await saveRecord('avisos', noticeData);
      $('#editDialog').close();
      notify('Comunicado salvo!');
      renderPage('avisos');
    } catch (err) {
      notify(err.message);
    }
  };
}

async function deleteNoticeAction(noticeId) {
  if (!confirm('Excluir este aviso?')) return;
  try {
    await saveRecord('avisos', { id: noticeId }, true);
    notify('Aviso excluído.');
    renderPage('avisos');
  } catch (err) {
    notify(err.message);
  }
}

/**
 * 4.10 QUADRO DE ÁRBITROS (renderJuizes)
 */
function renderJuizes() {
  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">EQUIPE DE ARBITRAGEM</div>
        <h1>Quadro de Juízes do Baba</h1>
        <p>Árbitros cadastrados e escalados para conduzir as partidas de domingo com respeito e imparcialidade.</p>
      </div>
      ${isAdmin ? `<button class="btn btn-gold" id="btnNewJuiz">+ Novo Árbitro</button>` : ''}
    </div>

    <div class="referees-grid">
      ${state.juizes.map(j => {
        const matchesRefereed = state.matches.filter(m => m.juiz_id === j.id).length;
        return `
          <div class="referee-card">
            <div class="referee-avatar">
              ${j.foto_url ? `<img src="${j.foto_url}" alt="${esc(j.nome)}">` : '⚖'}
            </div>
            <h3 class="referee-name">${esc(j.nome)}</h3>
            <div class="referee-phone">${esc(j.telefone || 'Telefone não informado')}</div>
            <div style="font-size:11px; color:var(--muted); margin-bottom:12px;">
              ⏱ <strong>${matchesRefereed}</strong> jogo(s) apitado(s)
            </div>
            <span class="badge-tag ${j.ativo ? 'success' : 'danger'}">${j.ativo ? 'Árbitro Ativo' : 'Inativo'}</span>
            ${isAdmin ? `
              <div class="row-actions" style="margin-top:14px; padding-top:10px; border-top:1px solid var(--line); width:100%;">
                <button onclick="editJuizModal('${j.id}')">Editar</button> •
                <button onclick="deleteJuizAction('${j.id}')" style="color:#e57373;">Excluir</button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  if ($('#btnNewJuiz')) {
    $('#btnNewJuiz').onclick = () => editJuizModal();
  }
}

function editJuizModal(juizId = '') {
  const j = juizId ? state.juizes.find(x => x.id === juizId) : {};
  showEdit(`
    <h2>${j.id ? 'Editar Árbitro' : 'Cadastrar Árbitro'}</h2>
    <form id="juizForm">
      <div class="field">
        <label>Nome do Juiz *</label>
        <input name="nome" required value="${esc(j.nome || '')}" placeholder="Ex: Jorge Silva">
      </div>
      <div class="field">
        <label>Telefone / WhatsApp</label>
        <input name="telefone" value="${esc(j.telefone || '')}" placeholder="Ex: (71) 98888-0000">
      </div>
      <div class="field">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" name="ativo" ${j.ativo !== false ? 'checked' : ''} style="width:auto;">
          <span>Árbitro disponível / ativo para escalações</span>
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Árbitro</button>
      </div>
    </form>
  `);

  $('#juizForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const juizData = {
      id: j.id || id(),
      nome: f.get('nome').trim(),
      telefone: f.get('telefone') ? f.get('telefone').trim() : null,
      ativo: f.get('ativo') === 'on'
    };

    try {
      await saveRecord('juizes', juizData);
      $('#editDialog').close();
      notify('Árbitro salvo com sucesso!');
      renderPage('juizes');
    } catch (err) {
      notify(err.message);
    }
  };
}

async function deleteJuizAction(juizId) {
  if (!confirm('Excluir este árbitro?')) return;
  try {
    await saveRecord('juizes', { id: juizId }, true);
    notify('Árbitro excluído.');
    renderPage('juizes');
  } catch (err) {
    notify(err.message);
  }
}

/**
 * 4.11 ÁREA DO ATLETA (renderAthleteDashboard)
 */
function showAthleteSelector() {
  showAdmin(`
    <h2>Área do Atleta</h2>
    <p>Selecione seu nome para consultar seu histórico esportivo e financeiro no Baba Humildes:</p>
    <div class="field">
      <select id="athletePortalSelect" style="font-size:14px; padding:12px;">
        <option value="">Selecione seu perfil...</option>
        ${state.athletes.map(a => `<option value="${a.id}">${esc(a.apelido)} (${a.posicao || 'Jogador'})</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-close>Fechar</button>
      <button type="button" class="btn-primary" id="btnEnterAthleteArea">Acessar Meu Perfil</button>
    </div>
  `);

  $('#btnEnterAthleteArea').onclick = () => {
    const aid = $('#athletePortalSelect').value;
    if (!aid) return notify('Selecione um atleta.');
    currentAthlete = state.athletes.find(a => a.id === aid);
    $('#adminDialog').close();
    renderAthleteProfile();
  };
}

function renderAthleteProfile() {
  if (!currentAthlete) return renderPage('inicio');
  const a = currentAthlete;
  currentPage = 'atleta';
  setTitle(`Área do Atleta • ${a.apelido}`);

  const team = state.teams.find(t => t.id === a.team_id);
  const disc = calculateDisciplinaryStatus(a.id);
  const fin = checkInadimplencia(a.id);
  const nextM = getNextMatch();

  const myGoals = state.goals.filter(g => g.athlete_id === a.id).length;
  const myAssists = state.assistencias.filter(as => as.athlete_id === a.id).length;

  $('#appContent').innerHTML = `
    <div class="page-header">
      <div>
        <div class="eyebrow">PORTAL INDIVIDUAL DO ATLETA</div>
        <h1>Olá, ${esc(a.apelido)}! ⚽</h1>
        <p>Acompanhe suas estatísticas, situação disciplinar e confirme presença nas rodadas.</p>
      </div>
      <button class="btn btn-secondary" onclick="showAthleteSelector()">Trocar Atleta</button>
    </div>

    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">MEUS GOLS</div>
        <div class="stat-value" style="color:var(--gold);">${myGoals}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">MINHAS ASSISTÊNCIAS</div>
        <div class="stat-value" style="color:#8ce4a6;">${myAssists}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">CARTÕES AMARELOS</div>
        <div class="stat-value" style="color:#ffd874;">${disc.accumulatedYellows} <small style="font-size:12px; color:var(--muted);">/ 3</small></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">CARTÕES VERMELHOS</div>
        <div class="stat-value" style="color:#f78d88;">${disc.totalReds}</div>
      </div>
    </section>

    <div class="section-grid">
      <div class="panel">
        <div class="panel-heading">
          <div><span class="eyebrow">AGENDA</span><h2>Confirmação para o Próximo Jogo</h2></div>
        </div>
        ${nextM ? `
          <div style="background:#0e1913; padding:16px; border-radius:10px; border:1px solid var(--line); margin-bottom:14px;">
            <div style="font-size:12px; color:var(--gold); font-weight:700; margin-bottom:6px;">
              📅 ${new Date(nextM.data + 'T12:00:00Z').toLocaleDateString('pt-BR')} • ${nextM.hora || '07:30'}
            </div>
            <div style="font-size:16px; font-weight:700;">
              ${esc(state.teams.find(t => t.id === nextM.time_a)?.nome || 'Time A')} × ${esc(state.teams.find(t => t.id === nextM.time_b)?.nome || 'Time B')}
            </div>
          </div>

          ${disc.isSuspended ? `
            <div class="presence-lock-alert">
              <span>🚫</span>
              <div>
                <strong>VOCÊ ESTÁ SUSPENSO PARA ESTE JOGO</strong><br>
                Motivo: ${esc(disc.reason)}. Sua presença está bloqueada.
              </div>
            </div>
          ` : fin.isInadimplente ? `
            <div class="presence-lock-alert">
              <span>⚠️</span>
              <div>
                <strong>PRESENÇA BLOQUEADA POR MENSALIDADE</strong><br>
                Consta pendência financeira de R$ ${fin.totalDue.toFixed(2)}. Fale com a diretoria para liberar.
              </div>
            </div>
          ` : `
            <button class="btn btn-gold" style="width:100%;" onclick="openPublicAttendanceModal('${nextM.id}')">
              Confirmar Minha Presença Agora ✓
            </button>
          `}
        ` : '<div class="empty-state compact">Nenhuma partida agendada.</div>'}
      </div>

      <div class="panel">
        <div class="panel-heading">
          <div><span class="eyebrow">SITUAÇÃO FINANCEIRA</span><h2>Minhas Mensalidades</h2></div>
        </div>
        ${a.is_diretoria ? `
          <div style="padding:14px; background:#1e3328; border:1px solid #355742; border-radius:8px; color:#a2e4b4; font-size:12px;">
            ★ <strong>Membro da Diretoria:</strong> Você é isento de pagamento de mensalidade no Baba Humildes.
          </div>
        ` : `
          <div style="font-size:12px; margin-bottom:10px;">
            Situação: ${fin.isInadimplente ? '<span class="badge-tag danger">Inadimplente</span>' : '<span class="badge-tag success">Em Dia</span>'}
          </div>
          <button class="text-button" data-goto="financeiro">Ver extrato completo no módulo financeiro →</button>
        `}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------------------
// 5. PAINEL ADMINISTRATIVO E AUTENTICAÇÃO
// ------------------------------------------------------------------------------

function showAdminControlPanel() {
  showAdmin(`
    <h2 style="color:var(--gold);">⚡ Painel da Diretoria</h2>
    <p style="color:var(--muted); font-size:.9rem; margin-bottom:16px;">Baba Humildes • Temporada ${getActiveTemporada().ano}</p>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0;">
      <button class="btn btn-secondary" onclick="$('#adminDialog').close(); editAthleteModal();">
        👤 Novo Atleta
      </button>
      <button class="btn btn-secondary" onclick="$('#adminDialog').close(); editMatchSchedule();">
        ⚽ Nova Partida
      </button>
      <button class="btn btn-secondary" onclick="$('#adminDialog').close(); batchGenerateDuesModal();">
        💳 Gerar Mensalidades
      </button>
      <button class="btn btn-secondary" onclick="$('#adminDialog').close(); newExpenseModal();">
        🧾 Nova Despesa
      </button>
      <button class="btn btn-secondary" onclick="$('#adminDialog').close(); editNoticeModal();">
        📢 Publicar Aviso
      </button>
      <button class="btn btn-secondary" onclick="$('#adminDialog').close(); editJuizModal();">
        ⚖ Cadastrar Árbitro
      </button>
      <button class="btn btn-secondary" onclick="editSeasonModal();">
        ⚙ Configurar Temporada
      </button>
      <button class="btn btn-secondary" onclick="resetDemoDataConfirm();">
        🔄 Restaurar Dados Demo
      </button>
    </div>

    <div class="modal-actions" style="margin-top:20px; border-top:1px solid var(--line); padding-top:14px;">
      <button type="button" class="btn-outline" onclick="logoutAdmin()">🔒 Encerrar Sessão</button>
      <button type="button" class="btn-secondary" data-close>Fechar</button>
    </div>
  `);
}

function editSeasonModal() {
  const s = getActiveTemporada();
  showAdmin(`
    <h2>⚙ Configurar Temporada</h2>
    <form id="seasonForm">
      <div class="field">
        <label>Ano da Temporada *</label>
        <input type="number" name="ano" required value="${s.ano}" min="2020" max="2099">
      </div>
      <div class="field">
        <label>Valor Padrão da Mensalidade (R$)</label>
        <input type="number" step="0.50" name="valor" required value="${s.valor_mensalidade_padrao || 25.00}">
      </div>
      <div class="field">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" name="ativa" ${s.ativa ? 'checked' : ''} style="width:auto;">
          <span>Temporada Ativa (exibe dados públicos desta temporada)</span>
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="showAdminControlPanel()">Voltar</button>
        <button type="submit" class="btn-primary">Salvar Temporada</button>
      </div>
    </form>
  `);

  $('#seasonForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const updatedSeason = {
      ...s,
      ano: Number(f.get('ano')),
      valor_mensalidade_padrao: Number(f.get('valor')),
      ativa: f.get('ativa') === 'on'
    };
    const idx = state.temporadas.findIndex(t => t.id === s.id);
    if (idx >= 0) state.temporadas[idx] = updatedSeason;
    else state.temporadas.push(updatedSeason);
    saveLocal();
    $('#adminDialog').close();
    notify('✅ Temporada atualizada com sucesso!');
    renderPage(currentPage);
  };
}

function resetDemoDataConfirm() {
  showAdmin(`
    <h2>🔄 Restaurar Dados Demo</h2>
    <p>Isso irá <strong>apagar todos os dados atuais</strong> e restaurar os dados de demonstração originais do sistema.</p>
    <div class="notice" style="border-color:#c0392b; color:#ff8a80;">
      ⚠ Esta ação não pode ser desfeita. Use apenas para testes.
    </div>
    <div class="modal-actions" style="margin-top:16px;">
      <button type="button" class="btn-secondary" onclick="showAdminControlPanel()">Cancelar</button>
      <button type="button" id="confirmResetBtn" class="btn-primary" style="background:#c0392b;">Confirmar Reset</button>
    </div>
  `);

  $('#confirmResetBtn').onclick = () => {
    localStorage.removeItem('bh-demo-data-v2');
    populateDemoData();
    saveLocal();
    $('#adminDialog').close();
    notify('🔄 Dados restaurados para o estado demo!');
    renderPage('inicio');
  };
}

function showLogin() {
  showAdmin(`
    <h2>⚡ Área Administrativa</h2>
    <p style="margin-bottom:14px;">Acesse o painel de gestão do <strong>Baba Humildes</strong>:</p>

    <button
      class="btn btn-gold"
      style="width:100%; font-size:1.1rem; padding:14px; margin-bottom:20px; letter-spacing:.5px;"
      onclick="
        isAdmin = true;
        localStorage.setItem('bh-admin-logged', 'true');
        updateAdminStatus();
        $('#adminDialog').close();
        notify('✅ Acesso administrativo ativado!');
        renderPage(currentPage);
      ">
      🏆 Entrar como Administrador (Diretoria)
    </button>

    <details style="margin-top:8px;">
      <summary style="cursor:pointer; color:var(--gold); font-size:.85rem;">Login com e-mail e senha (Supabase)</summary>
      <form id="adminLoginForm" style="margin-top:14px;">
        <div class="field">
          <label>E-mail</label>
          <input type="email" name="email" autocomplete="username" placeholder="admin@babahumildes.com">
        </div>
        <div class="field">
          <label>Senha</label>
          <input type="password" name="password" autocomplete="current-password">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" data-close>Cancelar</button>
          <button type="submit" class="btn-primary">Entrar</button>
        </div>
      </form>
    </details>
  `);

  const form = $('#adminLoginForm');
  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (!db) {
        // Sem Supabase: acesso direto
        isAdmin = true;
        localStorage.setItem('bh-admin-logged', 'true');
        updateAdminStatus();
        $('#adminDialog').close();
        notify('✅ Acesso administrativo ativado!');
        renderPage(currentPage);
        return;
      }
      try {
        const { data, error } = await db.auth.signInWithPassword({
          email: f.get('email'),
          password: f.get('password')
        });
        if (error) throw error;
        session = data.session;
        isAdmin = true;
        localStorage.setItem('bh-admin-logged', 'true');
        updateAdminStatus();
        $('#adminDialog').close();
        notify('✅ Login administrativo realizado!');
        renderPage(currentPage);
      } catch (err) {
        notify('❌ E-mail ou senha incorretos.');
      }
    };
  }
}

async function logoutAdmin() {
  if (db) {
    try { await db.auth.signOut(); } catch (e) {}
  }
  session = null;
  isAdmin = false;
  localStorage.removeItem('bh-admin-logged');
  updateAdminStatus();
  $('#adminDialog').close();
  notify('🔒 Sessão administrativa encerrada.');
  renderPage(currentPage);
}

function showAdmin(html) {
  $('#adminDialogBody').innerHTML = html;
  $('#adminDialog').showModal();
}

function showEdit(html) {
  $('#editDialogBody').innerHTML = html;
  $('#editDialog').showModal();
}

// Inicializa a aplicação
init().catch(err => {
  console.error('Erro na inicialização:', err);
  notify('Inicializando com base de dados local...');
  loadLocal();
  updateAdminStatus();
  bindNavigation();
  renderPage('inicio');
});

// ==============================================================================
// EXPOSIÇÃO GLOBAL — Necessário porque app.js é carregado como type="module"
// Funções chamadas via onclick="" em HTML dinâmico precisam estar no window
// ==============================================================================

// Expõe o seletor $ ao window para uso em onclick inline do painel admin
window.$ = $;

// Funções de edição de times (stub enquanto modal completo não está implementado)
function editTeamModal(teamId = '') {
  const t = teamId ? state.teams.find(x => x.id === teamId) : {};
  showEdit(`
    <h2>${t.id ? 'Editar Time' : 'Novo Time'}</h2>
    <form id="teamForm">
      <div class="field">
        <label>Nome do Time *</label>
        <input name="nome" required value="${esc(t.nome || '')}" placeholder="Ex: Internacional">
      </div>
      <div class="field">
        <label>Cor principal (hex)</label>
        <input name="cor" value="${esc(t.cor || '#cccccc')}" placeholder="#e52329">
      </div>
      <div class="field">
        <label>Sigla (badge)</label>
        <input name="badge" value="${esc(t.badge || '')}" maxlength="3" placeholder="INT">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Cancelar</button>
        <button type="submit" class="btn-primary">Salvar Time</button>
      </div>
    </form>
  `);
  $('#teamForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const teamData = {
      id: t.id || id(),
      nome: f.get('nome').trim(),
      cor: f.get('cor').trim(),
      badge: f.get('badge').trim().toUpperCase(),
      logo_url: t.logo_url || '',
      temporada_id: getActiveTemporada().id
    };
    await saveRecord('teams', teamData);
    $('#editDialog').close();
    notify('Time salvo!');
    renderPage('times');
  };
}

Object.assign(window, {
  // Navegação
  renderPage,

  // Painel Admin e autenticação
  showAdminControlPanel,
  showLogin,
  logoutAdmin,
  editSeasonModal,
  resetDemoDataConfirm,

  // Atletas
  editAthleteModal,
  deleteAthleteAction,
  openWhatsAppCardModal,
  showAthleteSelector,

  // Times
  editTeamModal,

  // Partidas e Súmula
  editMatchSchedule,
  deleteMatchAction,
  openSumulaModal,
  addGoalModal,
  addCardModal,
  removeGoalAction,
  removeCardAction,
  toggleFinishMatch,
  toggleAttendanceAdmin,
  openPublicAttendanceModal,

  // Financeiro
  batchGenerateDuesModal,
  newExpenseModal,
  deleteExpenseAction,
  togglePaymentStatus,
  registerPaymentModal,

  // Avisos
  editNoticeModal,
  deleteNoticeAction,

  // Juízes
  editJuizModal,
  deleteJuizAction,

  // Estatísticas
  getOverallStats,
  getTopScorers,
  getTopAssists,
  quickAddGoalForAthlete,
  quickRemoveGoalForAthlete,
  quickAddAssistForAthlete,
  quickRemoveAssistForAthlete,
  quickAddCardForAthlete,
  quickRemoveCardForAthlete,
  openStatsEntryModal,

  // Utilitários internos usados em onclick inline
  populateDemoData,
  saveLocal,
  notify,
});
