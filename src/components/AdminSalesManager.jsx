import React, { useState, useEffect } from 'react';
import { FileText, Search, User, AlertCircle, Calendar, TrendingUp } from 'lucide-react';
import { getDb, getLocalDateString } from '../services/db';

export default function AdminSalesManager() {
  const [vendedores, setVendedores] = useState([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));
  const [sales, setSales] = useState([]);
  const [totalSales, setTotalSales] = useState(0);

  const loadInitialData = () => {
    const db = getDb();
    // Filtrar todos os usuários vendedores (ativos e inativos), ordenados alfabeticamente
    const vends = db.usuarios
      .filter(u => u.perfil === 'Vendedor')
      .sort((a, b) => a.nome.localeCompare(b.nome));
    setVendedores(vends);
    if (vends.length > 0) {
      setSelectedVendedorId(vends[0].id);
    }
  };

  const loadSales = () => {
    if (!selectedVendedorId) return;
    const db = getDb();
    const vendedorId = Number(selectedVendedorId);

    // Filtrar pedidos do vendedor na data selecionada (não cancelados)
    const filtered = db.pedidos
      .filter(p => {
        const pDateStr = getLocalDateString(new Date(p.data));
        return p.vendedor_id === vendedorId && pDateStr === selectedDate && p.status !== 'Cancelado';
      })
      .map(p => {
        const client = db.clientes.find(c => c.id === p.cliente_id) || {};
        return {
          ...p,
          clienteNome: client.nome || 'Cliente Desconhecido',
          clienteCidade: client.cidade || 'N/A'
        };
      });

    // Ordenar decrescente por data/hora
    filtered.sort((a, b) => new Date(b.data) - new Date(a.data));
    setSales(filtered);

    const total = filtered.reduce((acc, p) => acc + p.total, 0);
    setTotalSales(total);
  };

  useEffect(() => {
    loadInitialData();
    window.addEventListener('fortegado_db_update', loadInitialData);
    return () => window.removeEventListener('fortegado_db_update', loadInitialData);
  }, []);

  useEffect(() => {
    loadSales();
  }, [selectedVendedorId, selectedDate]);

  useEffect(() => {
    const handleDbUpdate = () => loadSales();
    window.addEventListener('fortegado_db_update', handleDbUpdate);
    return () => window.removeEventListener('fortegado_db_update', handleDbUpdate);
  }, [selectedVendedorId, selectedDate]);

  const handleExportPDF = () => {
    if (!selectedVendedorId) return;
    const db = getDb();
    const vendedor = db.usuarios.find(u => u.id === Number(selectedVendedorId));
    if (!vendedor) return;

    const empresa = db.empresas?.[0] || { nome: 'Forte Gado', logotipo: '🐂' };
    const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR');

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Forte Gado - Vendas do Dia - ${vendedor.nome}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #002E73; padding-bottom: 15px; margin-bottom: 20px; }
            .logo { font-size: 24px; font-weight: bold; color: #002E73; display: flex; align-items: center; gap: 8px; }
            .title { text-align: right; }
            .title h1 { margin: 0; font-size: 20px; color: #002E73; }
            .title p { margin: 5px 0 0 0; font-size: 12px; color: #666; }
            .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 16px; background: #f9f9f9; border-left: 4px solid #002E73; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; }
            .card-value { font-size: 18px; font-weight: bold; color: #002E73; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background-color: #002E73; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
            td { padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 11px; }
            tr:nth-child(even) { background-color: #fcfcfc; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
            .badge-entregue { background-color: #DEF7EC; color: #03543F; }
            .badge-emitido { background-color: #E1EFFE; color: #1E429F; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
            .text-right { text-align: right; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
              ${empresa.logotipo && empresa.logotipo.startsWith('data:') ? `
                <img src="${empresa.logotipo}" alt="Logo" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;" />
              ` : `
                <span>${empresa.logotipo || '🐂'}</span>
              `}
              <span>${empresa.nome || 'Forte Gado'}</span>
            </div>
            <div class="title">
              <h1>Relatório de Vendas por Vendedor</h1>
              <p>Vendedor: <strong>${vendedor.nome}</strong> | Data: ${dateFormatted}</p>
            </div>
          </div>

          <div class="summary-card">
            <div>
              <div class="card-title">Total Vendido na Data</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">Quantidade de Vendas: <strong>${sales.length}</strong></div>
            </div>
            <div class="card-value">R$ ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Cliente (Comprador)</th>
                <th>Cidade</th>
                <th>Hora</th>
                <th>Status</th>
                <th class="text-right">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${sales.length > 0 ? sales.map(p => `
                <tr>
                  <td><strong>${p.numero}</strong></td>
                  <td>${p.clienteNome}</td>
                  <td>${p.clienteCidade}</td>
                  <td>${new Date(p.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>
                    <span class="badge ${p.status === 'Entregue' ? 'badge-entregue' : 'badge-emitido'}">
                      ${p.status}
                    </span>
                  </td>
                  <td class="text-right"><strong>R$ ${p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="6" style="text-align: center; color: #999; padding: 20px;">
                    Nenhuma venda realizada por este vendedor nesta data.
                  </td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="footer">
            ${empresa.nome || 'Forte Gado'} © 2026 - Relatório gerencial de controle diário de vendas por vendedor.
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', margin: 0, fontWeight: '700' }}>
          Vendas por Vendedor
        </h2>
        {selectedVendedorId && (
          <button
            className="btn btn-secondary"
            onClick={handleExportPDF}
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
            <FileText size={16} />
            Exportar PDF
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '6px' }}>
            <User size={16} /> Selecionar Vendedor
          </label>
          <select
            className="form-control"
            value={selectedVendedorId}
            onChange={(e) => setSelectedVendedorId(e.target.value)}
          >
            {vendedores.length > 0 ? (
              vendedores.map(v => (
                <option key={v.id} value={v.id}>
                  {v.nome}{!v.ativo ? ' (Inativo)' : ''}
                </option>
              ))
            ) : (
              <option value="">Nenhum vendedor cadastrado</option>
            )}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', marginBottom: '6px' }}>
            <Calendar size={16} /> Data das Vendas
          </label>
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* KPI de Faturamento do Dia */}
      <div className="card" style={{
        backgroundColor: 'rgba(22, 101, 184, 0.05)',
        borderColor: 'rgba(22, 101, 184, 0.15)',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        margin: '0 0 16px 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--azul-principal)', fontWeight: '700' }}>
          <TrendingUp size={20} /> Faturamento na Data
        </div>
        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--azul-principal)' }}>
          R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="card" style={{ padding: '10px', overflowX: 'auto' }}>
        {sales.length > 0 ? (
          <table className="data-table" style={{ width: '100%', minWidth: '500px' }}>
            <thead>
              <tr>
                <th>Nº Pedido</th>
                <th>Cliente (Comprador)</th>
                <th>Cidade</th>
                <th>Hora</th>
                <th>Status</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(item => (
                <tr key={item.id}>
                  <td>
                    <span style={{ fontWeight: 'bold' }}>{item.numero}</span>
                  </td>
                  <td>{item.clienteNome}</td>
                  <td>{item.clienteCidade}</td>
                  <td>
                    {new Date(item.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    {item.status === 'Entregue' ? (
                      <span className="badge badge-entregue">Entregue</span>
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
            <p>Nenhuma venda encontrada para este vendedor nesta data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
