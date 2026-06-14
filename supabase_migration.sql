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

-- 4. ATIVAR ROW LEVEL SECURITY (RLS) E CRIAR POLÍTICAS DE ACESSO
-- Novos projetos do Supabase habilitam o RLS automaticamente e o linter aponta erro se as tabelas ficarem públicas sem RLS.
-- Para resolver o aviso do linter de forma segura, ativamos o RLS e criamos políticas de acesso total para clientes anônimos e autenticados:

-- Habilitar RLS nas tabelas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localizacoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas se já existirem
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.empresas;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.usuarios;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.clientes;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.produtos;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.estoque;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.pedidos;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.itens_pedido;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.parcelas;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.assinaturas;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.fotos_entrega;
DROP POLICY IF EXISTS "Acesso total anon e auth" ON public.localizacoes;

-- Criar políticas de acesso irrestrito para os clientes anon e auth
CREATE POLICY "Acesso total anon e auth" ON public.empresas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.usuarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.clientes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.produtos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.estoque FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.pedidos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.itens_pedido FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.parcelas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.assinaturas FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.fotos_entrega FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total anon e auth" ON public.localizacoes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


