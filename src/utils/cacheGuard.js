// Proteção de cache: garante que uma atualização do site (novo build) ou uma
// troca de planilha não deixem artefatos antigos no navegador.

const BUILD_KEY = 'm300_build';

function currentBuild() {
  try {
    return typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';
  } catch {
    return 'dev';
  }
}

// Remove Service Workers e todo o Cache Storage da aplicação.
export async function clearAppCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    /* ignora ambientes sem service worker */
  }

  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    /* ignora navegadores sem Cache Storage */
  }
}

// Executado no carregamento: se o build mudou desde a última visita, limpa o
// cache antigo. Assim cada deploy chega "limpo" para o usuário.
export async function runVersionGuard() {
  const build = currentBuild();
  let previous = null;
  try {
    previous = localStorage.getItem(BUILD_KEY);
  } catch {
    previous = null;
  }

  if (previous !== build) {
    await clearAppCaches();
    try {
      localStorage.setItem(BUILD_KEY, build);
    } catch {
      /* modo privado / storage indisponível */
    }
  }
}
