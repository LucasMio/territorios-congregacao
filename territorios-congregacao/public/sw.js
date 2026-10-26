// "Service worker": guarda no celular o que já foi aberto (telas, pedaços do mapa e dados dos
// territórios), para o site abrir mesmo sem internet. Com internet, sempre busca o mais novo.
const VERSAO = 'v1';
const CACHE_APP = `territorios-app-${VERSAO}`;
const CACHE_DADOS = 'territorios-dados'; // apagado ao tocar em "Sair"
const CACHE_MAPA = 'territorios-mapa';
const LIMITE_MAPA = 800; // pedaços do mapa guardados (os mais antigos saem)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icone-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('territorios-app-') && n !== CACHE_APP).map((n) => caches.delete(n)))),
  );
  self.clients.claim();
});

async function primeiroRede(req, cache, chave = req) {
  try {
    const resp = await fetch(req);
    if (resp.ok) (await caches.open(cache)).put(chave, resp.clone());
    return resp;
  } catch (erro) {
    const guardado = await caches.match(chave, { ignoreVary: true });
    if (guardado) return guardado;
    throw erro;
  }
}

async function primeiroGuardado(req, cache, limite) {
  const guardado = await caches.match(req);
  if (guardado) return guardado;
  const resp = await fetch(req);
  if (resp.ok || resp.type === 'opaque') {
    const c = await caches.open(cache);
    await c.put(req, resp.clone());
    if (limite) {
      const chaves = await c.keys();
      for (const k of chaves.slice(0, Math.max(0, chaves.length - limite))) await c.delete(k);
    }
  }
  return resp;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // marcações, login etc. nunca são guardados
  const url = new URL(req.url);

  // Telas do site: busca a mais nova; sem internet, abre a guardada.
  if (req.mode === 'navigate') {
    e.respondWith(primeiroRede(req, CACHE_APP, '/'));
    return;
  }
  // Arquivos do site (têm o nome mudado a cada versão) e ruas: guardados de vez.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || /\.(png|svg|json|webmanifest)$/.test(url.pathname))) {
    e.respondWith(primeiroGuardado(req, CACHE_APP));
    return;
  }
  // Pedaços do mapa (OpenStreetMap).
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(primeiroGuardado(req, CACHE_MAPA, LIMITE_MAPA));
    return;
  }
  // Dados (territórios, quadras, programação): busca o mais novo; sem internet, usa o último guardado.
  if (url.pathname.startsWith('/rest/v1/')) {
    e.respondWith(primeiroRede(req, CACHE_DADOS));
  }
});
