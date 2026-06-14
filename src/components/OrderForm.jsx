import React, { useState, useEffect } from 'react';
import { ShoppingBag, User, Tag, CreditCard, PenTool, CheckCircle, Plus, Minus, Trash2, MapPin, RefreshCw, Send, FileText } from 'lucide-react';
import { getDb, getCredentials, createOrderLocal, createClientLocal, getLocalDateString } from '../services/db';
import CanvasSignature from './CanvasSignature';
import { printOrderPDF } from '../services/pdfGenerator';

export default function OrderForm({ setView }) {
  // Dados do BD Local
  const [dbClients, setDbClients] = useState([]);
  const [dbProducts, setDbProducts] = useState([]);
  const [dbStock, setDbStock] = useState([]);

  // Etapa Atual (1 a 5)
  const [step, setStep] = useState(1);

  // Estados do Pedido
  const [selectedClientId, setSelectedClientId] = useState('');
  const [cart, setCart] = useState([]); // [{ produto_id, quantidade, valor_unitario, desconto }]
  const [paymentMethod, setPaymentMethod] = useState(''); // PIX, Boleto, Cheque, Dinheiro, Transferência
  const [paymentCond, setPaymentCond] = useState(''); // À vista, Prazo direto, Parcelado
  const [condDetail, setCondDetail] = useState(''); // 30, 60, 90, 120, Personalizado | 30/60, etc.
  
  // Parcelas calculadas
  const [installments, setInstallments] = useState([]); // [{ vencimento, valor }]
  const [isCustomInstallments, setIsCustomInstallments] = useState(false);
  const [customInstallmentsCount, setCustomInstallmentsCount] = useState(2);
  const [customDays, setCustomDays] = useState(30);

  // Assinatura e Localização
  const [signatureImg, setSignatureImg] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Modo de Cadastro Rápido de Cliente
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const [newClientData, setNewClientData] = useState({
    nome_produtor: '', nome_fazenda: '', cpf_cnpj: '', telefone: '', endereco: '', cidade: '', latitude: '', longitude: ''
  });
  const [clientGpsLoading, setClientGpsLoading] = useState(false);

  // Alertas e Mensagens de Validação
  const [alertMsg, setAlertMsg] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);

  // Carregar dados
  useEffect(() => {
    const db = getDb();
    setDbClients(db.clientes || []);
    setDbProducts(db.produtos || []);
    setDbStock(db.estoque || []);
  }, []);

  // Calcular parcelas automaticamente quando total ou condições mudarem
  const orderTotal = cart.reduce((acc, it) => acc + (it.quantidade * it.valor_unitario) - (it.desconto || 0), 0);

  useEffect(() => {
    calculateInstallments();
  }, [paymentCond, condDetail, orderTotal, customInstallmentsCount, customDays]);

  const calculateInstallments = () => {
    if (orderTotal <= 0) {
      setInstallments([]);
      return;
    }

    const today = new Date();
    let computed = [];

    if (paymentCond === 'À vista') {
      computed.push({
        vencimento: getLocalDateString(today),
        valor: orderTotal
      });
      setIsCustomInstallments(false);
    } else if (paymentCond === 'Prazo direto') {
      if (condDetail === 'Personalizado') {
        setIsCustomInstallments(true);
        const due = new Date();
        due.setDate(today.getDate() + Number(customDays));
        computed.push({
          vencimento: getLocalDateString(due),
          valor: orderTotal
        });
      } else {
        setIsCustomInstallments(false);
        const days = Number(condDetail) || 30;
        const due = new Date();
        due.setDate(today.getDate() + days);
        computed.push({
          vencimento: getLocalDateString(due),
          valor: orderTotal
        });
      }
    } else if (paymentCond === 'Parcelado') {
      if (condDetail === 'Personalizado') {
        setIsCustomInstallments(true);
        const count = Number(customInstallmentsCount) || 2;
        const val = orderTotal / count;
        for (let i = 1; i <= count; i++) {
          const due = new Date();
          due.setDate(today.getDate() + (30 * i));
          computed.push({
            vencimento: getLocalDateString(due),
            valor: Number(val.toFixed(2))
          });
        }
      } else {
        setIsCustomInstallments(false);
        // condDetail: "30/60", "30/60/90", etc.
        const intervals = condDetail.split('/').map(Number);
        if (intervals.length > 0) {
          const val = orderTotal / intervals.length;
          intervals.forEach(days => {
            const due = new Date();
            due.setDate(today.getDate() + days);
            computed.push({
              vencimento: getLocalDateString(due),
              valor: Number(val.toFixed(2))
            });
          });
        }
      }
    }

    setInstallments(computed);
  };

  const handleUpdateInstallmentValue = (index, value) => {
    const updated = [...installments];
    updated[index].valor = Number(value);
    setInstallments(updated);
  };

  const handleUpdateInstallmentDate = (index, date) => {
    const updated = [...installments];
    updated[index].vencimento = date;
    setInstallments(updated);
  };

  // --- CONTROLES DE FLUXO E VALIDAÇÃO ---

  const handleNextStep = () => {
    setAlertMsg('');

    // Validação da Etapa 1: Cliente
    if (step === 1) {
      if (!selectedClientId) {
        setAlertMsg('Selecione um cliente para continuar.');
        return;
      }
    }

    // Validação da Etapa 2: Produtos
    if (step === 2) {
      if (cart.length === 0) {
        setAlertMsg('Adicione pelo menos um produto ao pedido.');
        return;
      }
      // Validar quantidades maiores que zero
      const invalidQty = cart.some(it => it.quantidade <= 0);
      if (invalidQty) {
        setAlertMsg('Verifique as quantidades informadas.');
        return;
      }
      // Validar estoque disponível
      let stockError = false;
      cart.forEach(it => {
        const est = dbStock.find(e => e.produto_id === Number(it.produto_id));
        if (est) {
          const disponivel = est.quantidade_atual - est.quantidade_reservada;
          if (it.quantidade > disponivel) {
            stockError = true;
          }
        }
      });
      if (stockError) {
        setAlertMsg('Estoque insuficiente para concluir o pedido.');
        return;
      }
    }

    // Validação da Etapa 3: Pagamento
    if (step === 3) {
      if (!paymentMethod) {
        setAlertMsg('Selecione a forma de pagamento.');
        return;
      }
      if (!paymentCond) {
        setAlertMsg('Selecione a condição de pagamento.');
        return;
      }
      if (paymentCond !== 'À vista' && !condDetail) {
        setAlertMsg('Selecione os prazos de vencimento.');
        return;
      }

      // Validar parcelamento personalizado se selecionado
      if (isCustomInstallments) {
        const sum = installments.reduce((acc, c) => acc + c.valor, 0);
        if (Math.abs(sum - orderTotal) > 0.05) {
          setAlertMsg('A soma das parcelas deve ser igual ao total do pedido.');
          return;
        }
      }
    }

    // Validação da Etapa 4: Assinatura e GPS
    if (step === 4) {
      if (!gpsLocation) {
        setAlertMsg('Capture a localização da venda.');
        return;
      }
      if (!signatureImg) {
        setAlertMsg('A assinatura do cliente é obrigatória.');
        return;
      }
    }

    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setAlertMsg('');
    setStep(step - 1);
  };

  // Cadastrar Cliente Rápido
  const handleCreateClient = (e) => {
    e.preventDefault();
    if (!newClientData.nome_fazenda) {
      setAlertMsg('O nome da fazenda é obrigatório.');
      return;
    }
    if (!newClientData.nome_produtor) {
      setAlertMsg('O nome do produtor é obrigatório.');
      return;
    }
    const newClient = createClientLocal(newClientData);
    setDbClients([...dbClients, newClient]);
    setSelectedClientId(newClient.id);
    setIsNewClientMode(false);
    setNewClientData({ nome_produtor: '', nome_fazenda: '', cpf_cnpj: '', telefone: '', endereco: '', cidade: '', latitude: '', longitude: '' });
    setAlertMsg('');
  };

  const handleFetchClientLocation = () => {
    setClientGpsLoading(true);
    setAlertMsg('');

    if (!navigator.geolocation) {
      setTimeout(() => {
        setNewClientData(prev => ({
          ...prev,
          latitude: -19.7476,
          longitude: -47.9392
        }));
        setClientGpsLoading(false);
      }, 600);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNewClientData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setClientGpsLoading(false);
      },
      (error) => {
        console.warn('Geolocation failed for client registration, using fallback:', error);
        setTimeout(() => {
          setNewClientData(prev => ({
            ...prev,
            latitude: -19.7476,
            longitude: -47.9392
          }));
          setClientGpsLoading(false);
        }, 600);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // --- GESTÃO DO CARRINHO DE COMPRAS ---

  const addToCart = (product) => {
    const est = dbStock.find(e => e.produto_id === product.id) || {};
    const disponivel = est.quantidade_atual - est.quantidade_reservada;

    if (disponivel <= 0) {
      alert('Produto sem estoque disponível para reserva.');
      return;
    }

    const existingIdx = cart.findIndex(it => it.produto_id === product.id);
    if (existingIdx > -1) {
      const currentQty = cart[existingIdx].quantidade;
      if (currentQty + 1 > disponivel) {
        alert('Limite de estoque excedido para este produto.');
        return;
      }
      const updated = [...cart];
      updated[existingIdx].quantidade += 1;
      setCart(updated);
    } else {
      setCart([...cart, {
        produto_id: product.id,
        quantidade: 1,
        valor_unitario: product.preco,
        desconto: 0
      }]);
    }
    setAlertMsg('');
  };

  const updateCartQty = (produtoId, delta) => {
    const existingIdx = cart.findIndex(it => it.produto_id === produtoId);
    if (existingIdx === -1) return;

    const est = dbStock.find(e => e.produto_id === produtoId) || {};
    const disponivel = est.quantidade_atual - est.quantidade_reservada;
    const currentQty = cart[existingIdx].quantidade;
    const nextQty = currentQty + delta;

    if (nextQty <= 0) {
      removeCartItem(produtoId);
      return;
    }

    if (nextQty > disponivel) {
      alert('Limite de estoque excedido para reserva.');
      return;
    }

    const updated = [...cart];
    updated[existingIdx].quantidade = nextQty;
    setCart(updated);
  };

  const updateCartDiscount = (produtoId, discountValue) => {
    const existingIdx = cart.findIndex(it => it.produto_id === produtoId);
    if (existingIdx === -1) return;

    const updated = [...cart];
    const maxDiscount = updated[existingIdx].quantidade * updated[existingIdx].valor_unitario;
    updated[existingIdx].desconto = Math.min(maxDiscount, Math.max(0, Number(discountValue)));
    setCart(updated);
  };

  const removeCartItem = (produtoId) => {
    setCart(cart.filter(it => it.produto_id !== produtoId));
  };

  // --- GPS E ASSINATURA ---

  const handleCaptureGps = () => {
    setGpsLoading(true);
    setAlertMsg('');

    if (!navigator.geolocation) {
      // Fallback
      setTimeout(() => {
        setGpsLocation({ latitude: -19.7476, longitude: -47.9392 });
        setGpsLoading(false);
      }, 600);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsLoading(false);
      },
      (error) => {
        console.warn('Geolocation failed, fallback used:', error);
        setTimeout(() => {
          setGpsLocation({ latitude: -19.7476, longitude: -47.9392 });
          setGpsLoading(false);
        }, 600);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // --- FINALIZAR PEDIDO ---

  const handleFinalizeOrder = () => {
    const creds = getCredentials();
    
    // Dados para gravação local
    const orderPayload = {
      cliente_id: selectedClientId,
      vendedor_id: creds.activeUserId,
      total: orderTotal,
      itens: cart,
      parcelas: installments,
      assinatura: signatureImg,
      latitude: gpsLocation.latitude,
      longitude: gpsLocation.longitude
    };

    const order = createOrderLocal(orderPayload);
    setCreatedOrder(order);
    setStep(5); // Ir para o passo de sucesso
  };

  // WhatsApp e Imprimir PDF
  const handlePrint = () => {
    if (createdOrder) {
      printOrderPDF(createdOrder.id);
    }
  };

  const handleWhatsAppShare = () => {
    if (!createdOrder) return;
    const client = dbClients.find(c => c.id === Number(selectedClientId)) || {};
    
    const text = `*Forte Gado - Pedido Confirmado!*%0A%0A` +
      `Olá, segue resumo do seu pedido feito na Forte Gado:%0A` +
      `*Número:* ${createdOrder.numero}%0A` +
      `*Total:* R$ ${createdOrder.total.toFixed(2)}%0A` +
      `*Status:* Assinado Digitalmente%0A%0A` +
      `Muito obrigado pela preferência! 🐂`;

    // Limpar caracteres não numéricos do telefone
    const phone = client.telefone ? client.telefone.replace(/\D/g, '') : '';
    window.open(`https://wa.me/${phone ? '55' + phone : ''}?text=${text}`, '_blank');
  };

  // Resolved Client Details
  const activeClient = dbClients.find(c => c.id === Number(selectedClientId)) || {};

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', marginBottom: '16px', fontWeight: '700' }}>
        Emissão de Pedido de Venda
      </h2>

      {/* Alerta de Validação */}
      {alertMsg && (
        <div className="alert-box alert-error">
          {alertMsg}
        </div>
      )}

      {/* Barra de Progresso Etapas */}
      <div className="step-bar">
        <div className="step-bar-fill" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
        <div className={`step-item ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          1 <span className="step-label">Cliente</span>
        </div>
        <div className={`step-item ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          2 <span className="step-label">Produtos</span>
        </div>
        <div className={`step-item ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          3 <span className="step-label">Pagamento</span>
        </div>
        <div className={`step-item ${step >= 4 ? 'active' : ''} ${step > 4 ? 'completed' : ''}`}>
          4 <span className="step-label">Assinatura</span>
        </div>
        <div className={`step-item ${step >= 5 ? 'active' : ''} ${step > 5 ? 'completed' : ''}`}>
          5 <span className="step-label">Fim</span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* ETAPA 1: SELEÇÃO DE CLIENTE */}
      {/* ==================================================== */}
      {step === 1 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--azul-principal)' }}>Selecionar Cliente</h3>
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={() => setIsNewClientMode(!isNewClientMode)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
            >
              {isNewClientMode ? 'Voltar para Lista' : '+ Novo Cliente'}
            </button>
          </div>

          {isNewClientMode ? (
            <form onSubmit={handleCreateClient} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label>Razão Social / Nome da Fazenda</label>
                <input
                  type="text"
                  className="form-control"
                  value={newClientData.nome_fazenda}
                  onChange={(e) => setNewClientData({ ...newClientData, nome_fazenda: e.target.value })}
                  placeholder="Ex: Fazenda Campo Alegre"
                  required
                />
              </div>

              <div className="form-group">
                <label>Nome do Produtor</label>
                <input
                  type="text"
                  className="form-control"
                  value={newClientData.nome_produtor}
                  onChange={(e) => setNewClientData({ ...newClientData, nome_produtor: e.target.value })}
                  placeholder="Ex: Carlos Alberto"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>CPF ou CNPJ</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newClientData.cpf_cnpj}
                    onChange={(e) => setNewClientData({ ...newClientData, cpf_cnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                  />
                </div>
                <div className="form-group">
                  <label>Telefone (WhatsApp)</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={newClientData.telefone}
                    onChange={(e) => setNewClientData({ ...newClientData, telefone: e.target.value })}
                    placeholder="(34) 99999-9999"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cidade</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newClientData.cidade}
                    onChange={(e) => setNewClientData({ ...newClientData, cidade: e.target.value })}
                    placeholder="Uberaba"
                  />
                </div>
                <div className="form-group">
                  <label>Endereço Físico</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newClientData.endereco}
                    onChange={(e) => setNewClientData({ ...newClientData, endereco: e.target.value })}
                    placeholder="Estrada Rural, Km 15"
                  />
                </div>
              </div>

              {/* Captura de Localização GPS do Cliente */}
              <div className="form-group" style={{ backgroundColor: 'var(--cinza-ultra-claro)', padding: '12px', borderRadius: '8px', border: '1px solid var(--cinza-claro)' }}>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '6px' }}>
                  Localização da Fazenda (Opcional, mas recomendado para áreas sem rua)
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleFetchClientLocation}
                    disabled={clientGpsLoading}
                    style={{ width: 'auto', padding: '8px 14px', fontSize: '0.8rem' }}
                  >
                    {clientGpsLoading ? (
                      <>
                        <RefreshCw size={14} className="spin-anim" /> Capturando...
                      </>
                    ) : (
                      <>
                        <MapPin size={14} /> {newClientData.latitude ? 'GPS Capturado' : 'Obter GPS'}
                      </>
                    )}
                  </button>
                  {newClientData.latitude && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--verde-escuro)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={12} /> Lat: {Number(newClientData.latitude).toFixed(5)}, Lng: {Number(newClientData.longitude).toFixed(5)}
                    </span>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                Salvar Cliente e Selecionar
              </button>
            </form>
          ) : (
            <div className="form-group">
              <label>Escolha o Cliente</label>
              <select
                className="form-control"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">-- Clique para selecionar --</option>
                {dbClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.cidade || 'Sem Cidade'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button type="button" className="btn btn-primary" onClick={handleNextStep}>
              Avançar para Produtos
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ETAPA 2: ADIÇÃO DE PRODUTOS */}
      {/* ==================================================== */}
      {step === 2 && (
        <div>
          {/* Listagem de produtos no banco */}
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Produtos Disponíveis</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
              {dbProducts.map(prod => {
                const est = dbStock.find(e => e.produto_id === prod.id) || {};
                const disponivel = est.quantidade_atual - est.quantidade_reservada;
                return (
                  <div key={prod.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: 'var(--cinza-ultra-claro)',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Imagem do Produto */}
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0,
                        backgroundColor: 'white', border: '1px solid var(--cinza-claro)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', fontSize: '1.2rem'
                      }}>
                        {prod.imagem
                          ? (prod.imagem.startsWith('data:')
                            ? <img src={prod.imagem} alt={prod.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span>{prod.imagem}</span>)
                          : <ShoppingBag size={18} color="var(--cinza-medio)" />
                        }
                      </div>
                      <div>
                        <strong>{prod.nome}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--cinza-medio)' }}>
                          Cód: {prod.codigo} | Valor: R$ {prod.preco.toFixed(2)} | Estoque Disponível: <strong style={{ color: disponivel <= est.estoque_minimo ? 'var(--vermelho-cancelar)' : 'var(--verde-escuro)' }}>{disponivel}</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => addToCart(prod)}
                      disabled={disponivel <= 0}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}
                    >
                      Adicionar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Carrinho de Compras do Pedido */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Itens Selecionados no Pedido</h3>
            
            {cart.length > 0 ? (
              <div>
                <div className="cart-list">
                  {cart.map(item => {
                    const prod = dbProducts.find(p => p.id === item.produto_id) || {};
                    return (
                      <div key={item.produto_id} className="cart-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '4px', flexShrink: 0,
                            backgroundColor: 'white', border: '1px solid var(--cinza-claro)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', fontSize: '1rem'
                          }}>
                            {prod.imagem
                              ? (prod.imagem.startsWith('data:')
                                ? <img src={prod.imagem} alt={prod.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span>{prod.imagem}</span>)
                              : <ShoppingBag size={14} color="var(--cinza-medio)" />
                            }
                          </div>
                          <div className="cart-item-details">
                            <span className="cart-item-name">{prod.nome}</span>
                            <span className="cart-item-meta">R$ {prod.preco.toFixed(2)} / {prod.unidade}</span>
                          </div>
                        </div>
                        <div className="cart-item-controls">
                          {/* Desconto */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <label style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--cinza-medio)' }}>Desconto R$</label>
                            <input
                              type="number"
                              min="0"
                              style={{ width: '70px', padding: '4px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--cinza-claro)' }}
                              value={item.desconto || ''}
                              onChange={(e) => updateCartDiscount(item.produto_id, e.target.value)}
                              placeholder="0,00"
                            />
                          </div>

                          {/* Quantidade */}
                          <div className="qty-control">
                            <button type="button" className="qty-btn" onClick={() => updateCartQty(item.produto_id, -1)}><Minus size={12} /></button>
                            <span className="qty-val">{item.quantidade}</span>
                            <button type="button" className="qty-btn" onClick={() => updateCartQty(item.produto_id, 1)}><Plus size={12} /></button>
                          </div>

                          {/* Lixeira */}
                          <button type="button" className="remove-btn" onClick={() => removeCartItem(item.produto_id)}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="cart-total-bar">
                  <span>Total Pedido:</span>
                  <span>R$ {orderTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--cinza-medio)', textAlign: 'center', padding: '20px 0', fontSize: '0.9rem' }}>Nenhum produto adicionado ao carrinho.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
              <button type="button" className="btn btn-secondary" onClick={handlePrevStep} style={{ width: 'auto' }}>
                Voltar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNextStep} style={{ width: 'auto' }}>
                Avançar para Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ETAPA 3: CONDIÇÕES E FORMA DE PAGAMENTO */}
      {/* ==================================================== */}
      {step === 3 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}>Forma e Condição de Pagamento</h3>

          {/* Forma de pagamento */}
          <div className="form-group">
            <label>Forma de Pagamento (PDR Obrigatório)</label>
            <div className="payment-methods-grid">
              {['PIX', 'Boleto', 'Cheque', 'Dinheiro', 'Transferência Bancária'].map(method => (
                <div
                  key={method}
                  className={`payment-method-card ${paymentMethod === method ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod(method)}
                >
                  {method}
                </div>
              ))}
            </div>
          </div>

          {/* Condição de pagamento */}
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Condição de Pagamento</label>
            <select
              className="form-control"
              value={paymentCond}
              onChange={(e) => {
                setPaymentCond(e.target.value);
                setCondDetail('');
              }}
            >
              <option value="">-- Selecione uma opção --</option>
              <option value="À vista">À vista</option>
              <option value="Prazo direto">Prazo Direto (Dias)</option>
              <option value="Parcelado">Parcelado</option>
            </select>
          </div>

          {/* Opções específicas de Condição */}
          {paymentCond === 'Prazo direto' && (
            <div className="form-group">
              <label>Prazo em Dias</label>
              <select
                className="form-control"
                value={condDetail}
                onChange={(e) => setCondDetail(e.target.value)}
              >
                <option value="">-- Selecione o prazo --</option>
                <option value="30">30 dias</option>
                <option value="60">60 dias</option>
                <option value="90">90 dias</option>
                <option value="120">120 dias</option>
                <option value="Personalizado">Personalizado...</option>
              </select>
            </div>
          )}

          {paymentCond === 'Parcelado' && (
            <div className="form-group">
              <label>Estrutura de Parcelamento</label>
              <select
                className="form-control"
                value={condDetail}
                onChange={(e) => setCondDetail(e.target.value)}
              >
                <option value="">-- Selecione as parcelas --</option>
                <option value="30/60">30 / 60 dias</option>
                <option value="30/60/90">30 / 60 / 90 dias</option>
                <option value="30/60/90/120">30 / 60 / 90 / 120 dias</option>
                <option value="Personalizado">Personalizado...</option>
              </select>
            </div>
          )}

          {/* Painel Personalizado */}
          {isCustomInstallments && (
            <div style={{ backgroundColor: 'var(--cinza-ultra-claro)', padding: '14px', borderRadius: '8px', border: '1px solid var(--cinza-claro)', marginTop: '12px' }}>
              <h4 style={{ fontSize: '0.85rem', marginBottom: '8px' }}>Configuração Personalizada</h4>
              
              {paymentCond === 'Prazo direto' ? (
                <div className="form-group">
                  <label>Dias para Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={customDays}
                    onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value)))}
                  />
                </div>
              ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label>Qtd de Parcelas</label>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      className="form-control"
                      value={customInstallmentsCount}
                      onChange={(e) => setCustomInstallmentsCount(Math.min(12, Math.max(2, Number(e.target.value))))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Frequência (Dias)</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={customDays}
                      onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grade de Parcelas Geradas */}
          {installments.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--cinza-escuro)' }}>Cronograma de Parcelas Gerado</label>
              <div className="installments-list">
                {installments.map((par, idx) => (
                  <div key={idx} className="installment-row">
                    <span style={{ fontWeight: 'bold' }}>{idx + 1}ª Parcela</span>
                    <input
                      type="date"
                      value={par.vencimento}
                      onChange={(e) => handleUpdateInstallmentDate(idx, e.target.value)}
                      disabled={!isCustomInstallments}
                    />
                    <input
                      type="number"
                      value={par.valor}
                      onChange={(e) => handleUpdateInstallmentValue(idx, e.target.value)}
                      disabled={!isCustomInstallments}
                      placeholder="Valor R$"
                    />
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px', fontSize: '0.85rem', color: 'var(--cinza-medio)' }}>
                Soma das parcelas: <strong>R$ {installments.reduce((a,c)=>a+c.valor,0).toFixed(2)}</strong> (Total: R$ {orderTotal.toFixed(2)})
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyCera: 'space-between', justifyContent: 'space-between', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={handlePrevStep} style={{ width: 'auto' }}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleNextStep} style={{ width: 'auto' }}>
              Avançar para Assinatura
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ETAPA 4: ASSINATURA E LOCALIZAÇÃO */}
      {/* ==================================================== */}
      {step === 4 && (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}>Assinatura e Validação GPS</h3>

          {/* 1. GPS de Venda */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px' }}>
              Localização da Venda (GPS Obrigatório)
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCaptureGps}
                disabled={gpsLoading}
                style={{ width: 'auto', padding: '10px 16px', fontSize: '0.85rem' }}
              >
                {gpsLoading ? (
                  <>
                    <RefreshCw size={16} className="spin-anim" /> Capturando GPS...
                  </>
                ) : (
                  <>
                    <MapPin size={16} /> {gpsLocation ? 'Coordenadas Capturadas' : 'Capturar Localização'}
                  </>
                )}
              </button>
              {gpsLocation && (
                <span style={{ fontSize: '0.8rem', color: 'var(--verde-escuro)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={14} /> Lat: {gpsLocation.latitude.toFixed(5)}, Lng: {gpsLocation.longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>

          {/* 2. Canvas Signature */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px' }}>
              Assinatura do Cliente (Obrigatório)
            </label>
            <CanvasSignature
              onSave={(imgData) => setSignatureImg(imgData)}
              onClearSignature={() => setSignatureImg(null)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={handlePrevStep} style={{ width: 'auto' }}>
              Voltar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleNextStep} style={{ width: 'auto' }}>
              Revisar Pedido
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* ETAPA 5: CONFIRMAÇÃO OU TELA DE SUCESSO */}
      {/* ==================================================== */}
      {step === 5 && (
        <div className="card" style={{ textAlign: 'center', padding: '30px 20px' }}>
          {!createdOrder ? (
            // REVISÃO FINAL ANTES DE EMITIR
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--azul-principal)', marginBottom: '16px' }}>Resumo Final do Pedido</h3>
              
              <div style={{ textAlign: 'left', backgroundColor: 'var(--cinza-ultra-claro)', padding: '16px', borderRadius: '12px', marginBottom: '24px', fontSize: '0.85rem', border: '1px solid var(--cinza-claro)' }}>
                <p style={{ margin: '4px 0' }}><strong>Cliente:</strong> {activeClient.nome}</p>
                <p style={{ margin: '4px 0' }}><strong>Cidade:</strong> {activeClient.cidade}</p>
                <p style={{ margin: '4px 0' }}><strong>Forma:</strong> {paymentMethod}</p>
                <p style={{ margin: '4px 0' }}><strong>Condição:</strong> {paymentCond} {condDetail !== 'Personalizado' ? `(${condDetail})` : ''}</p>
                <p style={{ margin: '4px 0' }}><strong>Nº Parcelas:</strong> {installments.length}</p>
                <p style={{ margin: '4px 0' }}><strong>GPS Venda:</strong> {gpsLocation ? `${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)}` : ''}</p>
                
                <h4 style={{ marginTop: '12px', borderTop: '1px solid var(--cinza-claro)', paddingTop: '8px', color: 'var(--azul-secundario)' }}>Produtos:</h4>
                <ul style={{ paddingLeft: '16px', margin: '6px 0' }}>
                  {cart.map(it => {
                    const pr = dbProducts.find(p => p.id === it.produto_id) || {};
                    return (
                      <li key={it.produto_id}>
                        {it.quantidade}x {pr.nome} – R$ {((it.quantidade * it.valor_unitario) - (it.desconto || 0)).toFixed(2)}
                      </li>
                    );
                  })}
                </ul>
                <div style={{ textAlign: 'right', fontWeight: '800', fontSize: '1.05rem', color: 'var(--azul-principal)', marginTop: '8px' }}>
                  Total: R$ {orderTotal.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={handlePrevStep} style={{ flex: 1 }}>
                  Ajustar Pedido
                </button>
                <button type="button" className="btn btn-primary" onClick={handleFinalizeOrder} style={{ flex: 2 }}>
                  Finalizar Pedido (Reservar Estoque)
                </button>
              </div>
            </div>
          ) : (
            // PEDIDO CRIADO COM SUCESSO - AÇÕES FINAIS (PDF, WHATSAPP, NOVO)
            <div>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(90, 158, 26, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--verde-agro)',
                marginBottom: '16px'
              }}>
                <CheckCircle size={36} />
              </div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--verde-escuro)', marginBottom: '8px', fontWeight: '800' }}>Pedido Emitido com Sucesso!</h3>
              <p style={{ color: 'var(--cinza-escuro)', fontSize: '0.9rem', marginBottom: '4px' }}>Número do pedido: <strong>{createdOrder.numero}</strong></p>
              <p style={{ color: 'var(--cinza-medio)', fontSize: '0.8rem', marginBottom: '24px' }}>
                O estoque foi reservado. Dados salvos localmente e adicionados à fila de sincronização.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
                {/* Geração de PDF */}
                <button type="button" className="btn btn-cta" onClick={handlePrint} style={{ display: 'inline-flex', justifyContent: 'center', gap: '8px' }}>
                  <FileText size={18} /> Gerar PDF do Pedido
                </button>

                {/* WhatsApp */}
                <button type="button" className="btn btn-cta" onClick={handleWhatsAppShare} style={{ display: 'inline-flex', justifyContent: 'center', gap: '8px', backgroundColor: '#25D366', color: 'white' }}>
                  <Send size={18} /> Enviar pelo WhatsApp
                </button>

                {/* Novo Pedido */}
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={() => {
                    setStep(1);
                    setSelectedClientId('');
                    setCart([]);
                    setPaymentMethod('');
                    setPaymentCond('');
                    setCondDetail('');
                    setInstallments([]);
                    setSignatureImg(null);
                    setGpsLocation(null);
                    setCreatedOrder(null);
                    setAlertMsg('');
                  }}
                  style={{ marginTop: '12px' }}
                >
                  Novo Pedido
                </button>

                <button type="button" className="btn btn-secondary" onClick={() => setView('dashboard')}>
                  Voltar ao Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
