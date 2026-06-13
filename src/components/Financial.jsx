import React, { useState, useEffect } from 'react';
import { DollarSign, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { getDb, getCredentials, receiveInstallmentLocal } from '../services/db';

export default function Financial() {
  const [installments, setInstallments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadFinancialData = () => {
    const db = getDb();
    const creds = getCredentials();
    
    // Identificar perfil
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId));
    setIsAdmin(user && user.perfil === 'Administrador');

    // Mapear parcelas com clientes e pedidos correspondentes
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
  const filtered = installments.filter(item => {
    // Não exibir parcelas de pedidos cancelados
    if (item.pedidoStatus === 'Cancelado') return false;

    const term = searchTerm.toLowerCase();
    return (
      item.clienteNome.toLowerCase().includes(term) ||
      item.pedidoNumero.toLowerCase().includes(term)
    );
  });

  const totalPendente = filtered
    .filter(i => !i.pago)
    .reduce((acc, curr) => acc + curr.valor, 0);

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
        {filtered.length > 0 ? (
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
              {filtered.map(item => (
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
