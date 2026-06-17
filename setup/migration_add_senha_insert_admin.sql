-- ==========================================
-- MIGRAÇÃO: Adicionar coluna senha na tabela usuarios
-- e inserir usuário Administrador Wislley Prado
-- ==========================================

-- 1. Adicionar coluna 'senha' na tabela usuarios (se ainda não existir)
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS senha TEXT;

-- 2. Inserir (ou atualizar) o usuário Administrador Wislley Prado
INSERT INTO public.usuarios (nome, email, perfil, ativo, senha)
VALUES (
  'Wislley Prado',
  'wislleyprado@gmail.com',
  'Administrador',
  true,
  '1234567'
)
ON CONFLICT (email)
DO UPDATE SET
  nome   = EXCLUDED.nome,
  perfil = EXCLUDED.perfil,
  ativo  = EXCLUDED.ativo,
  senha  = EXCLUDED.senha;

-- 3. Verificar resultado
SELECT id, nome, email, perfil, ativo FROM public.usuarios ORDER BY id;
