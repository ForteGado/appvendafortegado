import React, { useState, useEffect } from 'react';
import { ShoppingBag, Truck, Package, DollarSign, Settings, BarChart2, TrendingUp, AlertTriangle } from 'lucide-react';
import { getDb, getCredentials, getLocalDateString } from '../services/db';

export default function Dashboard({ setView }) {
  const [metrics, setMetrics] = useState({
    vendasHoje: 0,
    estoqueBaixoCount: 0,
    contasReceber: 0,
    entregasPendentes: 0,
    clientesAtivos: 0
  });

  const [currentUser, setCurrentUser] = useState(null);

  const calculateMetrics = () => {
    const db = getDb();
    const creds = getCredentials();
    
    // Identificar usuário logado
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId)) || db.usuarios[0];
    setCurrentUser(user);

    // Vendas hoje (emissão hoje)
    const hojeStr = getLocalDateString(new Date());
    const pedidosHoje = db.pedidos.filter(p => {
      const pedDataStr = getLocalDateString(new Date(p.data));
      const matchesUser = user.perfil === 'Administrador' || p.vendedor_id === user.id;
      return pedDataStr === hojeStr && p.status !== 'Cancelado' && matchesUser;
    });
    const totalHoje = pedidosHoje.reduce((acc, curr) => acc + curr.total, 0);

    // Estoque baixo (sempre global)
    const estoqueBaixo = db.estoque.filter(est => {
      const disponivel = est.quantidade_atual - est.quantidade_reservada;
      return disponivel <= est.estoque_minimo;
    }).length;

    // Contas a receber (parcelas não pagas e não canceladas, filtradas por vendedor se necessário)
    const canceladosIds = db.pedidos.filter(p => p.status === 'Cancelado').map(p => p.id);
    const parcelasPendentes = db.parcelas.filter(par => {
      const ped = db.pedidos.find(p => p.id === par.pedido_id) || {};
      const matchesUser = user.perfil === 'Administrador' || ped.vendedor_id === user.id;
      return !par.pago && !canceladosIds.includes(par.pedido_id) && matchesUser;
    });
    const totalReceber = parcelasPendentes.reduce((acc, curr) => acc + curr.valor, 0);

    // Entregas pendentes (pedidos com status "Emitido", filtrados por vendedor se necessário)
    const pendentes = db.pedidos.filter(p => {
      const matchesUser = user.perfil === 'Administrador' || p.vendedor_id === user.id;
      return p.status === 'Emitido' && matchesUser;
    }).length;

    // Clientes ativos (pelo menos 1 pedido não cancelado, filtrados por vendedor se necessário)
    const pedidosValidos = db.pedidos.filter(p => {
      const matchesUser = user.perfil === 'Administrador' || p.vendedor_id === user.id;
      return p.status !== 'Cancelado' && matchesUser;
    });
    const clientesIdsUnicos = new Set(pedidosValidos.map(p => p.cliente_id));
    
    setMetrics({
      vendasHoje: totalHoje,
      estoqueBaixoCount: estoqueBaixo,
      contasReceber: totalReceber,
      entregasPendentes: pendentes,
      clientesAtivos: clientesIdsUnicos.size
    });
  };

  useEffect(() => {
    calculateMetrics();
    window.addEventListener('fortegado_db_update', calculateMetrics);
    window.addEventListener('fortegado_credentials_update', calculateMetrics);
    return () => {
      window.removeEventListener('fortegado_db_update', calculateMetrics);
      window.removeEventListener('fortegado_credentials_update', calculateMetrics);
    };
  }, []);

  return (
    <div>
      {/* Bem vindo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--azul-principal)', fontWeight: '700' }}>
            Olá, {currentUser ? currentUser.nome : 'Carregando...'}
          </h2>
          <p style={{ color: 'var(--cinza-medio)', fontSize: '0.85rem' }}>
            Perfil: <strong style={{ color: 'var(--azul-secundario)' }}>{currentUser ? currentUser.perfil : ''}</strong>
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--cinza-medio)' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Grid de KPIs */}
      <div className="dashboard-grid">
        <div className="card kpi-card kpi-vendas" onClick={() => setView('financeiro')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} color="var(--azul-principal)" /> Vendas Hoje
          </div>
          <div className="kpi-value" style={{ color: 'var(--azul-principal)' }}>
            R$ {metrics.vendasHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card kpi-card kpi-estoque" onClick={() => setView('estoque')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Package size={14} color="var(--dourado-premium)" /> Estoque Crítico
          </div>
          <div className="kpi-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: metrics.estoqueBaixoCount > 0 ? 'var(--vermelho-cancelar)' : 'inherit' }}>
            {metrics.estoqueBaixoCount} 
            {metrics.estoqueBaixoCount > 0 && <AlertTriangle size={18} color="var(--vermelho-cancelar)" />}
          </div>
        </div>

        <div className="card kpi-card kpi-financeiro" onClick={() => setView('financeiro')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} color="var(--amarelo-cta)" /> A Receber
          </div>
          <div className="kpi-value" style={{ color: 'var(--verde-escuro)' }}>
            R$ {metrics.contasReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="card kpi-card kpi-entregas" onClick={() => setView('entregas')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Truck size={14} color="var(--verde-agro)" /> Entregas Pendentes
          </div>
          <div className="kpi-value" style={{ color: 'var(--verde-agro)' }}>
            {metrics.entregasPendentes}
          </div>
        </div>
      </div>

      {/* Atalhos Rápidos */}
      <h3 style={{ fontSize: '1.05rem', marginBottom: '14px', fontWeight: '700' }}>Atalhos do Sistema</h3>
      <div className="shortcuts-grid">
        <button className="shortcut-btn" onClick={() => setView('novo-pedido')}>
          <ShoppingBag />
          <span>Novo Pedido</span>
        </button>

        <button className="shortcut-btn" onClick={() => setView('entregas')}>
          <Truck />
          <span>Entregas</span>
        </button>

        <button className="shortcut-btn" onClick={() => setView('estoque')}>
          <Package />
          <span>Estoque</span>
        </button>

        <button className="shortcut-btn" onClick={() => setView('financeiro')}>
          <DollarSign />
          <span>Financeiro</span>
        </button>

        <button className="shortcut-btn" onClick={() => setView('configuracoes')}>
          <Settings />
          <span>Configurações</span>
        </button>

        <button 
          className="shortcut-btn" 
          onClick={() => {
            const creds = getCredentials();
            if (creds.googleSheetsUrl) {
              window.open(creds.googleSheetsUrl, '_blank');
            } else {
              alert('Configure a URL da planilha nas configurações primeiro.');
            }
          }}
        >
          <BarChart2 />
          <span>Planilha</span>
        </button>
      </div>

      {/* Destaque Institucional */}
      <div className="card" style={{
        backgroundImage: 'linear-gradient(135deg, var(--azul-principal), var(--azul-secundario))',
        color: 'white',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '24px'
      }}>
        <h4 style={{ color: 'var(--amarelo-cta)', fontSize: '1.1rem', fontWeight: '700' }}>Forte Gado Premium</h4>
        <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.5 }}>
          Aplicativo de campo integrado para controle de vendas e estoque físico de rações, suplementos e produtos agropecuários.
        </p>
      </div>
    </div>
  );
}
