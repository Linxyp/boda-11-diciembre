(() => {
  'use strict';

  const raiz = document.documentElement;
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const contenido = document.getElementById('contenido');
  const pie = document.querySelector('.pie');

  // ---------- Música: reproductor de YouTube invisible o un mp3 propio ----------
  // estado(): 'sonando' (se oye la canción), 'cargando' (anuncio en silencio o cargando) o 'quieta'
  const botonMusica = document.querySelector('[data-musica]');
  const musica = botonMusica ? crearMusica() : null;

  function crearMusica() {
    const audio = document.getElementById('musica');
    if (audio) {
      return {
        reproducir: () => audio.play().catch(() => {}),
        pausar: () => audio.pause(),
        estado: () => (audio.paused ? 'quieta' : 'sonando'),
        alCambiar: (fn) => { audio.addEventListener('play', fn); audio.addEventListener('pause', fn); },
      };
    }

    const seccion = document.querySelector('[data-youtube]');
    if (!seccion) return null;
    const ayuda = seccion.querySelector('.musica-youtube__ayuda');
    const textoAyuda = ayuda ? ayuda.textContent : '';
    const inicio = Number(seccion.dataset.inicio) || 0;
    const SIN_INICIAR = -1;
    const TERMINADO = 0;
    const REPRODUCIENDO = 1;
    const CARGANDO = 3;
    const EN_COLA = 5;
    // En iPhone/iPad YouTube no arranca con sonido sin un toque en su reproductor
    const esIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let reproductor = null;
    let listo = false;
    let quiereSonar = false;  // ya abrieron la invitación y no han pausado
    let primeraVez = true;    // al abrir, la canción empieza desde el principio
    let estadoYT = -1;
    let sonando = false;
    let avanza = false;       // el tiempo corre: suena algo (la canción o un anuncio en silencio)
    let ultimoTiempo = -1;
    const oyentes = [];
    const avisar = () => oyentes.forEach((fn) => fn());

    const conSonido = () => {
      reproductor.unMute();
      reproductor.setVolume(100);
      sonando = true;
      // Si el navegador no dejó activar el sonido (iPhone), se pide un toque en el reproductor
      setTimeout(() => {
        if (quiereSonar && estadoYT === REPRODUCIENDO && reproductor.isMuted()) {
          sonando = false;
          if (ayuda) ayuda.textContent = 'Toca 🔊 para activar el sonido';
          seccion.classList.add('tocar');
          avisar();
        }
      }, 900);
    };

    const cargar = () => {
      window.onYouTubeIframeAPIReady = () => {
        reproductor = new window.YT.Player(seccion.querySelector('[data-reproductor]'), {
          host: 'https://www.youtube-nocookie.com',
          videoId: seccion.dataset.youtube,
          playerVars: { playsinline: 1, rel: 0, loop: 1, playlist: seccion.dataset.youtube, start: inicio },
          events: {
            // Arranca en silencio desde ya: si YouTube pone un anuncio, pasa callado
            // mientras el invitado mira la portada.
            onReady: () => {
              listo = true;
              reproductor.mute();
              reproductor.playVideo();
            },
            // Durante un anuncio YouTube informa «sin iniciar»; solo la canción informa «reproduciendo»
            onStateChange: (evento) => {
              estadoYT = evento.data;
              if (estadoYT === REPRODUCIENDO && quiereSonar) {
                if (primeraVez) {
                  primeraVez = false;
                  if (reproductor.getCurrentTime() > inicio + 1.5) reproductor.seekTo(inicio, true);
                }
                conSonido();
              } else if (estadoYT !== REPRODUCIENDO) {
                // Anuncios, cargas y pausas van siempre en silencio: solo se oye la canción
                sonando = false;
                reproductor.mute();
              }
              avisar();
            },
          },
        });
        setInterval(() => {
          if (!listo) return;
          const tiempo = reproductor.getCurrentTime();
          const corre = tiempo !== ultimoTiempo;
          ultimoTiempo = tiempo;
          // Si el invitado activó el sonido tocando el reproductor (plan B), ya está sonando
          if (!sonando && quiereSonar && estadoYT === REPRODUCIENDO && !reproductor.isMuted()) {
            sonando = true;
            avisar();
          }
          if (corre !== avanza) {
            avanza = corre;
            avisar();
          }
        }, 700);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.append(script);
    };
    // Se carga de una vez: mientras el invitado mira la portada, un posible anuncio ya va pasando en silencio
    cargar();

    return {
      reproducir: () => {
        quiereSonar = true;
        if (listo && estadoYT === REPRODUCIENDO) {
          if (primeraVez) {
            primeraVez = false;
            reproductor.seekTo(inicio, true);
          }
          conSonido();
        } else if (listo) {
          reproductor.playVideo();
        } // si aún no está listo, arranca solo al estarlo
        avisar();
      },
      pausar: () => {
        quiereSonar = false;
        sonando = false;
        if (listo) {
          reproductor.pauseVideo();
          reproductor.mute();
        }
        avisar();
      },
      estado: () => {
        if (sonando) return 'sonando';
        // Fuera de iPhone, «sin iniciar», «en cola» o «terminado» (al repetir) son un anuncio
        // pasando en silencio o una carga: la canción viene en camino
        const enCamino = [SIN_INICIAR, TERMINADO, EN_COLA].includes(estadoYT) && !esIOS;
        const esperando = avanza || estadoYT === CARGANDO || enCamino;
        if (quiereSonar && esperando) return 'cargando';
        return 'quieta';
      },
      alCambiar: (fn) => oyentes.push(fn),
      // Plan B para iPhone: mostrar el reproductor pequeño para que el invitado le dé play
      mostrar: (visible) => {
        if (visible && ayuda) ayuda.textContent = textoAyuda;
        seccion.classList.toggle('tocar', visible);
      },
      visible: () => seccion.classList.contains('tocar'),
    };
  }

  function reproducir() {
    if (!musica) return;
    botonMusica.hidden = false;
    musica.reproducir();
    // Si el navegador no dejó arrancar la música (pasa en iPhone), el botón late para invitar a tocarlo
    setTimeout(() => { if (musica.estado() === 'quieta') botonMusica.classList.add('musica--invita'); }, 3500);
  }

  if (musica) {
    let ocultando = null;
    const actualizar = () => {
      const estado = musica.estado();
      botonMusica.classList.toggle('sonando', estado === 'sonando');
      botonMusica.classList.toggle('cargando', estado === 'cargando');
      if (estado !== 'quieta') botonMusica.classList.remove('musica--invita');
      // Con la canción ya sonando, el reproductor pequeño del plan B se vuelve a esconder
      if (estado === 'sonando' && musica.visible && musica.visible() && !ocultando) {
        ocultando = setTimeout(() => {
          ocultando = null;
          if (musica.estado() === 'sonando') musica.mostrar(false);
        }, 1200);
      }
      botonMusica.setAttribute('aria-label', estado === 'quieta' ? 'Reproducir música' : 'Pausar música');
    };
    musica.alCambiar(actualizar);
    botonMusica.addEventListener('click', () => {
      botonMusica.classList.remove('musica--invita');
      if (musica.estado() !== 'quieta') {
        musica.pausar();
        return;
      }
      if (musica.visible && musica.visible()) {
        musica.mostrar(false);
        return;
      }
      musica.reproducir();
      // En iPhone YouTube solo suena si se toca su reproductor: si no arrancó, se muestra pequeño
      if (musica.mostrar) {
        setTimeout(() => { if (musica.estado() === 'quieta') musica.mostrar(true); }, 1500);
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

  // ---------- Carrusel de fotos: pasan solas con un fundido suave ----------
  const carrusel = document.querySelector('[data-carrusel]');
  if (carrusel) {
    const diapositivas = Array.from(carrusel.querySelectorAll('.carrusel__foto'));
    const puntos = Array.from(carrusel.querySelectorAll('.carrusel__punto'));
    const marco = carrusel.querySelector('.carrusel__marco');
    const INTERVALO = 4500;
    let actual = 0;
    let reloj = null;
    let enPantalla = false;
    let bajoElMouse = false;

    const ir = (indice) => {
      diapositivas[actual].classList.remove('activa');
      diapositivas[actual].setAttribute('aria-hidden', 'true');
      puntos[actual].classList.remove('activo');
      puntos[actual].removeAttribute('aria-current');
      actual = (indice + diapositivas.length) % diapositivas.length;
      diapositivas[actual].classList.add('activa');
      diapositivas[actual].setAttribute('aria-hidden', 'false');
      puntos[actual].classList.add('activo');
      puntos[actual].setAttribute('aria-current', 'true');
    };
    // Avanza solo mientras se ve en pantalla (y nunca si el sistema pide reducir el movimiento)
    const programar = () => {
      clearInterval(reloj);
      reloj = null;
      if (enPantalla && !bajoElMouse && !document.hidden && !sinMovimiento) {
        reloj = setInterval(() => ir(actual + 1), INTERVALO);
      }
    };
    const mover = (indice) => { ir(indice); programar(); };

    carrusel.querySelector('[data-carrusel-ant]').addEventListener('click', () => mover(actual - 1));
    carrusel.querySelector('[data-carrusel-sig]').addEventListener('click', () => mover(actual + 1));
    puntos.forEach((punto, i) => punto.addEventListener('click', () => mover(i)));

    let toqueX = null;
    marco.addEventListener('touchstart', (evento) => { toqueX = evento.touches[0].clientX; }, { passive: true });
    marco.addEventListener('touchend', (evento) => {
      if (toqueX === null) return;
      const dx = evento.changedTouches[0].clientX - toqueX;
      if (Math.abs(dx) > 40) mover(actual + (dx < 0 ? 1 : -1));
      toqueX = null;
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entrada]) => {
        enPantalla = entrada.isIntersecting;
        programar();
      }, { threshold: 0.25 }).observe(carrusel);
    } else {
      enPantalla = true;
      programar();
    }
    document.addEventListener('visibilitychange', programar);
    if (window.matchMedia('(hover: hover)').matches) {
      carrusel.addEventListener('mouseenter', () => { bajoElMouse = true; programar(); });
      carrusel.addEventListener('mouseleave', () => { bajoElMouse = false; programar(); });
    }
  }
})();
