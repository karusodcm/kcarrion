(() => {
  'use strict';

  // ===== Configuración =====
  // true: se puede marcar "a", "b" o ambas (como indica el cuadernillo original).
  // false: solo una opción por pregunta.
  const PERMITIR_AMBAS = true;

  const TOTAL = PREGUNTAS.length;
  const CLAVE_GUARDADO = 'casm83-r91-progreso';
  const CLAVE_TEMA = 'casm83-r91-tema';

  const CAMPOS_DATOS = ['apellidos', 'edad', 'lugar', 'dia', 'mes', 'anio', 'centro', 'grado', 'examinador'];
  const CAMPOS_ENCUESTA = [
    'oficio1', 'oficio2', 'oficio3',
    'tecnica1', 'tecnica2', 'tecnica3',
    'carrera1', 'carrera2', 'carrera3'
  ];
  const ETAPAS = ['datos', 'encuesta', 'quiz'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // Hoja de respuestas: los ítems se leen por filas (1-13, 14-26, ...).
  // Filas: las 11 primeras áreas. Columnas: las 13 áreas (incluye VERA y CONS).
  const AREAS = ['CCFM', 'CCSS', 'CCNA', 'CCCO', 'ARTE', 'BURO', 'CCEP', 'HAA', 'FINA', 'LING', 'JURI', 'VERA', 'CONS'];
  const COLUMNAS = AREAS.length;                 // 13
  const FILAS = Math.ceil(TOTAL / COLUMNAS);     // 11

  // Estado:
  //   etapa: 'datos' | 'encuesta' | 'quiz'
  //   indice: primera pregunta de la página que se está mostrando
  //   respuestas[i]: '' (sin responder) | 'a' | 'b' | 'ab'
  const nuevoEstado = () => ({
    etapa: 'datos',
    indice: 0,
    respuestas: new Array(TOTAL).fill(''),
    datos: {},
    encuesta: {}
  });
  let estado = nuevoEstado();

  // Índices de las preguntas visibles en la página actual
  let visibles = [];

  // ===== Utilidades =====
  const $ = (id) => document.getElementById(id);
  const lista = $('lista');

  const pantallas = {
    intro: $('screen-intro'),
    datos: $('screen-datos'),
    encuesta: $('screen-encuesta'),
    quiz: $('screen-quiz'),
    fin: $('screen-end')
  };

  const enQuiz = () => !pantallas.quiz.classList.contains('hidden');

  function mostrar(nombre) {
    Object.entries(pantallas).forEach(([k, el]) => el.classList.toggle('hidden', k !== nombre));
    document.body.classList.toggle('modo-quiz', nombre === 'quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== Guardado local =====
  function guardar() {
    try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento */ }
  }

  function soloTexto(obj, campos) {
    const r = {};
    campos.forEach((c) => {
      if (obj && typeof obj[c] === 'string') r[c] = obj[c];
    });
    return r;
  }

  function hayProgreso() {
    const lleno = (o) => Object.values(o).some((v) => String(v).trim() !== '');
    return estado.respuestas.some((r) => r !== '') || lleno(estado.datos) || lleno(estado.encuesta);
  }

  function cargar() {
    try {
      const raw = localStorage.getItem(CLAVE_GUARDADO);
      if (!raw) return false;
      const g = JSON.parse(raw);
      if (!g || !Array.isArray(g.respuestas) || g.respuestas.length !== TOTAL) return false;
      estado = {
        etapa: 'datos',
        indice: Math.min(Math.max(Number(g.indice) || 0, 0), TOTAL - 1),
        respuestas: g.respuestas.map((r) => (['a', 'b', 'ab'].includes(r) ? r : '')),
        datos: soloTexto(g.datos, CAMPOS_DATOS),
        encuesta: soloTexto(g.encuesta, CAMPOS_ENCUESTA)
      };
      const pedida = ETAPAS.includes(g.etapa)
        ? g.etapa
        : (estado.respuestas.some((r) => r !== '') ? 'quiz' : 'datos');
      estado.etapa = etapaPermitida(pedida);
      return hayProgreso();
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
  function mensaje(texto, error = false, el = $('mensaje')) {
    el.textContent = texto;
    el.classList.remove('sacudir');
    if (error) {
      void el.offsetWidth; // reinicia la animación
      el.classList.add('sacudir');
    }
  }

  // ===== Formularios: datos personales y encuesta =====
  const hayErrores = (e) => Object.keys(e).length > 0;

  function fechaValida(d, m, a) {
    if (![d, m, a].every(Number.isInteger)) return false;
    const hoy = new Date();
    if (a < 1900 || a > hoy.getFullYear()) return false;
    const f = new Date(a, m - 1, d);
    return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d && f <= hoy;
  }

  function validarDatos(d) {
    const e = {};
    const v = (k) => (d[k] || '').trim();

    ['apellidos', 'lugar', 'centro', 'grado', 'examinador'].forEach((k) => {
      if (!v(k)) e[k] = 'Este dato es obligatorio.';
    });

    const edad = Number(v('edad'));
    if (!v('edad')) e.edad = 'Ingresa la edad.';
    else if (!Number.isInteger(edad) || edad < 4 || edad > 99) e.edad = 'Edad no válida.';

    if (!v('dia') || !v('mes') || !v('anio')) {
      e.fecha = 'Completa día, mes y año.';
    } else if (!fechaValida(Number(v('dia')), Number(v('mes')), Number(v('anio')))) {
      e.fecha = 'La fecha de nacimiento no es válida.';
    }
    return e;
  }

  function validarEncuesta(d) {
    const e = {};
    CAMPOS_ENCUESTA.forEach((k) => {
      if (!(d[k] || '').trim()) e[k] = 'Completa este campo.';
    });
    return e;
  }

  // Devuelve la etapa más avanzada a la que se puede entrar con los datos actuales
  function etapaPermitida(pedida) {
    if (pedida === 'datos') return 'datos';
    if (hayErrores(validarDatos(estado.datos))) return 'datos';
    if (pedida === 'encuesta') return 'encuesta';
    if (hayErrores(validarEncuesta(estado.encuesta))) return 'encuesta';
    return 'quiz';
  }

  const leerCampos = (campos) => {
    const r = {};
    campos.forEach((c) => { r[c] = $(c).value; });
    return r;
  };

  function llenarCampos(campos, valores) {
    campos.forEach((c) => { $(c).value = valores[c] || ''; });
  }

  function pintarErrores(form, errores) {
    form.querySelectorAll('.error').forEach((el) => {
      el.classList.remove('error');
      el.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('[data-err]').forEach((s) => { s.textContent = errores[s.dataset.err] || ''; });
    Object.keys(errores).forEach((k) => {
      const ids = k === 'fecha' ? ['dia', 'mes', 'anio'] : [k];
      ids.forEach((id) => {
        $(id).classList.add('error');
        $(id).setAttribute('aria-invalid', 'true');
      });
    });
  }

  // Aviso general de un formulario con errores
  function avisarErrores(form, errores, msgEl) {
    const n = Object.keys(errores).length;
    mensaje(n === 1
      ? 'Revisa el campo marcado en rojo.'
      : `Revisa los ${n} campos marcados en rojo.`, true, msgEl);
    const primero = form.querySelector('.error');
    if (primero) {
      primero.scrollIntoView({ block: 'center', behavior: 'smooth' });
      primero.focus({ preventScroll: true });
    }
  }

  function enlazarFormulario(form, campos, clave, msgEl) {
    // Guarda lo escrito al instante y quita el error del campo que se está corrigiendo
    const alEscribir = (e) => {
      const t = e.target;
      if (!t || !t.id) return;
      t.classList.remove('error');
      t.removeAttribute('aria-invalid');
      const clavErr = ['dia', 'mes', 'anio'].includes(t.id) ? 'fecha' : t.id;
      const s = form.querySelector(`[data-err="${clavErr}"]`);
      if (s) s.textContent = '';
      estado[clave] = leerCampos(campos);
      guardar();
      if (!form.querySelector('.error')) mensaje('', false, msgEl);
    };
    form.addEventListener('input', alEscribir);
    form.addEventListener('change', alEscribir);
  }

  function recortar(campos, valores) {
    const r = {};
    campos.forEach((c) => { r[c] = (valores[c] || '').trim(); });
    return r;
  }

  // ===== Navegación entre etapas =====
  function ir(etapa) {
    estado.etapa = etapa;
    guardar();

    if (etapa === 'datos') {
      llenarCampos(CAMPOS_DATOS, estado.datos);
      pintarErrores($('form-datos'), {});
      mensaje('', false, $('msg-datos'));
    } else if (etapa === 'encuesta') {
      llenarCampos(CAMPOS_ENCUESTA, estado.encuesta);
      pintarErrores($('form-encuesta'), {});
      mensaje('', false, $('msg-encuesta'));
    }

    mostrar(etapa);
    if (etapa === 'quiz') render('adelante', estado.indice);
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
    // En la primera página, Atrás vuelve a la encuesta vocacional
    $('btn-atras').disabled = false;
    $('btn-siguiente').innerHTML = ultima === TOTAL - 1 ? 'Finalizar &#10003;' : 'Siguiente &rarr;';
    mensaje('');
    actualizarProgreso();
  }

  // ===== Interacción del cuestionario =====
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
    if (estado.indice === 0) {
      ir('encuesta');
      return;
    }
    render('atras', estado.indice - 1);
  }

  // ===== Pantalla final =====
  const dos = (n) => String(n).padStart(2, '0');

  function textoFecha() {
    const d = estado.datos;
    return `${dos(Number(d.dia))}/${dos(Number(d.mes))}/${Number(d.anio)}`;
  }

  function filasFicha() {
    const d = estado.datos;
    const e = estado.encuesta;
    const trio = (a, b, c) => `1º ${e[a]} · 2º ${e[b]} · 3º ${e[c]}`;
    return [
      ['Apellidos y nombres', d.apellidos],
      ['Edad', d.edad],
      ['Lugar de nacimiento', d.lugar],
      ['Fecha de nacimiento', `${Number(d.dia)} de ${MESES[Number(d.mes) - 1]} de ${Number(d.anio)}`],
      ['Centro educativo', d.centro],
      ['Grado de instrucción', d.grado],
      ['Examinador', d.examinador],
      ['Oficios', trio('oficio1', 'oficio2', 'oficio3')],
      ['Carreras técnicas', trio('tecnica1', 'tecnica2', 'tecnica3')],
      ['Carreras profesionales', trio('carrera1', 'carrera2', 'carrera3')]
    ];
  }

  // La A suma en la columna de su casilla y la B suma en la fila.
  // Si se marcaron ambas, cuenta en las dos.
  function calcularPuntajes() {
    const colA = new Array(COLUMNAS).fill(0);
    const filaB = new Array(FILAS).fill(0);
    estado.respuestas.forEach((r, i) => {
      if (r.includes('a')) colA[i % COLUMNAS]++;
      if (r.includes('b')) filaB[Math.floor(i / COLUMNAS)]++;
    });
    const pd = AREAS.map((_, k) => colA[k] + (k < FILAS ? filaB[k] : 0));
    return { colA, filaB, pd };
  }

  function celda(tag, texto, clase) {
    const el = document.createElement(tag);
    if (texto !== undefined) el.textContent = texto;
    if (clase) el.className = clase;
    return el;
  }

  function armarTablas() {
    const { colA, filaB, pd } = calcularPuntajes();

    // Tabla de respuestas (11 filas x 13 columnas) con totales
    const t = $('tabla-resultados');
    t.innerHTML = '';

    const cabecera = t.createTHead().insertRow();
    cabecera.appendChild(celda('th', ''));
    AREAS.forEach((a) => cabecera.appendChild(celda('th', a)));
    cabecera.appendChild(celda('th', 'Σ B fila'));

    const cuerpo = t.createTBody();
    for (let f = 0; f < FILAS; f++) {
      const tr = cuerpo.insertRow();
      const th = celda('th', AREAS[f]);
      th.scope = 'row';
      tr.appendChild(th);
      for (let c = 0; c < COLUMNAS; c++) {
        const i = f * COLUMNAS + c;
        const r = estado.respuestas[i];
        const td = celda('td', undefined, 'celda');
        td.appendChild(celda('span', String(i + 1), 'n'));
        td.appendChild(celda('span', 'A', 'm a' + (r.includes('a') ? ' on' : '')));
        td.appendChild(celda('span', 'B', 'm b' + (r.includes('b') ? ' on' : '')));
        tr.appendChild(td);
      }
      tr.appendChild(celda('td', String(filaB[f]), 'tot'));
    }

    const pie = t.createTFoot().insertRow();
    pie.appendChild(celda('th', 'Σ A col.'));
    colA.forEach((n) => pie.appendChild(celda('td', String(n))));
    pie.appendChild(celda('td', ''));

    // Puntajes por área
    const p = $('tabla-puntajes');
    p.innerHTML = '';
    const ph = p.createTHead().insertRow();
    ['Área', 'A (columna)', 'B (fila)', 'PD'].forEach((x) => ph.appendChild(celda('th', x)));
    const pb = p.createTBody();
    AREAS.forEach((a, k) => {
      const tr = pb.insertRow();
      const th = celda('th', a);
      th.scope = 'row';
      tr.appendChild(th);
      tr.appendChild(celda('td', String(colA[k])));
      tr.appendChild(celda('td', k < FILAS ? String(filaB[k]) : '—'));
      tr.appendChild(celda('td', String(pd[k]), 'tot'));
    });
  }

  function finalizar() {
    const faltaIdx = estado.respuestas.findIndex((r) => r === '');
    if (faltaIdx !== -1) {
      render('adelante', faltaIdx);
      marcarFaltantes();
      mensaje(`Aún quedan preguntas sin responder (la primera es la ${faltaIdx + 1}).`, true);
      return;
    }

    const cuenta = { a: 0, b: 0, ab: 0 };
    estado.respuestas.forEach((r) => { cuenta[r]++; });
    $('res-a').textContent = cuenta.a;
    $('res-b').textContent = cuenta.b;
    $('res-ab').textContent = cuenta.ab;

    // Los datos escritos por la persona se insertan como texto, nunca como HTML
    const ficha = $('ficha');
    ficha.innerHTML = '';
    filasFicha().forEach(([titulo, valor]) => {
      const dt = document.createElement('dt');
      dt.textContent = titulo;
      const dd = document.createElement('dd');
      dd.textContent = valor;
      ficha.append(dt, dd);
    });

    armarTablas();

    const grilla = $('grilla');
    grilla.innerHTML = '';
    estado.respuestas.forEach((r, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.innerHTML = `${idx + 1}<small>${r === 'ab' ? 'a+b' : r}</small>`;
      chip.setAttribute('aria-label', `Pregunta ${idx + 1}, respuesta ${r === 'ab' ? 'a y b' : r}`);
      chip.addEventListener('click', () => {
        estado.etapa = 'quiz';
        estado.indice = idx;
        guardar();
        mostrar('quiz');
        render('adelante', idx);
      });
      grilla.appendChild(chip);
    });

    mostrar('fin');
  }

  function descargarCSV() {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const d = estado.datos;
    const e = estado.encuesta;
    const filas = [['sección', 'campo', 'valor']];

    const datos = [
      ['Apellidos y nombres', d.apellidos],
      ['Edad', d.edad],
      ['Lugar de nacimiento', d.lugar],
      ['Fecha de nacimiento', textoFecha()],
      ['Centro educativo', d.centro],
      ['Grado de instrucción', d.grado],
      ['Examinador', d.examinador]
    ];
    datos.forEach(([c, v]) => filas.push(['Datos personales', c, v]));

    const grupos = [
      ['Oficio', 'oficio'],
      ['Carrera técnica', 'tecnica'],
      ['Carrera profesional', 'carrera']
    ];
    grupos.forEach(([nombre, pref]) => {
      [1, 2, 3].forEach((n) => filas.push(['Encuesta vocacional', `${nombre} ${n}º`, e[pref + n]]));
    });

    estado.respuestas.forEach((r, i) => filas.push(['Cuestionario', `Pregunta ${i + 1}`, r]));

    const { colA, filaB, pd } = calcularPuntajes();
    AREAS.forEach((a, k) => {
      filas.push(['Puntajes', `${a} · A (columna)`, colA[k]]);
      if (k < FILAS) filas.push(['Puntajes', `${a} · B (fila)`, filaB[k]]);
      filas.push(['Puntajes', `${a} · PD`, pd[k]]);
    });

    const csv = filas.map((f) => f.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
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
    if (!confirm('¿Seguro que quieres borrar todos tus datos y respuestas y empezar de nuevo?')) return;
    estado = nuevoEstado();
    borrarGuardado();
    $('btn-continuar').classList.add('hidden');
    mostrar('intro');
  }

  // ===== Eventos =====
  $('total-intro').textContent = TOTAL;
  $('total-fin').textContent = TOTAL;

  $('btn-comenzar').addEventListener('click', () => {
    if (hayProgreso()) {
      if (!confirm('Ya tienes datos o respuestas guardadas. ¿Quieres empezar de nuevo y borrarlas?')) return;
      estado = nuevoEstado();
      borrarGuardado();
    }
    ir('datos');
  });

  $('btn-continuar').addEventListener('click', () => ir(etapaPermitida(estado.etapa)));

  // Paso 1: datos personales
  enlazarFormulario($('form-datos'), CAMPOS_DATOS, 'datos', $('msg-datos'));
  $('form-datos').addEventListener('submit', (ev) => {
    ev.preventDefault();
    estado.datos = recortar(CAMPOS_DATOS, leerCampos(CAMPOS_DATOS));
    const errores = validarDatos(estado.datos);
    pintarErrores($('form-datos'), errores);
    if (hayErrores(errores)) {
      guardar();
      avisarErrores($('form-datos'), errores, $('msg-datos'));
      return;
    }
    ir('encuesta');
  });
  $('datos-atras').addEventListener('click', () => {
    estado.datos = leerCampos(CAMPOS_DATOS);
    guardar();
    mostrar('intro');
    if (hayProgreso()) $('btn-continuar').classList.remove('hidden');
  });

  // Paso 2: encuesta vocacional
  enlazarFormulario($('form-encuesta'), CAMPOS_ENCUESTA, 'encuesta', $('msg-encuesta'));
  $('form-encuesta').addEventListener('submit', (ev) => {
    ev.preventDefault();
    estado.encuesta = recortar(CAMPOS_ENCUESTA, leerCampos(CAMPOS_ENCUESTA));
    const errores = validarEncuesta(estado.encuesta);
    pintarErrores($('form-encuesta'), errores);
    if (hayErrores(errores)) {
      guardar();
      avisarErrores($('form-encuesta'), errores, $('msg-encuesta'));
      return;
    }
    ir('quiz');
  });
  $('encuesta-atras').addEventListener('click', () => {
    estado.encuesta = leerCampos(CAMPOS_ENCUESTA);
    guardar();
    ir('datos');
  });

  // Paso 3: cuestionario
  $('btn-siguiente').addEventListener('click', siguiente);
  $('btn-atras').addEventListener('click', atras);
  $('btn-csv').addEventListener('click', descargarCSV);
  $('btn-reiniciar').addEventListener('click', reiniciar);

  document.querySelectorAll('[data-theme-btn]').forEach((b) => {
    b.addEventListener('click', () => {
      aplicarTema(b.dataset.themeBtn);
      // El tema cambia fuentes y formas: recalcular cuántas preguntas caben
      if (enQuiz()) render('adelante', estado.indice);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (!enQuiz()) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowRight') siguiente();
    else if (e.key === 'ArrowLeft') atras();
  });

  // Si cambia el tamaño de la ventana (o se rota el móvil), recalcular cuántas preguntas caben
  let temporizador = null;
  window.addEventListener('resize', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (enQuiz()) render('adelante', estado.indice);
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
