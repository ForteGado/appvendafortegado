import React, { useState, useEffect } from 'react';
import { DollarSign, Search, CheckCircle, AlertCircle, BarChart2, X } from 'lucide-react';
import { getDb, getCredentials, receiveInstallmentLocal, getLocalDateString } from '../services/db';

export default function Financial() {
  const [installments, setInstallments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Estados específicos para o Vendedor
  const [currentUser, setCurrentUser] = useState(null);
  const [isVendedor, setIsVendedor] = useState(false);
  const [vendas, setVendas] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState({
    dia: { total: 0, qtd: 0 },
    mes: { total: 0, qtd: 0 },
    trimestre: { total: 0, qtd: 0 }
  });

  const loadFinancialData = () => {
    const db = getDb();
    const creds = getCredentials();
    
    // Identificar perfil
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId));
    setCurrentUser(user);
    const isVend = user && user.perfil === 'Vendedor';
    setIsVendedor(isVend);
    setIsAdmin(user && user.perfil === 'Administrador');

    if (isVend) {
      // Vendas do vendedor
      const mySales = db.pedidos
        .filter(p => p.vendedor_id === user.id)
        .map(p => {
          const client = db.clientes.find(c => c.id === p.cliente_id) || {};
          return {
            ...p,
            clienteNome: client.nome || 'Cliente Desconhecido'
          };
        });
      
      // Ordenar por data decrescente
      mySales.sort((a, b) => new Date(b.data) - new Date(a.data));
      setVendas(mySales);

      // Calcular estatísticas de vendas ativas (não canceladas)
      const today = new Date();
      const todayStr = getLocalDateString(today);
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-indexed
      const currentQuarter = Math.floor(currentMonth / 3);

      const stats = {
        dia: { total: 0, qtd: 0 },
        mes: { total: 0, qtd: 0 },
        trimestre: { total: 0, qtd: 0 }
      };

      mySales.filter(p => p.status !== 'Cancelado').forEach(p => {
        const pDate = new Date(p.data);
        const pDateStr = getLocalDateString(pDate);
        
        // Dia
        if (pDateStr === todayStr) {
          stats.dia.total += p.total;
          stats.dia.qtd += 1;
        }

        // Mês
        if (pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth) {
          stats.mes.total += p.total;
          stats.mes.qtd += 1;
        }

        // Trimestre
        const pQuarter = Math.floor(pDate.getMonth() / 3);
        if (pDate.getFullYear() === currentYear && pQuarter === currentQuarter) {
          stats.trimestre.total += p.total;
          stats.trimestre.qtd += 1;
        }
      });

      setReportData(stats);

    } else {
      // Mapear parcelas com clientes e pedidos correspondentes (para admin/outros)
      const mapped = db.parcelas
        .filter(par => {
          const ped = db.pedidos.find(p => p.id === par.pedido_id) || {};
          return user && (user.perfil === 'Administrador' || ped.vendedor_id === user.id);
        })
        .map(par => {
          const ped = db.pedidos.find(p => p.id === par.pedido_id) || {};
          const client = db.clientes.find(c => c.id === ped.cliente_id) || {};
          
          return {
            ...par,
            clienteNome: client.nome || 'Cliente Desconhecido',
            pedidoNumero: ped.numero || 'N/A',
            pedidoStatus: ped.status || ''
          };
        });

      // Ordenar parcelas pendentes primeiro, e por vencimento
      mapped.sort((a, b) => {
        if (a.pago === b.pago) {
          return new Date(a.vencimento) - new Date(b.vencimento);
        }
        return a.pago ? 1 : -1;
      });

      setInstallments(mapped);
    }
  };

  useEffect(() => {
    loadFinancialData();
    window.addEventListener('fortegado_db_update', loadFinancialData);
    return () => window.removeEventListener('fortegado_db_update', loadFinancialData);
  }, []);

  const handleReceive = (item) => {
    if (!window.confirm(`Confirmar recebimento do valor de R$ ${item.valor.toFixed(2)} referente à parcela do pedido ${item.pedidoNumero}?`)) {
      return;
    }

    receiveInstallmentLocal(item.id);
    setSuccessMsg(`Recebimento da parcela do pedido ${item.pedidoNumero} registrado com sucesso!`);
    loadFinancialData();

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Filtrar parcelas
  const filteredInstallments = installments.filter(item => {
    if (item.pedidoStatus === 'Cancelado') return false;
    const term = searchTerm.toLowerCase();
    return (
      item.clienteNome.toLowerCase().includes(term) ||
      item.pedidoNumero.toLowerCase().includes(term)
    );
  });

  // Filtrar vendas
  const filteredVendas = vendas.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.clienteNome.toLowerCase().includes(term) ||
      item.numero.toLowerCase().includes(term)
    );
  });

  const totalPendente = filteredInstallments
    .filter(i => !i.pago)
    .reduce((acc, curr) => acc + curr.valor, 0);

  // RENDERIZAÇÃO DO VENDEDOR (VENDAS REALIZADAS + RELATÓRIO)
  if (isVendedor) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', margin: 0, fontWeight: '700' }}>
            Minhas Vendas Realizadas
          </h2>
          <button
            className="btn btn-cta"
            onClick={() => setShowReport(true)}
            style={{
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontWeight: 'bold',
              borderRadius: '8px'
            }}
          >
            <BarChart2 size={16} />
            Relatório de Vendas
          </button>
        </div>

        {/* Caixa de busca */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Pesquisar por cliente ou número do pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
        </div>

        {/* Tabela de Vendas */}
        <div className="card" style={{ padding: '10px', overflowX: 'auto' }}>
          {filteredVendas.length > 0 ? (
            <table className="data-table" style={{ width: '100%', minWidth: '500px' }}>
              <thead>
                <tr>
                  <th>Nº Pedido</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredVendas.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span style={{ fontWeight: 'bold' }}>{item.numero}</span>
                    </td>
                    <td>{item.clienteNome}</td>
                    <td>{new Date(item.data).toLocaleDateString('pt-BR')} {new Date(item.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      {item.status === 'Entregue' ? (
                        <span className="badge badge-entregue">Entregue</span>
                      ) : item.status === 'Cancelado' ? (
                        <span className="badge badge-cancelado" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--vermelho)' }}>Cancelado</span>
                      ) : (
                        <span className="badge badge-pendente">Emitido</span>
                      )}
                    </td>
                    <td className="text-right" style={{ fontWeight: 'bold' }}>
                      R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--cinza-medio)' }}>
              <AlertCircle size={32} style={{ marginBottom: '8px' }} />
              <p>Nenhuma venda encontrada.</p>
            </div>
          )}
        </div>

        {/* Modal do Relatório */}
        {showReport && (
          <div className="modal-overlay" onClick={() => setShowReport(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={20} /> Relatório de Vendas
                </h3>
                <button
                  onClick={() => setShowReport(false)}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', outline: 'none' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Dia */}
                  <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, padding: '16px', borderLeft: '4px solid var(--azul-secundario)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--azul-principal)' }}>Vendas do Dia (Hoje)</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--cinza-medio)' }}>{reportData.dia.qtd} {reportData.dia.qtd === 1 ? 'venda' : 'vendas'}</div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--azul-principal)' }}>
                      R$ {reportData.dia.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Mês */}
                  <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, padding: '16px', borderLeft: '4px solid var(--verde-escuro)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--verde-escuro)' }}>Vendas do Mês</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--cinza-medio)' }}>{reportData.mes.qtd} {reportData.mes.qtd === 1 ? 'venda' : 'vendas'}</div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--verde-escuro)' }}>
                      R$ {reportData.mes.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Trimestre */}
                  <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, padding: '16px', borderLeft: '4px solid var(--amarelo-cta)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#D97706' }}>Vendas do Trimestre</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--cinza-medio)' }}>{reportData.trimestre.qtd} {reportData.trimestre.qtd === 1 ? 'venda' : 'vendas'}</div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#D97706' }}>
                      R$ {reportData.trimestre.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowReport(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDERIZAÇÃO DO ADMINISTRADOR / FINANCEIRO PADRÃO
  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', marginBottom: '16px', fontWeight: '700' }}>
        Contas a Receber (Financeiro)
      </h2>

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.9rem',
          backgroundColor: 'rgba(90, 158, 26, 0.1)',
          color: 'var(--verde-escuro)',
          border: '1px solid rgba(90, 158, 26, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Caixa de busca e resumo de totais */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Pesquisar por cliente ou número do pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
        </div>

        <div className="card" style={{
          backgroundColor: 'rgba(90, 158, 26, 0.05)',
          borderColor: 'rgba(90, 158, 26, 0.15)',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--verde-escuro)', fontWeight: '700' }}>
            <DollarSign size={20} /> Saldo Total Pendente
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--verde-escuro)' }}>
            R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Tabela de parcelas */}
      <div className="card" style={{ padding: '10px', overflowX: 'auto' }}>
        {filteredInstallments.length > 0 ? (
          <table className="data-table" style={{ width: '100%', minWidth: '500px' }}>
            <thead>
              <tr>
                <th>Cliente / Pedido</th>
                <th>Vencimento</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                {isAdmin && <th>Ação</th>}
              </tr>
            </thead>
            <tbody>
              {filteredInstallments.map(item => (
                <tr key={item.id} style={{ opacity: item.pago ? 0.6 : 1 }}>
                  <td>
                    <div style={{ fontWeight: '600' }}>{item.clienteNome}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--cinza-medio)' }}>Pedido Ref: {item.pedidoNumero}</div>
                  </td>
                  <td>{new Date(item.vencimento).toLocaleDateString('pt-BR')}</td>
                  <td className="text-right" style={{ fontWeight: 'bold' }}>
                    R$ {item.valor.toFixed(2)}
                  </td>
                  <td>
                    {item.pago ? (
                      <span className="badge badge-entregue">Pago</span>
                    ) : (
                      <span className="badge badge-pendente">Aberto</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      {!item.pago && (
                        <button
                          className="btn btn-cta"
                          onClick={() => handleReceive(item)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.75rem',
                            width: 'auto',
                            display: 'flex',
                            gap: '4px',
                            alignItems: 'center',
                            fontWeight: '700'
                          }}
                        >
                          Receber
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--cinza-medio)' }}>
            <AlertCircle size={32} style={{ marginBottom: '8px' }} />
            <p>Nenhuma parcela encontrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
