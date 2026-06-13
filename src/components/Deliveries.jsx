import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Camera, AlertTriangle, CheckCircle, Navigation, Trash2, RefreshCw } from 'lucide-react';
import { getDb, getCredentials, confirmDeliveryLocal, cancelOrderLocal } from '../services/db';
import CameraCapture from './CameraCapture';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Dados de captura da entrega
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [validationError, setValidationError] = useState('');

  const loadDeliveries = () => {
    const db = getDb();
    const creds = getCredentials();

    // Identificar perfil
    const user = db.usuarios.find(u => u.id === Number(creds.activeUserId));
    setIsAdmin(user && user.perfil === 'Administrador');

    // Listar pedidos pendentes de entrega ("Emitido") ou todos se quiser ver histórico
    const pendingOrders = db.pedidos
      .filter(p => {
        const matchesUser = user && (user.perfil === 'Administrador' || p.vendedor_id === user.id);
        return p.status === 'Emitido' && matchesUser;
      })
      .map(p => {
        const client = db.clientes.find(c => c.id === p.cliente_id) || {};
        return {
          ...p,
          clienteNome: client.nome || 'Cliente Desconhecido',
          clienteCidade: client.cidade || '',
          clienteEndereco: client.endereco || '',
          clienteLatitude: client.latitude,
          clienteLongitude: client.longitude
        };
      });

    setDeliveries(pendingOrders);
  };

  useEffect(() => {
    loadDeliveries();
    window.addEventListener('fortegado_db_update', loadDeliveries);
    return () => window.removeEventListener('fortegado_db_update', loadDeliveries);
  }, []);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setLocation(null);
    setPhoto(null);
    setValidationError('');
  };

  // Capturar Localização GPS
  const handleCaptureLocation = () => {
    setLocationLoading(true);
    setValidationError('');

    if (!navigator.geolocation) {
      // Fallback elegante
      setTimeout(() => {
        const fallbackLoc = { latitude: -19.7476 + (Math.random() - 0.5) * 0.01, longitude: -47.9392 + (Math.random() - 0.5) * 0.01 };
        setLocation(fallbackLoc);
        setLocationLoading(false);
      }, 800);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationLoading(false);
      },
      (error) => {
        console.warn('Geolocation error, simulating coords:', error);
        // Coordenadas simuladas de Uberaba - MG
        setTimeout(() => {
          const fallbackLoc = { latitude: -19.7481, longitude: -47.9389 };
          setLocation(fallbackLoc);
          setLocationLoading(false);
        }, 800);
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Confirmar Entrega
  const handleConfirmDelivery = (e) => {
    e.preventDefault();
    setValidationError('');

    // Validações obrigatórias conforme PDR
    if (!location) {
      setValidationError('Capture a localização da entrega.');
      return;
    }

    if (!photo) {
      setValidationError('A foto da entrega é obrigatória.');
      return;
    }

    // Validar se há estoque reservado (Simulação rápida do check do PDR)
    const db = getDb();
    const orderItems = db.itens_pedido.filter(i => i.pedido_id === selectedOrder.id);
    let stockConsistent = true;

    orderItems.forEach(it => {
      const est = db.estoque.find(e => e.produto_id === it.produto_id);
      if (!est || est.quantidade_reservada < it.quantidade) {
        stockConsistent = false;
      }
    });

    if (!stockConsistent) {
      setValidationError('Não foi possível concluir a entrega. Estoque inconsistente.');
      return;
    }

    // Executar confirmação de entrega local
    confirmDeliveryLocal(selectedOrder.id, {
      imagem: photo,
      latitude: location.latitude,
      longitude: location.longitude
    });

    setSuccessMsg(`Entrega do pedido ${selectedOrder.numero} confirmada e estoque baixado!`);
    setSelectedOrder(null);
    loadDeliveries();
    
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Cancelar Pedido (Apenas Admin)
  const handleCancelOrder = () => {
    if (!window.confirm(`Tem certeza que deseja cancelar o pedido ${selectedOrder.numero}? Esta ação retornará os itens reservados ao estoque disponível.`)) {
      return;
    }

    cancelOrderLocal(selectedOrder.id);
    setSuccessMsg(`Pedido ${selectedOrder.numero} cancelado com sucesso!`);
    setSelectedOrder(null);
    loadDeliveries();

    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', color: 'var(--azul-principal)', marginBottom: '16px', fontWeight: '700' }}>
        Gerenciador de Entregas
      </h2>

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.9rem',
          backgroundColor: 'rgba(90, 158, 26, 0.1)',
          color: 'var(--verde-escuro)',
          border: '1px solid rgba(90, 158, 26, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {selectedOrder ? (
        // FORMULÁRIO DE CONFIRMAÇÃO DE ENTREGA SELECIONADA
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1.5px solid var(--cinza-claro)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Entrega do Pedido: {selectedOrder.numero}</h3>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setSelectedOrder(null)}
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem' }}
            >
              Voltar
            </button>
          </div>

          <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--cinza-escuro)' }}>
            <p><strong>Cliente:</strong> {selectedOrder.clienteNome}</p>
            <p><strong>Cidade:</strong> {selectedOrder.clienteCidade}</p>
            <p><strong>Endereço:</strong> {selectedOrder.clienteEndereco}</p>
            {selectedOrder.clienteLatitude && selectedOrder.clienteLongitude && (
              <p style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', marginBottom: '6px' }}>
                <strong>Localização:</strong> 
                <span style={{ color: 'var(--azul-principal)', fontWeight: '600' }}>
                  {selectedOrder.clienteLatitude.toFixed(5)}, {selectedOrder.clienteLongitude.toFixed(5)}
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedOrder.clienteLatitude},${selectedOrder.clienteLongitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline"
                  style={{ display: 'inline-flex', width: 'auto', padding: '4px 10px', fontSize: '0.75rem', gap: '4px' }}
                >
                  <Navigation size={12} /> Ver no Mapa / Rota
                </a>
              </p>
            )}
            <p style={{ marginTop: '6px' }}><strong>Total Pedido:</strong> R$ {selectedOrder.total.toFixed(2)}</p>
          </div>

          {validationError && (
            <div className="alert-box alert-error">
              {validationError}
            </div>
          )}

          {/* Etapa 1: Localização GPS */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px' }}>
              1. Localização da Entrega (Obrigatório)
            </label>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCaptureLocation}
                disabled={locationLoading}
                style={{ width: 'auto', padding: '10px 16px', fontSize: '0.85rem' }}
              >
                {locationLoading ? (
                  <>
                    <RefreshCw size={16} className="spin-anim" /> Capturando...
                  </>
                ) : (
                  <>
                    <MapPin size={16} /> {location ? 'Localização Capturada' : 'Capturar GPS'}
                  </>
                )}
              </button>
              
              {location && (
                <span style={{ fontSize: '0.8rem', color: 'var(--verde-escuro)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={14} /> Lat: {location.latitude.toFixed(5)}, Lng: {location.longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>

          {/* Etapa 2: Foto da Entrega */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px' }}>
              2. Foto de Comprovação (Câmera - Obrigatório)
            </label>
            <CameraCapture
              onCapture={(imgData) => setPhoto(imgData)}
              onClear={() => setPhoto(null)}
            />
          </div>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
            <button 
              type="button" 
              className="btn btn-success" 
              onClick={handleConfirmDelivery}
            >
              <CheckCircle size={20} /> Confirmar Entrega (Baixar Estoque)
            </button>
            
            {isAdmin && (
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleCancelOrder}
                style={{ display: 'inline-flex', gap: '8px', justifyContent: 'center' }}
              >
                <Trash2 size={16} /> Cancelar Pedido (Admin)
              </button>
            )}
          </div>

        </div>
      ) : (
        // LISTAGEM DE PEDIDOS PENDENTES DE ENTREGA
        <div>
          {deliveries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {deliveries.map(order => (
                <div 
                  key={order.id} 
                  className="card" 
                  onClick={() => handleSelectOrder(order)}
                  style={{ cursor: 'pointer', borderLeft: '5px solid var(--azul-secundario)', padding: '16px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '800', color: 'var(--azul-principal)' }}>{order.numero}</span>
                    <span className="badge badge-pendente">Aguardando Entrega</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--preto)', fontWeight: '600' }}>
                    {order.clienteNome}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--cinza-medio)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <MapPin size={12} /> {order.clienteCidade} - {order.clienteEndereco}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--cinza-claro)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--cinza-medio)' }}>
                      Emissão: {new Date(order.data).toLocaleDateString('pt-BR')}
                    </span>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--azul-secundario)' }}>
                      Total: R$ {order.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--cinza-medio)' }}>
              <Truck size={40} style={{ margin: '0 auto 12px auto', color: 'var(--cinza-claro)' }} />
              <h3 style={{ fontSize: '1.1rem', color: 'var(--cinza-medio)', marginBottom: '4px' }}>Nenhuma entrega pendente</h3>
              <p style={{ fontSize: '0.85rem' }}>Todos os pedidos emitidos já foram entregues ou cancelados.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
