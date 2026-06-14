import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { getSyncQueue, getCredentials } from '../services/db';
import { syncQueueToSupabase } from '../services/supabaseService';
import { syncToGoogleSheets } from '../services/sheetsService';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Carregar fila inicial
  const updateQueueStatus = () => {
    const queue = getSyncQueue();
    setQueueCount(queue.length);
  };

  useEffect(() => {
    // Monitorar conexao
    const handleOnline = () => {
      const creds = getCredentials();
      setIsOnline(navigator.onLine && !creds.simulateOffline);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('fortegado_queue_update', updateQueueStatus);
    window.addEventListener('fortegado_credentials_update', handleOnline);

    updateQueueStatus();
    handleOnline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('fortegado_queue_update', updateQueueStatus);
      window.removeEventListener('fortegado_credentials_update', handleOnline);
    };
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const creds = getCredentials();
      const queueBefore = getSyncQueue(); // Copia da fila antes do Supabase processar e limpar os itens
      
      // 1. Sincronizar com Supabase
      const supResult = await syncQueueToSupabase();
      
      // 2. Sincronizar com o Google Sheets somente os itens que foram processados com sucesso no Supabase
      const queueAfter = getSyncQueue();
      const processedItems = queueBefore.filter(itemBefore => 
        !queueAfter.some(itemAfter => itemAfter.id === itemBefore.id)
      );

      let sheetsSuccessCount = 0;
      if (creds.googleSheetsUrl && processedItems.length > 0) {
        // Envia as ações processadas com sucesso para o Google Sheets
        for (const item of processedItems) {
          const res = await syncToGoogleSheets(item.actionType, item.payload);
          if (res && res.success) {
            sheetsSuccessCount++;
          }
        }
      }

      setSyncResult({
        success: true,
        message: `Sincronização concluída! ${supResult.processed || 0} ações integradas.`
      });
      
      // Atualizar contador local
      updateQueueStatus();
    } catch (err) {
      setSyncResult({
        success: false,
        message: `Erro na sincronização: ${err.message}`
      });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  // Efeito para sincronização automática quando estiver online e houver itens pendentes
  useEffect(() => {
    if (isOnline && queueCount > 0 && !syncing) {
      console.log('[Auto-Sync] Iniciando sincronização automática de itens pendentes.');
      handleSync();
    }
  }, [isOnline, queueCount, syncing]);

  return (
    <div style={{ margin: '0 0 16px 0' }}>
      <div className={`connection-bar ${isOnline ? 'online' : 'offline'}`} style={{ borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOnline ? (
            <>
              <Wifi size={16} />
              <span>Conectado (Online)</span>
            </>
          ) : (
            <>
              <WifiOff size={16} />
              <span>Modo Offline</span>
            </>
          )}
        </div>
        
        {queueCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 'bold' }}>{queueCount} pendente(s)</span>
            {isOnline && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn btn-cta"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  width: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} className={syncing ? 'spin-anim' : ''} />
                {syncing ? 'Sincronizando...' : 'Enviar'}
              </button>
            )}
          </div>
        )}
      </div>

      {syncResult && (
        <div style={{
          marginTop: '8px',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          backgroundColor: syncResult.success ? 'rgba(90, 158, 26, 0.1)' : 'rgba(229, 62, 98, 0.1)',
          color: syncResult.success ? 'var(--verde-escuro)' : '#c53030',
          border: `1px solid ${syncResult.success ? 'rgba(90, 158, 26, 0.2)' : 'rgba(229, 62, 98, 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={14} />
          <span>{syncResult.message}</span>
        </div>
      )}

      {/* Estilo para animação spin */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
