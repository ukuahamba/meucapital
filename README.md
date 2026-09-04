# MeuCapital V19

Carteira e movimentos com sincronização por conta no Supabase.

## Segurança
- Guarda apenas os últimos 4 dígitos do cartão.
- Não guarda PIN, CVV, palavra-passe bancária ou número completo do cartão.
- Row Level Security (RLS) limita cada registo ao utilizador autenticado.

## Ativar a V19
1. No Supabase, abre **SQL Editor**.
2. Copia todo o conteúdo do ficheiro `MEUCAPITAL_V19_SUPABASE.sql` e executa-o.
3. Publica os 7 ficheiros desta pasta no repositório GitHub do MeuCapital.
4. Entra na conta e abre **Cartões**.

Se a base de dados ainda não estiver criada, a interface continua a funcionar localmente e mostra o estado de sincronização.
