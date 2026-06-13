// Serviço de Conectividade com o Google Sheets (via Apps Script)
import { getCredentials, getDb } from './db';

// Sincronizar ação com o Google Sheets
export async function syncToGoogleSheets(actionType, payload) {
  const creds = getCredentials();
  if (!creds.googleSheetsUrl) {
    return { success: false, reason: 'Google Sheets não configurado' };
  }
  
  if (creds.simulateOffline) {
    return { success: false, reason: 'Modo Offline Ativado' };
  }

  const db = getDb();
  let sheetsPayload = {};

  try {
    if (actionType === 'CREATE_ORDER') {
      const client = db.clientes.find(c => c.id === payload.pedido.cliente_id) || {};
      const seller = db.usuarios.find(u => u.id === payload.pedido.vendedor_id) || {};
      
      sheetsPayload = {
        action: 'CREATE_ORDER',
        payload: {
          pedido: payload.pedido,
          clienteNome: client.nome || 'Cliente Desconhecido',
          clienteCidade: client.cidade || 'Não informada',
          vendedorNome: seller.nome || 'Vendedor',
          parcelas: payload.parcelas
        }
      };
    } else if (actionType === 'CONFIRM_DELIVERY') {
      const ped = db.pedidos.find(p => p.id === payload.pedidoId) || {};
      const items = db.itens_pedido.filter(i => i.pedido_id === payload.pedidoId);
      
      const resolvedItems = items.map(it => {
        const prod = db.produtos.find(p => p.id === it.produto_id) || {};
        return {
          ...it,
          produtoNome: prod.nome || 'Produto'
        };
      });

      sheetsPayload = {
        action: 'CONFIRM_DELIVERY',
        payload: {
          pedidoNumero: ped.numero || '',
          itens: resolvedItems
        }
      };
    } else if (actionType === 'CANCEL_ORDER') {
      const ped = db.pedidos.find(p => p.id === payload.pedidoId) || {};
      sheetsPayload = {
        action: 'CANCEL_ORDER',
        payload: {
          pedidoNumero: ped.numero
        }
      };
    } else if (actionType === 'REOPEN_ORDER') {
      const ped = db.pedidos.find(p => p.id === payload.pedidoId) || {};
      sheetsPayload = {
        action: 'REOPEN_ORDER',
        payload: {
          pedidoNumero: ped.numero
        }
      };
    } else if (actionType === 'RECEIVE_INSTALLMENT') {
      const par = db.parcelas.find(p => p.id === payload.parcelaId) || {};
      const ped = db.pedidos.find(p => p.id === par.pedido_id) || {};
      const client = db.clientes.find(c => c.id === ped.cliente_id) || {};
      const allPars = db.parcelas.filter(p => p.pedido_id === ped.id);
      const index = allPars.findIndex(p => p.id === par.id) + 1;
      
      sheetsPayload = {
        action: 'RECEIVE_INSTALLMENT',
        payload: {
          clienteNome: client.nome || '',
          parcelaIndex: index + '/' + allPars.length,
          pedidoNumero: ped.numero
        }
      };
    } else {
      // Outras ações não impactam relatórios do Sheets diretamente ou disparam atualização global
      sheetsPayload = {
        action: 'ADJUST_STOCK',
        payload: {}
      };
    }

    console.log('[Google Sheets Sync] Enviando requisição para:', creds.googleSheetsUrl);
    
    // Como o Google Apps Script faz redirecionamentos (HTTP 302), a chamada padrão do fetch lida bem com isso
    const response = await fetch(creds.googleSheetsUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/plain', // Usando text/plain para evitar problemas de preflight CORS no Apps Script
      },
      body: JSON.stringify(sheetsPayload)
    });

    const result = await response.json();
    return result;

  } catch (err) {
    console.error('[Google Sheets Sync Error]', err);
    return { success: false, error: err.message };
  }
}
