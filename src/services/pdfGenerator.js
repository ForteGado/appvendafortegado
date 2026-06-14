// Gerador de PDF do Pedido utilizando a API de impressão do navegador (Offline-ready)
import { getDb } from './db';

export function printOrderPDF(pedidoId) {
  const db = getDb();
  
  // Buscar dados
  const ped = db.pedidos.find(p => p.id === Number(pedidoId));
  if (!ped) {
    alert('Pedido não encontrado para impressão.');
    return;
  }
  
  const client = db.clientes.find(c => c.id === ped.cliente_id) || {};
  const seller = db.usuarios.find(u => u.id === ped.vendedor_id) || {};
  const items = db.itens_pedido.filter(i => i.pedido_id === ped.id);
  const parcelas = db.parcelas.filter(p => p.pedido_id === ped.id);
  const signature = db.assinaturas.find(a => a.pedido_id === ped.id);
  const location = db.localizacoes.find(l => l.pedido_id === ped.id && l.tipo === 'venda');
  const deliveryLocation = db.localizacoes.find(l => l.pedido_id === ped.id && l.tipo === 'entrega');

  const resolvedItems = items.map(it => {
    const prod = db.produtos.find(p => p.id === it.produto_id) || {};
    return {
      ...it,
      nome: prod.nome,
      codigo: prod.codigo,
      unidade: prod.unidade
    };
  });

  const formattedDate = new Date(ped.data).toLocaleString('pt-BR');
  const empresa = db.empresas?.[0] || { nome: 'Forte Gado', logotipo: '🐂' };
  
  // Criar HTML para impressão
  const printContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Pedido ${ped.numero} - Forte Gado</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          color: #1A1A1A;
          margin: 0;
          padding: 20px;
          line-height: 1.4;
          font-size: 12px;
          background-color: #ffffff;
        }

        .container {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #E2E8F0;
          padding: 30px;
          border-radius: 8px;
        }

        /* Topo do PDF */
        .pdf-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 3px solid #0A2E73;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }

        .logo-box {
          font-size: 28px;
          font-weight: 800;
          color: #0A2E73;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-badge {
          background-color: #D4A017;
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 20px;
        }

        .title-box {
          text-align: right;
        }

        .title-box h1 {
          margin: 0;
          color: #0A2E73;
          font-size: 20px;
          font-weight: 700;
        }

        .title-box p {
          margin: 5px 0 0 0;
          font-size: 12px;
          color: #718096;
        }

        /* Blocos de informação lateral */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 25px;
        }

        .info-card {
          background-color: #F8FAFC;
          border: 1px solid #E2E8F0;
          padding: 15px;
          border-radius: 6px;
        }

        .info-card h3 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #0A2E73;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #cbd5e0;
          padding-bottom: 4px;
        }

        .info-card p {
          margin: 4px 0;
          font-size: 12px;
        }

        .info-card strong {
          color: #333333;
        }

        /* Tabela de Produtos */
        .product-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }

        .product-table th, .product-table td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #E2E8F0;
        }

        .product-table th {
          background-color: #0A2E73;
          color: #ffffff;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
        }

        .product-table tr:nth-child(even) td {
          background-color: #F8FAFC;
        }

        .text-right {
          text-align: right;
        }

        /* Totais e parcelamento */
        .summary-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
          align-items: start;
        }

        .parcelas-box {
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 15px;
        }

        .parcelas-box h4 {
          margin-top: 0;
          margin-bottom: 8px;
          color: #0A2E73;
          font-size: 11px;
          text-transform: uppercase;
        }

        .parcelas-table {
          width: 100%;
          border-collapse: collapse;
        }

        .parcelas-table td {
          padding: 5px 0;
          border-bottom: 1px dashed #E2E8F0;
          font-size: 11px;
        }

        .total-box {
          background-color: #0A2E73;
          color: #ffffff;
          padding: 20px;
          border-radius: 6px;
          text-align: right;
          border-right: 6px solid #D4A017;
        }

        .total-box span {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.8;
        }

        .total-box h2 {
          margin: 5px 0 0 0;
          font-size: 24px;
          font-weight: 800;
          color: #F5C400;
        }

        /* Assinatura e Localização */
        .footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 30px;
          border-top: 1px solid #E2E8F0;
          padding-top: 20px;
        }

        .signature-box {
          text-align: center;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 15px;
          background-color: #FCFDFE;
          height: 120px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
        }

        .signature-box img {
          max-height: 70px;
          max-width: 90%;
        }

        .signature-line {
          width: 80%;
          border-top: 1px solid #A0AEC0;
          margin-top: 10px;
          padding-top: 4px;
          font-size: 10px;
          color: #718096;
        }

        .location-box {
          background-color: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 15px;
          font-size: 11px;
        }

        .location-box h4 {
          margin-top: 0;
          margin-bottom: 8px;
          color: #0A2E73;
          font-size: 11px;
          text-transform: uppercase;
        }

        .location-box p {
          margin: 4px 0;
          color: #4A5568;
        }

        .footer-institucional {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #A0AEC0;
          border-top: 1px solid #E2E8F0;
          padding-top: 15px;
        }

        /* Ajustes de impressão */
        @media print {
          body {
            padding: 0;
          }
          .container {
            border: none;
            padding: 0;
          }
          button {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- Topo -->
        <div class="pdf-header">
          <div class="logo-box">
            ${empresa.logotipo && empresa.logotipo.startsWith('data:') ? (
              `<img src="${empresa.logotipo}" alt="Logo" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover;" />`
            ) : (
              `<span class="logo-badge">${empresa.logotipo || '🐂'}</span>`
            )}
            ${empresa.nome || 'Forte Gado'}
          </div>
          <div class="title-box">
            <h1>PEDIDO DE COMPRA</h1>
            <p>Número: <strong>${ped.numero}</strong> | Status: <strong>${ped.status}</strong></p>
          </div>
        </div>

        <!-- Informações -->
        <div class="info-grid">
          <div class="info-card">
            <h3>Informações do Cliente</h3>
            <p><strong>Nome:</strong> ${client.nome || 'Não cadastrado'}</p>
            <p><strong>CPF/CNPJ:</strong> ${client.cpf_cnpj || 'Não cadastrado'}</p>
            <p><strong>Cidade:</strong> ${client.cidade || 'Não cadastrado'}</p>
            <p><strong>Endereço:</strong> ${client.endereco || 'Não cadastrado'}</p>
            <p><strong>Telefone:</strong> ${client.telefone || 'Não cadastrado'}</p>
          </div>
          <div class="info-card">
            <h3>Detalhes da Emissão</h3>
            <p><strong>Data/Hora:</strong> ${formattedDate}</p>
            <p><strong>Vendedor:</strong> ${seller.nome || 'Vendedor'}</p>
            <p><strong>Empresa:</strong> ${empresa.nome || 'Forte Gado Comercial Ltda'}</p>
            <p><strong>CNPJ Empresa:</strong> ${empresa.cnpj || '12.345.678/0001-90'}</p>
            <p><strong>Telefone Empresa:</strong> ${empresa.telefone || '(34) 99999-1111'}</p>
          </div>
        </div>

        <!-- Produtos -->
        <table class="product-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th>Unid.</th>
              <th class="text-right">Qtd</th>
              <th class="text-right">Unitário</th>
              <th class="text-right">Desc.</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${resolvedItems.map(it => `
              <tr>
                <td>${it.codigo}</td>
                <td>${it.nome}</td>
                <td>${it.unidade}</td>
                <td class="text-right">${it.quantidade}</td>
                <td class="text-right">R$ ${it.valor_unitario.toFixed(2)}</td>
                <td class="text-right">R$ ${(it.desconto || 0).toFixed(2)}</td>
                <td class="text-right">R$ ${((it.quantidade * it.valor_unitario) - (it.desconto || 0)).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totais e Condições -->
        <div class="summary-grid">
          <div class="parcelas-box">
            <h4>Condições de Parcelamento</h4>
            <table class="parcelas-table">
              <tbody>
                ${parcelas.map((par, idx) => `
                  <tr>
                    <td>Parcela ${idx + 1}/${parcelas.length}</td>
                    <td class="text-right">Vencimento: ${new Date(par.vencimento).toLocaleDateString('pt-BR')}</td>
                    <td class="text-right"><strong>R$ ${par.valor.toFixed(2)}</strong></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="total-box">
            <span>VALOR TOTAL DO PEDIDO</span>
            <h2>R$ ${ped.total.toFixed(2)}</h2>
          </div>
        </div>

        <!-- Assinatura e Localização -->
        <div class="footer-grid">
          <div class="signature-box">
            ${signature ? `<img src="${signature.imagem}" alt="Assinatura Cliente" />` : '<div style="height: 50px;"></div>'}
            <div class="signature-line">Assinatura do Cliente</div>
          </div>
          
          <div class="location-box">
            <h4>Metadados de Segurança (GPS)</h4>
            <p><strong>GPS Venda:</strong> ${location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Não capturado'}</p>
            <p><strong>Data GPS Venda:</strong> ${location ? new Date(location.data_hora).toLocaleString('pt-BR') : 'N/A'}</p>
            ${ped.status === 'Entregue' ? `
              <p><strong>GPS Entrega:</strong> ${deliveryLocation ? `${deliveryLocation.latitude.toFixed(6)}, ${deliveryLocation.longitude.toFixed(6)}` : 'Não capturado'}</p>
              <p><strong>Data GPS Entrega:</strong> ${deliveryLocation ? new Date(deliveryLocation.data_hora).toLocaleString('pt-BR') : 'N/A'}</p>
            ` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div class="footer-institucional">
          ${empresa.nome || 'Forte Gado Comercial Ltda'} – Forte no campo, seguro nas vendas.<br>
          Este documento é uma cópia oficial do pedido registrado e assinado digitalmente.
        </div>

      </div>
    </body>
    </html>
  `;

  // Abrir uma janela temporária para imprimir
  const printWindow = window.open('', '_blank', 'width=850,height=600');
  printWindow.document.open();
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // Esperar carregar as fontes e imagens e chamar o print
  printWindow.onload = function() {
    printWindow.focus();
    printWindow.print();
    // Opcionalmente fechar a janela após a impressão (alguns navegadores podem precisar que feche manualmente)
    // printWindow.close();
  };
}
