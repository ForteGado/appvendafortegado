import React, { useState, useEffect } from 'react';
import { Home, ShoppingBag, Truck, Package, DollarSign, Settings as SettingsIcon } from 'lucide-react';

// Importando componentes
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import Deliveries from './components/Deliveries';
import StockManager from './components/StockManager';
import Financial from './components/Financial';
import Settings from './components/Settings';
import OfflineIndicator from './components/OfflineIndicator';

import { getDb, getCredentials } from './services/db';

export default function App() {
  const [view, setView] = useState('dashboard'); // dashboard, novo-pedido, entregas, estoque, financeiro, configuracoes
  const [currentUser, setCurrentUser] = useState(null);

  const loadUser = () => {
    const db = getDb();
    const creds = getCredentials();
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId)) || db.usuarios[0];
    setCurrentUser(user);
  };

  useEffect(() => {
    loadUser();
    window.addEventListener('fortegado_credentials_update', loadUser);
    window.addEventListener('fortegado_db_update', loadUser);
    return () => {
      window.removeEventListener('fortegado_credentials_update', loadUser);
      window.removeEventListener('fortegado_db_update', loadUser);
    };
  }, []);

  return (
    <div className="app-container">
      {/* Header Fixo */}
      <header>
        <div className="header-logo-container" onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>
          <span style={{ fontSize: '24px' }}>🐂</span>
          <div className="header-title">
            <h1>Forte Gado</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--amarelo-cta)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Vendas & Estoque
            </span>
          </div>
        </div>
        <div className="header-meta">
          <div style={{ fontWeight: 'bold' }}>{currentUser ? currentUser.nome : 'Carregando...'}</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{currentUser ? currentUser.perfil : ''}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {/* Barra de Status e Sincronização Offline */}
        <OfflineIndicator />

        {/* Roteador de Telas */}
        {view === 'dashboard' && <Dashboard setView={setView} />}
        {view === 'novo-pedido' && <OrderForm setView={setView} />}
        {view === 'entregas' && <Deliveries />}
        {view === 'estoque' && <StockManager />}
        {view === 'financeiro' && <Financial />}
        {view === 'configuracoes' && <Settings setView={setView} />}
      </main>

      {/* Navegação Inferior (Mobile-first, Premium) */}
      <nav style={{
        backgroundColor: 'var(--azul-principal)',
        borderTop: '2px solid var(--dourado-premium)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '8px 0',
        position: 'sticky',
        bottom: 0,
        zIndex: 100
      }}>
        {/* Home */}
        <button 
          onClick={() => setView('dashboard')} 
          style={navItemStyle(view === 'dashboard')}
        >
          <Home size={20} />
          <span>Início</span>
        </button>

        {/* Novo Pedido */}
        <button 
          onClick={() => setView('novo-pedido')} 
          style={navItemStyle(view === 'novo-pedido')}
        >
          <ShoppingBag size={20} />
          <span>Vender</span>
        </button>

        {/* Entregas */}
        <button 
          onClick={() => setView('entregas')} 
          style={navItemStyle(view === 'entregas')}
        >
          <Truck size={20} />
          <span>Entregas</span>
        </button>

        {/* Estoque */}
        <button 
          onClick={() => setView('estoque')} 
          style={navItemStyle(view === 'estoque')}
        >
          <Package size={20} />
          <span>Estoque</span>
        </button>

        {/* Financeiro */}
        <button 
          onClick={() => setView('financeiro')} 
          style={navItemStyle(view === 'financeiro')}
        >
          <DollarSign size={20} />
          <span>Contas</span>
        </button>

        {/* Configurações */}
        <button 
          onClick={() => setView('configuracoes')} 
          style={navItemStyle(view === 'configuracoes')}
        >
          <SettingsIcon size={20} />
          <span>Painel</span>
        </button>
      </nav>

      {/* Footer */}
      <footer>
        Forte Gado © 2026 – Todos os direitos reservados.
      </footer>
    </div>
  );
}

// Estilo dos botões da Tab Bar inferior
const navItemStyle = (isActive) => ({
  background: 'none',
  border: 'none',
  color: isActive ? 'var(--amarelo-cta)' : '#FFFFFF',
  opacity: isActive ? 1 : 0.75,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  cursor: 'pointer',
  padding: '6px 12px',
  fontSize: '0.68rem',
  fontWeight: 'bold',
  transition: 'all 0.2s ease',
  transform: isActive ? 'scale(1.08)' : 'scale(1)'
});
