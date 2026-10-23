(() => {
  'use strict';

  // ===== Configuración =====
  // true: se puede marcar "a", "b" o ambas (como indica el cuadernillo original).
  // false: solo una opción por pregunta.
  const PERMITIR_AMBAS = true;

  const TOTAL = PREGUNTAS.length;
  const CLAVE_GUARDADO = 'casm83-r91-progreso';
  const CLAVE_TEMA = 'casm83-r91-tema';

  // Estado: respuestas[i] = '' (sin responder) | 'a' | 'b' | 'ab'
  // indice = primera pregunta de la página que se está mostrando
  let estado = { indice: 0, respuestas: new Array(TOTAL).fill('') };

  // Índices de las preguntas visibles en la página actual
  let visibles = [];

  // ===== Utilidades =====
  const $ = (id) => document.getElementById(id);
  const lista = $('lista');

  const pantallas = {
    intro: $('screen-intro'),
    quiz: $('screen-quiz'),
    fin: $('screen-end')
  };

  function mostrar(nombre) {
    Object.entries(pantallas).forEach(([k, el]) => el.classList.toggle('hidden', k !== nombre));
    document.body.classList.toggle('modo-quiz', nombre === 'quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function guardar() {
    try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ }
  }

  function cargar() {
    try {
      const raw = localStorage.getItem(CLAVE_GUARDADO);
      if (!raw) return false;
      const g = JSON.parse(raw);
      if (!g || !Array.isArray(g.respuestas) || g.respuestas.length !== TOTAL) return false;
      estado = {
        indice: Math.min(Math.max(Number(g.indice) || 0, 0), TOTAL - 1),
        respuestas: g.respuestas.map((r) => (['a', 'b', 'ab'].includes(r) ? r : ''))
      };
      return estado.respuestas.some((r) => r !== '');
    } catch (e) {
      return false;
    }
  }

  function borrarGuardado() {
    try { localStorage.removeItem(CLAVE_GUARDADO); } catch (e) { /* nada */ }
  }

  // ===== Temas =====
  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    document.querySelectorAll('[data-theme-btn]').forEach((b) => {
      b.classList.toggle('activo', b.dataset.themeBtn === tema);
    });
    try { localStorage.setItem(CLAVE_TEMA, tema); } catch (e) { /* nada */ }
  }

  // ===== Mensajes =====
  function mensaje(texto, error = false) {
    const m = $('mensaje');
    m.textContent = texto;
    m.classList.remove('sacudir');
    if (error) {
      void m.offsetWidth; // reinicia la animación
      m.classList.add('sacudir');
    }
  }

  // ===== Construcción de preguntas =====
  function crearBloque(i) {
    const [textoA, textoB] = PREGUNTAS[i];
    const bloque = document.createElement('div');
    bloque.className = 'pregunta';
    bloque.dataset.i = i;

    const num = document.createElement('p');
    num.className = 'pregunta-num';
    num.textContent = `Pregunta ${i + 1}`;
    bloque.appendChild(num);

    const par = document.createElement('div');
    par.className = 'par';

    [['a', textoA], ['b', textoB]].forEach(([letra, texto]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opcion';
      btn.dataset.letra = letra;
      btn.setAttribute('aria-pressed', String(estado.respuestas[i].includes(letra)));

      const l = document.createElement('span');
      l.className = 'letra';
      l.textContent = letra;
      const t = document.createElement('span');
      t.className = 'texto';
      t.textContent = texto;

      btn.append(l, t);
      btn.addEventListener('click', () => alternar(i, letra, bloque));
      par.appendChild(btn);
    });

    bloque.appendChild(par);
    return bloque;
  }

  function desborda() {
    return lista.scrollHeight > lista.clientHeight + 1;
  }

  // Llena la lista con tantas preguntas como quepan en el alto disponible.
  // dir 'adelante': empieza en `inicio` y avanza. dir 'atras': termina en `inicio` y retrocede.
  function llenar(inicio, dir) {
    lista.innerHTML = '';
    lista.style.overflowY = 'hidden';
    const idx = [];

    if (dir === 'adelante') {
      for (let i = inicio; i < TOTAL; i++) {
        const el = crearBloque(i);
        lista.appendChild(el);
        if (desborda() && idx.length > 0) { lista.removeChild(el); break; }
        idx.push(i);
      }
    } else {
      for (let i = inicio; i >= 0; i--) {
        const el = crearBloque(i);
        lista.insertBefore(el, lista.firstChild);
        if (desborda() && idx.length > 0) { lista.removeChild(el); break; }
        idx.unshift(i);
      }
      // Llegamos al inicio: rellenar la primera página hacia adelante para aprovechar el espacio
      if (idx[0] === 0) return llenar(0, 'adelante');
    }

    // Si ni una sola pregunta cabe (pantalla minúscula), permitir desplazarse dentro de la lista
    if (idx.length === 1 && desborda()) lista.style.overflowY = 'auto';
    return idx;
  }

  function actualizarProgreso() {
    const hechas = estado.respuestas.filter((r) => r !== '').length;
    const pct = Math.round((hechas / TOTAL) * 100);
    const primera = visibles[0] + 1;
    const ultima = visibles[visibles.length - 1] + 1;

    $('contador').textContent = primera === ultima
      ? `Pregunta ${primera} de ${TOTAL}`
      : `Preguntas ${primera}–${ultima} de ${TOTAL}`;
    $('porcentaje').textContent = `${pct}% completado`;
    $('barra-fill').style.width = pct + '%';
    $('barra').setAttribute('aria-valuenow', pct);
  }

  function render(dir = 'adelante', inicio = estado.indice) {
    visibles = llenar(inicio, dir);
    estado.indice = visibles[0];
    guardar();

    const ultima = visibles[visibles.length - 1];
    $('btn-atras').disabled = estado.indice === 0;
    $('btn-siguiente').innerHTML = ultima === TOTAL - 1 ? 'Finalizar &#10003;' : 'Siguiente &rarr;';
    mensaje('');
    actualizarProgreso();
  }

  // ===== Interacción =====
  function alternar(i, letra, bloque) {
    let r = estado.respuestas[i];

    if (PERMITIR_AMBAS) {
      r = r.includes(letra) ? r.replace(letra, '') : (r + letra).split('').sort().join('');
    } else {
      r = r === letra ? '' : letra;
    }

    estado.respuestas[i] = r;
    guardar();

    bloque.querySelectorAll('.opcion').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(r.includes(btn.dataset.letra)));
    });

    if (r !== '') bloque.classList.remove('falta');
    if (!lista.querySelector('.pregunta.falta')) mensaje('');
    actualizarProgreso();
  }

  // Marca en rojo las preguntas sin responder de la página actual. Devuelve cuántas faltan.
  function marcarFaltantes() {
    const faltan = visibles.filter((i) => estado.respuestas[i] === '');
    lista.querySelectorAll('.pregunta').forEach((b) => {
      b.classList.toggle('falta', estado.respuestas[Number(b.dataset.i)] === '');
    });
    if (faltan.length > 0) {
      const primera = lista.querySelector('.pregunta.falta');
      if (primera) primera.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return faltan.length;
  }

  function siguiente() {
    const faltan = marcarFaltantes();
    if (faltan > 0) {
      mensaje(faltan === 1
        ? 'Falta marcar 1 pregunta en esta pantalla (a, b o ambas).'
        : `Faltan marcar ${faltan} preguntas en esta pantalla (a, b o ambas).`, true);
      return;
    }
    const ultima = visibles[visibles.length - 1];
    if (ultima === TOTAL - 1) {
      finalizar();
      return;
    }
    render('adelante', ultima + 1);
  }

  function atras() {
    if (estado.indice === 0) return;
    render('atras', estado.indice - 1);
  }

  // ===== Pantalla final =====
  function finalizar() {
    const faltaIdx = estado.respuestas.findIndex((r) => r === '');
    if (faltaIdx !== -1) {
      render('adelante', faltaIdx);
      const n = marcarFaltantes();
      mensaje(`Aún quedan preguntas sin responder (la primera es la ${faltaIdx + 1}).`, n >= 0);
      return;
    }

    const cuenta = { a: 0, b: 0, ab: 0 };
    estado.respuestas.forEach((r) => { cuenta[r]++; });
    $('res-a').textContent = cuenta.a;
    $('res-b').textContent = cuenta.b;
    $('res-ab').textContent = cuenta.ab;

    const grilla = $('grilla');
    grilla.innerHTML = '';
    estado.respuestas.forEach((r, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.innerHTML = `${idx + 1}<small>${r === 'ab' ? 'a+b' : r}</small>`;
      chip.setAttribute('aria-label', `Pregunta ${idx + 1}, respuesta ${r === 'ab' ? 'a y b' : r}`);
      chip.addEventListener('click', () => {
        mostrar('quiz');
        render('adelante', idx);
      });
      grilla.appendChild(chip);
    });

    mostrar('fin');
  }

  function descargarCSV() {
    const filas = ['pregunta,respuesta'];
    estado.respuestas.forEach((r, i) => filas.push(`${i + 1},${r}`));
    const blob = new Blob(['﻿' + filas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'respuestas-casm83-r91.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  }

  function reiniciar() {
    if (!confirm('¿Seguro que quieres borrar todas tus respuestas y empezar de nuevo?')) return;
    estado = { indice: 0, respuestas: new Array(TOTAL).fill('') };
    borrarGuardado();
    $('btn-continuar').classList.add('hidden');
    mostrar('intro');
  }

  // ===== Eventos =====
  $('total-intro').textContent = TOTAL;
  $('total-fin').textContent = TOTAL;

  $('btn-comenzar').addEventListener('click', () => {
    if (estado.respuestas.some((r) => r !== '')) {
      if (!confirm('Ya tienes respuestas guardadas. ¿Quieres empezar de nuevo y borrarlas?')) return;
      estado = { indice: 0, respuestas: new Array(TOTAL).fill('') };
      borrarGuardado();
    }
    mostrar('quiz');
    render('adelante', 0);
  });

  $('btn-continuar').addEventListener('click', () => {
    mostrar('quiz');
    render('adelante', estado.indice);
  });

  $('btn-siguiente').addEventListener('click', siguiente);
  $('btn-atras').addEventListener('click', atras);
  $('btn-csv').addEventListener('click', descargarCSV);
  $('btn-reiniciar').addEventListener('click', reiniciar);

  document.querySelectorAll('[data-theme-btn]').forEach((b) => {
    b.addEventListener('click', () => {
      aplicarTema(b.dataset.themeBtn);
      // El tema cambia fuentes y formas: recalcular cuántas preguntas caben
      if (!pantallas.quiz.classList.contains('hidden')) render('adelante', estado.indice);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (pantallas.quiz.classList.contains('hidden')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight') siguiente();
    else if (e.key === 'ArrowLeft') atras();
  });

  // Si cambia el tamaño de la ventana (o se rota el móvil), recalcular cuántas preguntas caben
  let temporizador = null;
  window.addEventListener('resize', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (!pantallas.quiz.classList.contains('hidden')) render('adelante', estado.indice);
    }, 150);
  });

  // ===== Inicio =====
  let temaInicial = 'ejecutivo';
  try { temaInicial = localStorage.getItem(CLAVE_TEMA) || temaInicial; } catch (e) { /* nada */ }
  aplicarTema(temaInicial);

  if (cargar()) {
    $('btn-continuar').classList.remove('hidden');
  }
})();