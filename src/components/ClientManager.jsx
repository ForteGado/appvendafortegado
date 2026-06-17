import React, { useState, useEffect } from 'react';
import { 
  Users, Search, User, MapPin, CreditCard, 
  Calendar, DollarSign, AlertCircle, ArrowLeft, 
  Save, FileText, CheckCircle, TrendingUp, X 
} from 'lucide-react';
import { getDb, updateClientLocal } from '../services/db';
import { saveClientToSupabase } from '../services/supabaseService';

export default function ClientManager({ currentUser, setView }) {
  const [clientes, setClientes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWithCredit, setFilterWithCredit] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Estados para edição (Admin)
  const [limiteCredito, setLimiteCredito] = useState('0');
  const [observacoes, setObservacoes] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  // Estados dos históricos do cliente selecionado
  const [comprasHist, setComprasHist] = useState([]);
  const [pagamentosHist, setPagamentosHist] = useState([]);
  const [resumoFinanceiro, setResumoFinanceiro] = useState({ totalComprado: 0, totalPendente: 0 });

  const loadClientes = () => {
    const db = getDb();
    setClientes(db.clientes || []);
  };

  useEffect(() => {
    loadClientes();
    window.addEventListener('fortegado_db_update', loadClientes);
    return () => window.removeEventListener('fortegado_db_update', loadClientes);
  }, []);

  // Recarregar históricos quando o cliente selecionado muda
  useEffect(() => {
    if (!selectedClient) return;

    const db = getDb();
    
    // 1. Filtrar compras do cliente (pedidos não cancelados)
    const clientOrders = (db.pedidos || [])
      .filter(p => p.cliente_id === selectedClient.id && p.status !== 'Cancelado')
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    
    setComprasHist(clientOrders);

    // 2. Filtrar parcelas dos pedidos do cliente
    const orderIds = clientOrders.map(p => p.id);
    const clientInstallments = (db.parcelas || [])
      .filter(par => orderIds.includes(par.pedido_id))
      .sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

    setPagamentosHist(clientInstallments);

    // 3. Calcular resumo financeiro
    const totalComprado = clientOrders.reduce((acc, p) => acc + p.total, 0);
    const totalPendente = clientInstallments
      .filter(par => !par.pago)
      .reduce((acc, par) => acc + par.valor, 0);

    setResumoFinanceiro({ totalComprado, totalPendente });
    setLimiteCredito(String(selectedClient.limite_credito || 0));
    setObservacoes(selectedClient.observacoes || '');
  }, [selectedClient, clientes]);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setMsg(null);
  };

  const handleCloseDetail = () => {
    setSelectedClient(null);
    setMsg(null);
  };

  const handleSaveFicha = async () => {
    if (!selectedClient) return;
    const credVal = parseFloat(limiteCredito.replace(',', '.'));
    if (isNaN(credVal) || credVal < 0) {
      setMsg({ ok: false, text: 'Limite de crédito inválido.' });
      return;
    }

    setSaving(true);
    setMsg(null);

    // 1. Atualizar localmente
    const updated = updateClientLocal(selectedClient.id, {
      limite_credito: credVal,
      observacoes: observacoes.trim()
    });

    loadClientes();
    
    // 2. Sincronizar com Supabase
    if (updated) {
      const res = await saveClientToSupabase(updated);
      if (res.success) {
        setMsg({ ok: true, text: '✅ Ficha do cliente salva e sincronizada com Supabase!' });
        // Atualiza a referência selecionada
        setSelectedClient(updated);
      } else {
        setMsg({ ok: false, text: `⚠️ Salvo localmente. Erro no Supabase: ${res.reason}` });
      }
    }
    setSaving(false);
  };

  // Filtragem dos clientes
  const filteredClientes = clientes.filter(c => {
    const term = searchQuery.toLowerCase();
    const matchSearch = 
      (c.nome_fazenda && c.nome_fazenda.toLowerCase().includes(term)) ||
      (c.nome_produtor && c.nome_produtor.toLowerCase().includes(term)) ||
      (c.cidade && c.cidade.toLowerCase().includes(term));

    if (filterWithCredit) {
      return matchSearch && (c.limite_credito > 0);
    }
    return matchSearch;
  });

  // Cálculos gerais de KPIs
  const totalCreditoLiberado = clientes.reduce((acc, c) => acc + (c.limite_credito || 0), 0);
  const clientesComCredito = clientes.filter(c => c.limite_credito > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Visualização de Detalhe da Ficha do Cliente */}
      {selectedClient ? (
        <div className="card" style={{ padding: '20px', position: 'relative', borderLeft: '4.5px solid var(--azul-principal)' }}>
          {/* Header do Detalhe */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--cinza-claro)', paddingBottom: '14px' }}>
            <button onClick={handleCloseDetail} style={btnBack}>
              <ArrowLeft size={16} /> Voltar à lista
            </button>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--azul-principal)', margin: 0, fontWeight: '800' }}>
              Ficha do Cliente
            </h2>
          </div>

          {msg && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.88rem',
              backgroundColor: msg.ok ? 'rgba(90,158,26,0.1)' : 'rgba(229,62,98,0.1)',
              color: msg.ok ? 'var(--verde-escuro)' : '#c53030',
              border: `1px solid ${msg.ok ? 'rgba(90,158,26,0.2)' : 'rgba(229,62,98,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <CheckCircle size={15} />{msg.text}
            </div>
          )}

          <div style={detailGrid}>
            
            {/* Coluna 1: Dados do Cliente */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={subSectionTitle}><User size={16} /> Identificação e Contato</h3>
              <div style={dataField}>
                <span style={fieldLabel}>Fazenda / Razão Social</span>
                <strong style={fieldValue}>{selectedClient.nome_fazenda || 'Não informado'}</strong>
              </div>
              <div style={dataField}>
                <span style={fieldLabel}>Produtor Responsável</span>
                <strong style={fieldValue}>{selectedClient.nome_produtor || 'Não informado'}</strong>
              </div>
              <div style={dataField}>
                <span style={fieldLabel}>CPF/CNPJ</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--cinza-escuro)' }}>{selectedClient.cpf_cnpj || 'Não cadastrado'}</span>
              </div>
              <div style={dataField}>
                <span style={fieldLabel}>Telefone</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--cinza-escuro)' }}>{selectedClient.telefone || 'Não informado'}</span>
              </div>
              <div style={dataField}>
                <span style={fieldLabel}>Localização</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--cinza-escuro)' }}>
                  <MapPin size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {selectedClient.endereco ? `${selectedClient.endereco}, ` : ''}{selectedClient.cidade || ''}
                </span>
                {selectedClient.latitude && selectedClient.longitude && (
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedClient.latitude},${selectedClient.longitude}`, '_blank')}
                    style={{ ...btnEdit, width: 'fit-content', marginTop: '8px', padding: '4px 8px', fontSize: '0.75rem' }}
                  >
                    🗺️ Ver no Mapa (Google Maps)
                  </button>
                )}
              </div>
            </div>

            {/* Coluna 2: Crédito e Notas (Admin edita, Vendedor lê) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--cinza-ultra-claro)', padding: '16px', borderRadius: '10px', border: '1px solid var(--cinza-claro)' }}>
              <h3 style={subSectionTitle}><CreditCard size={16} /> Parâmetros Financeiros</h3>
              
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Limite de Crédito Liberado (R$)</label>
                {currentUser?.perfil === 'Administrador' ? (
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={limiteCredito}
                    onChange={(e) => setLimiteCredito(e.target.value)}
                    placeholder="0.00"
                    style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--verde-escuro)' }}
                  />
                ) : (
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--verde-escuro)', padding: '6px 0' }}>
                    {parseFloat(limiteCredito) > 0 
                      ? Number(limiteCredito).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : 'Sem Crédito Liberado'
                    }
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Observações Internas da Conta</label>
                {currentUser?.perfil === 'Administrador' ? (
                  <textarea
                    className="form-control"
                    rows="3"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Notas internas do admin sobre este cliente..."
                    style={{ resize: 'none', fontSize: '0.85rem' }}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', color: 'var(--cinza-escuro)', backgroundColor: 'white', padding: '10px', borderRadius: '6px', minHeight: '60px', border: '1px solid var(--cinza-claro)' }}>
                    {observacoes || 'Sem observações cadastradas.'}
                  </div>
                )}
              </div>

              {currentUser?.perfil === 'Administrador' && (
                <button 
                  onClick={handleSaveFicha} 
                  disabled={saving} 
                  style={{ ...btnGreen, justifyContent: 'center', width: '100%', marginTop: '6px' }}
                >
                  <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Crédito e Notas'}
                </button>
              )}
            </div>
          </div>

          {/* Históricos */}
          <div style={{ marginTop: '24px' }}>
            {/* KPIs Rápidos da Ficha */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={miniKpi}>
                <span style={miniKpiLabel}>Qtd de Compras</span>
                <strong style={miniKpiVal}>{comprasHist.length} vez(es)</strong>
              </div>
              <div style={miniKpi}>
                <span style={miniKpiLabel}>Total Comprado</span>
                <strong style={{ ...miniKpiVal, color: 'var(--azul-principal)' }}>
                  R$ {resumoFinanceiro.totalComprado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div style={miniKpi}>
                <span style={miniKpiLabel}>Saldo em Aberto</span>
                <strong style={{ ...miniKpiVal, color: resumoFinanceiro.totalPendente > 0 ? '#d97706' : 'var(--verde-escuro)' }}>
                  R$ {resumoFinanceiro.totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

            {/* Abas internas para histórico comercial e financeiro */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
              
              {/* Painel Histórico de Compras (Comercial) */}
              <div className="card" style={{ padding: '12px', overflowX: 'auto', border: '1px solid var(--cinza-claro)' }}>
                <h4 style={{ ...subSectionTitle, color: 'var(--azul-principal)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> Histórico de Compras (Pedidos)
                </h4>
                {comprasHist.length > 0 ? (
                  <table style={tableMiniStyle}>
                    <thead>
                      <tr>
                        <th>Nº Pedido</th>
                        <th>Data</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comprasHist.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.numero}</strong></td>
                          <td>{new Date(p.data).toLocaleDateString('pt-BR')}</td>
                          <td>
                            <span style={{
                              fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold',
                              backgroundColor: p.status === 'Entregue' ? '#DEF7EC' : '#E1EFFE',
                              color: p.status === 'Entregue' ? '#03543F' : '#1E429F'
                            }}>{p.status}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={emptyHistory}>Nenhum pedido efetuado por este cliente.</div>
                )}
              </div>

              {/* Painel Histórico de Contas/Pagamentos */}
              <div className="card" style={{ padding: '12px', overflowX: 'auto', border: '1px solid var(--cinza-claro)' }}>
                <h4 style={{ ...subSectionTitle, color: 'var(--verde-escuro)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={16} /> Histórico de Contas (Pagamentos)
                </h4>
                {pagamentosHist.length > 0 ? (
                  <table style={tableMiniStyle}>
                    <thead>
                      <tr>
                        <th>Vencimento</th>
                        <th>Valor</th>
                        <th style={{ textAlign: 'center' }}>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagamentosHist.map(par => (
                        <tr key={par.id}>
                          <td>{new Date(par.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                          <td style={{ fontWeight: 'bold' }}>R$ {par.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{
                              fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold',
                              backgroundColor: par.pago ? 'rgba(90,158,26,0.12)' : 'rgba(217,119,6,0.12)',
                              color: par.pago ? 'var(--verde-escuro)' : '#b45309'
                            }}>{par.pago ? 'Pago' : 'Em Aberto'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={emptyHistory}>Nenhuma parcela financeira pendente ou registrada.</div>
                )}
              </div>

            </div>
          </div>

        </div>
      ) : (
        /* LISTAGEM DE CLIENTES */
        <div>
          {/* Cabeçalho */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={24} /> Ficha de Clientes e Créditos
            </h2>
            <button className="btn btn-primary" onClick={() => setView('novo-pedido')} style={{ width: 'auto', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem' }}>
              + Novo Cliente
            </button>
          </div>

          {/* KPIs da Lista */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="card kpi-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--cinza-medio)' }}>Total de Clientes</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--azul-principal)' }}>{clientes.length}</div>
            </div>
            <div className="card kpi-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--cinza-medio)' }}>Com Crédito Ativo</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--verde-escuro)' }}>{clientesComCredito}</div>
            </div>
            <div className="card kpi-card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--cinza-medio)' }}>Crédito Total Liberado</div>
              <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--amarelo-escuro)' }}>
                R$ {totalCreditoLiberado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="card" style={{ padding: '14px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Buscar por fazenda, produtor ou cidade..."
                className="form-control"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--cinza-medio)' }} />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={filterWithCredit}
                onChange={(e) => setFilterWithCredit(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Filtrar apenas com limite de crédito
            </label>
          </div>

          {/* Grid de Clientes */}
          <div style={clientsGrid}>
            {filteredClientes.length > 0 ? (
              filteredClientes.map(c => {
                const db = getDb();
                const orders = (db.pedidos || []).filter(p => p.cliente_id === c.id && p.status !== 'Cancelado');
                const totalSpent = orders.reduce((acc, p) => acc + p.total, 0);

                return (
                  <div 
                    key={c.id} 
                    onClick={() => handleSelectClient(c)}
                    style={clientCardStyle}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--cinza-medio)', backgroundColor: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                        ID: {c.id}
                      </span>
                      {c.limite_credito > 0 ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', backgroundColor: 'rgba(90,158,26,0.12)', color: 'var(--verde-escuro)', padding: '2px 8px', borderRadius: '12px' }}>
                          Crédito: R$ {c.limite_credito.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.05)', color: 'var(--cinza-medio)', padding: '2px 8px', borderRadius: '12px' }}>
                          Sem Crédito
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--azul-principal)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.nome_fazenda || 'Sem nome da fazenda'}
                    </h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cinza-escuro)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                      <User size={12} style={{ color: 'var(--cinza-medio)' }} />
                      <span>{c.nome_produtor || 'Não informado'}</span>
                    </div>

                    <div style={{ borderTop: '1px solid var(--cinza-claro)', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--cinza-medio)' }}>
                      <span>{orders.length} compra(s)</span>
                      <strong style={{ color: 'var(--azul-escuro)' }}>
                        R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--cinza-medio)' }}>
                <AlertCircle size={36} style={{ margin: '0 auto 10px', color: 'var(--cinza-medio)' }} />
                <span>Nenhum cliente correspondente aos filtros.</span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Estilos do Componente ───────────────────────────────────────────────────
const subSectionTitle = { fontSize: '0.88rem', fontWeight: '700', color: 'var(--azul-escuro)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 };
const btnBack = { display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--cinza-medio)', background: 'transparent', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer', color: 'var(--cinza-escuro)' };
const btnEdit = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--azul-principal)', backgroundColor: 'transparent', color: 'var(--azul-principal)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' };
const btnGreen = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '10px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--verde-agro)', color: 'white', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' };

const detailGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '10px' };
const dataField = { display: 'flex', flexDirection: 'column', gap: '2px' };
const fieldLabel = { fontSize: '0.7rem', color: 'var(--cinza-medio)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.2px' };
const fieldValue = { fontSize: '0.98rem', color: 'var(--azul-escuro)', fontWeight: '700' };

const miniKpi = { display: 'flex', flexDirection: 'column', gap: '2px', backgroundColor: 'var(--cinza-ultra-claro)', border: '1px solid var(--cinza-claro)', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' };
const miniKpiLabel = { fontSize: '0.66rem', color: 'var(--cinza-medio)', fontWeight: 'bold' };
const miniKpiVal = { fontSize: '0.92rem', fontWeight: '800' };

const tableMiniStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginTop: '6px' };
const emptyHistory = { textAlign: 'center', padding: '20px', color: 'var(--cinza-medio)', fontSize: '0.8rem', fontStyle: 'italic' };

const clientsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' };
const clientCardStyle = { 
  backgroundColor: 'var(--cinza-ultra-claro)', 
  border: '1px solid var(--cinza-claro)', 
  borderRadius: '10px', 
  padding: '12px 14px', 
  cursor: 'pointer', 
  transition: 'all 0.2s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
};
// Hover em JavaScript para manter Inline sem dependencias extras
if (typeof window !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    .shortcuts-grid button:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .client-card-hover:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--azul-principal); }
  `;
  document.head.appendChild(styleEl);
}
// Aplica a classe para hover
const clientCardClass = 'client-card-hover';
