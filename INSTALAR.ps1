# ============================================================
# AUTOPECAS — SSE + ANTI-CORRIDA
# Cole cada bloco separadamente no PowerShell
# ============================================================

# ── 1 de 3 — handoff.service.ts (API) ───────────────────────
@'
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export interface HandoffPayload {
  conversaId: string;
  clienteId: string;
  telefone: string;
  resumo: string;
  peca?: string;
  veiculo?: string;
  pagamento?: string;
  entrega?: string;
  prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  slaMinutos: number;
}

export interface HandoffSseEvent {
  tipo: 'novo' | 'assumido' | 'resolvido';
  atendimentoId: string;
}

@Injectable()
export class HandoffService {
  private readonly sseStream$ = new Subject<HandoffSseEvent>();

  constructor(
    @InjectQueue('handoff') private handoffQueue: Queue,
    private prisma: PrismaService,
  ) {}

  getSseStream() {
    return this.sseStream$.asObservable();
  }

  async criarHandoff(payload: HandoffPayload) {
    const existente = await this.prisma.atendimento.findUnique({
      where: { conversaId: payload.conversaId },
    });

    if (existente && existente.status === 'PENDENTE') {
      console.log(`[Handoff] Ja existe handoff pendente para conversa ${payload.conversaId}`);
      return existente;
    }

    const atendimento = await this.prisma.atendimento.create({
      data: {
        conversaId: payload.conversaId,
        status: 'PENDENTE',
        prioridade: payload.prioridade,
        slaMinutos: payload.slaMinutos,
        resumo: this.montarResumo(payload),
      },
    });

    await this.handoffQueue.add(
      'novo-handoff',
      { atendimentoId: atendimento.id, ...payload },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: false, removeOnFail: false },
    );

    await this.handoffQueue.add(
      'verificar-sla',
      { atendimentoId: atendimento.id, conversaId: payload.conversaId },
      { delay: payload.slaMinutos * 60 * 1000, attempts: 1, removeOnComplete: true },
    );

    console.log(`[Handoff] Criado atendimento ${atendimento.id} — prioridade: ${payload.prioridade}`);
    this.sseStream$.next({ tipo: 'novo', atendimentoId: atendimento.id });
    return atendimento;
  }

  async assumirAtendimento(atendimentoId: string, vendedorId: string) {
    const resultado = await this.prisma.atendimento.updateMany({
      where: { id: atendimentoId, status: 'PENDENTE' },
      data: { vendedorId, status: 'EM_ANDAMENTO', iniciadoEm: new Date() },
    });

    if (resultado.count === 0) {
      throw new ConflictException('Atendimento ja foi assumido por outro vendedor');
    }

    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
      include: { conversa: { include: { cliente: true } } },
    });

    await this.prisma.conversa.update({
      where: { id: atendimento.conversaId },
      data: { status: 'EM_ATENDIMENTO' },
    });

    await this.prisma.logConversa.create({
      data: {
        conversaId: atendimento.conversaId,
        tipo: 'HANDOFF_ASSUMIDO',
        payload: { vendedorId, atendimentoId },
      },
    });

    this.sseStream$.next({ tipo: 'assumido', atendimentoId });
    return atendimento;
  }

  async resolverAtendimento(atendimentoId: string) {
    const atendimento = await this.prisma.atendimento.update({
      where: { id: atendimentoId },
      data: { status: 'RESOLVIDO', resolvidoEm: new Date() },
    });

    await this.prisma.conversa.update({
      where: { id: atendimento.conversaId },
      data: { status: 'FINALIZADA', estadoAtual: 'FINALIZADO' },
    });

    this.sseStream$.next({ tipo: 'resolvido', atendimentoId });
    return atendimento;
  }

  async listarPendentes() {
    return this.prisma.atendimento.findMany({
      where: { status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
      include: {
        conversa: {
          include: { cliente: true, mensagens: { orderBy: { timestamp: 'desc' }, take: 3 } },
        },
      },
      orderBy: [{ prioridade: 'desc' }, { createdAt: 'asc' }],
    });
  }

  private montarResumo(payload: HandoffPayload): string {
    const linhas = [`Cliente: ${payload.telefone}`];
    if (payload.peca) linhas.push(`Peca: ${payload.peca}`);
    if (payload.veiculo) linhas.push(`Veiculo: ${payload.veiculo}`);
    if (payload.pagamento) linhas.push(`Pagamento: ${payload.pagamento}`);
    if (payload.entrega) linhas.push(`Entrega: ${payload.entrega}`);
    return linhas.join(' | ');
  }

  calcularPrioridade(contexto: Record<string, any>): 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE' {
    if (contexto.pagamento) return 'ALTA';
    if (contexto.peca && contexto.veiculo) return 'MEDIA';
    return 'BAIXA';
  }
}
'@ | Set-Content -Encoding UTF8 "C:\autopecas\autopecas-mvp-main\apps\api\src\modules\handoff\handoff.service.ts"
Write-Host "✅ 1/3 handoff.service.ts gravado"


# ── 2 de 3 — handoff.controller.ts (API) ────────────────────
@'
import {
  Controller, Get, Post, Param, Body,
  Inject, forwardRef, Sse, MessageEvent, Header,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { HandoffService } from './handoff.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('handoff')
export class HandoffController {
  constructor(
    private readonly handoffService: HandoffService,
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly prisma: PrismaService,
  ) {}

  @Sse('stream')
  @Header('X-Accel-Buffering', 'no')
  stream(): Observable<MessageEvent> {
    return this.handoffService.getSseStream().pipe(
      map((evento) => ({
        data: JSON.stringify(evento),
        type: evento.tipo,
        id: evento.atendimentoId,
      })),
    );
  }

  @Get('pendentes')
  listarPendentes() {
    return this.handoffService.listarPendentes();
  }

  @Post(':id/assumir')
  assumir(@Param('id') id: string, @Body() body: { vendedorId: string }) {
    return this.handoffService.assumirAtendimento(id, body.vendedorId);
  }

  @Post(':id/resolver')
  resolver(@Param('id') id: string) {
    return this.handoffService.resolverAtendimento(id);
  }

  @Post(':id/mensagem')
  async enviarMensagem(
    @Param('id') id: string,
    @Body() body: { texto: string; vendedorId: string },
  ) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id },
      include: { conversa: { include: { cliente: true } } },
    });
    if (!atendimento) return { erro: 'Atendimento nao encontrado' };
    if (atendimento.status !== 'EM_ANDAMENTO') return { erro: 'Atendimento nao esta em andamento' };

    const telefone = atendimento.conversa.cliente.telefone;
    await this.whatsappService.enviarMensagem(telefone, body.texto);
    await this.prisma.mensagem.create({
      data: {
        conversaId: atendimento.conversaId,
        origem: 'HUMANO',
        conteudo: body.texto,
        metadata: { vendedorId: body.vendedorId },
      },
    });
    return { status: 'ok', enviado: true };
  }
}
'@ | Set-Content -Encoding UTF8 "C:\autopecas\autopecas-mvp-main\apps\api\src\modules\handoff\handoff.controller.ts"
Write-Host "✅ 2/3 handoff.controller.ts gravado"


# ── 3 de 3 — page.tsx (Web) ─────────────────────────────────
@'
"use client";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Mensagem = { id: string; origem: "IA" | "CLIENTE" | "HUMANO"; conteudo: string; timestamp: string };
type Handoff = {
  id: string; prioridade: string; status: string; resumo?: string; vendedorId?: string;
  conversa?: {
    cliente?: { nome?: string; telefone?: string };
    mensagens?: Mensagem[];
    contexto?: { carrinho?: { nome: string; preco: number; quantidade: number }[]; endereco?: string; pagamento?: string; tipoEntrega?: string; veiculo?: string };
  };
};
type Metricas = {
  leads: { total: number; atendidosIA: number; abandonados: number; taxaAtendimento: number; taxaAbandono: number };
  vendas: { finalizadas: number; abandonadas: number; taxaConversao: number; receitaGerada: number; ticketMedio: number };
  eficiencia: { horasEconomizadas: number; minutosEconomizadosPorLead: number };
  vendedores: { codigo: string; finalizadas: number; abandonadas: number; total: number }[];
};

function Badge({ texto }: { texto: string }) {
  const cores: Record<string, string> = { URGENTE: "#dc2626", ALTA: "#ea580c", MEDIA: "#d97706", BAIXA: "#16a34a", PENDENTE: "#6b7280", EM_ANDAMENTO: "#2563eb", RESOLVIDO: "#16a34a", EXPIRADO: "#dc2626" };
  return <span style={{ background: cores[texto] ?? "#6b7280", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{texto}</span>;
}

function Toast({ mensagem, tipo, onClose }: { mensagem: string; tipo: "erro" | "info"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, background: tipo === "erro" ? "#dc2626" : "#2563eb", color: "#fff", borderRadius: 10, padding: "14px 20px", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12, maxWidth: 360 }}>
      <span>{mensagem}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, marginLeft: "auto" }}>x</button>
    </div>
  );
}

function KpiCard({ label, valor, sub, cor }: { label: string; valor: string | number; sub?: string; cor?: string }) {
  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 150 }}>
      <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 4px 0", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, margin: 0, color: cor ?? "#111827" }}>{valor}</p>
      {sub && <p style={{ fontSize: 11, color: "#9ca3af", margin: "4px 0 0 0" }}>{sub}</p>}
    </div>
  );
}

function GraficoBarras({ dados, tipo }: { dados: Metricas["vendedores"]; tipo: "finalizadas" | "abandonadas" | "total" }) {
  const cores = { finalizadas: "#16a34a", abandonadas: "#dc2626", total: "#2563eb" };
  const max = Math.max(...dados.map((d) => d[tipo]), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {dados.length === 0 && <p style={{ color: "#9ca3af", fontSize: 13 }}>Sem dados no periodo.</p>}
      {dados.map((v) => (
        <div key={v.codigo} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, fontWeight: 700, fontSize: 13, textAlign: "center", background: "#f3f4f6", borderRadius: 4, padding: "3px 0" }}>{v.codigo}</span>
          <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 4, height: 10 }}>
            <div style={{ width: `${Math.round((v[tipo] / max) * 100)}%`, background: cores[tipo], height: 10, borderRadius: 4, transition: "width 0.5s ease" }} />
          </div>
          <span style={{ width: 28, fontSize: 13, fontWeight: 700, color: cores[tipo], textAlign: "right" }}>{v[tipo]}</span>
        </div>
      ))}
    </div>
  );
}

function GraficoPizza({ dados }: { dados: Metricas["vendedores"] }) {
  const cores = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];
  const total = dados.reduce((s, d) => s + d.finalizadas, 0) || 1;
  let angulo = 0;
  const fatias = dados.map((v, i) => { const pct = v.finalizadas / total; const ini = angulo; angulo += pct * 360; return { ...v, ini, fim: angulo, cor: cores[i % cores.length], pct }; });
  const rad = (g: number) => (g * Math.PI) / 180;
  function arco(cx: number, cy: number, r: number, ini: number, fim: number) {
    const x1 = cx + r * Math.cos(rad(ini - 90)), y1 = cy + r * Math.sin(rad(ini - 90));
    const x2 = cx + r * Math.cos(rad(fim - 90)), y2 = cy + r * Math.sin(rad(fim - 90));
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${fim - ini > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <svg width={150} height={150} viewBox="0 0 150 150">
        {dados.length === 0 ? <circle cx={75} cy={75} r={65} fill="#e5e7eb" /> : fatias.map((f, i) => f.fim - f.ini > 0.5 ? <path key={i} d={arco(75, 75, 65, f.ini, f.fim)} fill={f.cor} stroke="#fff" strokeWidth={2} /> : null)}
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fatias.map((f, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: f.cor, flexShrink: 0 }} />
            <span style={{ fontWeight: 700 }}>{f.codigo}</span>
            <span style={{ color: "#6b7280" }}>{f.finalizadas} venda{f.finalizadas !== 1 ? "s" : ""} ({Math.round(f.pct * 100)}%)</span>
          </div>
        ))}
        {dados.length === 0 && <span style={{ color: "#9ca3af", fontSize: 13 }}>Sem dados.</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [aba, setAba] = useState<"operacional" | "admin">("operacional");
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [vendedorCodigo, setVendedorCodigo] = useState("");
  const [codigoErro, setCodigoErro] = useState("");
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [graficoTipo, setGraficoTipo] = useState<"barras-finalizadas" | "barras-abandonadas" | "pizza">("barras-finalizadas");
  const [carregando, setCarregando] = useState(false);
  const [toast, setToast] = useState<{ mensagem: string; tipo: "erro" | "info" } | null>(null);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<string | null>(null);

  const carregarHandoffs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/handoff/pendentes`);
      if (r.ok) {
        const dados: Handoff[] = await r.json();
        setHandoffs(dados);
        setAtendimentoAtivo((atual) => {
          if (!atual) return null;
          const aindaExiste = dados.some((h) => h.id === atual && h.status === "EM_ANDAMENTO");
          return aindaExiste ? atual : null;
        });
      }
    } catch {}
  }, []);

  const carregarMetricas = useCallback(async () => {
    setCarregando(true);
    try { const r = await fetch(`${API}/api/admin/metricas`); if (r.ok) setMetricas(await r.json()); } catch {}
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregarHandoffs();
    const es = new EventSource(`${API}/api/handoff/stream`);
    const onEvento = () => carregarHandoffs();
    es.addEventListener("novo", onEvento);
    es.addEventListener("assumido", onEvento);
    es.addEventListener("resolvido", onEvento);
    es.onerror = () => console.warn("[SSE] Reconectando...");
    return () => { es.removeEventListener("novo", onEvento); es.removeEventListener("assumido", onEvento); es.removeEventListener("resolvido", onEvento); es.close(); };
  }, [carregarHandoffs]);

  useEffect(() => { if (aba === "admin") carregarMetricas(); }, [aba, carregarMetricas]);

  const validarCodigo = (v: string) => {
    if (atendimentoAtivo) return;
    const limpo = v.replace(/\D/g, "").slice(0, 3);
    setVendedorCodigo(limpo);
    setCodigoErro(limpo.length > 0 && limpo.length < 3 ? "Codigo deve ter 3 digitos" : "");
  };

  const assumir = async (id: string) => {
    if (vendedorCodigo.length !== 3) { setCodigoErro("Informe seu codigo de 3 digitos antes de assumir"); return; }
    try {
      const r = await fetch(`${API}/api/handoff/${id}/assumir`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vendedorId: vendedorCodigo }) });
      if (r.status === 409) { setToast({ mensagem: "Este atendimento ja foi assumido por outro vendedor.", tipo: "erro" }); carregarHandoffs(); return; }
      if (!r.ok) { setToast({ mensagem: "Erro ao assumir atendimento.", tipo: "erro" }); return; }
      setAtendimentoAtivo(id);
      setSelecionado(id);
      carregarHandoffs();
    } catch { setToast({ mensagem: "Erro de conexao. Verifique a API.", tipo: "erro" }); }
  };

  const resolver = async (id: string) => {
    await fetch(`${API}/api/handoff/${id}/resolver`, { method: "POST" });
    setAtendimentoAtivo(null);
    setSelecionado(null);
    carregarHandoffs();
  };

  const enviarMensagem = async () => {
    if (!selecionado || !mensagem.trim() || vendedorCodigo.length !== 3) return;
    await fetch(`${API}/api/handoff/${selecionado}/mensagem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto: mensagem, vendedorId: vendedorCodigo }) });
    setMensagem(""); carregarHandoffs();
  };

  const pendentes = handoffs.filter((h) => h.status === "PENDENTE");
  const emAndamento = handoffs.filter((h) => h.status === "EM_ANDAMENTO");
  const selecionadoObj = handoffs.find((h) => h.id === selecionado);
  const mensagens = selecionadoObj?.conversa?.mensagens ?? [];
  const contexto = selecionadoObj?.conversa?.contexto;
  const nomeCliente = selecionadoObj?.conversa?.cliente?.nome ?? selecionadoObj?.conversa?.cliente?.telefone ?? "Cliente";
  const clienteAtivo = atendimentoAtivo ? handoffs.find((h) => h.id === atendimentoAtivo)?.conversa?.cliente : null;
  const nomeClienteAtivo = clienteAtivo?.nome ?? clienteAtivo?.telefone ?? "cliente";

  const botaoAba = (a: "operacional" | "admin", label: string) => (
    <button onClick={() => setAba(a)} style={{ padding: "8px 22px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: aba === a ? "#3b82f6" : "transparent", color: aba === a ? "#fff" : "#94a3b8" }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f3f4f6" }}>
      {toast && <Toast mensagem={toast.mensagem} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <header style={{ background: "#1e293b", color: "#fff", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>AutoPecas — Painel</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>Gestao de atendimentos e analise operacional</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{botaoAba("operacional", "Operacional")}{botaoAba("admin", "Administracao / ROI")}</div>
      </header>

      {aba === "operacional" && (
        <main style={{ padding: 24, maxWidth: 1300, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 20px", fontSize: 13 }}><span style={{ color: "#6b7280" }}>Pendentes </span><strong style={{ color: "#dc2626" }}>{pendentes.length}</strong></div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 20px", fontSize: 13 }}><span style={{ color: "#6b7280" }}>Em atendimento </span><strong style={{ color: "#2563eb" }}>{emAndamento.length}</strong></div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 20px", fontSize: 13 }}><span style={{ color: "#6b7280" }}>Total </span><strong>{handoffs.length}</strong></div>
            <div style={{ marginLeft: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{atendimentoAtivo ? "Em atendimento" : "Seu codigo (3 digitos)"}</label>
                <input type="text" value={vendedorCodigo} onChange={(e) => validarCodigo(e.target.value)} maxLength={3} placeholder="000" disabled={!!atendimentoAtivo}
                  style={{ width: 60, padding: "6px 10px", borderRadius: 6, border: `1.5px solid ${codigoErro ? "#dc2626" : atendimentoAtivo ? "#d97706" : "#d1d5db"}`, fontSize: 18, fontWeight: 700, textAlign: "center", background: atendimentoAtivo ? "#fef3c7" : "#fff", color: atendimentoAtivo ? "#92400e" : "#111827", cursor: atendimentoAtivo ? "not-allowed" : "text" }} />
              </div>
              {codigoErro && !atendimentoAtivo && <p style={{ fontSize: 11, color: "#dc2626", margin: "4px 0 0 0" }}>{codigoErro}</p>}
              {atendimentoAtivo && <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 0 0", fontWeight: 600 }}>Atendendo {nomeClienteAtivo} — resolva para liberar</p>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              {handoffs.length === 0 && <p style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>Nenhum atendimento no momento.</p>}
              {handoffs.map((h) => {
                const cliente = h.conversa?.cliente;
                const ctx = h.conversa?.contexto;
                const podeAssumir = h.status === "PENDENTE" && !atendimentoAtivo;
                const esteEstaAtivo = h.id === atendimentoAtivo;
                return (
                  <div key={h.id} onClick={() => setSelecionado(h.id === selecionado ? null : h.id)}
                    style={{ background: esteEstaAtivo ? "#f0fdf4" : selecionado === h.id ? "#eff6ff" : "#fff", border: `1.5px solid ${esteEstaAtivo ? "#16a34a" : selecionado === h.id ? "#3b82f6" : "#e5e7eb"}`, borderRadius: 10, padding: 16, marginBottom: 10, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                          {cliente?.nome ?? cliente?.telefone ?? "Cliente"}
                          {esteEstaAtivo && <span style={{ marginLeft: 8, fontSize: 11, color: "#16a34a", fontWeight: 600 }}>● seu atendimento</span>}
                        </p>
                        {ctx?.veiculo && <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#6b7280" }}>{ctx.veiculo} | {ctx.tipoEntrega} | {ctx.pagamento}</p>}
                        {ctx?.carrinho && ctx.carrinho.length > 0 && <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#374151" }}>{ctx.carrinho.map((c) => c.nome).join(", ")}</p>}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}><Badge texto={h.prioridade} /><Badge texto={h.status} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {h.status === "PENDENTE" && (
                        <button onClick={(e) => { e.stopPropagation(); assumir(h.id); }} disabled={!podeAssumir} title={atendimentoAtivo && !esteEstaAtivo ? "Voce ja esta em um atendimento" : ""}
                          style={{ padding: "6px 14px", background: podeAssumir ? "#2563eb" : "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: podeAssumir ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600 }}>
                          Assumir
                        </button>
                      )}
                      {h.status === "EM_ANDAMENTO" && esteEstaAtivo && (
                        <button onClick={(e) => { e.stopPropagation(); resolver(h.id); }} style={{ padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Resolver</button>
                      )}
                      {h.status === "EM_ANDAMENTO" && !esteEstaAtivo && (
                        <span style={{ fontSize: 12, color: "#6b7280", padding: "6px 0" }}>Vendedor {h.vendedorId}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selecionadoObj && (
              <div style={{ width: 380, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, flexShrink: 0 }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700 }}>{nomeCliente}</h3>
                {contexto && (
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#374151", lineHeight: 1.7 }}>
                    {contexto.veiculo && <div><strong>Veiculo:</strong> {contexto.veiculo}</div>}
                    {contexto.tipoEntrega && <div><strong>Entrega:</strong> {contexto.tipoEntrega}</div>}
                    {contexto.endereco && <div><strong>Endereco:</strong> {contexto.endereco}</div>}
                    {contexto.pagamento && <div><strong>Pagamento:</strong> {contexto.pagamento}</div>}
                    {contexto.carrinho && contexto.carrinho.length > 0 && <div><strong>Itens:</strong> {contexto.carrinho.map((c) => `${c.nome} (R$ ${c.preco})`).join(" | ")}</div>}
                  </div>
                )}
                <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, height: 280, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {mensagens.length === 0 && <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Sem mensagens registradas.</p>}
                  {[...mensagens].reverse().map((m) => (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.origem === "CLIENTE" ? "flex-start" : "flex-end" }}>
                      <span style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>{m.origem} · {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5, background: m.origem === "CLIENTE" ? "#e5e7eb" : m.origem === "IA" ? "#dbeafe" : "#f3e8ff", color: "#111827", borderBottomLeftRadius: m.origem === "CLIENTE" ? 2 : 10, borderBottomRightRadius: m.origem === "CLIENTE" ? 10 : 2 }}>{m.conteudo}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={mensagem} onChange={(e) => setMensagem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarMensagem()} placeholder="Digite a resposta..." style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1.5px solid #d1d5db", fontSize: 13 }} />
                  <button onClick={enviarMensagem} style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Enviar</button>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {aba === "admin" && (
        <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
          {carregando && <p style={{ color: "#6b7280", textAlign: "center", marginTop: 60 }}>Carregando metricas...</p>}
          {!carregando && !metricas && <p style={{ color: "#dc2626", textAlign: "center", marginTop: 60 }}>Nao foi possivel carregar as metricas. Verifique se a API esta online.</p>}
          {metricas && (
            <>
              <section style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px 0" }}>Visao Geral do Mes</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <KpiCard label="Leads recebidos" valor={metricas.leads.total} sub="total do periodo" />
                  <KpiCard label="Atendidos pela IA" valor={`${metricas.leads.taxaAtendimento}%`} sub={`${metricas.leads.atendidosIA} atendimentos`} cor="#2563eb" />
                  <KpiCard label="Taxa de abandono" valor={`${metricas.leads.taxaAbandono}%`} sub={`${metricas.leads.abandonados} abandonados`} cor="#dc2626" />
                  <KpiCard label="Vendas realizadas" valor={metricas.vendas.finalizadas} sub={`Conversao ${metricas.vendas.taxaConversao}%`} cor="#16a34a" />
                </div>
              </section>
              <section style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px 0" }}>ROI da Automacao</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <KpiCard label="Receita gerada" valor={`R$ ${metricas.vendas.receitaGerada.toLocaleString("pt-BR")}`} sub={`Ticket medio R$ ${metricas.vendas.ticketMedio}`} cor="#16a34a" />
                  <KpiCard label="Horas economizadas" valor={`${metricas.eficiencia.horasEconomizadas}h`} sub={`${metricas.eficiencia.minutosEconomizadosPorLead} min por lead`} cor="#7c3aed" />
                  <KpiCard label="Vendas abandonadas" valor={metricas.vendas.abandonadas} sub="handoffs expirados" cor="#dc2626" />
                  <KpiCard label="Ticket medio" valor={`R$ ${metricas.vendas.ticketMedio}`} sub="estimativa configuravel" />
                </div>
              </section>
              <section style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>Desempenho por Vendedor</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {([["barras-finalizadas", "Vendas"], ["barras-abandonadas", "Abandonadas"], ["pizza", "Pizza"]] as const).map(([v, l]) => (
                      <button key={v} onClick={() => setGraficoTipo(v)} style={{ padding: "5px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${graficoTipo === v ? "#2563eb" : "#d1d5db"}`, background: graficoTipo === v ? "#eff6ff" : "#fff", color: graficoTipo === v ? "#2563eb" : "#6b7280" }}>{l}</button>
                    ))}
                  </div>
                </div>
                {graficoTipo === "pizza" ? <GraficoPizza dados={metricas.vendedores} /> : <GraficoBarras dados={metricas.vendedores} tipo={graficoTipo === "barras-finalizadas" ? "finalizadas" : "abandonadas"} />}
                <div style={{ marginTop: 24, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>{["Cod. Vendedor", "Total", "Finalizadas", "Abandonadas", "Taxa conv."].map((h) => (<th key={h} style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#374151" }}>{h}</th>))}</tr></thead>
                    <tbody>
                      {metricas.vendedores.map((v) => (
                        <tr key={v.codigo} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 14px", fontWeight: 700, fontSize: 15 }}>{v.codigo}</td>
                          <td style={{ padding: "10px 14px" }}>{v.total}</td>
                          <td style={{ padding: "10px 14px", color: "#16a34a", fontWeight: 600 }}>{v.finalizadas}</td>
                          <td style={{ padding: "10px 14px", color: "#dc2626" }}>{v.abandonadas}</td>
                          <td style={{ padding: "10px 14px" }}>{v.total > 0 ? `${Math.round((v.finalizadas / v.total) * 100)}%` : "—"}</td>
                        </tr>
                      ))}
                      {metricas.vendedores.length === 0 && (<tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Sem dados de vendedores no periodo.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      )}
    </div>
  );
}
'@ | Set-Content -Encoding UTF8 "C:\autopecas\autopecas-mvp-main\apps\web\src\app\page.tsx"
Write-Host "✅ 3/3 page.tsx gravado"

Write-Host ""
Write-Host "✅ Todos os arquivos gravados. Reinicie a API e o Web para aplicar."
