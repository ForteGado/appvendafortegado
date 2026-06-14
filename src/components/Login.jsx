import React, { useState } from 'react';
import { User, LogIn, AlertCircle } from 'lucide-react';
import { getDb, getCredentials, saveCredentials } from '../services/db';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [empresa, setEmpresa] = useState(() => {
    const db = getDb();
    return db.empresas?.[0] || { nome: 'Forte Gado', logotipo: '🐂' };
  });

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email) {
      setErrorMsg('Por favor, informe seu e-mail.');
      return;
    }

    const db = getDb();
    const user = db.usuarios.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      setErrorMsg('E-mail não cadastrado no sistema ou usuário inativo.');
      return;
    }

    if (!user.ativo) {
      setErrorMsg('Este usuário está desativado no sistema.');
      return;
    }

    // Gravar usuário ativo nas credenciais
    const creds = getCredentials();
    creds.activeUserId = user.id;
    saveCredentials(creds);

    // Notificar App para recarregar
    onLogin();
  };

  const handleQuickLogin = (userEmail) => {
    setEmail(userEmail);
    const db = getDb();
    const user = db.usuarios.find(u => u.email === userEmail);
    if (user) {
      const creds = getCredentials();
      creds.activeUserId = user.id;
      saveCredentials(creds);
      onLogin();
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '20px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '30px',
        boxShadow: 'var(--shadow-lg)',
        border: '1.5px solid var(--cinza-claro)'
      }}>
        {/* Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {empresa.logotipo && empresa.logotipo.startsWith('data:') ? (
            <img
              src={empresa.logotipo}
              alt="Logo"
              style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 8px', border: '2px solid var(--azul-principal)' }}
            />
          ) : (
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>{empresa.logotipo || '🐂'}</span>
          )}
          <h2 style={{ fontSize: '1.6rem', color: 'var(--azul-principal)', fontWeight: '800', margin: 0 }}>
            {empresa.nome || 'Forte Gado'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--dourado-premium)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Vendas & Estoque Agro
          </span>
        </div>

        {errorMsg && (
          <div className="alert-box alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>Identificação por E-mail</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-control"
                placeholder="Ex: silva@fortegado.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '40px', width: '100%' }}
                required
              />
              <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ fontWeight: '700', padding: '12px' }}>
            <LogIn size={18} /> Entrar no App
          </button>
        </form>

        {/* Quick select users list */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--cinza-claro)' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--cinza-medio)', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
            Acesso Rápido para Teste
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => handleQuickLogin('prado@fortegado.com.br')}
              style={quickButtonStyle('var(--azul-principal)')}
            >
              <strong>Wislley Prado</strong> (Administrador)
              <span style={{ fontSize: '0.7rem', opacity: 0.8, display: 'block' }}>prado@fortegado.com.br</span>
            </button>

            <button
              onClick={() => handleQuickLogin('silva@fortegado.com.br')}
              style={quickButtonStyle('var(--azul-secundario)')}
            >
              <strong>Silva Vendedor</strong> (Vendedor)
              <span style={{ fontSize: '0.7rem', opacity: 0.8, display: 'block' }}>silva@fortegado.com.br</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const quickButtonStyle = (color) => ({
  background: 'none',
  border: `1.5px solid ${color}`,
  borderRadius: '8px',
  color: color,
  padding: '8px 12px',
  fontSize: '0.8rem',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s',
  outline: 'none',
  ':hover': {
    backgroundColor: 'rgba(10, 46, 115, 0.03)'
  }
});
