# Vigia da Maya

**Vigia principal (desde 07/11/2026): Cloudflare Worker `vigia-maya`** (`cloudflare/`), a cada 5 minutos, com notificação no celular do dono pelo app **ntfy** (canal guardado como segredo `NTFY_TOPICO` na Cloudflare). Avisa quando cai, reavisa a cada 2 h e avisa quando volta. Teste: `https://vigia-maya.mussa-por-ai.workers.dev/teste?chave=<CHAVE_TESTE>&simular=1`. Última conferência: chave `ultima_conferencia` no KV `VIGIA_MAYA`.

O agendamento do GitHub abaixo fica só de reserva: nesta conta ele atrasa horas ou nem roda.

## Reserva no GitHub Actions

Confere a cada 10 minutos, de fora, se a Maya (agente de WhatsApp da Level UP) está no ar:

- **Servidor** (Railway): `https://orcamentos.levelupvideo.com.br/health` precisa responder 200 com banco e Redis ok.
- **WhatsApp** (Evolution API): `https://orcamentos.levelupvideo.com.br/` precisa dizer `"whatsapp": "open"`.

Se algo falhar duas vezes seguidas (60 s de intervalo), o job falha e o **GitHub manda e-mail** ao dono da conta. Enquanto continuar fora, reavisa a cada 2 horas. Quando volta, a própria Maya avisa no grupo da equipe.

Não usa senha nem chave. Fica fora da Railway e da Evolution de propósito: se uma delas cair, a vigia continua funcionando.

**Testar o aviso:** Actions → Vigia da Maya → Run workflow → marcar "simular_queda". O job falha de propósito (não mexe na produção) e o e-mail deve chegar.

**Desligar:** Actions → Vigia da Maya → "..." → Disable workflow.
