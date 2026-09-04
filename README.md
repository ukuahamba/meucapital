# MeuCapital V5 — Autenticação

Esta versão integra o frontend do MeuCapital com o Supabase Auth.

Inclui:
- Criar conta com nome, e-mail e palavra-passe
- Login
- Confirmação de e-mail
- Recuperação de palavra-passe
- Logout
- Sessão persistente
- Dados locais separados por utilizador neste dispositivo
- Favicon e imagem de apresentação mantidos

Próxima etapa: criar as tabelas do MeuCapital no Supabase e ativar RLS para sincronizar receitas, despesas, metas, investimentos e histórico na nuvem.

Importante: a Publishable key pode ser usada no frontend. Nunca colocar uma Secret/Service Role key no site.
