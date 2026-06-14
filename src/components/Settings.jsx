import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, LogOut, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { getCredentials, saveCredentials, resetDb, getDb } from '../services/db';

export default function Settings({ setView }) {
  const [dbUsers, setDbUsers] = useState([]);
  const [config, setConfig] = useState({
    supabaseUrl: '',
    supabaseAnonKey: '',
    googleSheetsUrl: '',
    activeUserId: 2,
    simulateOffline: false
  });

  const [message, setMessage] = useState(null);

  useEffect(() => {
    const db = getDb();
    setDbUsers(db.usuarios || []);
    setConfig(getCredentials());
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    saveCredentials(config);
    setMessage({ success: true, text: 'Configurações salvas com sucesso!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleResetDb = () => {
    if (window.confirm('Tem certeza que deseja resetar o banco de dados local? Todos os novos pedidos e alterações serão perdidos e restaurados para os dados fictícios iniciais.')) {
      resetDb();
      setMessage({ success: true, text: 'Banco de dados local resetado com sucesso!' });
      setTimeout(() => {
        setMessage(null);
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', marginBottom: '16px', fontWeight: '700' }}>
        Configurações do Sistema
      </h2>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.9rem',
          backgroundColor: message.success ? 'rgba(90, 158, 26, 0.1)' : 'rgba(229, 62, 98, 0.1)',
          color: message.success ? 'var(--verde-escuro)' : '#c53030',
          border: `1px solid ${message.success ? 'rgba(90, 158, 26, 0.2)' : 'rgba(229, 62, 98, 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="card">
        <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', borderBottom: '1px solid var(--cinza-claro)', paddingBottom: '6px' }}>
          Controles do Dispositivo e Teste
        </h3>

        {/* Simulador Offline */}
        <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
          <input
            type="checkbox"
            id="simulateOffline"
            style={{ width: '20px', height: '20px' }}
            checked={config.simulateOffline}
            onChange={(e) => setConfig({ ...config, simulateOffline: e.target.checked })}
          />
          <label htmlFor="simulateOffline" style={{ cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {config.simulateOffline ? <WifiOff size={16} color="var(--vermelho-cancelar)" /> : <Wifi size={16} color="var(--verde-agro)" />}
            Simular Conexão Offline (Guardar ações na fila local)
          </label>
        </div>

        {/* Usuário Logado */}
        <div className="form-group" style={{ marginTop: '10px' }}>
          <label>Usuário Ativo</label>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--cinza-ultra-claro)', padding: '12px', borderRadius: '8px', border: '1px solid var(--cinza-claro)' }}>
            <div>
              <strong style={{ color: 'var(--azul-principal)' }}>{dbUsers.find(u => u.id === config.activeUserId)?.nome || 'Nenhum'}</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--cinza-medio)' }}>Perfil: {dbUsers.find(u => u.id === config.activeUserId)?.perfil || ''}</div>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                if (window.confirm('Deseja realmente sair do sistema?')) {
                  const creds = getCredentials();
                  creds.activeUserId = null;
                  saveCredentials(creds);
                  window.location.reload();
                }
              }}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '4px', alignItems: 'center', borderColor: 'var(--vermelho-cancelar)', color: 'var(--vermelho-cancelar)' }}
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}>
          <Save size={18} /> Salvar Configurações
        </button>
      </form>

      {/* Perigo / Ferramentas */}
      <div className="card" style={{ borderColor: 'var(--vermelho-suave)' }}>
        <h3 style={{ fontSize: '1.1rem', color: 'var(--vermelho-cancelar)', marginBottom: '14px' }}>
          Manutenção do Sistema
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--cinza-escuro)', marginBottom: '14px' }}>
          As ações abaixo restauram as tabelas e dados mock locais padrão (5 clientes, 5 produtos, históricos de pedidos) para testar a aplicação de forma limpa.
        </p>
        <button type="button" className="btn btn-danger" onClick={handleResetDb}>
          <RefreshCw size={18} /> Resetar Banco de Dados Local (Dados Fictícios)
        </button>
      </div>
    </div>
  );
}
