(() => {
  'use strict';

  // Cada boda usa sus propias llaves: varias pueden vivir en el mismo dominio de GitHub Pages
  const idBoda = document.body.dataset.boda;
  const LLAVE_CLAVE = `portal-clave-${idBoda}`;
  // Subir la ronda en boda.toml deja todo otra vez como pendiente en todos los celulares
  const LLAVE_ENVIADAS = `portal-enviadas-${idBoda}-${document.body.dataset.ronda}`;
  const cifrado = JSON.parse(document.getElementById('cifrado').textContent);
  const esCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const porId = (id) => document.getElementById(id);
  const vistaAcceso = porId('acceso');
  const vistaLista = porId('vista-lista');
  const vistaEnvio = porId('vista-envio');
  const enlacesWhatsApp = document.querySelectorAll('[data-whatsapp]');

  let invitados = [];
  let porCodigo = {};
  let enviadas = {};
  let filtro = 'pendientes';
  let scrollLista = 0;
  let actual = null;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // ---------- Utilidades ----------
  const leer = (llave) => { try { return localStorage.getItem(llave); } catch (error) { return null; } };
  const escribir = (llave, valor) => { try { localStorage.setItem(llave, valor); } catch (error) { /* modo privado */ } };
  const borrar = (llave) => { try { localStorage.removeItem(llave); } catch (error) { /* modo privado */ } };

  const desdeBase64 = (texto) => Uint8Array.from(atob(texto), (letra) => letra.charCodeAt(0));
  const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const personas = (pases) => (pases === 1 ? '1 persona' : `${pases} personas`);
  const fechaCorta = (iso) => new Date(iso).toLocaleString('es-CO', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });

  const mostrar = (vista) => {
    [vistaAcceso, vistaLista, vistaEnvio].forEach((v) => { v.hidden = v !== vista; });
  };

  // ---------- Acceso: la clave descifra la lista en el navegador ----------
  async function descifrar(clave) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
    const llave = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: desdeBase64(cifrado.sal), iterations: cifrado.iteraciones, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
    );
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: desdeBase64(cifrado.iv) }, llave, desdeBase64(cifrado.datos));
    return JSON.parse(new TextDecoder().decode(plano));
  }

  async function entrar(clave) {
    const datos = await descifrar(clave); // lanza un error si la clave es incorrecta
    invitados = datos.invitados;
    porCodigo = {};
    invitados.forEach((inv) => { porCodigo[inv.codigo] = inv; });
    try {
      enviadas = JSON.parse(leer(LLAVE_ENVIADAS)) || {};
    } catch (error) {
      enviadas = {};
    }
    porId('aviso-confirmacion').hidden = !datos.falta_confirmacion;
    escribir(LLAVE_CLAVE, clave);
    enrutar();
  }

  porId('form-clave').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const boton = porId('entrar');
    boton.disabled = true;
    porId('error-clave').hidden = true;
    try {
      await entrar(porId('clave').value.trim());
    } catch (error) {
      porId('error-clave').hidden = false;
      porId('clave').select();
    }
    boton.disabled = false;
  });

  porId('salir').addEventListener('click', () => {
    borrar(LLAVE_CLAVE);
    porId('clave').value = '';
    mostrar(vistaAcceso);
  });

  // ---------- Lista de invitados ----------
  function crearFila(inv) {
    const enviada = enviadas[inv.codigo];
    const fila = document.createElement('button');
    fila.type = 'button';
    fila.className = enviada ? 'fila fila--enviada' : 'fila';

    const texto = document.createElement('span');
    const nombre = document.createElement('span');
    nombre.className = 'fila__nombre';
    nombre.textContent = inv.nombre;
    const detalle = document.createElement('span');
    detalle.className = inv.pases ? 'fila__detalle' : 'fila__detalle fila__detalle--aviso';
    detalle.textContent = inv.pases ? personas(inv.pases) : 'Faltan los pases';
    if (enviada) detalle.textContent += ` · ${fechaCorta(enviada)}`;
    texto.append(nombre, detalle);

    const accion = document.createElement('span');
    accion.className = 'fila__accion';
    if (enviada) accion.innerHTML = '<svg aria-hidden="true"><use href="#i-listo"/></svg>Enviada';
    else accion.textContent = 'Enviar';

    fila.append(texto, accion);
    fila.addEventListener('click', () => {
      scrollLista = window.scrollY;
      window.location.hash = inv.codigo;
    });

    const elemento = document.createElement('li');
    elemento.append(fila);
    return elemento;
  }

  function pintarLista() {
    const total = invitados.length;
    const hechas = invitados.filter((inv) => enviadas[inv.codigo]).length;
    porId('progreso-texto').textContent = `${hechas} de ${total} enviadas`;
    porId('progreso-personas').textContent = personas(invitados.reduce((suma, inv) => suma + (inv.pases || 0), 0));
    porId('progreso-barra').style.width = `${total ? (hechas / total) * 100 : 0}%`;
    porId('cuenta-pendientes').textContent = total - hechas;
    porId('cuenta-enviadas').textContent = hechas;
    porId('cuenta-todas').textContent = total;

    const busqueda = normalizar(porId('buscar').value.trim());
    const visibles = invitados.filter((inv) => {
      const enviada = Boolean(enviadas[inv.codigo]);
      if (filtro === 'pendientes' && enviada) return false;
      if (filtro === 'enviadas' && !enviada) return false;
      return !busqueda || normalizar(inv.nombre).includes(busqueda);
    });

    const lista = porId('invitados');
    lista.textContent = '';
    visibles.forEach((inv) => lista.append(crearFila(inv)));

    const vacio = porId('vacio');
    vacio.hidden = visibles.length > 0;
    if (busqueda) vacio.textContent = 'Ningún invitado con ese nombre.';
    else if (filtro === 'pendientes') vacio.textContent = '¡Todas las invitaciones están enviadas!';
    else vacio.textContent = 'Todavía no has enviado ninguna invitación.';
  }

  porId('buscar').addEventListener('input', pintarLista);
  document.querySelectorAll('[data-filtro]').forEach((boton) => boton.addEventListener('click', () => {
    filtro = boton.dataset.filtro;
    document.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b === boton)));
    pintarLista();
    window.scrollTo(0, 0);
  }));

  // ---------- Envío de una invitación ----------
  function siguientePendiente(inv) {
    const inicio = invitados.indexOf(inv);
    for (let i = 1; i < invitados.length; i += 1) {
      const candidato = invitados[(inicio + i) % invitados.length];
      if (!enviadas[candidato.codigo]) return candidato;
    }
    return null;
  }

  function pintarEnvio(inv) {
    const enviada = enviadas[inv.codigo];
    porId('posicion').textContent = `${invitados.indexOf(inv) + 1} de ${invitados.length}`;
    porId('vp-nombre').textContent = inv.nombre;
    porId('vp-pases').textContent = inv.pases_texto;
    porId('vp-pases').hidden = !inv.pases_texto;
    porId('vp-linea').hidden = !inv.pases_texto;
    porId('aviso-pases').hidden = Boolean(inv.pases_texto);
    porId('ver-invitacion').href = inv.enlace;
    porId('texto-mensaje').textContent = inv.mensaje;

    // Sin número: WhatsApp se abre con el mensaje listo y deja escoger el contacto
    const enlace = `https://wa.me/?text=${encodeURIComponent(inv.mensaje)}`;
    enlacesWhatsApp.forEach((a) => {
      a.href = enlace;
      if (!esCelular) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
    });

    porId('estado-enviada').hidden = !enviada;
    porId('acciones-pendiente').hidden = Boolean(enviada);
    porId('acciones-enviada').hidden = !enviada;
    if (enviada) {
      porId('estado-texto').textContent = `Marcada como enviada · ${fechaCorta(enviada)}`;
      const siguiente = siguientePendiente(inv);
      porId('siguiente').href = siguiente ? `#${siguiente.codigo}` : '#';
      porId('siguiente').textContent = siguiente ? `Siguiente: ${siguiente.nombre}` : 'Volver a la lista';
    }
  }

  const guardarEnviadas = () => escribir(LLAVE_ENVIADAS, JSON.stringify(enviadas));

  enlacesWhatsApp.forEach((a) => a.addEventListener('click', () => {
    enviadas[actual.codigo] = new Date().toISOString();
    guardarEnviadas();
    // Se repinta un instante después para no interrumpir la salida hacia WhatsApp
    const inv = actual;
    setTimeout(() => { if (actual === inv) pintarEnvio(inv); }, 400);
  }));

  porId('marcar-pendiente').addEventListener('click', () => {
    delete enviadas[actual.codigo];
    guardarEnviadas();
    pintarEnvio(actual);
  });

  porId('copiar-mensaje').addEventListener('click', async (evento) => {
    const boton = evento.currentTarget;
    try {
      await navigator.clipboard.writeText(actual.mensaje);
    } catch (error) {
      const area = document.createElement('textarea');
      area.value = actual.mensaje;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    boton.textContent = '¡Copiado!';
    setTimeout(() => { boton.textContent = 'Copiar mensaje'; }, 1600);
  });

  // ---------- Navegación: #código abre una invitación; sin código, la lista ----------
  function enrutar() {
    if (!invitados.length) return;
    const inv = porCodigo[window.location.hash.slice(1)];
    actual = inv || null;
    if (inv) {
      pintarEnvio(inv);
      mostrar(vistaEnvio);
      window.scrollTo(0, 0);
    } else {
      pintarLista();
      mostrar(vistaLista);
      window.scrollTo(0, scrollLista);
    }
  }

  window.addEventListener('hashchange', enrutar);

  // ---------- Inicio: si este celular ya tiene la clave, entra directo ----------
  const guardada = leer(LLAVE_CLAVE);
  if (guardada) {
    entrar(guardada).catch(() => {
      borrar(LLAVE_CLAVE);
      mostrar(vistaAcceso);
    });
  } else {
    mostrar(vistaAcceso);
  }
})();
