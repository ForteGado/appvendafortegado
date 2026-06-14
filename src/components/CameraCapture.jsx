import React, { useState, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle, Upload } from 'lucide-react';

export default function CameraCapture({ onCapture, onClear }) {
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Função para comprimir a imagem usando canvas antes de salvar e subir
  const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Comprime e exporta como JPEG
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => {
          resolve(event.target.result); // Fallback
        };
      };
      reader.onerror = () => resolve('');
    });
  };

  // Manipular imagem selecionada da câmera
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImage(file);
      setPreview(compressedDataUrl);
      onCapture(compressedDataUrl);
    } catch (err) {
      console.error('Erro na compressão:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        setPreview(dataUrl);
        onCapture(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleReset = () => {
    setPreview(null);
    onClear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Input Oculto de Câmera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment" // Instrui o celular a abrir a câmera traseira
        onChange={handleFileChange}
        style={{ display: 'none' }}
        id="camera-file-input"
      />

      {preview ? (
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--verde-agro)' }}>
          <img 
            src={preview} 
            alt="Comprovante de Entrega" 
            style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'cover' }} 
          />
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            right: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            background: 'rgba(0,0,0,0.6)',
            padding: '8px 12px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '0.8rem',
            alignItems: 'center'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={16} color="var(--verde-agro)" /> Foto Capturada
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto', background: 'var(--vermelho-cancelar)', color: 'white', border: 'none' }}
            >
              Tirar Outra
            </button>
          </div>
        </div>
      ) : (
        <div 
          onClick={triggerCamera}
          style={{
            border: '2px dashed var(--azul-secundario)',
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: 'rgba(20, 63, 150, 0.02)',
            transition: 'var(--transition-normal)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(20, 63, 150, 0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(20, 63, 150, 0.02)'}
        >
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: 'rgba(20, 63, 150, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--azul-principal)'
          }}>
            <Camera size={32} />
          </div>
          <div>
            <h4 style={{ color: 'var(--azul-principal)', marginBottom: '4px', fontSize: '1rem' }}>Tirar Foto da Entrega</h4>
            <p style={{ color: 'var(--cinza-medio)', fontSize: '0.8rem' }}>Clique para abrir a câmera do seu dispositivo</p>
          </div>
          <button 
            type="button" 
            className="btn btn-primary"
            style={{ width: 'auto', padding: '10px 20px', fontSize: '0.85rem', marginTop: '4px' }}
          >
            <Upload size={16} /> Abrir Câmera
          </button>
        </div>
      )}
    </div>
  );
}
