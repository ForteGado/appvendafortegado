-- =============================================================================
-- MIGRAÇÃO: Adicionar colunas de logo e imagem ao banco Forte Gado
-- Execute este SQL no painel do Supabase:
-- Dashboard → SQL Editor → New Query → Cole e execute
-- =============================================================================

-- 1. Adicionar coluna logotipo à tabela empresas (armazena base64 ou URL)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS logotipo TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 2. Adicionar colunas de imagem e descrição à tabela produtos
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS imagem TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT;

-- 3. Adicionar campos de localização ao cadastro de clientes (se ausente)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS nome_produtor TEXT,
  ADD COLUMN IF NOT EXISTS nome_fazenda TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 4. Verificar estrutura atual das tabelas (opcional — só para consulta)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'empresas';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'produtos';
