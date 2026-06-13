-- ==========================================
-- SCRIPT DE BANCO DE DADOS SUPABASE (SQL)
-- SISTEMA DE VENDAS FORTE GADO
-- ==========================================

-- 1. Tabela Empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cnpj VARCHAR(20) UNIQUE NOT NULL,
    endereco TEXT,
    telefone VARCHAR(20),
    logotipo TEXT, -- Caractere emoji ou URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela Usuários
CREATE TABLE IF NOT EXISTS public.usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    perfil VARCHAR(50) NOT NULL CHECK (perfil IN ('Administrador', 'Vendedor')),
    ativo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20) UNIQUE,
    telefone VARCHAR(20),
    endereco TEXT,
    cidade VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    unidade VARCHAR(50) NOT NULL,
    preco NUMERIC(10, 2) NOT NULL CHECK (preco >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela Estoque
CREATE TABLE IF NOT EXISTS public.estoque (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL UNIQUE REFERENCES public.produtos(id) ON DELETE CASCADE,
    quantidade_atual INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    quantidade_reservada INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_reservada >= 0),
    estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela Pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INTEGER NOT NULL REFERENCES public.clientes(id),
    vendedor_id INTEGER NOT NULL REFERENCES public.usuarios(id),
    data TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Emitido' CHECK (status IN ('Emitido', 'Entregue', 'Cancelado')),
    total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0)
);

-- 7. Tabela Itens do Pedido
CREATE TABLE IF NOT EXISTS public.itens_pedido (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES public.produtos(id),
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    valor_unitario NUMERIC(10, 2) NOT NULL CHECK (valor_unitario >= 0),
    desconto NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (desconto >= 0)
);

-- 8. Tabela Parcelas
CREATE TABLE IF NOT EXISTS public.parcelas (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    vencimento DATE NOT NULL,
    valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
    pago BOOLEAN DEFAULT false NOT NULL
);

-- 9. Tabela Assinaturas
CREATE TABLE IF NOT EXISTS public.assinaturas (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    imagem TEXT NOT NULL -- Assinatura em Base64 ou URL
);

-- 10. Tabela Fotos de Entrega
CREATE TABLE IF NOT EXISTS public.fotos_entrega (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    imagem TEXT NOT NULL -- Foto da entrega em Base64 ou URL
);

-- 11. Tabela Localizações
CREATE TABLE IF NOT EXISTS public.localizacoes (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('venda', 'entrega')),
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS) se necessário
-- (Por simplicidade, assume-se acesso direto via Anon Key sem restrições complexas para facilidade de demonstração)

-- Carga Inicial de Dados de Demonstração
INSERT INTO public.empresas (nome, cnpj, endereco, telefone, logotipo)
VALUES ('Forte Gado Comercial Ltda', '12.345.678/0001-90', 'Rodovia Transagro, Km 45, Uberaba - MG', '(34) 99999-1111', '🐂')
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO public.usuarios (id, nome, email, perfil, ativo)
VALUES 
(1, 'Wislley Prado', 'prado@fortegado.com.br', 'Administrador', true),
(2, 'Silva Vendedor', 'silva@fortegado.com.br', 'Vendedor', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.clientes (id, nome, cpf_cnpj, telefone, endereco, cidade)
VALUES 
(1, 'Fazenda Bela Vista (Carlos)', '11.222.333/0001-44', '(34) 98888-2222', 'Estrada Geral, Zona Rural', 'Uberaba'),
(2, 'Agropecuária São José', '22.333.444/0001-55', '(34) 98777-3333', 'Av. Brasil, 120, Centro', 'Sacramento'),
(3, 'Haras Imperial (Dra. Ana)', '33.444.555/0001-66', '(16) 99666-4444', 'Rodovia SP-330, Km 310', 'Ribeirão Preto'),
(4, 'Fazenda Santa Maria (José)', '44.555.666/0001-77', '(34) 99555-5555', 'Vicinal dos Ipês, Km 8', 'Conquista'),
(5, 'Recanto Feliz Agro', '55.666.777/0001-88', '(34) 99111-6666', 'Fazenda Recanto Feliz', 'Delta')
ON CONFLICT (cpf_cnpj) DO NOTHING;

INSERT INTO public.produtos (id, codigo, nome, unidade, preco)
VALUES 
(1, 'RAC001', 'Ração Gado de Corte Premium', 'Saco 40kg', 120.00),
(2, 'SUP002', 'Suplemento Mineral Fosgasto', 'Saco 25kg', 185.50),
(3, 'SAL003', 'Sal Milagroso Engorda Rápida', 'Saco 25kg', 95.00),
(4, 'VAC004', 'Vacina Antiaftosa ForteDose', 'Frasco 50ml', 350.00),
(5, 'VER005', 'Vermífugo Premium Potente', 'Frasco 500ml', 280.00)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.estoque (produto_id, quantidade_atual, quantidade_reservada, estoque_minimo)
VALUES 
(1, 150, 20, 30),
(2, 45, 5, 10),
(3, 300, 0, 50),
(4, 12, 2, 15),
(5, 0, 0, 5)
ON CONFLICT (produto_id) DO NOTHING;
