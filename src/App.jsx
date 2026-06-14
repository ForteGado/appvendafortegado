import React, { useState, useEffect } from 'react';
import { Home, ShoppingBag, Truck, Package, DollarSign, ShieldCheck, LogOut } from 'lucide-react';

// Importando componentes
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import Deliveries from './components/Deliveries';
import StockManager from './components/StockManager';
import Financial from './components/Financial';
import AdminPanel from './components/AdminPanel';
import OfflineIndicator from './components/OfflineIndicator';
import Login from './components/Login';
import Settings from './components/Settings';

import { getDb, getCredentials, saveCredentials } from './services/db';
import { downloadDataFromSupabase } from './services/supabaseService';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState(null);
  const [empresa, setEmpresa] = useState({ nome: 'Forte Gado', logotipo: '🐂' });

  const loadUser = () => {
    const db = getDb();
    const creds = getCredentials();
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId));
    setCurrentUser(user || null);
  };

  const loadEmpresa = () => {
    const db = getDb();
    if (db.empresas?.[0]) setEmpresa(db.empresas[0]);
  };

  useEffect(() => {
    loadUser();
    loadEmpresa();

    // Sincronizar/Baixar os dados mais recentes do Supabase na inicialização
    const syncOnStartup = async () => {
      try {
        const res = await downloadDataFromSupabase();
        if (res.success) {
          console.log('[Supabase] Dados baixados com sucesso:', res.counts);
          loadUser();
          loadEmpresa();
          // Notifica todos os componentes que os dados foram atualizados
          window.dispatchEvent(new Event('fortegado_db_update'));
        } else {
          console.warn('[Supabase] Falha no download inicial:', res.reason);
        }
      } catch (e) {
        console.error('[Supabase] Erro inesperado na sincronização inicial:', e);
      }
    };
    syncOnStartup();

    window.addEventListener('fortegado_credentials_update', loadUser);
    window.addEventListener('fortegado_db_update', loadUser);
    window.addEventListener('fortegado_db_update', loadEmpresa);
    return () => {
      window.removeEventListener('fortegado_credentials_update', loadUser);
      window.removeEventListener('fortegado_db_update', loadUser);
      window.removeEventListener('fortegado_db_update', loadEmpresa);
    };
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.perfil !== 'Administrador' && view === 'admin') {
      setView('dashboard');
    }
  }, [currentUser, view]);

  if (!currentUser) {
    return <Login onLogin={loadUser} />;
  }

  return (
    <div className="app-container">
      {/* Header Fixo */}
      <header>
        <div className="header-logo-container" onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>
          {/* Logo dinâmica — lida do banco de dados */}
          {empresa.logotipo && empresa.logotipo.startsWith('data:') ? (
            <img
              src={empresa.logotipo}
              alt="Logo"
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }}
            />
          ) : (
            <span style={{ fontSize: '24px' }}>{empresa.logotipo || '🐂'}</span>
          )}
          <div className="header-title">
            <h1>{empresa.nome || 'Forte Gado'}</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--amarelo-cta)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Vendas & Estoque
            </span>
          </div>
        </div>
        <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>{currentUser.nome}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{currentUser.perfil}</div>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Deseja realmente sair do sistema?')) {
                const creds = getCredentials();
                creds.activeUserId = null;
                saveCredentials(creds);
                loadUser();
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'background 0.2s',
              outline: 'none'
            }}
            title="Sair do Sistema"
          >
            <LogOut size={16} />
          </button>
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
        {view === 'admin' && currentUser?.perfil === 'Administrador' && <AdminPanel currentUser={currentUser} />}
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

        {/* Painel Admin (Apenas Administrador) */}
        {currentUser && currentUser.perfil === 'Administrador' && (
          <button 
            onClick={() => setView('admin')} 
            style={navItemStyle(view === 'admin')}
          >
            <ShieldCheck size={20} />
            <span>Admin</span>
          </button>
        )}
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
