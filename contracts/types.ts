// ==============================================================================
// TIPOS E CONTRATOS TYPESCRIPT - BABA HUMILDES / TROPICANA MANAGER
// ==============================================================================
// Utilize estas interfaces para alimentar aplicações React Native, Flutter,
// Next.js, APIs REST em Node/NestJS ou microsserviços.

export interface Temporada {
  id: number;
  ano: number;
  valorMensalidadePadrao: number;
  ativa: boolean;
}

export interface Time {
  id: number | string;
  nome: string;
  logoUrl?: string | null;
  cor: string;
  badge: string;
  temporadaId: number;
}

export interface Atleta {
  id: number | string;
  nomeCompleto?: string | null; // Restrito à diretoria
  apelido: string;              // Exibido publicamente
  telefone?: string | null;     // Restrito
  fotoUrl?: string | null;
  isDiretoria: boolean;         // Isento de mensalidade
  posicao?: 'Goleiro' | 'Atacante' | 'Meio-campo' | 'Volante' | 'Zagueiro' | 'Lateral' | string | null;
  numeroCamisa?: string | number | null;
  nomeCamisa?: string | null;
}

export interface AtletaTemporada {
  id: number | string;
  ativo: boolean;
  atletaId: number | string;
  temporadaId: number;
  timeId?: number | string | null;
  atleta?: Atleta;
  time?: Time | null;
}

export interface Juiz {
  id: number | string;
  nome: string;
  telefone?: string | null;
  fotoUrl?: string | null;
  ativo: boolean;
}

export interface Partida {
  id: number | string;
  data: string | Date;
  hora?: string | null;
  tipo: 'Domingo' | 'Feriado' | 'Especial' | string;
  placarA: number;
  placarB: number;
  temporadaId: number;
  timeAId?: number | string | null;
  timeBId?: number | string | null;
  status: 'Agendada' | 'Finalizada' | 'Cancelada';
  juizId?: number | string | null;
  timeA?: Time | null;
  timeB?: Time | null;
  juiz?: Juiz | null;
  gols?: Gol[];
  assistencias?: Assistencia[];
  cartoes?: Cartao[];
  presencas?: Presenca[];
}

export interface Gol {
  id: number | string;
  quantidade: number;
  minuto?: number | null;
  atletaId: number | string;
  partidaId: number | string;
  timeId?: number | string | null;
  atleta?: Atleta;
}

export interface Assistencia {
  id: number | string;
  quantidade: number;
  atletaId: number | string;
  partidaId: number | string;
  atleta?: Atleta;
}

export interface Cartao {
  id: number | string;
  tipo: 'Amarelo' | 'Vermelho';
  atletaId: number | string;
  partidaId: number | string;
  atleta?: Atleta;
}

export interface Presenca {
  id: number | string;
  confirmado: boolean;
  atletaId: number | string;
  partidaId: number | string;
  atleta?: Atleta;
}

export interface Mensalidade {
  id: number | string;
  mes: number; // 1 a 12
  valor: number;
  pago: boolean;
  dataPagamento?: string | Date | null;
  formaPagamento?: 'Dinheiro' | 'Pix' | 'Transferência' | string | null;
  comprovanteUrl?: string | null;
  atletaId: number | string;
  temporadaId: number;
  atleta?: Atleta;
}

export interface Despesa {
  id: number | string;
  descricao: string;
  categoria: string;
  valor: number;
  data: string | Date;
  temporadaId: number;
  juizId?: number | string | null;
  juiz?: Juiz | null;
  comprovanteUrl?: string | null;
}

export interface Aviso {
  id: number | string;
  titulo: string;
  conteudo: string;
  tipo: 'Geral' | 'Financeiro' | 'Regra' | 'Convocação';
  dataPublicacao: string | Date;
  ativo: boolean;
  destaque: boolean;
}

export interface DisciplinaryStatus {
  atletaId: number | string;
  isSuspended: boolean;
  reason?: string;
  yellowCount: number;
  redCount: number;
  suspensionsServed: number;
}

export interface FinancialStatus {
  atletaId: number | string;
  isInadimplente: boolean;
  pendingMonths: number[];
  totalDue: number;
}
