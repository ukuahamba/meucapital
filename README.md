# MeuCapital V5 — Login (corrigido)

Versão corrigida do MeuCapital com Supabase Auth.

Inclui:
- Criar conta
- Login
- Confirmação de e-mail
- Recuperação de palavra-passe
- Logout
- Sessão persistente
- Dados locais separados por utilizador neste dispositivo
- Favicon e apresentação

Correção principal:
- A autenticação agora é inicializada depois de o estado e os dados padrão do MeuCapital estarem carregados, evitando erro de JavaScript na abertura do site.

Próxima etapa: configurar as URLs de autenticação no Supabase e depois criar as tabelas/RLS para sincronizar os dados na nuvem.

Nunca colocar uma Secret/Service Role key no frontend.


V6: confirmação de criação de conta por código OTP de 6 dígitos. No Supabase, o template "Confirm signup" deve usar {{ .Token }} para enviar o código.
