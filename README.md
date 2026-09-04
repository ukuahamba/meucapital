# MeuCapital V8 — Recuperação de palavra-passe corrigida

Versão baseada no V7, com a recuperação de palavra-passe corrigida para o Supabase.

## O que foi corrigido
- O e-mail de recuperação redireciona para `https://ukuahamba.github.io/meucapital/`.
- A aplicação reconhece o fluxo `PASSWORD_RECOVERY` do Supabase.
- Suporta links de recuperação com sessão no hash e com `code` na URL.
- Abre automaticamente a janela para definir uma nova palavra-passe.
- Usa `supabaseClient.auth.updateUser({ password })` depois de a sessão de recuperação estar estabelecida.
- Valida pelo menos 8 caracteres e confirmação da nova palavra-passe.
- Limpa a URL depois da atualização.

## Ficheiros
`index.html`, `style.css`, `script.js`, `README.md`, `favicon.png`, `apple-touch-icon.png`, `meucapital-apresentacao.png`.
