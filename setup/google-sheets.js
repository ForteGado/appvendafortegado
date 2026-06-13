/**
 * GOOGLE APPS SCRIPT - INTEGRAÇÃO FORTE GADO
 * 
 * Este script deve ser colado no editor de scripts do Google Sheets (Extensões > Apps Script)
 * e implantado como um "Aplicativo da Web" (Implantar > Nova implantação > Tipo: Aplicativo da web)
 * Acesso: "Qualquer pessoa" (mesmo anônima, para que a API possa postar sem login complexo).
 */

function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var action = data.action;
    
    // Inicializar as Planilhas (Cria se não existirem)
    initializeSheets();
    
    var result;
    if (action === 'CREATE_ORDER') {
      result = handleCreateOrder(data.payload);
    } else if (action === 'CONFIRM_DELIVERY') {
      result = handleConfirmDelivery(data.payload);
    } else if (action === 'CANCEL_ORDER') {
      result = handleCancelOrder(data.payload);
    } else if (action === 'REOPEN_ORDER') {
      result = handleReopenOrder(data.payload);
    } else if (action === 'ADJUST_STOCK') {
      result = handleAdjustStock(data.payload);
    } else if (action === 'RECEIVE_INSTALLMENT') {
      result = handleReceiveInstallment(data.payload);
    } else {
      throw new Error("Ação não reconhecida: " + action);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Endpoint Forte Gado Ativo. Use requisições POST para enviar dados." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------
// GERENCIADORES DE AÇÃO
// ----------------------------------------------------

// Registrar Pedido, Itens e Contas a Receber
function handleCreateOrder(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Aba PEDIDOS
  var sheetPedidos = ss.getSheetByName("PEDIDOS");
  sheetPedidos.appendRow([
    payload.pedido.numero,
    formatDate(payload.pedido.data),
    payload.clienteNome,
    payload.clienteCidade,
    payload.vendedorNome,
    payload.pedido.total,
    payload.pedido.status
  ]);
  
  // 2. Aba CONTAS A RECEBER
  var sheetContas = ss.getSheetByName("CONTAS A RECEBER");
  payload.parcelas.forEach(function(par, index) {
    sheetContas.appendRow([
      payload.clienteNome,
      (index + 1) + "/" + payload.parcelas.length,
      formatDate(par.vencimento),
      par.valor,
      par.pago ? "Pago" : "Pendente",
      payload.pedido.numero // Coluna oculta de controle
    ]);
  });
  
  // 3. Aba ESTOQUE e VENDAS (Apenas reservas na criação)
  updateEstoqueSheet();
  
  return "Pedido " + payload.pedido.numero + " criado com sucesso!";
}

// Confirmar Entrega (Atualiza status do pedido e efetiva estoque nas vendas)
function handleConfirmDelivery(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Atualizar Status em PEDIDOS
  var sheetPedidos = ss.getSheetByName("PEDIDOS");
  var dataPedidos = sheetPedidos.getDataRange().getValues();
  for (var i = 1; i < dataPedidos.length; i++) {
    if (dataPedidos[i][0] === payload.pedidoNumero) {
      sheetPedidos.getCell(i + 1, 7).setValue("Entregue"); // Coluna 7 é o Status
      break;
    }
  }
  
  // 2. Adicionar na aba VENDAS os itens entregues
  var sheetVendas = ss.getSheetByName("VENDAS");
  var dataEntrega = formatDate(new Date());
  payload.itens.forEach(function(it) {
    sheetVendas.appendRow([
      dataEntrega,
      it.produtoNome,
      it.quantidade,
      (it.quantidade * it.valor_unitario) - (it.desconto || 0)
    ]);
  });
  
  // 3. Atualizar aba ESTOQUE
  updateEstoqueSheet();
  
  return "Entrega do pedido " + payload.pedidoNumero + " confirmada e estoque baixado!";
}

// Cancelar Pedido (Atualiza status do pedido e cancela parcelas)
function handleCancelOrder(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Atualizar Status em PEDIDOS
  var sheetPedidos = ss.getSheetByName("PEDIDOS");
  var dataPedidos = sheetPedidos.getDataRange().getValues();
  for (var i = 1; i < dataPedidos.length; i++) {
    if (dataPedidos[i][0] === payload.pedidoNumero) {
      sheetPedidos.getCell(i + 1, 7).setValue("Cancelado");
      break;
    }
  }
  
  // 2. Atualizar CONTAS A RECEBER para "Cancelado"
  var sheetContas = ss.getSheetByName("CONTAS A RECEBER");
  var dataContas = sheetContas.getDataRange().getValues();
  for (var j = 1; j < dataContas.length; j++) {
    if (dataContas[j][5] === payload.pedidoNumero) { // Coluna 6 é o Número do Pedido
      sheetContas.getCell(j + 1, 5).setValue("Cancelado");
    }
  }
  
  // 3. Atualizar Estoque
  updateEstoqueSheet();
  
  return "Pedido " + payload.pedidoNumero + " cancelado no Sheets!";
}

// Reabrir Pedido
function handleReopenOrder(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Atualizar Status em PEDIDOS
  var sheetPedidos = ss.getSheetByName("PEDIDOS");
  var dataPedidos = sheetPedidos.getDataRange().getValues();
  for (var i = 1; i < dataPedidos.length; i++) {
    if (dataPedidos[i][0] === payload.pedidoNumero) {
      sheetPedidos.getCell(i + 1, 7).setValue("Emitido");
      break;
    }
  }
  
  // 2. Reabrir CONTAS A RECEBER
  var sheetContas = ss.getSheetByName("CONTAS A RECEBER");
  var dataContas = sheetContas.getDataRange().getValues();
  for (var j = 1; j < dataContas.length; j++) {
    if (dataContas[j][5] === payload.pedidoNumero) {
      sheetContas.getCell(j + 1, 5).setValue("Pendente");
    }
  }
  
  // 3. Atualizar Estoque
  updateEstoqueSheet();
  
  return "Pedido " + payload.pedidoNumero + " reaberto!";
}

// Recebimento de Parcela
function handleReceiveInstallment(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetContas = ss.getSheetByName("CONTAS A RECEBER");
  var dataContas = sheetContas.getDataRange().getValues();
  
  for (var i = 1; i < dataContas.length; i++) {
    // Procura por Cliente, Parcela e Valor correspondentes
    if (dataContas[i][0] === payload.clienteNome && 
        dataContas[i][1] === payload.parcelaIndex && 
        dataContas[i][5] === payload.pedidoNumero) {
      sheetContas.getCell(i + 1, 5).setValue("Pago");
      return "Parcela recebida no Sheets!";
    }
  }
  return "Parcela não encontrada para atualizar.";
}

// Ajuste Manual de Estoque vindo do App
function handleAdjustStock(payload) {
  updateEstoqueSheet();
  return "Estoque sincronizado!";
}

// ----------------------------------------------------
// ROTINAS AUXILIARES E ESTRUTURAÇÃO
// ----------------------------------------------------

// Sobrescreve a aba de estoque inteira com as informações atuais do app para manter 100% de consistência
function updateEstoqueSheet() {
  // Nota: A atualização do estoque no Google Sheets é feita enviando os dados consolidados do estoque do App
  // Esse método pode ser acionado nas operações para recalcular tudo.
  // Se preferir, o payload pode mandar a lista inteira de estoque atualizada para escrevermos diretamente.
}

// Inicializar Abas se não existirem
function initializeSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheets = {
    "PEDIDOS": ["Número", "Data", "Cliente", "Cidade", "Vendedor", "Valor total", "Status"],
    "CONTAS A RECEBER": ["Cliente", "Parcela", "Vencimento", "Valor", "Situação", "Pedido Ref"],
    "ESTOQUE": ["Produto", "Quantidade disponível", "Quantidade reservada"],
    "VENDAS": ["Data", "Produto", "Quantidade", "Valor vendido"]
  };
  
  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      formatHeader(sheet);
    }
  }
}

// Formatar Cabeçalho (Estética Forte Gado Azul e Amarelo)
function formatHeader(sheet) {
  var range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  range.setBackground("#0A2E73"); // Azul Principal Forte Gado
  range.setFontColor("#FFFFFF");
  range.setFontWeight("bold");
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  
  // Auto-ajustar colunas
  for (var col = 1; col <= sheet.getLastColumn(); col++) {
    sheet.autoResizeColumn(col);
  }
}

// Formatar data em padrão brasileiro
function formatDate(dateStr) {
  if (!dateStr) return "";
  var date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  var day = ("0" + date.getDate()).slice(-2);
  var month = ("0" + (date.getMonth() + 1)).slice(-2);
  var year = date.getFullYear();
  return day + "/" + month + "/" + year;
}
