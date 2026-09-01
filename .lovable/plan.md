# Promover conta a administrador

## Objetivo
Dar perfil de **administrador** à conta `douglaslms94@gmail.com` (Douglas GESTOR), hoje com papel `funcionario`.

## Estado atual (verificado no banco)
- 4 contas existem; `douglaslms.work@gmail.com` já é admin.
- A conta escolhida (`douglaslms94@gmail.com`, id `807902fe-3c96-4a47-af66-2b89960e8c86`) tem apenas o papel `funcionario`.

## Mudança
- Inserir em `public.user_roles` o papel `admin` para o usuário `807902fe-3c96-4a47-af66-2b89960e8c86` (mantendo o papel `funcionario`, que é inofensivo — as permissões de admin prevalecem via `has_role`/`has_permission`).
- Operação de dados via `run_sql` (não é mudança de schema):
  `INSERT INTO public.user_roles (user_id, role) VALUES ('807902fe-3c96-4a47-af66-2b89960e8c86', 'admin') ON CONFLICT DO NOTHING;`

## Resultado esperado
- Ao entrar com `douglaslms94@gmail.com`, o usuário vê o painel de gestor, gerencia acessos/cargos, aprova prestações, adiciona verbas e usa a integração de obras.

## Verificação
- Consultar `user_roles` confirmando o papel `admin` na conta.
