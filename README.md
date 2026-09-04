# MeuCapital V21 — Reconhecimento de Bancos Angola

Carteira e movimentos com sincronização por conta no Supabase e reconhecimento local de BIN/IIN.

## O que mudou
- Reconhecimento local por correspondências de BIN/IIN conhecidas.
- Estado separado para **banco reconhecido**, **rede conhecida mas emissor não confirmado** e **emissor não confirmado**.
- O BIN é usado somente no navegador e não é guardado no Supabase.
- BINs sem confirmação não são atribuídos a um banco por tentativa.
- `500294` é tratado como **MAESTRO / Débito, emissor não confirmado**, em vez de apresentar um erro ou inventar um banco.
- Continua a guardar apenas os últimos 4 dígitos do cartão.
- Não guarda PIN, CVV, palavra-passe bancária ou número completo do cartão.
- Mantém as tabelas/RLS da V19; não é necessário executar SQL novo.

## Publicar
1. No GitHub, substitui os 7 ficheiros do site pelos ficheiros desta pasta.
2. **Não publiques o SQL como ficheiro do site**; ele é apenas referência para a base de dados.
3. Aguarda a atualização do GitHub Pages.
4. Abre Cartões e testa um BIN conhecido.

## Nota de confiança
As listas públicas de BIN podem estar desatualizadas ou conter lacunas. Por isso, a V21 nunca transforma um BIN desconhecido numa afirmação de banco. A Rede MULTICAIXA processa cartões emitidos pelos bancos participantes, mas isso não significa que o banco emissor possa ser deduzido apenas pelo texto de uma transação.
