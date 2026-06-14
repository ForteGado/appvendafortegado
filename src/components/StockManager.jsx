import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, CheckCircle, Sliders } from 'lucide-react';
import { getDb, getCredentials, adjustStockLocal } from '../services/db';

export default function StockManager() {
  const [stockList, setStockList] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustMin, setAdjustMin] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');

  const loadStock = () => {
    const db = getDb();
    const creds = getCredentials();
    
    // Identificar perfil
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId));
    setIsAdmin(user && user.perfil === 'Administrador');

    // Mapear estoque com nomes do produto
    const resolvedStock = db.estoque.map(est => {
      const prod = db.produtos.find(p => p.id === est.produto_id) || {};
      const disponivel = est.quantidade_atual - est.quantidade_reservada;
      
      let status = 'ok';
      if (disponivel <= 0) {
        status = 'zerado';
      } else if (disponivel <= est.estoque_minimo) {
        status = 'baixo';
      }

      return {
        ...est,
        nome: prod.nome || 'Produto Indefinido',
        codigo: prod.codigo || 'N/A',
        unidade: prod.unidade || 'un',
        preco: prod.preco || 0,
        imagem: prod.imagem || null,
        disponivel,
        status
      };
    });

    setStockList(resolvedStock);
  };

  useEffect(() => {
    loadStock();
    window.addEventListener('fortegado_db_update', loadStock);
    return () => window.removeEventListener('fortegado_db_update', loadStock);
  }, []);

  const handleOpenAdjust = (item) => {
    setEditingItem(item);
    setAdjustQty(item.quantidade_atual);
    setAdjustMin(item.estoque_minimo);
  };

  const handleSaveAdjust = (e) => {
    e.preventDefault();
    if (!editingItem) return;

    // Chamar função de ajuste local
    adjustStockLocal(editingItem.produto_id, adjustQty, adjustMin);
    
    setSuccessMsg(`Estoque de "${editingItem.nome}" ajustado com sucesso!`);
    setEditingItem(null);
    loadStock();

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', marginBottom: '16px', fontWeight: '700' }}>
        Controle de Estoque Físico
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

      {/* Tabela de Estoque */}
      <div className="card" style={{ padding: '10px', overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '500px' }}>
          <thead>
            <tr>
              <th>Cód. / Produto</th>
              <th className="text-right">Físico</th>
              <th className="text-right">Reservado</th>
              <th className="text-right">Disponível</th>
              <th>Status</th>
              {isAdmin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {stockList.map(item => (
              <tr key={item.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '4px', flexShrink: 0,
                      backgroundColor: 'white', border: '1px solid var(--cinza-claro)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', fontSize: '1rem'
                    }}>
                      {item.imagem
                        ? (item.imagem.startsWith('data:')
                          ? <img src={item.imagem} alt={item.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span>{item.imagem}</span>)
                        : <Package size={16} color="var(--cinza-medio)" />
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: '600' }}>{item.nome}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--cinza-medio)' }}>Cód: {item.codigo} | {item.unidade}</div>
                    </div>
                  </div>
                </td>
                <td className="text-right" style={{ fontWeight: 'bold' }}>{item.quantidade_atual}</td>
                <td className="text-right" style={{ color: 'var(--cinza-medio)' }}>{item.quantidade_reservada}</td>
                <td className="text-right" style={{ 
                  fontWeight: '800', 
                  color: item.status === 'zerado' ? 'var(--vermelho-cancelar)' : item.status === 'baixo' ? 'var(--dourado-premium)' : 'var(--verde-escuro)' 
                }}>
                  {item.disponivel}
                </td>
                <td>
                  {item.status === 'zerado' && (
                    <span className="badge badge-cancelado" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                      <AlertTriangle size={10} /> Esgotado
                    </span>
                  )}
                  {item.status === 'baixo' && (
                    <span className="badge badge-pendente">Baixo</span>
                  )}
                  {item.status === 'ok' && (
                    <span className="badge badge-entregue">Disponível</span>
                  )}
                </td>
                {isAdmin && (
                  <td>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenAdjust(item)}
                      style={{ padding: '6px 10px', fontSize: '0.75rem', width: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                      <Sliders size={12} /> Ajustar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de Ajuste de Estoque (Administrador) */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.1rem' }}>Ajustar Estoque – Admin</h3>
              <button 
                type="button" 
                onClick={() => setEditingItem(null)} 
                style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveAdjust}>
              <div className="modal-body">
                <p style={{ marginBottom: '14px', fontSize: '0.9rem' }}>
                  Ajustando estoque físico para: <strong style={{ color: 'var(--azul-principal)' }}>{editingItem.nome}</strong>
                </p>
                
                <div className="form-group">
                  <label>Quantidade Atual Física em Estoque</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(Math.max(0, Number(e.target.value)))}
                    required
                  />
                  <small style={{ color: 'var(--cinza-medio)' }}>
                    Estoque Reservado ativo: <strong>{editingItem.quantidade_reservada}</strong>. 
                    A quantidade disponível será de: <strong>{adjustQty - editingItem.quantidade_reservada}</strong>.
                  </small>
                </div>

                <div className="form-group">
                  <label>Estoque Mínimo de Alerta</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={adjustMin}
                    onChange={(e) => setAdjustMin(Math.max(0, Number(e.target.value)))}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEditingItem(null)}
                  style={{ width: 'auto' }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
