'use client';
import { useEffect, useState, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : 'http://localhost:3001/api';

type Prioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
type Status = 'PENDENTE' | 'EM_ANDAMENTO' | 'RESOLVIDO';

interface Mensagem {
  id: string;
  origem: string;
  conteudo: string;
  timestamp: string;
}

interface Cliente {
  id: string;
  telefone: string;
  nome: string | null;
}

interface Conversa {
  id: string;
  estadoAtual: string;
  status: string;
  contexto: Record<string, any>;
  cliente: Cliente;
  mensagens: Mensagem[];
}

interface Handoff {
  id: string;
  status: Status;
  prioridade: Prioridade;
  resumo: string;
  slaMinutos: number;
  createdAt: string;
  conversa: Conversa;
}

function tempoAtras(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function BadgePrioridade({ p }: { p: Prioridade }) {
  const map: Record<Prioridade, string> = {
    URGENTE: 'bg-red-500/15 text-red-400 border border-red-500/30',
    ALTA:    'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    MEDIA:   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    BAIXA:   'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[p]}`}>{p}</span>;
}

function BadgeStatus({ s }: { s: string }) {
  const map: Record<string, string> = {
    PENDENTE:     'bg-yellow-500/12 text-yellow-400 border border-yellow-500/25',
    EM_ANDAMENTO: 'bg-blue-500/12 text-blue-400 border border-blue-500/25',
    RESOLVIDO:    'bg-green-500/12 text-green-400 border border-green-500/25',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[s] || 'bg-slate-500/10 text-slate-400'}`}>
      {s.replace('_', ' ')}
    </span>
  );
}

function BadgeEstado({ s }: { s: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
      {s.replace(/_/g, ' ')}
    </span>
  );
}

function PrioridadeFaixa({ p }: { p: Prioridade }) {
  const map: Record<Prioridade, string> = {
    URGENTE: 'bg-red-400',
    ALTA:    'bg-orange-400',
    MEDIA:   'bg-blue-400',
    BAIXA:   'bg-slate-500',
  };
  return <div className={`h-0.5 w-full rounded-full mb-3 ${map[p]}`} />;
}

export default function Dashboard() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [selecionado, setSelecionado] = useState<Handoff | null>(null);
  const [loading, setLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState('');

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`${API}/handoff/pendentes`);
      const data = await res.json();
      setHandoffs(data);
      setUltimaAtualizacao(new Date().toLocaleTimeString('pt-BR'));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 10000);
    return () => clearInterval(interval);
  }, [carregar]);

  async function assumir(id: string) {
    setLoading(true);
    await fetch(`${API}/handoff/${id}/assumir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendedorId: 'vendedor-01' }),
    });
    await carregar();
    setLoading(false);
  }

  async function resolver(id: string) {
    setLoading(true);
    await fetch(`${API}/handoff/${id}/resolver`, { method: 'POST' });
    setSelecionado(null);
    await carregar();
    setLoading(false);
  }

  const pendentes = handoffs.filter(h => h.status === 'PENDENTE');
  const andamento = handoffs.filter(h => h.status === 'EM_ANDAMENTO');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f2040', color: '#e8f0fe', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <header style={{ background: '#1a3a6b', borderBottom: '1px solid rgba(59,130,246,0.25)' }}
        className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-lg"
            style={{ background: '#2563b0' }}>⚙</div>
          <div>
            <div className="text-sm font-medium text-white">Autopeças MVP</div>
            <div className="text-[11px]" style={{ color: '#93b4d8' }}>Painel Operacional</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="text-[11px]" style={{ color: '#5a7fa8' }}>Atualizado: {ultimaAtualizacao}</span>
          <button onClick={carregar}
            style={{ background: '#1e3d6e', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}
            className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            ↻ Atualizar
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 px-6 py-4">
        {[
          { label: 'Pendentes', valor: pendentes.length, cor: '#f87171', faixa: '#f87171', icon: '⚠' },
          { label: 'Em atendimento', valor: andamento.length, cor: '#60a5fa', faixa: '#3b82f6', icon: '🎧' },
          { label: 'Total abertos', valor: handoffs.length, cor: '#34d399', faixa: '#34d399', icon: '☑' },
        ].map(s => (
          <div key={s.label}
            style={{ background: '#162d52', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ height: 2, background: s.faixa }} />
            <div className="px-4 py-3">
              <div className="text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1.5"
                style={{ color: '#5a7fa8' }}>{s.icon} {s.label}</div>
              <div className="text-3xl font-medium" style={{ color: s.cor }}>{s.valor}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden gap-0 px-6 pb-6" style={{ height: 'calc(100vh - 196px)' }}>

        {/* Lista */}
        <div className="overflow-y-auto flex flex-col gap-2 pr-3" style={{ width: '44%' }}>
          {handoffs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ color: '#5a7fa8' }}>
              <span className="text-4xl">✅</span>
              <span className="text-sm">Nenhum atendimento pendente</span>
            </div>
          )}
          {handoffs.map(h => (
            <div key={h.id} onClick={() => setSelecionado(h)}
              style={{
                background: selecionado?.id === h.id ? '#1e3d6e' : '#162d52',
                border: `1px solid ${selecionado?.id === h.id ? '#3b82f6' : 'rgba(59,130,246,0.18)'}`,
                borderRadius: 10, padding: 12, cursor: 'pointer', transition: 'all 0.15s',
              }}>
              <PrioridadeFaixa p={h.prioridade} />
              <div className="flex items-start justify-between mb-2">
                <div className="flex gap-1.5 flex-wrap">
                  <BadgePrioridade p={h.prioridade} />
                  <BadgeStatus s={h.status} />
                </div>
                <span className="text-[10px]" style={{ color: '#5a7fa8' }}>{tempoAtras(h.createdAt)}</span>
              </div>
              <div className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: '#e8f0fe' }}>
                <span style={{ color: '#60a5fa' }}>📱</span>
                {h.conversa.cliente.nome || h.conversa.cliente.telefone}
                {h.conversa.cliente.nome && (
                  <span className="text-[10px]" style={{ color: '#5a7fa8' }}>— {h.conversa.cliente.telefone}</span>
                )}
              </div>
              <div className="text-[11px] mb-3 truncate" style={{ color: '#93b4d8' }}>{h.resumo}</div>
              <div className="flex gap-2">
                {h.status === 'PENDENTE' && (
                  <button onClick={e => { e.stopPropagation(); assumir(h.id); }} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium text-white transition-opacity hover:opacity-80"
                    style={{ background: '#2563b0' }}>
                    👤 Assumir
                  </button>
                )}
                {h.status === 'EM_ANDAMENTO' && (
                  <button onClick={e => { e.stopPropagation(); resolver(h.id); }} disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    ✓ Resolver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Detalhe */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-xl"
          style={{ background: '#162d52', border: '1px solid rgba(59,130,246,0.18)' }}>

          {!selecionado ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: '#5a7fa8' }}>
              <span className="text-4xl" style={{ opacity: 0.3 }}>💬</span>
              <span className="text-sm">← Selecione um atendimento</span>
            </div>
          ) : (
            <>
              {/* Det Header */}
              <div className="px-4 py-3 flex-shrink-0" style={{ background: '#1e3d6e', borderBottom: '1px solid rgba(59,130,246,0.2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium flex items-center gap-2" style={{ color: '#e8f0fe' }}>
                    <span style={{ color: '#60a5fa' }}>📱</span>
                    {selecionado.conversa.cliente.nome || selecionado.conversa.cliente.telefone}
                    {selecionado.conversa.cliente.nome && (
                      <span className="text-[11px]" style={{ color: '#5a7fa8' }}>
                        {selecionado.conversa.cliente.telefone}
                      </span>
                    )}
                  </div>
                  <BadgeEstado s={selecionado.conversa.estadoAtual} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selecionado.conversa.contexto)
                    .filter(([k]) => k !== 'intent' && k !== 'ultimaAcao')
                    .map(([k, v]) => (
                      <div key={k}
                        style={{ background: '#162d52', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 6 }}
                        className="px-2 py-0.5 text-[10px]">
                        <span style={{ color: '#60a5fa' }}>{k}:</span>{' '}
                        <span style={{ color: '#e8f0fe' }}>{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Chat */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {[...selecionado.conversa.mensagens].reverse().map(m => (
                  <div key={m.id} className={`flex ${m.origem === 'CLIENTE' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-xs px-3 py-2 rounded-xl text-[11px] leading-relaxed"
                      style={{
                        background: m.origem === 'CLIENTE' ? '#2563b0'
                          : m.origem === 'IA' ? '#1e3d6e'
                          : 'rgba(52,211,153,0.1)',
                        color: m.origem === 'CLIENTE' ? '#fff'
                          : m.origem === 'IA' ? '#e8f0fe'
                          : '#34d399',
                        border: m.origem === 'CLIENTE' ? 'none'
                          : m.origem === 'IA' ? '1px solid rgba(59,130,246,0.2)'
                          : '1px solid rgba(52,211,153,0.2)',
                        borderBottomRightRadius: m.origem === 'CLIENTE' ? 3 : 11,
                        borderBottomLeftRadius: m.origem !== 'CLIENTE' ? 3 : 11,
                      }}>
                      <div className="text-[9px] font-semibold mb-1 opacity-60">{m.origem}</div>
                      <div className="whitespace-pre-wrap">{m.conteudo}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(59,130,246,0.2)', background: '#1e3d6e' }}>
                {selecionado.status === 'PENDENTE' && (
                  <button onClick={() => assumir(selecionado.id)} disabled={loading}
                    className="w-full py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                    style={{ background: '#2563b0' }}>
                    👤 Assumir Atendimento
                  </button>
                )}
                {selecionado.status === 'EM_ANDAMENTO' && (
                  <button onClick={() => resolver(selecionado.id)} disabled={loading}
                    className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}>
                    ✓ Marcar como Resolvido
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
