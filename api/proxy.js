export const config = {
  runtime: 'edge', // Força a Vercel a usar o Edge Runtime e não cobrar pela memória em espera
};

const BLOCKED_HEADERS = new Set([
  'host', 'connection', 'x-forwarded-for',
  'x-forwarded-host', 'x-forwarded-proto',
  'x-vercel-id', 'x-vercel-cache',
  'cdn-loop', 'cf-connecting-ip',
]);

export default async function handler(req) {
  // Extrai a URL original e direciona para o seu VPS na porta 8383
  const url = new URL(req.url);
  const target = `http://164.152.43.13:8383${url.pathname}${url.search}`;

  // Limpa e reconstrói os cabeçalhos
  const newHeaders = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!BLOCKED_HEADERS.has(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }
  
  // Força os cabeçalhos específicos da sua configuração original
  newHeaders.set('host', '164.152.43.13');
  newHeaders.set('connection', 'keep-alive');

  const init = {
    method: req.method,
    headers: newHeaders,
    redirect: 'manual', // Evita que o fetch siga redirecionamentos sozinho
  };

  // Se não for GET ou HEAD, repassa o corpo da requisição (essencial para o xhttp)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    // O parâmetro abaixo é obrigatório no Edge Runtime para fazer proxy de streams (como xhttp)
    init.duplex = 'half'; 
  }

  try {
    // Faz a requisição para a sua VPS
    const response = await fetch(target, init);

    // Copia os cabeçalhos de resposta da VPS
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Accel-Buffering', 'no');
    responseHeaders.set('Cache-Control', 'no-store');

    // Retorna a resposta contínua (stream) para o cliente
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error.message);
    return new Response('Bad Gateway', { status: 502 });
  }
}
