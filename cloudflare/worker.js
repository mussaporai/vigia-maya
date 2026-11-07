// Vigia da Maya (Cloudflare): a cada 5 minutos confere de fora se o servidor
// da Maya (Railway) responde e se o WhatsApp dela (Evolution) está conectado.
// Quando cai, manda notificação no celular do dono (app ntfy); reavisa a cada
// 2 horas enquanto continuar fora; avisa quando volta.
// Segredos (wrangler secret): NTFY_TOPICO (canal do celular) e CHAVE_TESTE.

const SITE = "https://orcamentos.levelupvideo.com.br";
const REAVISO_MS = 2 * 60 * 60 * 1000;

async function pegar(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), cf: { cacheTtl: 0 } });
    let corpo = null;
    try { corpo = await r.json(); } catch {}
    return { status: r.status, corpo };
  } catch {
    return { status: 0, corpo: null };
  }
}

// Devolve "" se está tudo bem, ou o texto do problema.
async function conferirUmaVez(site) {
  const saude = await pegar(`${site}/health`);
  const db = saude.corpo?.checks?.db, redis = saude.corpo?.checks?.redis;
  if (saude.status !== 200 || db !== true || redis !== true) {
    return `O servidor da Maya (Railway) não está respondendo (HTTP ${saude.status}). Clientes ficam sem resposta e o painel não abre.`;
  }
  const raiz = await pegar(`${site}/`);
  const wa = raiz.corpo?.whatsapp;
  if (!wa) {
    return "O servidor da Evolution (Cloudfy), que liga a Maya ao WhatsApp, não respondeu. Clientes ficam sem resposta.";
  }
  if (wa !== "open") {
    return `O WhatsApp da Maya desconectou (estado: ${wa}). Para voltar: abrir o painel da Evolution, instância Level, e ler o QR Code com o celular da Level UP.`;
  }
  return "";
}

async function conferir(site) {
  let problema = await conferirUmaVez(site);
  if (problema) {
    // Confirma depois de 45 s para não avisar por oscilação de segundos.
    await new Promise((r) => setTimeout(r, 45000));
    problema = await conferirUmaVez(site);
  }
  return problema;
}

async function notificar(env, { titulo, texto, prioridade, tags }) {
  const r = await fetch("https://ntfy.sh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic: env.NTFY_TOPICO, title: titulo, message: texto, priority: prioridade, tags }),
  });
  if (!r.ok) throw new Error(`ntfy respondeu ${r.status}`);
}

async function rodar(env, site = SITE) {
  const problema = await conferir(site);
  const anterior = (await env.VIGIA_MAYA.get("estado")) || "ok";
  const agora = Date.now();
  if (site === SITE) {
    await env.VIGIA_MAYA.put("ultima_conferencia", `${new Date(agora).toISOString()} ${problema ? "FORA" : "ok"}`);
  }

  if (!problema) {
    if (anterior !== "ok") {
      await notificar(env, { titulo: "Maya voltou", texto: "A Maya está no ar de novo. Vale conferir no Chat se algum cliente ficou sem resposta enquanto ela estava fora.", prioridade: 3, tags: ["white_check_mark"] });
      await env.VIGIA_MAYA.put("estado", "ok");
    }
    return "ok";
  }

  const ultimo = anterior.startsWith("fora:") ? Number(anterior.slice(5)) : 0;
  if (!ultimo || agora - ultimo >= REAVISO_MS) {
    await notificar(env, { titulo: ultimo ? "Maya continua fora do ar" : "Maya caiu", texto: problema, prioridade: 5, tags: ["rotating_light"] });
    await env.VIGIA_MAYA.put("estado", `fora:${agora}`);
  }
  return problema;
}

export default {
  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(rodar(env));
  },

  // Só para teste: /teste?chave=...            → manda uma notificação de teste
  //                /teste?chave=...&simular=1  → simula queda (não mexe na produção nem no estado real)
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname !== "/teste" || !env.CHAVE_TESTE || u.searchParams.get("chave") !== env.CHAVE_TESTE) {
      return new Response("Vigia da Maya", { status: 200 });
    }
    if (u.searchParams.get("simular") === "1") {
      const problema = await conferirUmaVez("https://teste-da-vigia.invalid");
      await notificar(env, { titulo: "TESTE: Maya caiu", texto: `Isto é um teste. Numa queda real a mensagem seria: ${problema}`, prioridade: 5, tags: ["rotating_light"] });
      return new Response(`teste de queda enviado: ${problema}`);
    }
    const situacao = await conferirUmaVez(SITE);
    await notificar(env, { titulo: "Vigia da Maya ligada", texto: `Teste de aviso. Situação agora: ${situacao || "Maya no ar, WhatsApp conectado."}`, prioridade: 3, tags: ["eyes"] });
    return new Response(`aviso de teste enviado; situação: ${situacao || "ok"}`);
  },
};
