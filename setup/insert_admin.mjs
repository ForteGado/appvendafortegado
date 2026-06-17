// Script para inserir o usuário admin no Supabase
// Execute com: node setup/insert_admin.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://appfortegado.vendopro.com.br';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.xqOuPBjRM7dEEnbQqrhYm4gah1S0vPaIOEDPB6UbLDU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('Conectando ao Supabase...');

  // 1. Verificar usuários existentes
  const { data: existentes, error: errList } = await supabase
    .from('usuarios')
    .select('id, nome, email, perfil');
  
  if (errList) {
    console.error('Erro ao listar usuários:', errList.message);
    console.log('\nDica: Execute o SQL abaixo diretamente no Dashboard do Supabase SQL Editor:');
    console.log('---');
    console.log(`ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS senha TEXT;`);
    console.log(`INSERT INTO public.usuarios (nome, email, perfil, ativo, senha)
VALUES ('Wislley Prado', 'wislleyprado@gmail.com', 'Administrador', true, '1234567')
ON CONFLICT (email) DO UPDATE SET nome=EXCLUDED.nome, perfil=EXCLUDED.perfil, ativo=EXCLUDED.ativo, senha=EXCLUDED.senha;`);
    return;
  }

  console.log('Usuários existentes:', existentes);

  // 2. Inserir/atualizar Wislley Prado como admin
  const { data, error } = await supabase
    .from('usuarios')
    .upsert({
      nome: 'Wislley Prado',
      email: 'wislleyprado@gmail.com',
      perfil: 'Administrador',
      ativo: true,
      senha: '1234567'
    }, { onConflict: 'email' })
    .select();

  if (error) {
    console.error('Erro ao inserir usuário:', error.message);
    console.log('\nSe o erro for "column senha does not exist", execute no SQL Editor do Supabase:');
    console.log('ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS senha TEXT;');
    console.log('Depois execute este script novamente.');
  } else {
    console.log('✅ Usuário inserido/atualizado com sucesso!', data);
  }
}

main().catch(console.error);
