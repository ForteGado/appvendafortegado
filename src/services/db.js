// Banco de Dados Local com Mock Data e Fila Offline
// Simulando as tabelas do Supabase

const LOCAL_STORAGE_KEY = 'fortegado_db';
const SYNC_QUEUE_KEY = 'fortegado_sync_queue';
const CREDENTIALS_KEY = 'fortegado_credentials';

// Dados Iniciais Fictícios
const INITIAL_DATA = {
  empresas: [
    { id: 1, nome: 'Forte Gado Comercial Ltda', cnpj: '12.345.678/0001-90', endereco: 'Rodovia Transagro, Km 45, Uberaba - MG', telefone: '(34) 99999-1111', logotipo: '🐂' }
  ],
  usuarios: [
    { id: 1, nome: 'Wislley Prado', email: 'prado@fortegado.com.br', perfil: 'Administrador', ativo: true },
    { id: 2, nome: 'Silva Vendedor', email: 'silva@fortegado.com.br', perfil: 'Vendedor', ativo: true }
  ],
  clientes: [
    { id: 1, nome: 'Fazenda Bela Vista (Carlos)', cpf_cnpj: '11.222.333/0001-44', telefone: '(34) 98888-2222', endereco: 'Estrada Geral, Zona Rural', cidade: 'Uberaba' },
    { id: 2, nome: 'Agropecuária São José', cpf_cnpj: '22.333.444/0001-55', telefone: '(34) 98777-3333', endereco: 'Av. Brasil, 120, Centro', cidade: 'Sacramento' },
    { id: 3, nome: 'Haras Imperial (Dra. Ana)', cpf_cnpj: '33.444.555/0001-66', telefone: '(16) 99666-4444', endereco: 'Rodovia SP-330, Km 310', cidade: 'Ribeirão Preto' },
    { id: 4, nome: 'Fazenda Santa Maria (José)', cpf_cnpj: '44.555.666/0001-77', telefone: '(34) 99555-5555', endereco: 'Vicinal dos Ipês, Km 8', cidade: 'Conquista' },
    { id: 5, nome: 'Recanto Feliz Agro', cpf_cnpj: '55.666.777/0001-88', telefone: '(34) 99111-6666', endereco: 'Fazenda Recanto Feliz', cidade: 'Delta' }
  ],
  produtos: [
    { id: 1, codigo: 'RAC001', nome: 'Ração Gado de Corte Premium', unidade: 'Saco 40kg', preco: 120.00 },
    { id: 2, codigo: 'SUP002', nome: 'Suplemento Mineral Fosgasto', unidade: 'Saco 25kg', preco: 185.50 },
    { id: 3, codigo: 'SAL003', nome: 'Sal Milagroso Engorda Rápida', unidade: 'Saco 25kg', preco: 95.00 },
    { id: 4, codigo: 'VAC004', nome: 'Vacina Antiaftosa ForteDose', unidade: 'Frasco 50ml', preco: 350.00 },
    { id: 5, codigo: 'VER005', nome: 'Vermífugo Premium Potente', unidade: 'Frasco 500ml', preco: 280.00 }
  ],
  estoque: [
    { id: 1, produto_id: 1, quantidade_atual: 150, quantidade_reservada: 20, estoque_minimo: 30 },
    { id: 2, produto_id: 2, quantidade_atual: 45, quantidade_reservada: 5, estoque_minimo: 10 },
    { id: 3, produto_id: 3, quantidade_atual: 300, quantidade_reservada: 0, estoque_minimo: 50 },
    { id: 4, produto_id: 4, quantidade_atual: 12, quantidade_reservada: 2, estoque_minimo: 15 }, // Estoque baixo!
    { id: 5, produto_id: 5, quantidade_atual: 0, quantidade_reservada: 0, estoque_minimo: 5 }     // Sem estoque!
  ],
  pedidos: [
    { id: 1001, numero: 'FG-1001', cliente_id: 1, vendedor_id: 2, data: '2026-06-12T10:00:00Z', status: 'Entregue', total: 610.00 },
    { id: 1002, numero: 'FG-1002', cliente_id: 2, vendedor_id: 2, data: '2026-06-13T09:15:00Z', status: 'Emitido', total: 2420.00 },
    { id: 1003, numero: 'FG-1003', cliente_id: 3, vendedor_id: 1, data: '2026-06-13T11:30:00Z', status: 'Emitido', total: 1100.00 }
  ],
  itens_pedido: [
    { id: 1, pedido_id: 1001, produto_id: 1, quantidade: 2, valor_unitario: 120.00, desconto: 10.00 },
    { id: 2, pedido_id: 1001, produto_id: 2, quantidade: 2, valor_unitario: 185.00, desconto: 0.00 },
    { id: 3, pedido_id: 1002, produto_id: 4, quantidade: 2, valor_unitario: 350.00, desconto: 0.00 },
    { id: 4, pedido_id: 1002, produto_id: 1, quantidade: 10, valor_unitario: 120.00, desconto: 0.00 },
    { id: 5, pedido_id: 1002, produto_id: 3, quantidade: 5, valor_unitario: 95.00, desconto: 25.00 },
    { id: 6, pedido_id: 1003, produto_id: 2, quantidade: 5, valor_unitario: 185.50, desconto: 0.00 },
    { id: 7, pedido_id: 1003, produto_id: 3, quantidade: 2, valor_unitario: 95.00, desconto: 10.00 }
  ],
  parcelas: [
    { id: 1, pedido_id: 1001, vencimento: '2026-07-12', valor: 305.00, pago: true },
    { id: 2, pedido_id: 1001, vencimento: '2026-08-12', valor: 305.00, pago: true },
    { id: 3, pedido_id: 1002, vencimento: '2026-06-13', valor: 1210.00, pago: false },
    { id: 4, pedido_id: 1002, vencimento: '2026-07-13', valor: 1210.00, pago: false },
    { id: 5, pedido_id: 1003, vencimento: '2026-07-13', valor: 1100.00, pago: false }
  ],
  assinaturas: [
    { id: 1, pedido_id: 1001, imagem: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><path d="M 10,15 Q 30,5 50,20 T 90,15" fill="none" stroke="black" stroke-width="2"/></svg>' },
    { id: 2, pedido_id: 1002, imagem: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><path d="M 5,20 C 30,0 70,30 95,10" fill="none" stroke="black" stroke-width="2"/></svg>' },
    { id: 3, pedido_id: 1003, imagem: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><path d="M 10,10 Q 50,30 90,10" fill="none" stroke="black" stroke-width="2"/></svg>' }
  ],
  fotos_entrega: [
    { id: 1, pedido_id: 1001, imagem: '🐂' }
  ],
  localizacoes: [
    { id: 1, pedido_id: 1001, tipo: 'venda', latitude: -19.7476, longitude: -47.9392, data_hora: '2026-06-12T10:00:00Z' },
    { id: 2, pedido_id: 1001, tipo: 'entrega', latitude: -19.7480, longitude: -47.9388, data_hora: '2026-06-12T14:30:00Z' },
    { id: 3, pedido_id: 1002, tipo: 'venda', latitude: -19.7345, longitude: -47.9022, data_hora: '2026-06-13T09:15:00Z' },
    { id: 4, pedido_id: 1003, tipo: 'venda', latitude: -21.1704, longitude: -47.8103, data_hora: '2026-06-13T11:30:00Z' }
  ]
};

// Obter banco de dados atual
export function getDb() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DATA));
    return INITIAL_DATA;
  }
  return JSON.parse(data);
}

// Salvar alterações
export function saveDb(data) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  // Notificar o app sobre a mudança (para atualizar telas em tempo real se necessário)
  window.dispatchEvent(new Event('fortegado_db_update'));
}

// Resetar para valores padrão
export function resetDb() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DATA));
  window.dispatchEvent(new Event('fortegado_db_update'));
}

// --- Credenciais e Configurações ---
export function getCredentials() {
  const data = localStorage.getItem(CREDENTIALS_KEY);
  const defaultCreds = {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    googleSheetsUrl: '',
    activeUserId: 2,
    simulateOffline: false
  };
  if (!data) {
    return defaultCreds;
  }
  const parsed = JSON.parse(data);
  if (!parsed.supabaseUrl) parsed.supabaseUrl = defaultCreds.supabaseUrl;
  if (!parsed.supabaseAnonKey) parsed.supabaseAnonKey = defaultCreds.supabaseAnonKey;
  return parsed;
}

export function saveCredentials(creds) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
  window.dispatchEvent(new Event('fortegado_credentials_update'));
}

// --- Fila de Sincronização ---
export function getSyncQueue() {
  const queue = localStorage.getItem(SYNC_QUEUE_KEY);
  return queue ? JSON.parse(queue) : [];
}

export function saveSyncQueue(queue) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event('fortegado_queue_update'));
}

export function addToSyncQueue(actionType, payload) {
  const queue = getSyncQueue();
  queue.push({
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    actionType,
    payload,
    createdAt: new Date().toISOString()
  });
  saveSyncQueue(queue);
}

// --- AÇÕES DO BANCO DE DADOS LOCAL ---

// Novo Pedido
export function createOrderLocal(orderData) {
  const db = getDb();
  const nextId = db.pedidos.length > 0 ? Math.max(...db.pedidos.map(p => p.id)) + 1 : 1001;
  const nextNum = `FG-${nextId}`;
  
  const newOrder = {
    id: nextId,
    numero: nextNum,
    cliente_id: Number(orderData.cliente_id),
    vendedor_id: Number(orderData.vendedor_id),
    data: new Date().toISOString(),
    status: 'Emitido',
    total: orderData.total
  };
  
  // Itens
  const items = orderData.itens.map((it, idx) => {
    const nextItemId = db.itens_pedido.length > 0 ? Math.max(...db.itens_pedido.map(i => i.id)) + 1 + idx : 1 + idx;
    return {
      id: nextItemId,
      pedido_id: nextId,
      produto_id: Number(it.produto_id),
      quantidade: Number(it.quantidade),
      valor_unitario: Number(it.valor_unitario),
      desconto: Number(it.desconto || 0)
    };
  });

  // Parcelas
  const parcelas = orderData.parcelas.map((par, idx) => {
    const nextParId = db.parcelas.length > 0 ? Math.max(...db.parcelas.map(p => p.id)) + 1 + idx : 1 + idx;
    return {
      id: nextParId,
      pedido_id: nextId,
      vencimento: par.vencimento,
      valor: Number(par.valor),
      pago: false
    };
  });

  // Assinatura
  const nextAssId = db.assinaturas.length > 0 ? Math.max(...db.assinaturas.map(a => a.id)) + 1 : 1;
  const assinatura = {
    id: nextAssId,
    pedido_id: nextId,
    imagem: orderData.assinatura
  };

  // Localização
  const nextLocId = db.localizacoes.length > 0 ? Math.max(...db.localizacoes.map(l => l.id)) + 1 : 1;
  const localizacao = {
    id: nextLocId,
    pedido_id: nextId,
    tipo: 'venda',
    latitude: orderData.latitude,
    longitude: orderData.longitude,
    data_hora: new Date().toISOString()
  };

  // Atualizar Estoque (Reservar)
  orderData.itens.forEach(it => {
    const est = db.estoque.find(e => e.produto_id === Number(it.produto_id));
    if (est) {
      est.quantidade_reservada += Number(it.quantidade);
    }
  });

  // Inserir registros
  db.pedidos.push(newOrder);
  db.itens_pedido.push(...items);
  db.parcelas.push(...parcelas);
  db.assinaturas.push(assinatura);
  db.localizacoes.push(localizacao);

  saveDb(db);

  // Adicionar para sincronizar
  addToSyncQueue('CREATE_ORDER', {
    pedido: newOrder,
    itens: items,
    parcelas,
    assinatura,
    localizacao,
    estoqueUpdates: orderData.itens.map(it => ({ produto_id: it.produto_id, deltaReservado: it.quantidade }))
  });

  return newOrder;
}

// Confirmar Entrega
export function confirmDeliveryLocal(pedidoId, deliveryData) {
  const db = getDb();
  const ped = db.pedidos.find(p => p.id === Number(pedidoId));
  if (!ped) return null;

  ped.status = 'Entregue';

  // Registrar foto de entrega
  const nextFotoId = db.fotos_entrega.length > 0 ? Math.max(...db.fotos_entrega.map(f => f.id)) + 1 : 1;
  const foto = {
    id: nextFotoId,
    pedido_id: Number(pedidoId),
    imagem: deliveryData.imagem // Base64
  };
  db.fotos_entrega.push(foto);

  // Registrar localização de entrega
  const nextLocId = db.localizacoes.length > 0 ? Math.max(...db.localizacoes.map(l => l.id)) + 1 : 1;
  const localizacao = {
    id: nextLocId,
    pedido_id: Number(pedidoId),
    tipo: 'entrega',
    latitude: deliveryData.latitude,
    longitude: deliveryData.longitude,
    data_hora: new Date().toISOString()
  };
  db.localizacoes.push(localizacao);

  // Atualizar estoque (Demitir reservado e baixar total)
  const itens = db.itens_pedido.filter(i => i.pedido_id === Number(pedidoId));
  itens.forEach(it => {
    const est = db.estoque.find(e => e.produto_id === Number(it.produto_id));
    if (est) {
      est.quantidade_reservada = Math.max(0, est.quantidade_reservada - it.quantidade);
      est.quantidade_atual = Math.max(0, est.quantidade_atual - it.quantidade);
    }
  });

  saveDb(db);

  // Adicionar à fila de sincronização
  addToSyncQueue('CONFIRM_DELIVERY', {
    pedidoId: Number(pedidoId),
    foto,
    localizacao,
    estoqueUpdates: itens.map(it => ({ produto_id: it.produto_id, quantidade: it.quantidade }))
  });

  return ped;
}

// Cancelar Pedido (Apenas Admin)
export function cancelOrderLocal(pedidoId) {
  const db = getDb();
  const ped = db.pedidos.find(p => p.id === Number(pedidoId));
  if (!ped) return null;

  const oldStatus = ped.status;
  ped.status = 'Cancelado';

  // Se estava "Emitido" (reservado), libera o estoque
  if (oldStatus === 'Emitido') {
    const itens = db.itens_pedido.filter(i => i.pedido_id === Number(pedidoId));
    itens.forEach(it => {
      const est = db.estoque.find(e => e.produto_id === Number(it.produto_id));
      if (est) {
        est.quantidade_reservada = Math.max(0, est.quantidade_reservada - it.quantidade);
      }
    });
  }

  saveDb(db);
  addToSyncQueue('CANCEL_ORDER', { pedidoId: Number(pedidoId), oldStatus });
  return ped;
}

// Reabrir Pedido Cancelado (Apenas Admin)
export function reopenOrderLocal(pedidoId) {
  const db = getDb();
  const ped = db.pedidos.find(p => p.id === Number(pedidoId));
  if (!ped || ped.status !== 'Cancelado') return null;

  ped.status = 'Emitido';

  // Reservar estoque novamente
  const itens = db.itens_pedido.filter(i => i.pedido_id === Number(pedidoId));
  itens.forEach(it => {
    const est = db.estoque.find(e => e.produto_id === Number(it.produto_id));
    if (est) {
      est.quantidade_reservada += it.quantidade;
    }
  });

  saveDb(db);
  addToSyncQueue('REOPEN_ORDER', { pedidoId: Number(pedidoId) });
  return ped;
}

// Ajustar Estoque (Apenas Admin)
export function adjustStockLocal(produtoId, novaQuantidadeAtual, novaQuantidadeMinima) {
  const db = getDb();
  const est = db.estoque.find(e => e.produto_id === Number(produtoId));
  if (!est) return null;

  est.quantidade_atual = Number(novaQuantidadeAtual);
  if (novaQuantidadeMinima !== undefined) {
    est.estoque_minimo = Number(novaQuantidadeMinima);
  }

  saveDb(db);
  addToSyncQueue('ADJUST_STOCK', { produtoId: Number(produtoId), quantidade_atual: est.quantidade_atual, estoque_minimo: est.estoque_minimo });
  return est;
}

// Registrar Recebimento de Parcela
export function receiveInstallmentLocal(parcelaId) {
  const db = getDb();
  const par = db.parcelas.find(p => p.id === Number(parcelaId));
  if (!par) return null;

  par.pago = true;
  saveDb(db);
  addToSyncQueue('RECEIVE_INSTALLMENT', { parcelaId: Number(parcelaId) });
  return par;
}

// Cadastrar Cliente Rápido
export function createClientLocal(clientData) {
  const db = getDb();
  const nextId = db.clientes.length > 0 ? Math.max(...db.clientes.map(c => c.id)) + 1 : 1;
  const newClient = {
    id: nextId,
    nome: clientData.nome,
    cpf_cnpj: clientData.cpf_cnpj || '',
    telefone: clientData.telefone || '',
    endereco: clientData.endereco || '',
    cidade: clientData.cidade || ''
  };
  
  db.clientes.push(newClient);
  saveDb(db);
  addToSyncQueue('CREATE_CLIENT', newClient);
  return newClient;
}
