import React, { useState } from 'react';
import { User, Lock, LogIn, AlertCircle, UserPlus, ArrowLeft, CheckCircle } from 'lucide-react';
import { getDb, getCredentials, saveCredentials, createUserLocal } from '../services/db';
import { saveUserToSupabase } from '../services/supabaseService';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
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

    // Validar senha
    if (user.senha && user.senha !== password) {
      setErrorMsg('Senha incorreta.');
      return;
    }

    // Gravar usuário ativo nas credenciais
    const creds = getCredentials();
    creds.activeUserId = user.id;
    saveCredentials(creds);

    // Notificar App para recarregar
    onLogin();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!regName || !regEmail || !regPassword) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const db = getDb();
    const emailExists = db.usuarios.some(u => u.email.toLowerCase() === regEmail.trim().toLowerCase());
    if (emailExists) {
      setErrorMsg('Este e-mail já está cadastrado no sistema.');
      return;
    }

    // Criar vendedor inativo localmente
    const newUser = {
      nome: regName.trim(),
      email: regEmail.trim(),
      perfil: 'Vendedor',
      senha: regPassword,
      ativo: false // Deve ser autorizado pelo Administrador
    };

    const created = createUserLocal(newUser);
    
    // Sincronizar com Supabase
    const res = await saveUserToSupabase(created);

    setSuccessMsg('✅ Solicitação enviada! Aguarde a autorização do administrador para poder entrar no app.');
    setIsRegisterMode(false);
    
    // Limpar campos
    setRegName('');
    setRegEmail('');
    setRegPassword('');
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
          <div className="alert-box alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-box alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', marginBottom: '16px', backgroundColor: 'rgba(90, 158, 26, 0.1)', color: 'var(--verde-escuro)', border: '1px solid rgba(90, 158, 26, 0.2)', borderRadius: '6px', fontSize: '0.82rem' }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {!isRegisterMode ? (
          /* TELA DE LOGIN */
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

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>Senha de Acesso</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Sua senha (se cadastrada)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px', width: '100%' }}
                />
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ fontWeight: '700', padding: '12px' }}>
              <LogIn size={18} /> Entrar no App
            </button>

            <button
              type="button"
              onClick={() => { setIsRegisterMode(true); setErrorMsg(''); setSuccessMsg(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--azul-principal)',
                fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer',
                textAlign: 'center', marginTop: '4px', textDecoration: 'underline'
              }}
            >
              Ainda não tem acesso? Solicitar cadastro
            </button>
          </form>
        ) : (
          /* TELA DE CADASTRO (SOLICITAR ACESSO) */
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>Nome Completo *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Seu nome"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  style={{ paddingLeft: '40px', width: '100%' }}
                  required
                />
                <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>E-mail de Acesso *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Ex: joao@fortegado.com.br"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  style={{ paddingLeft: '40px', width: '100%' }}
                  required
                />
                <User size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
              </div>
            </div>

            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: '700' }}>Senha *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Crie uma senha"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{ paddingLeft: '40px', width: '100%' }}
                  required
                />
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--cinza-medio)' }} />
              </div>
            </div>

            <button type="submit" className="btn btn-success" style={{ fontWeight: '700', padding: '12px', backgroundColor: 'var(--verde-agro)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', cursor: 'pointer' }}>
              <UserPlus size={18} /> Solicitar Cadastro
            </button>

            <button
              type="button"
              onClick={() => { setIsRegisterMode(false); setErrorMsg(''); setSuccessMsg(''); }}
              style={{
                background: 'none', border: 'none', color: 'var(--cinza-escuro)',
                fontSize: '0.82rem', fontWeight: '500', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px'
              }}
            >
              <ArrowLeft size={14} /> Voltar para o Login
            </button>
          </form>
        )}

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
