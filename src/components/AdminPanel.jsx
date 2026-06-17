import React, { useState, useEffect, useRef } from 'react';
import {
  Save, RefreshCw, CheckCircle,
  DollarSign, Users, Package, Building2,
  Edit3, X, Plus, ShieldCheck, AlertTriangle,
  Upload, Trash2, Camera, FileText
} from 'lucide-react';
import {
  getDb, saveDb,
  updateProductPriceLocal, updateProductLocal, createProductLocal, deleteProductLocal, addToSyncQueue,
  getLocalDateString,
  createUserLocal, updateUserLocal, deleteUserLocal
} from '../services/db';
import { 
  saveCompanyToSupabase, saveProductToSupabase, deleteProductFromSupabase, saveStockToSupabase, saveUserToSupabase,
  deleteUserFromSupabase
} from '../services/supabaseService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Converte arquivo para base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Sub-componente: Upload de Imagem ─────────────────────────────────────────
function ImageUploader({ value, onChange, size = 80, label = 'Imagem', shape = 'square' }) {
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem.');
      return;
    }

    try {
      const compressedB64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new window.Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDimension = 600; // Resolução ideal para logos e produtos

            if (width > height) {
              if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Comprime e gera base64 otimizado
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.onerror = () => resolve(event.target.result);
        };
        reader.onerror = () => resolve('');
      });

      onChange(compressedB64);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      const b64 = await fileToBase64(file);
      onChange(b64);
    }
  };

  const isEmoji = value && !value.startsWith('data:');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div
        onClick={() => inputRef.current?.click()}
        style={{
          width: size, height: size,
          borderRadius: shape === 'circle' ? '50%' : '10px',
          border: '2px dashed var(--cinza-medio)',
          backgroundColor: 'var(--cinza-ultra-claro)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', overflow: 'hidden', position: 'relative',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          fontSize: isEmoji ? '2rem' : 'inherit'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--azul-principal)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cinza-medio)'}
      >
        {value ? (
          isEmoji ? (
            <span>{value}</span>
          ) : (
            <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--cinza-medio)' }}>
            <Upload size={20} />
            <div style={{ fontSize: '0.6rem', marginTop: '4px' }}>{label}</div>
          </div>
        )}
        {/* Overlay ao hover */}
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.2s', borderRadius: 'inherit',
          color: 'white', fontSize: '0.7rem', gap: '4px',
          flexDirection: 'column'
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
        >
          <Camera size={18} />
          <span>Trocar</span>
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{ ...btnDanger, padding: '2px 8px', fontSize: '0.7rem' }}
        >
          <Trash2 size={11} /> Remover
        </button>
      )}
    </div>
  );
}

// ─── ABA PRODUTOS ─────────────────────────────────────────────────────────────
function ProdutosTab() {
  const [produtos, setProdutos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [novoMode, setNovoMode] = useState(false);
  const [novoProd, setNovoProd] = useState({ codigo: '', nome: '', unidade: 'Saco 25kg', preco: '', imagem: null, descricao: '', quantidade_atual: '0', estoque_minimo: '5' });
  const [msg, setMsg] = useState(null);

  const reload = () => { const db = getDb(); setProdutos(db.produtos); };
  useEffect(() => {
    reload();
    window.addEventListener('fortegado_db_update', reload);
    return () => window.removeEventListener('fortegado_db_update', reload);
  }, []);

  const startEdit = (p) => {
    const db = getDb();
    const est = db.estoque.find(e => e.produto_id === p.id) || { quantidade_atual: 0, estoque_minimo: 5 };
    setEditId(p.id);
    setEditData({
      preco: String(p.preco),
      imagem: p.imagem || null,
      nome: p.nome,
      unidade: p.unidade,
      codigo: p.codigo,
      descricao: p.descricao || '',
      quantidade_atual: String(est.quantidade_atual),
      estoque_minimo: String(est.estoque_minimo)
    });
  };
  
  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async (id) => {
    const val = parseFloat(String(editData.preco).replace(',', '.'));
    if (isNaN(val) || val < 0) { setMsg({ ok: false, text: 'Preço inválido.' }); return; }

    const qty = parseInt(String(editData.quantidade_atual), 10);
    const min = parseInt(String(editData.estoque_minimo), 10);
    if (isNaN(qty) || qty < 0) { setMsg({ ok: false, text: 'Quantidade de estoque inválida.' }); return; }
    if (isNaN(min) || min < 0) { setMsg({ ok: false, text: 'Estoque mínimo inválido.' }); return; }

    const { quantidade_atual, estoque_minimo, ...productUpdates } = editData;

    // Atualizar produto local
    const updated = updateProductLocal(id, { ...productUpdates, preco: val });
    
    // Atualizar estoque local
    const db = getDb();
    const estIdx = db.estoque.findIndex(e => e.produto_id === id);
    if (estIdx > -1) {
      db.estoque[estIdx].quantidade_atual = qty;
      db.estoque[estIdx].estoque_minimo = min;
      saveDb(db);
    }
    
    // Fila offline para ajuste de estoque
    addToSyncQueue('ADJUST_STOCK', { produtoId: id, quantidade_atual: qty, estoque_minimo: min });

    setEditId(null);
    reload();

    // Sincronizar diretamente com Supabase
    if (updated) {
      const res = await saveProductToSupabase(updated);
      const resStock = await saveStockToSupabase(id, qty, min);
      if (res.success && resStock.success) {
        setMsg({ ok: true, text: '✅ Produto e estoque atualizados e sincronizados com Supabase!' });
      } else {
        setMsg({ ok: false, text: `⚠️ Salvo localmente. Erro Supabase: ${res.reason || ''} ${resStock.reason || ''}` });
      }
    } else {
      setMsg({ ok: true, text: 'Produto atualizado localmente.' });
    }
    setTimeout(() => setMsg(null), 4000);
  };

  const handleCreate = async () => {
    if (!novoProd.nome) { setMsg({ ok: false, text: 'Nome do produto é obrigatório.' }); return; }
    const val = parseFloat(String(novoProd.preco).replace(',', '.'));
    if (isNaN(val) || val < 0) { setMsg({ ok: false, text: 'Preço inválido.' }); return; }

    const qty = parseInt(String(novoProd.quantidade_atual), 10);
    const min = parseInt(String(novoProd.estoque_minimo), 10);
    if (isNaN(qty) || qty < 0) { setMsg({ ok: false, text: 'Quantidade de estoque inválida.' }); return; }
    if (isNaN(min) || min < 0) { setMsg({ ok: false, text: 'Estoque mínimo inválido.' }); return; }

    const created = createProductLocal({ ...novoProd, preco: val, quantidade_atual: qty, estoque_minimo: min });
    setNovoMode(false);
    setNovoProd({ codigo: '', nome: '', unidade: 'Saco 25kg', preco: '', imagem: null, descricao: '', quantidade_atual: '0', estoque_minimo: '5' });
    reload();

    // Sincronizar diretamente com Supabase
    const res = await saveProductToSupabase(created);
    const resStock = await saveStockToSupabase(created.id, qty, min);
    if (res.success && resStock.success) {
      setMsg({ ok: true, text: '✅ Produto cadastrado e sincronizado com Supabase!' });
    } else {
      setMsg({ ok: false, text: `⚠️ Produto salvo localmente. Erro Supabase: ${res.reason || ''} ${resStock.reason || ''}` });
    }
    setTimeout(() => setMsg(null), 5000);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Tem certeza de que deseja excluir este produto? Isso também removerá o estoque do mesmo.')) {
      return;
    }
    deleteProductLocal(id);
    reload();
    setMsg({ ok: true, text: 'Produto removido localmente. Sincronizando com Supabase...' });

    const res = await deleteProductFromSupabase(id);
    if (res.success) {
      setMsg({ ok: true, text: '✅ Produto removido localmente e do Supabase com sucesso!' });
    } else {
      setMsg({ ok: false, text: `⚠️ Removido localmente. Falha ao excluir do Supabase: ${res.reason}. A exclusão está na fila offline.` });
    }
    setTimeout(() => setMsg(null), 5000);
  };

  return (
    <div>
      <h3 style={sectionTitle}><Package size={18} style={{ color: 'var(--verde-agro)' }} />Produtos e Tabela de Preços</h3>
      <p style={hint}>Gerencie o catálogo completo de produtos, preços e imagens. Apenas Administradores podem alterar.</p>
      {msg && <Msg ok={msg.ok} text={msg.text} />}

      {/* Lista de Produtos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {produtos.map((p) => {
          const db = getDb();
          const est = db.estoque.find(e => e.produto_id === p.id) || { quantidade_atual: 0, quantidade_reservada: 0, estoque_minimo: 5 };
          const disponivel = est.quantidade_atual - est.quantidade_reservada;
          return (
            <div key={p.id} style={{
              backgroundColor: editId === p.id ? 'rgba(22,101,184,0.04)' : 'var(--cinza-ultra-claro)',
              border: editId === p.id ? '1.5px solid var(--azul-principal)' : '1px solid var(--cinza-claro)',
              borderRadius: '10px', padding: '12px', transition: 'all 0.2s'
            }}>
            {editId === p.id ? (
              /* Modo edição */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px', alignItems: 'start', marginBottom: '12px' }}>
                  <ImageUploader
                    value={editData.imagem}
                    onChange={(v) => setEditData({ ...editData, imagem: v })}
                    size={90}
                    label="Foto"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Código</label>
                      <input className="form-control" style={inputSm} value={editData.codigo} onChange={e => setEditData({ ...editData, codigo: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Unidade</label>
                      <input className="form-control" style={inputSm} value={editData.unidade} onChange={e => setEditData({ ...editData, unidade: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Nome do Produto</label>
                      <input className="form-control" style={inputSm} value={editData.nome} onChange={e => setEditData({ ...editData, nome: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Preço (R$) *</label>
                      <input type="number" step="0.01" className="form-control" style={{ ...inputSm, borderColor: 'var(--verde-agro)' }}
                        value={editData.preco} onChange={e => setEditData({ ...editData, preco: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Descrição</label>
                      <input className="form-control" style={inputSm} value={editData.descricao} onChange={e => setEditData({ ...editData, descricao: e.target.value })} placeholder="Opcional" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Estoque Físico</label>
                      <input type="number" className="form-control" style={inputSm} value={editData.quantidade_atual} onChange={e => setEditData({ ...editData, quantidade_atual: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Estoque Mínimo</label>
                      <input type="number" className="form-control" style={inputSm} value={editData.estoque_minimo} onChange={e => setEditData({ ...editData, estoque_minimo: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => saveEdit(p.id)} style={btnGreen}><Save size={14} /> Salvar</button>
                  <button onClick={cancelEdit} style={btnOutline}><X size={14} /> Cancelar</button>
                </div>
              </div>
            ) : (
              /* Modo visualização */
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Imagem ou placeholder */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '8px', flexShrink: 0,
                  backgroundColor: 'white', border: '1px solid var(--cinza-claro)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', fontSize: '1.6rem'
                }}>
                  {p.imagem
                    ? (p.imagem.startsWith('data:')
                      ? <img src={p.imagem} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span>{p.imagem}</span>)
                    : <Package size={24} color="var(--cinza-medio)" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--azul-escuro)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--cinza-medio)', marginTop: '2px' }}>
                    <code style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: '4px' }}>{p.codigo}</code>
                    {' · '}{p.unidade}
                    {' · '}Estoque: <strong style={{ color: disponivel <= est.estoque_minimo ? 'var(--vermelho-cancelar)' : 'var(--verde-escuro)' }}>{disponivel}</strong>
                  </div>
                  {p.descricao && <div style={{ fontSize: '0.72rem', color: 'var(--cinza-medio)', marginTop: '2px' }}>{p.descricao}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--verde-escuro)' }}>{fmt(p.preco)}</div>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
                    <button onClick={() => startEdit(p)} style={btnEdit}><Edit3 size={12} /> Editar</button>
                    <button onClick={() => handleDeleteProduct(p.id)} style={btnDanger}><Trash2 size={12} /> Excluir</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )})}
      </div>

      {/* Formulário Novo Produto */}
      {!novoMode ? (
        <button onClick={() => setNovoMode(true)} style={{ ...btnGreen, display: 'inline-flex' }}>
          <Plus size={15} /> Cadastrar Novo Produto
        </button>
      ) : (
        <div className="card" style={{ borderLeft: '4px solid var(--verde-agro)', marginTop: '4px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '14px', color: 'var(--verde-escuro)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Novo Produto
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', alignItems: 'start' }}>
            {/* Imagem */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '6px', color: 'var(--cinza-escuro)' }}>Foto do Produto</label>
              <ImageUploader
                value={novoProd.imagem}
                onChange={(v) => setNovoProd({ ...novoProd, imagem: v })}
                size={100}
                label="Foto"
              />
            </div>
            {/* Campos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group">
                <label>Código</label>
                <input className="form-control" value={novoProd.codigo} onChange={e => setNovoProd({ ...novoProd, codigo: e.target.value })} placeholder="Ex: RAC010" />
              </div>
              <div className="form-group">
                <label>Unidade de Venda</label>
                <input className="form-control" value={novoProd.unidade} onChange={e => setNovoProd({ ...novoProd, unidade: e.target.value })} placeholder="Ex: Saco 40kg, Frasco 50ml" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Nome do Produto *</label>
                <input className="form-control" value={novoProd.nome} onChange={e => setNovoProd({ ...novoProd, nome: e.target.value })} placeholder="Ex: Ração Gado Premium" />
              </div>
              <div className="form-group">
                <label>Preço de Venda (R$) *</label>
                <input type="number" step="0.01" className="form-control" value={novoProd.preco} onChange={e => setNovoProd({ ...novoProd, preco: e.target.value })} placeholder="0,00" />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <input className="form-control" value={novoProd.descricao} onChange={e => setNovoProd({ ...novoProd, descricao: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="form-group">
                <label>Estoque Físico Inicial</label>
                <input type="number" className="form-control" value={novoProd.quantidade_atual} onChange={e => setNovoProd({ ...novoProd, quantidade_atual: e.target.value })} placeholder="Ex: 100" />
              </div>
              <div className="form-group">
                <label>Estoque Mínimo (Alerta)</label>
                <input type="number" className="form-control" value={novoProd.estoque_minimo} onChange={e => setNovoProd({ ...novoProd, estoque_minimo: e.target.value })} placeholder="Ex: 5" />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={handleCreate} style={btnGreen}><Plus size={14} /> Cadastrar Produto</button>
            <button onClick={() => { setNovoMode(false); setNovoProd({ codigo: '', nome: '', unidade: 'Saco 25kg', preco: '', imagem: null, descricao: '' }); }} style={btnOutline}><X size={14} /> Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ABA USUÁRIOS ─────────────────────────────────────────────────────────────
function UsuariosTab({ currentUser }) {
  const [usuarios, setUsuarios] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [novoMode, setNovoMode] = useState(false);
  const [novoUser, setNovoUser] = useState({ nome: '', email: '', perfil: 'Vendedor', senha: '' });
  const [msg, setMsg] = useState(null);

  const reload = () => { const db = getDb(); setUsuarios(db.usuarios); };
  useEffect(() => {
    reload();
    window.addEventListener('fortegado_db_update', reload);
    return () => window.removeEventListener('fortegado_db_update', reload);
  }, []);

  const handlePrintSellerDailyReport = (vendedor) => {
    const db = getDb();
    const empresa = db.empresas?.[0] || { nome: 'Forte Gado', logotipo: '🐂' };
    
    // Filtrar pedidos do vendedor feitos hoje (que não estejam cancelados)
    const todayStr = getLocalDateString(new Date());
    const salesToday = db.pedidos.filter(p => {
      const pDateStr = getLocalDateString(new Date(p.data));
      return p.vendedor_id === vendedor.id && pDateStr === todayStr && p.status !== 'Cancelado';
    });

    const totalSales = salesToday.reduce((acc, p) => acc + p.total, 0);

    // Mapear os clientes correspondentes
    const salesWithClient = salesToday.map(p => {
      const client = db.clientes.find(c => c.id === p.cliente_id) || {};
      return {
        ...p,
        clienteNome: client.nome || 'Cliente Desconhecido',
        clienteCidade: client.cidade || 'N/A'
      };
    });

    // Abrir janela de impressão
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
              <h1>Relatório Diário de Vendas</h1>
              <p>Vendedor: <strong>${vendedor.nome}</strong> | Data: ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div class="summary-card">
            <div>
              <div class="card-title">Total Vendido Hoje</div>
              <div style="font-size: 11px; color: #666; margin-top: 4px;">Quantidade de Vendas: <strong>${salesToday.length}</strong></div>
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
              ${salesWithClient.length > 0 ? salesWithClient.map(p => `
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
                    Nenhuma venda realizada por este vendedor hoje.
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

  const saveUser = async (id) => {
    const updated = updateUserLocal(id, editData);
    setEditId(null);
    reload();
    if (updated) {
      const res = await saveUserToSupabase(updated);
      if (res.success) {
        setMsg({ ok: true, text: '✅ Usuário atualizado e sincronizado com Supabase!' });
      } else {
        setMsg({ ok: false, text: `⚠️ Salvo localmente. Erro no Supabase: ${res.reason}` });
      }
    }
    setTimeout(() => setMsg(null), 5000);
  };

  const createUser = async () => {
    if (!novoUser.nome || !novoUser.email) { setMsg({ ok: false, text: 'Nome e e-mail são obrigatórios.' }); return; }
    if (!novoUser.senha) { setMsg({ ok: false, text: 'A senha é obrigatória.' }); return; }
    
    const created = createUserLocal(novoUser);
    setNovoMode(false);
    setNovoUser({ nome: '', email: '', perfil: 'Vendedor', senha: '' });
    reload();

    // Sincronizar diretamente com Supabase
    const res = await saveUserToSupabase(created);
    if (res.success) {
      setMsg({ ok: true, text: '✅ Usuário criado e sincronizado com Supabase!' });
    } else {
      setMsg({ ok: false, text: `⚠️ Salvo localmente. Erro no Supabase: ${res.reason}` });
    }
    setTimeout(() => setMsg(null), 5000);
  };

  const toggleAtivo = async (id) => {
    const db = getDb();
    const u = db.usuarios.find(u => u.id === id);
    if (u) {
      const updated = updateUserLocal(id, { ativo: !u.ativo });
      reload();
      if (updated) {
        const res = await saveUserToSupabase(updated);
        if (res.success) {
          setMsg({ ok: true, text: `✅ Usuário ${updated.ativo ? 'ativado' : 'pausado (inativado)'} no Supabase com sucesso!` });
        } else {
          setMsg({ ok: false, text: `⚠️ Status alterado localmente. Erro no Supabase: ${res.reason}` });
        }
      }
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleDeleteUser = async (id) => {
    const db = getDb();
    const u = db.usuarios.find(u => u.id === id);
    if (!u) return;

    if (!window.confirm(`Tem certeza de que deseja excluir permanentemente o usuário/vendedor "${u.nome}"?`)) {
      return;
    }

    deleteUserLocal(id);
    reload();
    setMsg({ ok: true, text: 'Usuário removido localmente. Sincronizando com Supabase...' });

    const res = await deleteUserFromSupabase(id);
    if (res.success) {
      setMsg({ ok: true, text: '✅ Usuário removido do Supabase com sucesso!' });
    } else {
      setMsg({ ok: false, text: `⚠️ Removido localmente. Erro no Supabase: ${res.reason}. A exclusão está na fila offline.` });
    }
    setTimeout(() => setMsg(null), 5000);
  };

  return (
    <div>
      <h3 style={sectionTitle}><Users size={18} style={{ color: 'var(--azul-principal)' }} />Gestão de Usuários e Vendedores</h3>
      {msg && <Msg ok={msg.ok} text={msg.text} />}

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
                  {editId === u.id
                    ? <input className="form-control" style={inputSm} value={editData.nome || ''} onChange={(e) => setEditData({ ...editData, nome: e.target.value })} />
                    : <span style={{ fontWeight: '600' }}>{u.nome}</span>}
                </td>
                <td style={td}>
                  {editId === u.id
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input className="form-control" style={inputSm} value={editData.email || ''} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                        <input type="password" className="form-control" style={{ ...inputSm, fontSize: '0.75rem', marginTop: '2px' }} value={editData.senha || ''} onChange={(e) => setEditData({ ...editData, senha: e.target.value })} placeholder="Nova Senha (opcional)" />
                      </div>
                    : u.email}
                </td>
                <td style={td}>
                  {editId === u.id
                    ? <select className="form-control" style={inputSm} value={editData.perfil || 'Vendedor'} onChange={(e) => setEditData({ ...editData, perfil: e.target.value })}>
                      <option value="Administrador">Administrador</option>
                      <option value="Vendedor">Vendedor</option>
                    </select>
                    : <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                      backgroundColor: u.perfil === 'Administrador' ? 'rgba(22,101,184,0.12)' : 'rgba(90,158,26,0.12)',
                      color: u.perfil === 'Administrador' ? 'var(--azul-principal)' : 'var(--verde-escuro)'
                    }}>{u.perfil}</span>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <button onClick={() => toggleAtivo(u.id)} style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700', border: 'none', cursor: 'pointer',
                    backgroundColor: u.ativo ? 'rgba(90,158,26,0.12)' : 'rgba(229,62,98,0.12)',
                    color: u.ativo ? 'var(--verde-escuro)' : 'var(--vermelho-cancelar)'
                  }}>{u.ativo ? '● Ativo' : '○ Inativo'}</button>
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  {editId === u.id
                    ? <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button onClick={() => saveUser(u.id)} style={btnGreen}><Save size={14} /> Salvar</button>
                      <button onClick={() => setEditId(null)} style={btnOutline}><X size={14} /></button>
                    </div>
                    : <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                      <button onClick={() => { setEditId(u.id); setEditData({ nome: u.nome, email: u.email, perfil: u.perfil }); }} style={btnEdit}>
                        <Edit3 size={14} /> Editar
                      </button>
                      {u.id !== currentUser?.id && (
                        <button onClick={() => handleDeleteUser(u.id)} style={btnDanger}>
                          <Trash2 size={14} /> Excluir
                        </button>
                      )}
                      {u.perfil === 'Vendedor' && (
                        <button
                          onClick={() => handlePrintSellerDailyReport(u)}
                          style={{
                            ...btnOutline,
                            borderColor: 'var(--azul-principal)',
                            color: 'var(--azul-principal)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            backgroundColor: 'transparent'
                          }}
                          title="Relatório de Vendas do Dia"
                        >
                          <FileText size={14} /> PDF
                        </button>
                      )}
                    </div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!novoMode ? (
        <button onClick={() => setNovoMode(true)} style={{ ...btnGreen, display: 'inline-flex' }}>
          <Plus size={15} /> Novo Usuário / Vendedor
        </button>
      ) : (
        <div className="card" style={{ borderLeft: '4px solid var(--azul-principal)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--azul-principal)' }}>Novo Usuário</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label>Nome Completo *</label><input className="form-control" value={novoUser.nome} onChange={(e) => setNovoUser({ ...novoUser, nome: e.target.value })} placeholder="João da Silva" /></div>
            <div className="form-group"><label>E-mail *</label><input type="email" className="form-control" value={novoUser.email} onChange={(e) => setNovoUser({ ...novoUser, email: e.target.value })} placeholder="joao@fortegado.com.br" /></div>
            <div className="form-group">
              <label>Perfil</label>
              <select className="form-control" value={novoUser.perfil} onChange={(e) => setNovoUser({ ...novoUser, perfil: e.target.value })}>
                <option value="Vendedor">Vendedor</option>
                <option value="Administrador">Administrador</option>
              </select>
            </div>
            <div className="form-group"><label>Senha Inicial</label><input type="password" className="form-control" value={novoUser.senha} onChange={(e) => setNovoUser({ ...novoUser, senha: e.target.value })} placeholder="••••••" /></div>
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

// ─── ABA EMPRESA ──────────────────────────────────────────────────────────────
function EmpresaTab() {
  const [empresa, setEmpresa] = useState({});
  const [msg, setMsg] = useState(null);

  const reload = () => { const db = getDb(); setEmpresa(db.empresas?.[0] || {}); };
  useEffect(() => {
    reload();
    window.addEventListener('fortegado_db_update', reload);
    return () => window.removeEventListener('fortegado_db_update', reload);
  }, []);

  const handleSave = async () => {
    const db = getDb();
    const updatedEmpresa = { ...db.empresas[0], ...empresa };
    db.empresas[0] = updatedEmpresa;
    saveDb(db);
    // Sincronizar diretamente com Supabase (sem fila)
    const res = await saveCompanyToSupabase(updatedEmpresa);
    if (res.success) {
      setMsg({ ok: true, text: '✅ Empresa salva e sincronizada com Supabase com sucesso!' });
    } else {
      setMsg({ ok: false, text: `⚠️ Salvo localmente. Erro no Supabase: ${res.reason}` });
    }
    setTimeout(() => setMsg(null), 5000);
  };

  return (
    <div>
      <h3 style={sectionTitle}><Building2 size={18} style={{ color: 'var(--dourado-premium)' }} />Dados e Identidade Visual da Empresa</h3>
      {msg && <Msg ok={msg.ok} text={msg.text} />}

      {/* Logo */}
      <div style={{ ...cardSection, borderLeftColor: 'var(--dourado-premium)', marginBottom: '16px' }}>
        <div style={{ ...subsectionTitle, color: 'var(--amarelo-escuro)' }}>🎨 Logo da Empresa</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <ImageUploader
            value={empresa.logotipo}
            onChange={(v) => setEmpresa({ ...empresa, logotipo: v })}
            size={110}
            shape="circle"
            label="Logo"
          />
          <div style={{ flex: 1, minWidth: '180px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--cinza-escuro)', lineHeight: '1.5' }}>
              Faça upload do logotipo da empresa. A imagem será exibida no cabeçalho do app e nos PDFs de pedidos.
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--cinza-medio)', marginTop: '6px' }}>
              📐 Recomendado: formato quadrado ou circular, mínimo 200×200px. Máximo: 2MB.
            </p>
            {/* Preview de como fica no header */}
            {empresa.logotipo && empresa.logotipo.startsWith('data:') && (
              <div style={{ marginTop: '10px', backgroundColor: 'var(--azul-principal)', borderRadius: '8px', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <img src={empresa.logotipo} alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: '700' }}>{empresa.nome || 'Forte Gado'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dados cadastrais */}
      <div style={{ ...cardSection, borderLeftColor: 'var(--azul-principal)' }}>
        <div style={subsectionTitle}>🏢 Dados Cadastrais</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
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
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label>Endereço Completo</label>
            <input className="form-control" value={empresa.endereco || ''} onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })} placeholder="Rodovia Transagro, Km 45, Uberaba - MG" />
          </div>
        </div>
      </div>

      <button onClick={handleSave} style={{ ...btnGreen, marginTop: '16px', display: 'inline-flex' }}>
        <Save size={15} /> Salvar Dados da Empresa
      </button>
    </div>
  );
}

// ─── Auxiliar Msg ─────────────────────────────────────────────────────────────
function Msg({ ok, text }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.88rem',
      backgroundColor: ok ? 'rgba(90,158,26,0.1)' : 'rgba(229,62,98,0.1)',
      color: ok ? 'var(--verde-escuro)' : '#c53030',
      border: `1px solid ${ok ? 'rgba(90,158,26,0.2)' : 'rgba(229,62,98,0.2)'}`,
      display: 'flex', alignItems: 'center', gap: '8px'
    }}>
      <CheckCircle size={15} />{text}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
const TABS = [
  { id: 'produtos', label: 'Produtos', icon: Package },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'empresa', label: 'Empresa', icon: Building2 },
];

export default function AdminPanel({ currentUser }) {
  const [activeTab, setActiveTab] = useState('produtos');

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{
        background: 'linear-gradient(135deg, var(--azul-principal), var(--azul-escuro))',
        borderRadius: '12px', padding: '20px', marginBottom: '20px', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: '800', letterSpacing: '-0.3px' }}>Painel Administrativo</div>
            <div style={{ fontSize: '0.72rem', opacity: 0.8, fontWeight: '500' }}>ACESSO RESTRITO — SUPER ADMIN</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', opacity: 0.85 }}>
          <div style={{ fontWeight: '700' }}>{currentUser?.nome}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--amarelo-cta)' }}>● Administrador</div>
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', backgroundColor: 'var(--cinza-ultra-claro)', borderRadius: '10px', padding: '4px', border: '1px solid var(--cinza-claro)' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              padding: '8px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.7rem', fontWeight: isActive ? '700' : '500',
              backgroundColor: isActive ? 'white' : 'transparent',
              color: isActive ? 'var(--azul-principal)' : 'var(--cinza-escuro)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.2s ease'
            }}>
              <Icon size={17} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo */}
      <div className="card" style={{ minHeight: '300px' }}>
        {activeTab === 'produtos' && <ProdutosTab />}
        {activeTab === 'usuarios' && <UsuariosTab currentUser={currentUser} />}
        {activeTab === 'empresa' && <EmpresaTab />}
      </div>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const sectionTitle = { fontSize: '1rem', fontWeight: '700', color: 'var(--azul-escuro)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--cinza-claro)', paddingBottom: '10px' };
const hint = { fontSize: '0.78rem', color: 'var(--cinza-medio)', marginBottom: '14px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', borderRadius: '8px', overflow: 'hidden' };
const th = { padding: '10px 12px', textAlign: 'left', fontWeight: '600', fontSize: '0.78rem', letterSpacing: '0.3px' };
const td = { padding: '10px 12px', borderBottom: '1px solid var(--cinza-claro)' };
const inputSm = { padding: '4px 8px', fontSize: '0.85rem' };
const btnGreen = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--verde-agro)', color: 'white', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' };
const btnEdit = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--azul-principal)', backgroundColor: 'transparent', color: 'var(--azul-principal)', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' };
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--cinza-medio)', backgroundColor: 'transparent', color: 'var(--cinza-escuro)', fontSize: '0.78rem', cursor: 'pointer' };
const btnDanger = { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(229,62,98,0.1)', color: 'var(--vermelho-cancelar)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600' };
const cardSection = { backgroundColor: 'var(--cinza-ultra-claro)', borderRadius: '8px', padding: '12px 14px', borderLeft: '3px solid var(--azul-principal)' };
const subsectionTitle = { fontWeight: '700', fontSize: '0.85rem', color: 'var(--azul-principal)', marginBottom: '10px' };
