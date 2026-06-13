// Serviço de Conectividade com o Supabase
import { createClient } from '@supabase/supabase-js';
import { getCredentials, getSyncQueue, saveSyncQueue, getDb, saveDb } from './db';

let supabaseInstance = null;

// Obter cliente Supabase ativo
function getSupabaseClient() {
  const creds = getCredentials();
  if (!creds.supabaseUrl || !creds.supabaseAnonKey) {
    return null;
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(creds.supabaseUrl, creds.supabaseAnonKey);
  }
  return supabaseInstance;
}

// Resetar instância se credenciais mudarem
window.addEventListener('fortegado_credentials_update', () => {
  supabaseInstance = null;
});

// Sincronizar Fila Offline
export async function syncQueueToSupabase() {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado' };
  
  const creds = getCredentials();
  if (creds.simulateOffline) return { success: false, reason: 'Modo Offline Ativado' };

  let queue = getSyncQueue();
  if (queue.length === 0) return { success: true, processed: 0 };

  console.log(`[Supabase Sync] Iniciando sincronização de ${queue.length} itens.`);
  let processedCount = 0;
  const newQueue = [...queue];

  for (const item of queue) {
    try {
      const { actionType, payload } = item;
      let syncSuccess = false;

      if (actionType === 'CREATE_ORDER') {
        syncSuccess = await syncCreateOrder(client, payload);
      } else if (actionType === 'CONFIRM_DELIVERY') {
        syncSuccess = await syncConfirmDelivery(client, payload);
      } else if (actionType === 'CANCEL_ORDER') {
        syncSuccess = await syncCancelOrder(client, payload);
      } else if (actionType === 'REOPEN_ORDER') {
        syncSuccess = await syncReopenOrder(client, payload);
      } else if (actionType === 'ADJUST_STOCK') {
        syncSuccess = await syncAdjustStock(client, payload);
      } else if (actionType === 'RECEIVE_INSTALLMENT') {
        syncSuccess = await syncReceiveInstallment(client, payload);
      } else if (actionType === 'CREATE_CLIENT') {
        syncSuccess = await syncCreateClient(client, payload);
      } else if (actionType === 'UPDATE_PRODUCT_PRICE') {
        syncSuccess = await syncUpdateProductPrice(client, payload);
      } else if (actionType === 'UPDATE_PRODUCT') {
        syncSuccess = await syncUpdateProduct(client, payload);
      } else if (actionType === 'CREATE_PRODUCT') {
        syncSuccess = await syncCreateProduct(client, payload);
      } else if (actionType === 'UPDATE_COMPANY') {
        syncSuccess = await syncUpdateCompany(client, payload);
      } else {
        // Tipo desconhecido: remove da fila para não bloquear
        syncSuccess = true;
      }

      if (syncSuccess) {
        // Remover da fila
        const idx = newQueue.findIndex(q => q.id === item.id);
        if (idx > -1) newQueue.splice(idx, 1);
        processedCount++;
      } else {
        // Interrompe na primeira falha para manter a ordem cronológica
        break;
      }
    } catch (err) {
      console.error('[Supabase Sync Error]', err);
      break;
    }
  }

  saveSyncQueue(newQueue);
  return { success: true, processed: processedCount };
}

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
  if (errPed) return false;

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
  if (errItens) return false;

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
  if (errPar) return false;

  // 4. Inserir Assinatura
  const { error: errAss } = await client.from('assinaturas').insert({
    id: payload.assinatura.id,
    pedido_id: payload.assinatura.pedido_id,
    imagem: payload.assinatura.imagem
  });
  if (errAss) return false;

  // 5. Inserir Localização
  const { error: errLoc } = await client.from('localizacoes').insert({
    id: payload.localizacao.id,
    pedido_id: payload.localizacao.pedido_id,
    tipo: payload.localizacao.tipo,
    latitude: payload.localizacao.latitude,
    longitude: payload.localizacao.longitude,
    data_hora: payload.localizacao.data_hora
  });
  if (errLoc) return false;

  // 6. Atualizar estoque reservado
  for (const it of payload.estoqueUpdates) {
    // Obter estoque atual do Supabase
    const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).single();
    if (estData) {
      await client.from('estoque').update({
        quantidade_reservada: estData.quantidade_reservada + it.deltaReservado,
        updated_at: new Date().toISOString()
      }).eq('produto_id', it.produto_id);
    }
  }

  return true;
}

async function syncConfirmDelivery(client, payload) {
  // 1. Atualizar Pedido
  const { error: errPed } = await client.from('pedidos').update({ status: 'Entregue' }).eq('id', payload.pedidoId);
  if (errPed) return false;

  // 2. Inserir Foto da entrega
  const { error: errFoto } = await client.from('fotos_entrega').insert({
    id: payload.foto.id,
    pedido_id: payload.foto.pedido_id,
    imagem: payload.foto.imagem
  });
  if (errFoto) return false;

  // 3. Inserir Localização
  const { error: errLoc } = await client.from('localizacoes').insert({
    id: payload.localizacao.id,
    pedido_id: payload.localizacao.pedido_id,
    tipo: payload.localizacao.tipo,
    latitude: payload.localizacao.latitude,
    longitude: payload.localizacao.longitude,
    data_hora: payload.localizacao.data_hora
  });
  if (errLoc) return false;

  // 4. Atualizar Estoque (Debitar Reservado e Baixar Atual)
  for (const it of payload.estoqueUpdates) {
    const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).single();
    if (estData) {
      await client.from('estoque').update({
        quantidade_reservada: Math.max(0, estData.quantidade_reservada - it.quantidade),
        quantidade_atual: Math.max(0, estData.quantidade_atual - it.quantidade),
        updated_at: new Date().toISOString()
      }).eq('produto_id', it.produto_id);
    }
  }

  return true;
}

async function syncCancelOrder(client, payload) {
  const { error: errPed } = await client.from('pedidos').update({ status: 'Cancelado' }).eq('id', payload.pedidoId);
  if (errPed) return false;

  // Se estava Emitido, libera o estoque reservado no Supabase
  if (payload.oldStatus === 'Emitido') {
    // Buscar itens do pedido no Supabase
    const { data: itens } = await client.from('itens_pedido').select('*').eq('pedido_id', payload.pedidoId);
    if (itens) {
      for (const it of itens) {
        const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).single();
        if (estData) {
          await client.from('estoque').update({
            quantidade_reservada: Math.max(0, estData.quantidade_reservada - it.quantidade),
            updated_at: new Date().toISOString()
          }).eq('produto_id', it.produto_id);
        }
      }
    }
  }

  return true;
}

async function syncReopenOrder(client, payload) {
  const { error: errPed } = await client.from('pedidos').update({ status: 'Emitido' }).eq('id', payload.pedidoId);
  if (errPed) return false;

  // Reservar estoque novamente
  const { data: itens } = await client.from('itens_pedido').select('*').eq('pedido_id', payload.pedidoId);
  if (itens) {
    for (const it of itens) {
      const { data: estData } = await client.from('estoque').select('*').eq('produto_id', it.produto_id).single();
      if (estData) {
        await client.from('estoque').update({
          quantidade_reservada: estData.quantidade_reservada + it.quantidade,
          updated_at: new Date().toISOString()
        }).eq('produto_id', it.produto_id);
      }
    }
  }

  return true;
}

async function syncAdjustStock(client, payload) {
  const { error } = await client.from('estoque').update({
    quantidade_atual: payload.quantidade_atual,
    estoque_minimo: payload.estoque_minimo,
    updated_at: new Date().toISOString()
  }).eq('produto_id', payload.produtoId);
  return !error;
}

async function syncReceiveInstallment(client, payload) {
  const { error } = await client.from('parcelas').update({ pago: true }).eq('id', payload.parcelaId);
  return !error;
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
    cidade: payload.cidade
  });
  return !error;
}

async function syncUpdateProductPrice(client, payload) {
  const { error } = await client.from('produtos').update({
    preco: payload.preco
  }).eq('id', payload.id);
  return !error;
}

async function syncUpdateProduct(client, payload) {
  const { id, ...updates } = payload;
  // Apenas campos aceitos pelo Supabase (sem id)
  const { error } = await client.from('produtos').update(updates).eq('id', id);
  return !error;
}

async function syncCreateProduct(client, payload) {
  const { error } = await client.from('produtos').insert({
    id: payload.id,
    codigo: payload.codigo,
    nome: payload.nome,
    unidade: payload.unidade,
    preco: payload.preco,
    imagem: payload.imagem || null,
    descricao: payload.descricao || null
  });
  if (error) return false;
  // Criar entrada de estoque zerada
  await client.from('estoque').insert({
    produto_id: payload.id,
    quantidade_atual: 0,
    quantidade_reservada: 0,
    estoque_minimo: 5
  });
  return true;
}

async function syncUpdateCompany(client, payload) {
  const { id, ...updates } = payload;
  const { error } = await client.from('empresas').update(updates).eq('id', id);
  return !error;
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

  // Tenta UPDATE primeiro
  const { data: existing, error: fetchErr } = await client
    .from('empresas')
    .select('id')
    .eq('id', id)
    .single();

  let error;
  if (!fetchErr && existing) {
    // Atualiza registro existente
    ({ error } = await client.from('empresas').update(fields).eq('id', id));
  } else {
    // Insere novo registro se não existir
    ({ error } = await client.from('empresas').insert({ id, ...fields }));
  }

  if (error) {
    console.error('[Supabase] Erro ao salvar empresa:', error);
    // Verificar se é erro de coluna ausente
    if (error.message?.includes('column') || error.code === '42703') {
      return { success: false, reason: `Coluna ausente no Supabase: ${error.message}. Execute o SQL de migração.` };
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

  // Campos de produto aceitos pelo Supabase
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
  return { success: true };
}

// --- Download de Dados (Sync Down) ---

export async function downloadDataFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return { success: false, reason: 'Supabase não configurado' };

  try {
    const { data: empresas } = await client.from('empresas').select('*');
    const { data: usuarios } = await client.from('usuarios').select('*');
    const { data: clientes } = await client.from('clientes').select('*');
    const { data: produtos } = await client.from('produtos').select('*');
    const { data: estoque } = await client.from('estoque').select('*');
    const { data: pedidos } = await client.from('pedidos').select('*');
    const { data: itens_pedido } = await client.from('itens_pedido').select('*');
    const { data: parcelas } = await client.from('parcelas').select('*');
    const { data: assinaturas } = await client.from('assinaturas').select('*');
    const { data: fotos_entrega } = await client.from('fotos_entrega').select('*');
    const { data: localizacoes } = await client.from('localizacoes').select('*');

    const db = getDb();
    if (empresas?.length) db.empresas = empresas;
    if (usuarios?.length) db.usuarios = usuarios;
    if (clientes?.length) db.clientes = clientes;
    if (produtos?.length) db.produtos = produtos;
    if (estoque?.length) db.estoque = estoque;
    if (pedidos?.length) db.pedidos = pedidos;
    if (itens_pedido?.length) db.itens_pedido = itens_pedido;
    if (parcelas?.length) db.parcelas = parcelas;
    if (assinaturas?.length) db.assinaturas = assinaturas;
    if (fotos_entrega?.length) db.fotos_entrega = fotos_entrega;
    if (localizacoes?.length) db.localizacoes = localizacoes;

    saveDb(db);
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, reason: err.message };
  }
}
