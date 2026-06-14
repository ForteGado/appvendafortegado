-- =============================================================================
-- MIGRAÇÃO: Adicionar colunas de logo e imagem e desabilitar RLS no Supabase
-- Execute este SQL no painel do Supabase:
-- Dashboard → SQL Editor → New Query → Cole e execute
-- =============================================================================

-- 1. Adicionar colunas faltantes de logo e dados à tabela empresas (armazena base64 ou URL)
ALTER TABLE IF EXISTS public.empresas
  ADD COLUMN IF NOT EXISTS logotipo TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT;

-- 2. Adicionar colunas de imagem e descrição à tabela produtos (se ausente)
ALTER TABLE IF EXISTS public.produtos
  ADD COLUMN IF NOT EXISTS imagem TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT;

-- 3. Adicionar campos de localização ao cadastro de clientes (se ausente)
ALTER TABLE IF EXISTS public.clientes
  ADD COLUMN IF NOT EXISTS nome_produtor TEXT,
  ADD COLUMN IF NOT EXISTS nome_fazenda TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 4. DESABILITAR ROW LEVEL SECURITY (RLS)
-- Por padrão, novos projetos no Supabase habilitam RLS automaticamente.
-- Se RLS estiver ativo sem políticas, inserts de fotos e assinaturas falham silenciosamente.
-- Execute as linhas abaixo para desabilitar o RLS e permitir a sincronização das tabelas:
ALTER TABLE public.empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_entrega DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.localizacoes DISABLE ROW LEVEL SECURITY;

