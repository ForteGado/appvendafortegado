// Serviço de Conectividade com o Supabase
import { createClient } from '@supabase/supabase-js';
import { getCredentials, getSyncQueue, saveSyncQueue, getDb, saveDb } from './db';

let supabaseInstance = null;
let lastCredKey = null;

// Obter cliente Supabase ativo
function getSupabaseClient() {
  const creds = getCredentials();
  if (!creds.supabaseUrl || !creds.supabaseAnonKey) {
    console.warn('[Supabase] Credenciais não configuradas.');
    return null;
  }
  
  // Recriar instância se as credenciais mudaram
  const credKey = creds.supabaseUrl + '|' + creds.supabaseAnonKey;
  if (!supabaseInstance || lastCredKey !== credKey) {
    console.log('[Supabase] Criando cliente com URL:', creds.supabaseUrl);
    supabaseInstance = createClient(creds.supabaseUrl, creds.supabaseAnonKey);
    lastCredKey = credKey;
  }
  return supabaseInstance;
}

// Resetar instância se credenciais mudarem
window.addEventListener('fortegado_credentials_update', () => {
  supabaseInstance = null;
  lastCredKey = null;
  console.log('[Supabase] Instância resetada por atualização de credenciais.');
});

// Sincronizar Fila Offline
export async function syncQueueToSupabase() {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado. Insira a URL e a Anon Key nas configurações.' };
  
  const creds = getCredentials();
  if (creds.simulateOffline) return { success: false, reason: 'Modo Offline Ativado' };

  let queue = getSyncQueue();
  if (queue.length === 0) return { success: true, processed: 0 };

  console.log(`[Supabase Sync] Iniciando sincronização de ${queue.length} itens.`);
  let processedCount = 0;
  const newQueue = [...queue];
  let syncError = null;

  for (const item of queue) {
    try {
      const { actionType, payload } = item;
      let result = { success: false, error: { message: 'Ação desconhecida na fila' } };

      if (actionType === 'CREATE_ORDER') {
        result = await syncCreateOrder(client, payload);
      } else if (actionType === 'CONFIRM_DELIVERY') {
        result = await syncConfirmDelivery(client, payload);
      } else if (actionType === 'CANCEL_ORDER') {
        result = await syncCancelOrder(client, payload);
      } else if (actionType === 'REOPEN_ORDER') {
        result = await syncReopenOrder(client, payload);
      } else if (actionType === 'ADJUST_STOCK') {
        result = await syncAdjustStock(client, payload);
      } else if (actionType === 'RECEIVE_INSTALLMENT') {
        result = await syncReceiveInstallment(client, payload);
      } else if (actionType === 'CREATE_CLIENT') {
        result = await syncCreateClient(client, payload);
      } else if (actionType === 'UPDATE_PRODUCT_PRICE') {
        result = await syncUpdateProductPrice(client, payload);
      } else if (actionType === 'UPDATE_PRODUCT') {
        result = await syncUpdateProduct(client, payload);
      } else if (actionType === 'CREATE_PRODUCT') {
        result = await syncCreateProduct(client, payload);
      } else if (actionType === 'DELETE_PRODUCT') {
        result = await syncDeleteProduct(client, payload);
      } else if (actionType === 'UPDATE_COMPANY') {
        result = await syncUpdateCompany(client, payload);
      } else if (actionType === 'SAVE_USER') {
        result = await syncSaveUser(client, payload);
      } else if (actionType === 'DELETE_USER') {
        result = await syncDeleteUser(client, payload);
      } else if (actionType === 'SAVE_CLIENT') {
        result = await syncSaveClient(client, payload);
      } else {
        // Tipo desconhecido: remove da fila para não bloquear
        result = { success: true };
      }

      if (result.success) {
        const idx = newQueue.findIndex(q => q.id === item.id);
        if (idx > -1) newQueue.splice(idx, 1);
        processedCount++;
      } else {
        // Se for uma violação permanente de restrição do Postgres (código começa com 23),
        // avisa no console e ignora o item da fila para evitar travamento.
        if (result.error && typeof result.error.code === 'string' && result.error.code.startsWith('23')) {
          console.warn(`[Supabase Sync] Ignorando item da fila devido a erro de constraint permanente (${result.error.code}):`, result.error.message);
          const idx = newQueue.findIndex(q => q.id === item.id);
          if (idx > -1) newQueue.splice(idx, 1);
          processedCount++;
          continue;
        }
        syncError = result.error;
        break;
      }
    } catch (err) {
      console.error('[Supabase Sync Error]', err);
      syncError = err;
      break;
    }
  }

  saveSyncQueue(newQueue);
  
  if (syncError) {
    const errorMsg = typeof syncError === 'string' ? syncError : (syncError.message || JSON.stringify(syncError));
    return { success: false, reason: errorMsg, processed: processedCount };
  }
  return { success: true, processed: processedCount };
}

// Imagens são salvas como base64 diretamente nas colunas TEXT do banco.
// Não há upload para o Supabase Storage — mais simples e confiável.

// --- Métodos de sincronização individual ---

async function syncCreateOrder(client, payload) {
  // 1. Inserir Pedido
  const { error: errPed } = await client.from('pedidos').insert({
    id: payload.pedido.id,
    numero: payload.pedido.numero,
    cliente_id: payload.pedido.cliente_id,
    vendedor_id: payload.pedido.vendedor_id,
    data: payload.pedido.data,
    status: payload.pedido.status,
    total: payload.pedido.total
  });
  if (errPed) {
    console.error('[Supabase Sync] Erro ao criar pedido:', errPed);
    return { success: false, error: errPed };
  }

  // 2. Inserir Itens
  const { error: errItens } = await client.from('itens_pedido').insert(
    payload.itens.map(it => ({
      id: it.id,
      pedido_id: it.pedido_id,
      produto_id: it.produto_id,
      quantidade: it.quantidade,
      valor_unitario: it.valor_unitario,
      desconto: it.desconto
    }))
  );
  if (errItens) {
    console.error('[Supabase Sync] Erro ao criar itens do pedido:', errItens);
    return { success: false, error: errItens };
  }

  // 3. Inserir Parcelas
  const { error: errPar } = await client.from('parcelas').insert(
    payload.parcelas.map(par => ({
      id: par.id,
      pedido_id: par.pedido_id,
      vencimento: par.vencimento,
      valor: par.valor,
      pago: par.pago
    }))
  );
  if (errPar) {
    console.error('[Supabase Sync] Erro ao criar parcelas:', errPar);
    return { success: false, error: errPar };
  }

  // 4. Inserir Assinatura (base64 salvo diretamente na coluna TEXT)
  const { error: errAss } = await client.from('assinaturas').insert({
    id: payload.assinatura.id,
    pedido_id: payload.assinatura.pedido_id,
    imagem: payload.assinatura.imagem
  });
  if (errAss) {
    console.error('[Supabase Sync] Erro ao criar assinatura no Supabase:', errAss);
    return { success: false, error: errAss };
  }

  // 5. Inserir Localização
  const { error: errLoc } = await client.from('localizacoes').insert({
    id: payload.localizacao.id,
    pedido_id: payload.localizacao.pedido_id,
    tipo: payload.localizacao.tipo,
    latitude: payload.localizacao.latitude,
    longitude: payload.localizacao.longitude,
    data_hora: payload.localizacao.data_hora
  });
  if (errLoc) {
    console.error('[Supabase Sync] Erro ao criar localização da venda:', errLoc);
    return { success: false, error: errLoc };
  }

  if (payload.estoqueUpdates) {
    for (const it of payload.estoqueUpdates) {
      const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).maybeSingle();
      if (estData) {
        const { error: errEstUpd } = await client.from('estoque').update({
          quantidade_reservada: estData.quantidade_reservada + (it.deltaReservado || 0),
          updated_at: new Date().toISOString()
        }).eq('produto_id', it.produto_id);
        if (errEstUpd) {
          console.error('[Supabase Sync] Erro ao atualizar estoque reservado:', errEstUpd);
        }
      } else {
        const { error: errEstIns } = await client.from('estoque').insert({
          produto_id: it.produto_id,
          quantidade_atual: 0,
          quantidade_reservada: it.deltaReservado || 0,
          estoque_minimo: 5,
          updated_at: new Date().toISOString()
        });
        if (errEstIns) {
          console.error('[Supabase Sync] Erro ao criar registro de estoque inicial na reserva:', errEstIns);
        }
      }
    }
  }

  return { success: true };
}

async function syncConfirmDelivery(client, payload) {
  // 1. Atualizar Pedido
  const { error: errPed } = await client.from('pedidos').update({ status: 'Entregue' }).eq('id', payload.pedidoId);
  if (errPed) {
    console.error('[Supabase Sync] Erro ao atualizar status do pedido para entregue:', errPed);
    return { success: false, error: errPed };
  }

  // 2. Inserir Foto da entrega (base64 salvo diretamente na coluna TEXT)
  const { error: errFoto } = await client.from('fotos_entrega').insert({
    id: payload.foto.id,
    pedido_id: payload.foto.pedido_id,
    imagem: payload.foto.imagem
  });
  if (errFoto) {
    console.error('[Supabase Sync] Erro ao inserir foto da entrega no Supabase:', errFoto);
    return { success: false, error: errFoto };
  }

  // 3. Inserir Localização
  const { error: errLoc } = await client.from('localizacoes').insert({
    id: payload.localizacao.id,
    pedido_id: payload.localizacao.pedido_id,
    tipo: payload.localizacao.tipo,
    latitude: payload.localizacao.latitude,
    longitude: payload.localizacao.longitude,
    data_hora: payload.localizacao.data_hora
  });
  if (errLoc) {
    console.error('[Supabase Sync] Erro ao criar localização da entrega:', errLoc);
    return { success: false, error: errLoc };
  }

  if (payload.estoqueUpdates) {
    for (const it of payload.estoqueUpdates) {
      const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).maybeSingle();
      if (estData) {
        const { error: errEstUpd } = await client.from('estoque').update({
          quantidade_reservada: Math.max(0, estData.quantidade_reservada - (it.quantidade || 0)),
          quantidade_atual: Math.max(0, estData.quantidade_atual - (it.quantidade || 0)),
          updated_at: new Date().toISOString()
        }).eq('produto_id', it.produto_id);
        if (errEstUpd) {
          console.error('[Supabase Sync] Erro ao atualizar estoque na entrega:', errEstUpd);
        }
      } else {
        const { error: errEstIns } = await client.from('estoque').insert({
          produto_id: it.produto_id,
          quantidade_atual: 0,
          quantidade_reservada: 0,
          estoque_minimo: 5,
          updated_at: new Date().toISOString()
        });
        if (errEstIns) {
          console.error('[Supabase Sync] Erro ao criar registro de estoque inicial na entrega:', errEstIns);
        }
      }
    }
  }

  return { success: true };
}

async function syncCancelOrder(client, payload) {
  const { error: errPed } = await client.from('pedidos').update({ status: 'Cancelado' }).eq('id', payload.pedidoId);
  if (errPed) {
    console.error('[Supabase Sync] Erro ao atualizar status do pedido para cancelado:', errPed);
    return { success: false, error: errPed };
  }

  // Se estava Emitido, libera o estoque reservado no Supabase
  if (payload.oldStatus === 'Emitido') {
    const { data: itens, error: errItens } = await client.from('itens_pedido').select('*').eq('pedido_id', payload.pedidoId);
    if (errItens) {
      console.error('[Supabase Sync] Erro ao obter itens do pedido cancelado:', errItens);
    }
    if (itens) {
      for (const it of itens) {
        const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).maybeSingle();
        if (estData) {
          const { error: errEstUpd } = await client.from('estoque').update({
            quantidade_reservada: Math.max(0, estData.quantidade_reservada - it.quantidade),
            updated_at: new Date().toISOString()
          }).eq('produto_id', it.produto_id);
          if (errEstUpd) {
            console.error('[Supabase Sync] Erro ao liberar estoque de pedido cancelado:', errEstUpd);
          }
        } else {
          await client.from('estoque').insert({
            produto_id: it.produto_id,
            quantidade_atual: 0,
            quantidade_reservada: 0,
            estoque_minimo: 5,
            updated_at: new Date().toISOString()
          });
        }
      }
    }
  }

  return { success: true };
}

async function syncReopenOrder(client, payload) {
  const { error: errPed } = await client.from('pedidos').update({ status: 'Emitido' }).eq('id', payload.pedidoId);
  if (errPed) {
    console.error('[Supabase Sync] Erro ao reabrir pedido:', errPed);
    return { success: false, error: errPed };
  }

  // Reservar estoque novamente
  const { data: itens, error: errItens } = await client.from('itens_pedido').select('*').eq('pedido_id', payload.pedidoId);
  if (errItens) {
    console.error('[Supabase Sync] Erro ao obter itens para reabertura:', errItens);
  }
  if (itens) {
    for (const it of itens) {
      const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).maybeSingle();
      if (estData) {
        const { error: errEstUpd } = await client.from('estoque').update({
          quantidade_reservada: estData.quantidade_reservada + it.quantidade,
          updated_at: new Date().toISOString()
        }).eq('produto_id', it.produto_id);
        if (errEstUpd) {
          console.error('[Supabase Sync] Erro ao reservar estoque na reabertura:', errEstUpd);
        }
      } else {
        await client.from('estoque').insert({
          produto_id: it.produto_id,
          quantidade_atual: 0,
          quantidade_reservada: it.quantidade,
          estoque_minimo: 5,
          updated_at: new Date().toISOString()
        });
      }
    }
  }

  return { success: true };
}

async function syncAdjustStock(client, payload) {
  const { error } = await client.from('estoque').update({
    quantidade_atual: payload.quantidade_atual,
    estoque_minimo: payload.estoque_minimo,
    updated_at: new Date().toISOString()
  }).eq('produto_id', payload.produtoId);
  if (error) {
    console.error('[Supabase Sync] Erro ao ajustar estoque:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncReceiveInstallment(client, payload) {
  const { error } = await client.from('parcelas').update({ pago: true }).eq('id', payload.parcelaId);
  if (error) {
    console.error('[Supabase Sync] Erro ao registrar recebimento de parcela:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncCreateClient(client, payload) {
  const { error } = await client.from('clientes').insert({
    id: payload.id,
    nome: payload.nome,
    nome_produtor: payload.nome_produtor || null,
    nome_fazenda: payload.nome_fazenda || null,
    latitude: payload.latitude || null,
    longitude: payload.longitude || null,
    cpf_cnpj: payload.cpf_cnpj,
    telefone: payload.telefone,
    endereco: payload.endereco,
    cidade: payload.cidade,
    limite_credito: Number(payload.limite_credito) || 0,
    observacoes: payload.observacoes || null
  });
  if (error) {
    console.error('[Supabase Sync] Erro ao criar cliente:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncUpdateProductPrice(client, payload) {
  const { error } = await client.from('produtos').update({
    preco: payload.preco
  }).eq('id', payload.id);
  if (error) {
    console.error('[Supabase Sync] Erro ao atualizar preço do produto:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncUpdateProduct(client, payload) {
  const { id, ...updates } = payload;
  // Imagem salva como base64 direto na coluna TEXT
  const { error } = await client.from('produtos').update(updates).eq('id', id);
  if (error) {
    console.error('[Supabase Sync] Erro ao atualizar dados do produto:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncCreateProduct(client, payload) {
  // Imagem salva como base64 direto na coluna TEXT
  const { error } = await client.from('produtos').insert({
    id: payload.id,
    codigo: payload.codigo,
    nome: payload.nome,
    unidade: payload.unidade,
    preco: payload.preco,
    imagem: payload.imagem || null,
    descricao: payload.descricao || null
  });
  if (error) {
    console.error('[Supabase Sync] Erro ao cadastrar produto:', error);
    return { success: false, error };
  }
  const { error: errEst } = await client.from('estoque').insert({
    produto_id: payload.id,
    quantidade_atual: Number(payload.quantidade_atual) || 0,
    quantidade_reservada: 0,
    estoque_minimo: Number(payload.estoque_minimo) || 5
  });
  if (errEst) {
    console.error('[Supabase Sync] Erro ao criar estoque inicial do produto:', errEst);
  }
  return { success: true };
}

async function syncDeleteProduct(client, payload) {
  const { id } = payload;
  const { error } = await client.from('produtos').delete().eq('id', Number(id));
  if (error) {
    console.error('[Supabase Sync] Erro ao deletar produto:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncUpdateCompany(client, payload) {
  const { id, ...updates } = payload;
  // logotipo salvo como base64 direto na coluna TEXT
  const { error } = await client.from('empresas').update(updates).eq('id', id);
  if (error) {
    console.error('[Supabase Sync] Erro ao atualizar empresa:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncSaveUser(client, payload) {
  const { error } = await client.from('usuarios').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase Sync] Erro ao salvar usuário por id, tentando por email:', error);
    const { error: error2 } = await client.from('usuarios').upsert(payload, { onConflict: 'email' });
    if (error2) {
      console.error('[Supabase Sync] Erro ao salvar usuário por email:', error2);
      return { success: false, error: error2 };
    }
  }
  return { success: true };
}

async function syncDeleteUser(client, payload) {
  const { id } = payload;
  const { error } = await client.from('usuarios').delete().eq('id', Number(id));
  if (error) {
    console.error('[Supabase Sync] Erro ao deletar usuário:', error);
    return { success: false, error };
  }
  return { success: true };
}

async function syncSaveClient(client, payload) {
  const { error } = await client.from('clientes').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase Sync] Erro ao salvar cliente:', error);
    return { success: false, error };
  }
  return { success: true };
}

// --- Sincronização Direta (Admin — sem fila) ---

/**
 * Salva dados da empresa diretamente no Supabase.
 * Usado pelo AdminPanel para garantir atualização imediata.
 * A logo (base64) é armazenada como TEXT no Supabase.
 */
export async function saveCompanyToSupabase(empresaData) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado. Configure a URL e Anon Key na aba Integrações.' };

  const { id, ...fields } = empresaData;
  if (!id) return { success: false, reason: 'ID da empresa não encontrado.' };

  // Logo salva como base64 diretamente na coluna TEXT logotipo
  const { data: existing, error: fetchErr } = await client
    .from('empresas')
    .select('id')
    .eq('id', id)
    .single();

  let error;
  if (!fetchErr && existing) {
    ({ error } = await client.from('empresas').update(fields).eq('id', id));
  } else {
    ({ error } = await client.from('empresas').insert({ id, ...fields }));
  }

  if (error) {
    console.error('[Supabase] Erro ao salvar empresa:', error);
    if (error.message?.includes('column') || error.code === '42703') {
      return { success: false, reason: `Coluna ausente: ${error.message}. Execute o SQL de migração no Dashboard do Supabase.` };
    }
    return { success: false, reason: error.message };
  }

  return { success: true };
}

/**
 * Salva produto diretamente no Supabase (upsert).
 * Usado pelo AdminPanel para atualização imediata de produtos.
 */
export async function saveProductToSupabase(produtoData) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  // Imagem salva como base64 diretamente na coluna TEXT
  const payload = {
    id: produtoData.id,
    codigo: produtoData.codigo,
    nome: produtoData.nome,
    unidade: produtoData.unidade,
    preco: Number(produtoData.preco),
    imagem: produtoData.imagem || null,
    descricao: produtoData.descricao || null
  };

  const { error } = await client.from('produtos').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase] Erro ao salvar produto:', error);
    return { success: false, reason: error.message };
  }

  // Garantir que exista um registro correspondente na tabela estoque no Supabase
  try {
    const { data: estData, error: estErr } = await client
      .from('estoque')
      .select('id')
      .eq('produto_id', produtoData.id)
      .maybeSingle();

    if (!estErr && !estData) {
      const { error: insErr } = await client.from('estoque').insert({
        produto_id: produtoData.id,
        quantidade_atual: 0,
        quantidade_reservada: 0,
        estoque_minimo: 5
      });
      if (insErr) {
        console.error('[Supabase] Erro ao criar registro de estoque inicial:', insErr);
      }
    }
  } catch (e) {
    console.error('[Supabase] Erro de exceção ao criar registro de estoque inicial:', e);
  }

  return { success: true };
}

// --- Download de Dados (Sync Down) ---

export async function downloadDataFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  const creds = getCredentials();
  if (creds.simulateOffline) return { success: false, reason: 'Modo Offline Ativado' };

  console.log('[Supabase Download] Iniciando download de dados do Supabase...');

  try {
    const { data: empresas, error: errEmp } = await client.from('empresas').select('*');
    if (errEmp) throw errEmp;
    
    const { data: usuarios, error: errUsr } = await client.from('usuarios').select('*');
    if (errUsr) throw errUsr;
    
    const { data: clientes, error: errCli } = await client.from('clientes').select('*');
    if (errCli) throw errCli;
    
    const { data: produtos, error: errPrd } = await client.from('produtos').select('*');
    if (errPrd) throw errPrd;
    
    const { data: estoque, error: errEst } = await client.from('estoque').select('*');
    if (errEst) throw errEst;
    
    const { data: pedidos, error: errPed } = await client.from('pedidos').select('*');
    if (errPed) throw errPed;
    
    const { data: itens_pedido, error: errItens } = await client.from('itens_pedido').select('*');
    if (errItens) throw errItens;
    
    const { data: parcelas, error: errPar } = await client.from('parcelas').select('*');
    if (errPar) throw errPar;
    
    const { data: assinaturas, error: errAss } = await client.from('assinaturas').select('*');
    if (errAss) throw errAss;
    
    const { data: fotos_entrega, error: errFoto } = await client.from('fotos_entrega').select('*');
    if (errFoto) throw errFoto;
    
    const { data: localizacoes, error: errLoc } = await client.from('localizacoes').select('*');
    if (errLoc) throw errLoc;

    const db = getDb();

    // Sobrescreve os dados locais com os dados do Supabase.
    // Usa os dados do Supabase se retornar array (mesmo vazio), para limpar dados mock antigos.
    // Para tabelas críticas (empresas, usuarios) sempre sobrescreve se vier array válido.
    if (Array.isArray(empresas)) db.empresas = empresas.length ? empresas : db.empresas;
    if (Array.isArray(usuarios) && usuarios.length) db.usuarios = usuarios;
    if (Array.isArray(clientes) && clientes.length) db.clientes = clientes;
    if (Array.isArray(produtos) && produtos.length) db.produtos = produtos;
    if (Array.isArray(estoque) && estoque.length) db.estoque = estoque;
    if (Array.isArray(pedidos)) db.pedidos = pedidos; // Sempre substitui (pode estar vazio no Supabase)
    if (Array.isArray(itens_pedido)) db.itens_pedido = itens_pedido;
    if (Array.isArray(parcelas)) db.parcelas = parcelas;
    if (Array.isArray(assinaturas)) db.assinaturas = assinaturas;
    if (Array.isArray(fotos_entrega)) db.fotos_entrega = fotos_entrega;
    if (Array.isArray(localizacoes)) db.localizacoes = localizacoes;

    console.log(`[Supabase Download] Sincronizado: ${empresas?.length || 0} empresas, ${usuarios?.length || 0} usuários, ${pedidos?.length || 0} pedidos, ${clientes?.length || 0} clientes.`);

    saveDb(db);
    return { success: true, counts: { empresas: empresas?.length, usuarios: usuarios?.length, pedidos: pedidos?.length, clientes: clientes?.length } };
  } catch (err) {
    console.error('[Supabase Download Error]', err);
    return { success: false, reason: err.message || JSON.stringify(err) };
  }
}

export async function deleteProductFromSupabase(id) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  const { error } = await client.from('produtos').delete().eq('id', Number(id));
  if (error) {
    console.error('[Supabase] Erro ao deletar produto:', error);
    return { success: false, reason: error.message };
  }
  return { success: true };
}

export async function saveStockToSupabase(produtoId, quantidadeAtual, estoqueMinimo) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  const { data: estData, error: estErr } = await client
    .from('estoque')
    .select('id')
    .eq('produto_id', Number(produtoId))
    .maybeSingle();

  let error;
  if (!estErr && estData) {
    ({ error } = await client.from('estoque').update({
      quantidade_atual: Number(quantidadeAtual),
      estoque_minimo: Number(estoqueMinimo),
      updated_at: new Date().toISOString()
    }).eq('produto_id', Number(produtoId)));
  } else {
    ({ error } = await client.from('estoque').insert({
      produto_id: Number(produtoId),
      quantidade_atual: Number(quantidadeAtual),
      quantidade_reservada: 0,
      estoque_minimo: Number(estoqueMinimo),
      updated_at: new Date().toISOString()
    }));
  }

  if (error) {
    console.error('[Supabase] Erro ao salvar estoque:', error);
    return { success: false, reason: error.message };
  }
  return { success: true };
}

/**
 * Salva (cria ou atualiza) um usuário no Supabase.
 * Usado pelo AdminPanel para garantir que usuários criados/editados
 * persistam no banco de dados e não sejam perdidos ao sincronizar.
 */
export async function saveUserToSupabase(userData) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  const payload = {
    id: userData.id,
    nome: userData.nome,
    email: userData.email,
    perfil: userData.perfil,
    ativo: userData.ativo !== undefined ? userData.ativo : true,
    senha: userData.senha || null
  };

  const { error } = await client.from('usuarios').upsert(payload, { onConflict: 'id' });
  if (error) {
    // Tentar upsert por email caso o id seja conflitante
    console.error('[Supabase] Erro ao salvar usuário por id, tentando por email:', error);
    const { error: error2 } = await client.from('usuarios').upsert(
      { ...payload },
      { onConflict: 'email' }
    );
    if (error2) {
      console.error('[Supabase] Erro ao salvar usuário por email:', error2);
      return { success: false, reason: error2.message };
    }
  }
  return { success: true };
}

/**
 * Exclui um usuário do Supabase.
 * Usado pelo AdminPanel para garantir exclusão imediata.
 */
export async function deleteUserFromSupabase(id) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  const { error } = await client.from('usuarios').delete().eq('id', Number(id));
  if (error) {
    console.error('[Supabase] Erro ao deletar usuário:', error);
    return { success: false, reason: error.message };
  }
  return { success: true };
}

/**
 * Salva (cria ou atualiza) um cliente no Supabase.
 * Usado pelo ClientManager para garantir atualização imediata de crédito e observações.
 */
export async function saveClientToSupabase(clientData) {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado.' };

  const payload = {
    id: clientData.id,
    nome: clientData.nome,
    nome_produtor: clientData.nome_produtor || null,
    nome_fazenda: clientData.nome_fazenda || null,
    latitude: clientData.latitude || null,
    longitude: clientData.longitude || null,
    cpf_cnpj: clientData.cpf_cnpj || null,
    telefone: clientData.telefone || null,
    endereco: clientData.endereco || null,
    cidade: clientData.cidade || null,
    limite_credito: Number(clientData.limite_credito) || 0,
    observacoes: clientData.observacoes || null
  };

  const { error } = await client.from('clientes').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('[Supabase] Erro ao salvar cliente:', error);
    return { success: false, reason: error.message };
  }
  return { success: true };
}

