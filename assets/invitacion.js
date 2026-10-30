(() => {
  'use strict';

  const raiz = document.documentElement;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const contenido = document.getElementById('contenido');
  const pie = document.querySelector('.pie');

  // ---------- Música: reproductor oficial de YouTube o un mp3 propio ----------
  const botonMusica = document.querySelector('[data-musica]');
  const musica = botonMusica ? crearMusica() : null;

  function crearMusica() {
    const audio = document.getElementById('musica');
    if (audio) {
      return {
        reproducir: () => audio.play().catch(() => {}),
        pausar: () => audio.pause(),
        sonando: () => !audio.paused,
        alCambiar: (fn) => { audio.addEventListener('play', fn); audio.addEventListener('pause', fn); },
      };
    }

    const seccion = document.querySelector('[data-youtube]');
    if (!seccion) return null;
    let reproductor = null;
    let listo = false;
    let quiereSonar = false;
    let sonando = false;
    const oyentes = [];

    const cargar = () => {
      window.onYouTubeIframeAPIReady = () => {
        reproductor = new window.YT.Player(seccion.querySelector('[data-reproductor]'), {
          host: 'https://www.youtube-nocookie.com',
          videoId: seccion.dataset.youtube,
          playerVars: {
            playsinline: 1, rel: 0, loop: 1, playlist: seccion.dataset.youtube,
            start: Number(seccion.dataset.inicio) || 0,
          },
          events: {
            onReady: () => { listo = true; if (quiereSonar) reproductor.playVideo(); },
            onStateChange: (evento) => {
              const estados = window.YT.PlayerState;
              sonando = evento.data === estados.PLAYING || evento.data === estados.BUFFERING;
              oyentes.forEach((fn) => fn());
            },
          },
        });
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.append(script);
    };
    // Se carga después de la página para no competir con las fotos
    if (document.readyState === 'complete') cargar();
    else window.addEventListener('load', cargar, { once: true });

    return {
      reproducir: () => { quiereSonar = true; if (listo) reproductor.playVideo(); },
      pausar: () => { quiereSonar = false; if (listo) reproductor.pauseVideo(); },
      sonando: () => sonando,
      alCambiar: (fn) => oyentes.push(fn),
      seccion,
    };
  }

  function reproducir() {
    if (!musica) return;
    botonMusica.hidden = false;
    musica.reproducir();
    // Si el navegador no dejó arrancar la música (pasa en iPhone), el botón late para invitar a tocarlo
    setTimeout(() => { if (!musica.sonando()) botonMusica.classList.add('musica--invita'); }, 3500);
  }

  if (musica) {
    const actualizar = () => {
      const activo = musica.sonando();
      botonMusica.classList.toggle('sonando', activo);
      if (activo) botonMusica.classList.remove('musica--invita');
      botonMusica.setAttribute('aria-label', activo ? 'Pausar música' : 'Reproducir música');
    };
    musica.alCambiar(actualizar);
    botonMusica.addEventListener('click', () => {
      botonMusica.classList.remove('musica--invita');
      if (musica.sonando()) {
        musica.pausar();
        return;
      }
      musica.reproducir();
      // En iPhone el video de YouTube solo arranca si se toca: si no sonó, lleva a la canción
      if (musica.seccion) {
        setTimeout(() => {
          if (!musica.sonando()) musica.seccion.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'center' });
        }, 1500);
      }
    });
  }

  // ---------- Portada: las dos hojas se abren ----------
  const portada = document.getElementById('portada');

  if (portada) {
    raiz.classList.add('con-portada');
    contenido.inert = true;
    if (pie) pie.inert = true;
    portada.querySelectorAll('[data-abrir]').forEach((boton) => boton.addEventListener('click', abrir));
  } else {
    raiz.classList.add('invitacion-abierta');
  }

  function abrir() {
    if (portada.classList.contains('abierta')) return;
    window.scrollTo(0, 0);
    portada.classList.add('abierta');
    raiz.classList.remove('con-portada');
    raiz.classList.add('invitacion-abierta');
    contenido.inert = false;
    if (pie) pie.inert = false;
    reproducir();

    const terminar = () => {
      portada.hidden = true;
      document.getElementById('inicio').focus({ preventScroll: true });
    };
    if (sinMovimiento) terminar();
    else setTimeout(terminar, 1900);
  }

  // ---------- Aparición al hacer scroll ----------
  const revelables = document.querySelectorAll('.revelar');
  if ('IntersectionObserver' in window && !sinMovimiento) {
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        entrada.target.classList.add('visible');
        observador.unobserve(entrada.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revelables.forEach((el) => observador.observe(el));
  } else {
    revelables.forEach((el) => el.classList.add('visible'));
  }

  // ---------- Cuenta regresiva ----------
  const cuenta = document.querySelector('[data-cuenta]');
  if (cuenta) {
    const objetivo = new Date(cuenta.dataset.cuenta).getTime();
    const celdas = {};
    cuenta.querySelectorAll('[data-u]').forEach((el) => { celdas[el.dataset.u] = el; });
    const dosCifras = (n) => String(n).padStart(2, '0');
    const DIA = 864e5;

    const mostrarMensaje = (texto) => {
      cuenta.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'cuenta__mensaje';
      p.textContent = texto;
      cuenta.append(p);
    };

    const tic = () => {
      let resta = objetivo - Date.now();
      if (resta <= 0) {
        clearInterval(reloj);
        mostrarMensaje(resta > -DIA ? '¡Hoy es el gran día!' : '¡Gracias por acompañarnos!');
        return;
      }
      const d = Math.floor(resta / DIA); resta -= d * DIA;
      const h = Math.floor(resta / 36e5); resta -= h * 36e5;
      const m = Math.floor(resta / 6e4); resta -= m * 6e4;
      const s = Math.floor(resta / 1e3);
      celdas.d.textContent = d;
      celdas.h.textContent = dosCifras(h);
      celdas.m.textContent = dosCifras(m);
      celdas.s.textContent = dosCifras(s);
    };
    const reloj = setInterval(tic, 1000);
    tic();
  }

  // ---------- Confirmación por WhatsApp ----------
  const tarjeta = document.querySelector('[data-rsvp]');
  if (tarjeta) {
    const datos = JSON.parse(tarjeta.dataset.rsvp);
    const salida = tarjeta.querySelector('[data-asistentes]');
    const menos = tarjeta.querySelector('[data-menos]');
    const mas = tarjeta.querySelector('[data-mas]');
    const si = tarjeta.querySelector('[data-confirmar="si"]');
    const no = tarjeta.querySelector('[data-confirmar="no"]');
    let asistentes = datos.pases || 1;

    const enlace = (texto) => `https://wa.me/${datos.telefono}?text=${encodeURIComponent(texto)}`;
    const textoAsistentes = (n) => {
      if (datos.pases <= 1) return '';
      return n === 1 ? ' Asistirá 1 persona.' : ` Asistiremos ${n} personas.`;
    };

    const actualizar = () => {
      if (salida) salida.textContent = asistentes;
      if (menos) menos.disabled = asistentes <= 1;
      if (mas) mas.disabled = asistentes >= datos.pases;
      si.href = enlace(datos.si.replace('{asistentes}', textoAsistentes(asistentes)));
      no.href = enlace(datos.no);
    };

    if (menos) menos.addEventListener('click', () => { asistentes = Math.max(1, asistentes - 1); actualizar(); });
    if (mas) mas.addEventListener('click', () => { asistentes = Math.min(datos.pases, asistentes + 1); actualizar(); });
    actualizar();
  }

  // ---------- Visor de fotos ----------
  const visor = document.getElementById('visor');
  const fotos = Array.from(document.querySelectorAll('[data-visor]'));
  if (visor && fotos.length) {
    const imagen = visor.querySelector('.visor__img');
    const contador = visor.querySelector('.visor__contador');
    let actual = 0;
    let inicioToque = null;

    const mostrar = () => {
      const foto = fotos[actual];
      imagen.src = foto.href;
      imagen.alt = foto.querySelector('img').alt;
      contador.textContent = `${actual + 1} / ${fotos.length}`;
      // precarga la siguiente
      new Image().src = fotos[(actual + 1) % fotos.length].href;
    };
    const mover = (paso) => { actual = (actual + paso + fotos.length) % fotos.length; mostrar(); };
    const cerrar = () => {
      visor.hidden = true;
      raiz.classList.remove('con-visor');
      fotos[actual].focus({ preventScroll: true });
    };

    fotos.forEach((foto, i) => foto.addEventListener('click', (evento) => {
      evento.preventDefault();
      actual = i;
      mostrar();
      visor.hidden = false;
      raiz.classList.add('con-visor');
      visor.querySelector('.visor__cerrar').focus();
    }));

    visor.querySelector('.visor__cerrar').addEventListener('click', cerrar);
    visor.querySelector('.visor__nav--ant').addEventListener('click', () => mover(-1));
    visor.querySelector('.visor__nav--sig').addEventListener('click', () => mover(1));
    visor.addEventListener('click', (evento) => { if (evento.target === visor) cerrar(); });
    document.addEventListener('keydown', (evento) => {
      if (visor.hidden) return;
      if (evento.key === 'Escape') cerrar();
      if (evento.key === 'ArrowLeft') mover(-1);
      if (evento.key === 'ArrowRight') mover(1);
    });
    visor.addEventListener('touchstart', (evento) => { inicioToque = evento.touches[0].clientX; }, { passive: true });
    visor.addEventListener('touchend', (evento) => {
      if (inicioToque === null) return;
      const dx = evento.changedTouches[0].clientX - inicioToque;
      if (Math.abs(dx) > 45) mover(dx < 0 ? 1 : -1);
      inicioToque = null;
    });
  }
})();
