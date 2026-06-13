import React, { useState, useEffect } from 'react';
import {
  Save, RefreshCw, CheckCircle, Wifi, WifiOff,
  DollarSign, Users, Package, Building2, Settings,
  Edit3, X, Plus, Trash2, ShieldCheck, AlertTriangle,
  TrendingUp, BarChart2, LogOut
} from 'lucide-react';
import {
  getDb, saveDb, resetDb, getCredentials, saveCredentials,
  updateProductPriceLocal
} from '../services/db';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Sub-componentes de aba ───────────────────────────────────────────────────

/** ABA PREÇOS */
function PrecosTab() {
  const [produtos, setProdutos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editPreco, setEditPreco] = useState('');
  const [msg, setMsg] = useState(null);

  const reload = () => {
    const db = getDb();
    setProdutos(db.produtos);
  };
  useEffect(() => {
    reload();
    window.addEventListener('fortegado_db_update', reload);
    return () => window.removeEventListener('fortegado_db_update', reload);
  }, []);

  const startEdit = (p) => {
    setEditId(p.id);
    setEditPreco(String(p.preco));
  };
  const cancelEdit = () => { setEditId(null); setEditPreco(''); };

  const savePreco = (id) => {
    const val = parseFloat(editPreco.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      setMsg({ ok: false, text: 'Valor inválido.' });
      return;
    }
    updateProductPriceLocal(id, val);
    setEditId(null);
    setEditPreco('');
    setMsg({ ok: true, text: 'Preço atualizado com sucesso!' });
    reload();
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div>
      <h3 style={sectionTitle}>
        <DollarSign size={18} style={{ color: 'var(--verde-agro)' }} />
        Tabela de Preços dos Produtos
      </h3>
      <p style={hint}>Apenas o Administrador pode alterar os preços. Cada alteração é sincronizada com o Supabase automaticamente.</p>

      {msg && <Msg ok={msg.ok} text={msg.text} />}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: 'var(--azul-principal)', color: 'white' }}>
              <th style={th}>Código</th>
              <th style={th}>Produto</th>
              <th style={th}>Unidade</th>
              <th style={th}>Preço Atual</th>
              <th style={{ ...th, textAlign: 'center' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p, i) => (
              <tr key={p.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--cinza-ultra-claro)' : 'white' }}>
                <td style={td}><code style={{ fontSize: '0.75rem', color: 'var(--azul-escuro)' }}>{p.codigo}</code></td>
                <td style={{ ...td, fontWeight: '600' }}>{p.nome}</td>
                <td style={td}>{p.unidade}</td>
                <td style={td}>
                  {editId === p.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editPreco}
                      onChange={(e) => setEditPreco(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') savePreco(p.id); if (e.key === 'Escape') cancelEdit(); }}
                      autoFocus
                      style={{
                        border: '2px solid var(--verde-agro)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.9rem',
                        width: '100px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span style={{ fontWeight: '700', color: 'var(--verde-escuro)', fontSize: '1rem' }}>
                      {fmt(p.preco)}
                    </span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {editId === p.id ? (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button onClick={() => savePreco(p.id)} style={btnGreen}><Save size={14} /> Salvar</button>
                      <button onClick={cancelEdit} style={btnOutline}><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(p)} style={btnEdit}><Edit3 size={14} /> Editar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** ABA USUÁRIOS */
function UsuariosTab() {
  const [usuarios, setUsuarios] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [novoMode, setNovoMode] = useState(false);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', perfil: 'Vendedor', senha: '' });
  const [msg, setMsg] = useState(null);

  const reload = () => {
    const db = getDb();
    setUsuarios(db.usuarios);
  };
  useEffect(() => {
    reload();
    window.addEventListener('fortegado_db_update', reload);
    return () => window.removeEventListener('fortegado_db_update', reload);
  }, []);

  const saveUser = (id) => {
    const db = getDb();
    const idx = db.usuarios.findIndex(u => u.id === id);
    if (idx === -1) return;
    db.usuarios[idx] = { ...db.usuarios[idx], ...editData };
    saveDb(db);
    setEditId(null);
    setMsg({ ok: true, text: 'Usuário atualizado!' });
    reload();
    setTimeout(() => setMsg(null), 3000);
  };

  const createUser = () => {
    if (!novoUser.nome || !novoUser.email) {
      setMsg({ ok: false, text: 'Nome e e-mail são obrigatórios.' });
      return;
    }
    const db = getDb();
    const nextId = db.usuarios.length > 0 ? Math.max(...db.usuarios.map(u => u.id)) + 1 : 1;
    db.usuarios.push({ id: nextId, nome: novoUser.nome, email: novoUser.email, perfil: novoUser.perfil, senha: novoUser.senha, ativo: true });
    saveDb(db);
    setNovoMode(false);
    setNovoUser({ nome: '', email: '', perfil: 'Vendedor', senha: '' });
    setMsg({ ok: true, text: 'Usuário criado com sucesso!' });
    reload();
    setTimeout(() => setMsg(null), 3000);
  };

  const toggleAtivo = (id) => {
    const db = getDb();
    const u = db.usuarios.find(u => u.id === id);
    if (u) {
      u.ativo = !u.ativo;
      saveDb(db);
      reload();
    }
  };

  return (
    <div>
      <h3 style={sectionTitle}>
        <Users size={18} style={{ color: 'var(--azul-principal)' }} />
        Gestão de Usuários e Vendedores
      </h3>

      {msg && <Msg ok={msg.ok} text={msg.text} />}

      {/* Tabela */}
      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: 'var(--azul-principal)', color: 'white' }}>
              <th style={th}>Nome</th>
              <th style={th}>E-mail</th>
              <th style={th}>Perfil</th>
              <th style={{ ...th, textAlign: 'center' }}>Status</th>
              <th style={{ ...th, textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => (
              <tr key={u.id} style={{ backgroundColor: i % 2 === 0 ? 'var(--cinza-ultra-claro)' : 'white' }}>
                <td style={td}>
                  {editId === u.id ? (
                    <input className="form-control" style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      value={editData.nome || ''} onChange={(e) => setEditData({ ...editData, nome: e.target.value })} />
                  ) : (
                    <span style={{ fontWeight: '600' }}>{u.nome}</span>
                  )}
                </td>
                <td style={td}>
                  {editId === u.id ? (
                    <input className="form-control" style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                  ) : u.email}
                </td>
                <td style={td}>
                  {editId === u.id ? (
                    <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      value={editData.perfil || 'Vendedor'} onChange={(e) => setEditData({ ...editData, perfil: e.target.value })}>
                      <option value="Administrador">Administrador</option>
                      <option value="Vendedor">Vendedor</option>
                    </select>
                  ) : (
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                      backgroundColor: u.perfil === 'Administrador' ? 'rgba(22, 101, 184, 0.12)' : 'rgba(90, 158, 26, 0.12)',
                      color: u.perfil === 'Administrador' ? 'var(--azul-principal)' : 'var(--verde-escuro)'
                    }}>{u.perfil}</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <button
                    onClick={() => toggleAtivo(u.id)}
                    style={{
                      padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', border: 'none', cursor: 'pointer',
                      backgroundColor: u.ativo ? 'rgba(90,158,26,0.12)' : 'rgba(229,62,98,0.12)',
                      color: u.ativo ? 'var(--verde-escuro)' : 'var(--vermelho-cancelar)'
                    }}
                    title={u.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                  >
                    {u.ativo ? '● Ativo' : '○ Inativo'}
                  </button>
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {editId === u.id ? (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button onClick={() => saveUser(u.id)} style={btnGreen}><Save size={14} /> Salvar</button>
                      <button onClick={() => setEditId(null)} style={btnOutline}><X size={14} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditId(u.id); setEditData({ nome: u.nome, email: u.email, perfil: u.perfil }); }} style={btnEdit}>
                      <Edit3 size={14} /> Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adicionar novo usuário */}
      {!novoMode ? (
        <button onClick={() => setNovoMode(true)} style={{ ...btnGreen, display: 'inline-flex' }}>
          <Plus size={15} /> Novo Usuário / Vendedor
        </button>
      ) : (
        <div className="card" style={{ borderColor: 'var(--azul-principal)', borderLeftWidth: '4px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--azul-principal)' }}>Novo Usuário</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label>Nome Completo *</label>
              <input className="form-control" value={novoUser.nome} onChange={(e) => setNovoUser({ ...novoUser, nome: e.target.value })} placeholder="João da Silva" />
            </div>
            <div className="form-group">
              <label>E-mail *</label>
              <input type="email" className="form-control" value={novoUser.email} onChange={(e) => setNovoUser({ ...novoUser, email: e.target.value })} placeholder="joao@fortegado.com.br" />
            </div>
            <div className="form-group">
              <label>Perfil</label>
              <select className="form-control" value={novoUser.perfil} onChange={(e) => setNovoUser({ ...novoUser, perfil: e.target.value })}>
                <option value="Vendedor">Vendedor</option>
                <option value="Administrador">Administrador</option>
              </select>
            </div>
            <div className="form-group">
              <label>Senha Inicial</label>
              <input type="password" className="form-control" value={novoUser.senha} onChange={(e) => setNovoUser({ ...novoUser, senha: e.target.value })} placeholder="••••••" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={createUser} style={btnGreen}><Plus size={14} /> Criar Usuário</button>
            <button onClick={() => setNovoMode(false)} style={btnOutline}><X size={14} /> Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** ABA EMPRESA */
function EmpresaTab() {
  const [empresa, setEmpresa] = useState({});
  const [msg, setMsg] = useState(null);

  const reload = () => {
    const db = getDb();
    setEmpresa(db.empresas?.[0] || {});
  };
  useEffect(() => { reload(); }, []);

  const handleSave = () => {
    const db = getDb();
    db.empresas[0] = { ...db.empresas[0], ...empresa };
    saveDb(db);
    setMsg({ ok: true, text: 'Dados da empresa atualizados!' });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div>
      <h3 style={sectionTitle}>
        <Building2 size={18} style={{ color: 'var(--dourado-premium)' }} />
        Dados da Empresa
      </h3>

      {msg && <Msg ok={msg.ok} text={msg.text} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Razão Social</label>
          <input className="form-control" value={empresa.nome || ''} onChange={(e) => setEmpresa({ ...empresa, nome: e.target.value })} placeholder="Forte Gado Comercial Ltda" />
        </div>
        <div className="form-group">
          <label>CNPJ</label>
          <input className="form-control" value={empresa.cnpj || ''} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
        </div>
        <div className="form-group">
          <label>Telefone</label>
          <input className="form-control" value={empresa.telefone || ''} onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })} placeholder="(34) 9 9999-0000" />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label>Endereço</label>
          <input className="form-control" value={empresa.endereco || ''} onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })} placeholder="Rodovia Transagro, Km 45, Uberaba - MG" />
        </div>
      </div>

      <button onClick={handleSave} style={btnGreen}><Save size={15} /> Salvar Dados da Empresa</button>
    </div>
  );
}

/** ABA INTEGRAÇÕES */
function IntegracoesTab() {
  const [config, setConfig] = useState({});
  const [msg, setMsg] = useState(null);

  useEffect(() => { setConfig(getCredentials()); }, []);

  const handleSave = (e) => {
    e.preventDefault();
    saveCredentials(config);
    setMsg({ ok: true, text: 'Configurações de integração salvas!' });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleResetDb = () => {
    if (window.confirm('Tem certeza? Todos os dados serão restaurados para o estado inicial (dados fictícios).')) {
      resetDb();
      setMsg({ ok: true, text: 'Banco de dados resetado!' });
      setTimeout(() => { setMsg(null); window.location.reload(); }, 1000);
    }
  };

  return (
    <div>
      <h3 style={sectionTitle}>
        <Settings size={18} style={{ color: 'var(--azul-principal)' }} />
        Integrações e Configurações Técnicas
      </h3>

      {msg && <Msg ok={msg.ok} text={msg.text} />}

      <form onSubmit={handleSave}>
        {/* Supabase */}
        <div style={{ ...cardSection, borderLeftColor: 'var(--azul-principal)' }}>
          <div style={subsectionTitle}>🔗 Supabase (Banco de Dados Remoto)</div>
          <div className="form-group">
            <label>URL do Projeto Supabase</label>
            <input type="url" className="form-control" placeholder="https://xxxx.supabase.co"
              value={config.supabaseUrl || ''} onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Chave Anon (Anon Key)</label>
            <input type="password" className="form-control" placeholder="eyJhbGciOi..."
              value={config.supabaseAnonKey || ''} onChange={(e) => setConfig({ ...config, supabaseAnonKey: e.target.value })} />
          </div>
        </div>

        {/* Google Sheets */}
        <div style={{ ...cardSection, borderLeftColor: '#34A853', marginTop: '12px' }}>
          <div style={{ ...subsectionTitle, color: '#34A853' }}>📊 Google Sheets (Relatórios)</div>
          <div className="form-group">
            <label>URL do Apps Script</label>
            <input type="url" className="form-control" placeholder="https://script.google.com/macros/s/.../exec"
              value={config.googleSheetsUrl || ''} onChange={(e) => setConfig({ ...config, googleSheetsUrl: e.target.value })} />
            <small style={{ color: 'var(--cinza-medio)', fontSize: '0.75rem' }}>
              Abas sincronizadas: PEDIDOS, CONTAS A RECEBER, ESTOQUE, VENDAS
            </small>
          </div>
        </div>

        {/* Simulador Offline */}
        <div style={{ ...cardSection, borderLeftColor: 'var(--amarelo-cta)', marginTop: '12px' }}>
          <div style={{ ...subsectionTitle, color: 'var(--amarelo-escuro)' }}>⚡ Modo de Operação</div>
          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="simulateOffline" style={{ width: '20px', height: '20px' }}
              checked={config.simulateOffline || false} onChange={(e) => setConfig({ ...config, simulateOffline: e.target.checked })} />
            <label htmlFor="simulateOffline" style={{ cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {config.simulateOffline
                ? <WifiOff size={16} color="var(--vermelho-cancelar)" />
                : <Wifi size={16} color="var(--verde-agro)" />}
              Simular Conexão Offline (guardar ações na fila local)
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '16px' }}>
          <Save size={18} /> Salvar Configurações
        </button>
      </form>

      {/* Zona de Perigo */}
      <div className="card" style={{ borderColor: 'var(--vermelho-suave)', marginTop: '20px', borderLeftWidth: '4px', borderLeftColor: 'var(--vermelho-cancelar)' }}>
        <h4 style={{ color: 'var(--vermelho-cancelar)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <AlertTriangle size={16} /> Zona de Perigo
        </h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--cinza-escuro)', marginBottom: '12px' }}>
          Restaura todas as tabelas para os dados fictícios iniciais. Use apenas para testes.
        </p>
        <button type="button" className="btn btn-danger" onClick={handleResetDb}>
          <RefreshCw size={18} /> Resetar Banco de Dados Local
        </button>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function Msg({ ok, text }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.88rem',
      backgroundColor: ok ? 'rgba(90, 158, 26, 0.1)' : 'rgba(229, 62, 98, 0.1)',
      color: ok ? 'var(--verde-escuro)' : '#c53030',
      border: `1px solid ${ok ? 'rgba(90,158,26,0.2)' : 'rgba(229,62,98,0.2)'}`,
      display: 'flex', alignItems: 'center', gap: '8px'
    }}>
      <CheckCircle size={15} />
      {text}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'precos', label: 'Preços', icon: DollarSign },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'integracoes', label: 'Integrações', icon: Settings },
];

export default function AdminPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('precos');

  return (
    <div>
      {/* Cabeçalho do Painel */}
      <div style={{
        background: 'linear-gradient(135deg, var(--azul-principal), var(--azul-escuro))',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '-0.3px' }}>
              Painel Administrativo
            </div>
            <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: '500' }}>
              ACESSO RESTRITO — SUPER ADMIN
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', opacity: 0.85 }}>
          <div style={{ fontWeight: '700' }}>{currentUser?.nome}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--amarelo-cta)' }}>● Administrador</div>
        </div>
      </div>

      {/* Abas de Navegação */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '16px',
        backgroundColor: 'var(--cinza-ultra-claro)',
        borderRadius: '10px',
        padding: '4px',
        border: '1px solid var(--cinza-claro)'
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                padding: '8px 4px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: isActive ? '700' : '500',
                backgroundColor: isActive ? 'white' : 'transparent',
                color: isActive ? 'var(--azul-principal)' : 'var(--cinza-escuro)',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={17} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da Aba */}
      <div className="card" style={{ minHeight: '300px' }}>
        {activeTab === 'precos' && <PrecosTab />}
        {activeTab === 'usuarios' && <UsuariosTab />}
        {activeTab === 'empresa' && <EmpresaTab />}
        {activeTab === 'integracoes' && <IntegracoesTab />}
      </div>
    </div>
  );
}

// ─── Estilos reutilizáveis ────────────────────────────────────────────────────
const sectionTitle = {
  fontSize: '1rem',
  fontWeight: '700',
  color: 'var(--azul-escuro)',
  marginBottom: '8px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  borderBottom: '1px solid var(--cinza-claro)',
  paddingBottom: '10px'
};

const hint = {
  fontSize: '0.78rem',
  color: 'var(--cinza-medio)',
  marginBottom: '14px'
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
  borderRadius: '8px',
  overflow: 'hidden'
};

const th = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '0.78rem',
  letterSpacing: '0.3px'
};

const td = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--cinza-claro)'
};

const btnGreen = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '6px 14px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: 'var(--verde-agro)',
  color: 'white',
  fontSize: '0.8rem',
  fontWeight: '700',
  cursor: 'pointer'
};

const btnEdit = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '5px 12px',
  borderRadius: '8px',
  border: '1px solid var(--azul-principal)',
  backgroundColor: 'transparent',
  color: 'var(--azul-principal)',
  fontSize: '0.78rem',
  fontWeight: '600',
  cursor: 'pointer'
};

const btnOutline = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  padding: '5px 10px',
  borderRadius: '8px',
  border: '1px solid var(--cinza-medio)',
  backgroundColor: 'transparent',
  color: 'var(--cinza-escuro)',
  fontSize: '0.78rem',
  cursor: 'pointer'
};

const cardSection = {
  backgroundColor: 'var(--cinza-ultra-claro)',
  borderRadius: '8px',
  padding: '12px 14px',
  borderLeft: '3px solid var(--azul-principal)',
  marginBottom: '4px'
};

const subsectionTitle = {
  fontWeight: '700',
  fontSize: '0.85rem',
  color: 'var(--azul-principal)',
  marginBottom: '10px'
};
