(() => {
  'use strict';

  // ===== Configuración =====
  // true: se puede marcar "a", "b" o ambas (como indica el cuadernillo original).
  // false: solo una opción por pregunta.
  const PERMITIR_AMBAS = true;

  const TOTAL = PREGUNTAS.length;
  const CLAVE_GUARDADO = 'casm83-r91-progreso';
  const CLAVE_TEMA = 'casm83-r91-tema';

  const CAMPOS_DATOS = ['apellidos', 'edad', 'sexo', 'lugar', 'dia', 'mes', 'anio', 'centro', 'grado', 'examinador'];
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
  const N_AREAS = 11;                            // escalas de interés (filas y primeras 11 columnas)
  const COL_VERA = 11;
  const COL_CONS = 12;
  const LIMITE_INVALIDO = 5;                     // 5 o más anulan la aplicación

  // Nombres según el manual CASM83 (HAA aparece como IIAA en el manual)
  const NOMBRES = {
    CCFM: 'Ciencias Físico-Matemática',
    CCSS: 'Ciencias Sociales',
    CCNA: 'Ciencias Naturales',
    CCCO: 'Ciencias de la Comunicación',
    ARTE: 'Artes',
    BURO: 'Burocracia',
    CCEP: 'Ciencias Económicas Políticas',
    HAA: 'Institutos Armados',
    FINA: 'Finanzas',
    LING: 'Lingüística',
    JURI: 'Jurisprudencia'
  };

  // Pares de ítems repetidos para la escala de consistencia
  const PARES_CONS = [[13, 131], [26, 132], [39, 133], [52, 134], [65, 135], [78, 136],
    [91, 137], [104, 138], [117, 139], [130, 140], [143, 1]];

  // Dispersigrama: categorías y percentiles (rango de cada categoría)
  const CATEGORIAS = ['Desinterés', 'Bajo', 'Promedio bajo', 'Indecisión', 'Promedio alto', 'Alto', 'Muy alto'];
  const PERCENTILES = ['1–14', '15–29', '30–39', '40–60', '61–74', '75–89', '90–99'];

  // Límite superior del puntaje directo de cada categoría, por área y sexo
  const BAREMO = {
    varon: {
      CCFM: [4, 7, 9, 13, 15, 17, 22],
      CCSS: [3, 6, 8, 12, 14, 16, 22],
      CCNA: [4, 7, 9, 13, 15, 18, 22],
      CCCO: [2, 4, 6, 10, 13, 17, 22],
      ARTE: [2, 4, 6, 10, 14, 17, 22],
      BURO: [3, 5, 7, 11, 13, 16, 22],
      CCEP: [3, 5, 7, 12, 14, 17, 22],
      HAA: [3, 5, 7, 12, 14, 17, 22],
      FINA: [2, 4, 6, 10, 12, 16, 22],
      LING: [2, 4, 6, 9, 12, 15, 22],
      JURI: [2, 4, 6, 10, 13, 16, 22]
    },
    mujer: {
      CCFM: [2, 4, 6, 11, 14, 17, 22],
      CCSS: [4, 7, 9, 14, 16, 19, 22],
      CCNA: [3, 5, 7, 12, 14, 17, 22],
      CCCO: [2, 4, 6, 11, 13, 16, 22],
      ARTE: [2, 4, 6, 11, 13, 16, 22],
      BURO: [4, 7, 9, 14, 16, 19, 22],
      CCEP: [2, 5, 7, 12, 14, 17, 22],
      HAA: [2, 4, 6, 9, 12, 15, 22],
      FINA: [2, 5, 7, 12, 14, 17, 22],
      LING: [2, 5, 7, 12, 14, 17, 22],
      JURI: [2, 4, 6, 11, 13, 16, 22]
    }
  };

  function indiceCategoria(area, pd, sexo) {
    const limites = (BAREMO[sexo] || BAREMO.varon)[area];
    const k = limites.findIndex((max) => pd <= max);
    return k === -1 ? limites.length - 1 : k;
  }

  const textoSexo = () => (estado.datos.sexo === 'varon' ? 'Varón' : 'Mujer');

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

    if (!['varon', 'mujer'].includes(v('sexo'))) e.sexo = 'Selecciona una opción.';

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
      ['Sexo', textoSexo()],
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

  // ===== Calificación =====
  // A suma en la columna de su casilla; B suma en la fila, pero solo en las 11 columnas de áreas
  // (las casillas de VERA y CONS no aportan a las áreas). Si se marcaron ambas, cuenta en las dos.
  function calcularPuntajes() {
    const colA = new Array(COLUMNAS).fill(0);
    const filaB = new Array(FILAS).fill(0);
    estado.respuestas.forEach((r, i) => {
      const f = Math.floor(i / COLUMNAS);
      const c = i % COLUMNAS;
      if (r.includes('a')) colA[c]++;
      if (r.includes('b') && c < N_AREAS) filaB[f]++;
    });

    const perfil = AREAS.slice(0, N_AREAS).map((area, k) => {
      const pd = colA[k] + filaB[k];
      const cat = indiceCategoria(area, pd, estado.datos.sexo);
      return { area, a: colA[k], b: filaB[k], pd, cat, categoria: CATEGORIAS[cat], percentil: PERCENTILES[cat] };
    });

    // Veracidad: respuestas "a" en la columna VERA
    const vera = colA[COL_VERA];
    // Consistencia: pares de ítems repetidos cuya respuesta no coincide
    const inconsistentes = PARES_CONS.filter(([x, y]) => estado.respuestas[x - 1] !== estado.respuestas[y - 1]);
    const veraOk = vera < LIMITE_INVALIDO;
    const consOk = inconsistentes.length < LIMITE_INVALIDO;

    return { colA, filaB, perfil, vera, veraOk, inconsistentes, consOk, valida: veraOk && consOk };
  }

  function celda(tag, texto, clase) {
    const el = document.createElement(tag);
    if (texto !== undefined) el.textContent = texto;
    if (clase) el.className = clase;
    return el;
  }

  function armarValidez(r) {
    const cont = $('validez');
    cont.innerHTML = '';

    const tarjeta = (titulo, valor, nota, ok, detalle) => {
      const d = celda('div', undefined, 'vcard' + (ok ? '' : ' mal'));
      d.appendChild(celda('div', titulo, 'v-tit'));
      d.appendChild(celda('div', valor, 'v-val'));
      d.appendChild(celda('div', (ok ? '✓ ' : '✕ ') + nota, 'v-nota'));
      if (detalle) d.appendChild(celda('div', detalle, 'v-detalle'));
      return d;
    };

    cont.appendChild(tarjeta(
      'Veracidad (VERA)',
      `${r.vera} resp. "a"`,
      r.veraOk ? 'Válida (menos de 5)' : 'Anula la aplicación (5 o más)',
      r.veraOk
    ));

    const pares = r.inconsistentes.map(([x, y]) => `${x}↔${y}`).join(', ');
    cont.appendChild(tarjeta(
      'Consistencia (CONS)',
      `${r.inconsistentes.length} inconsistencias`,
      r.consOk ? 'Consistente (menos de 5)' : 'Anula la aplicación (5 o más)',
      r.consOk,
      pares ? `Pares distintos: ${pares}` : 'Los 11 pares coinciden'
    ));

    cont.appendChild(tarjeta(
      '¿Aplicar retest?',
      r.valida ? 'No' : 'Sí',
      r.valida ? 'Aplicación válida: el perfil se puede interpretar' : 'Aplicación no válida: no interpretar el perfil',
      r.valida
    ));
  }

  function armarTablaRespuestas(r) {
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
        const resp = estado.respuestas[i];
        const noA = c === COL_CONS;   // en CONS la A no suma
        const noB = c >= N_AREAS;     // en VERA y CONS la B no suma en la fila
        const td = celda('td', undefined, 'celda');
        td.appendChild(celda('span', String(i + 1), 'n'));
        td.appendChild(celda('span', 'A', 'm a' + (resp.includes('a') ? ' on' : '') + (noA ? ' x' : '')));
        td.appendChild(celda('span', 'B', 'm b' + (resp.includes('b') ? ' on' : '') + (noB ? ' x' : '')));
        tr.appendChild(td);
      }
      tr.appendChild(celda('td', String(r.filaB[f]), 'tot'));
    }

    const pie = t.createTFoot().insertRow();
    pie.appendChild(celda('th', 'Σ A col.'));
    r.colA.forEach((n, c) => pie.appendChild(celda('td', c === COL_CONS ? '—' : String(n))));
    pie.appendChild(celda('td', ''));
  }

  function armarTablaPuntajes(r) {
    $('baremo-sexo').textContent = estado.datos.sexo === 'varon' ? 'varones' : 'mujeres';
    const p = $('tabla-puntajes');
    p.innerHTML = '';

    const cab = p.createTHead().insertRow();
    ['Área', 'A (col.)', 'B (fila)', 'PD', 'Categoría', 'Percentil'].forEach((x) => cab.appendChild(celda('th', x)));

    const cuerpo = p.createTBody();
    r.perfil.forEach((x) => {
      const tr = cuerpo.insertRow();
      const th = celda('th', `${NOMBRES[x.area]} (${x.area})`);
      th.scope = 'row';
      tr.appendChild(th);
      tr.appendChild(celda('td', String(x.a)));
      tr.appendChild(celda('td', String(x.b)));
      tr.appendChild(celda('td', String(x.pd), 'tot'));
      tr.appendChild(celda('td', x.categoria));
      tr.appendChild(celda('td', x.percentil));
    });
  }

  // Gráfica de barras horizontales (SVG): puntaje directo por área, coloreado por categoría
  function armarGrafica(r) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs = {}, texto) => {
      const e = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
      if (texto !== undefined) e.textContent = texto;
      return e;
    };

    const W = 900, FILA = 36, TOP = 8, X0 = 310, ANCHO = 350, MAX = 22;
    const H = TOP + FILA * N_AREAS + 40;
    const x = (v) => X0 + (v / MAX) * ANCHO;
    const base = TOP + FILA * N_AREAS;

    const resumen = r.perfil.map((p) => `${NOMBRES[p.area]} ${p.pd}`).join('; ');
    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      class: 'grafica',
      role: 'img',
      'aria-label': `Perfil de intereses, puntaje directo por área: ${resumen}`
    });

    r.perfil.forEach((p, i) => {
      if (i % 2 === 0) svg.appendChild(el('rect', { x: 0, y: TOP + i * FILA, width: W, height: FILA, class: 'fila-alt' }));
    });

    for (let v = 0; v <= MAX; v += 2) {
      svg.appendChild(el('line', { x1: x(v), x2: x(v), y1: TOP, y2: base, class: v === 0 ? 'eje-linea' : 'rejilla' }));
      svg.appendChild(el('text', { x: x(v), y: base + 16, 'text-anchor': 'middle', class: 't-eje' }, String(v)));
    }
    svg.appendChild(el('text', { x: X0 + ANCHO / 2, y: base + 34, 'text-anchor': 'middle', class: 't-eje' }, 'Puntaje directo (0 – 22)'));

    r.perfil.forEach((p, i) => {
      const y = TOP + i * FILA;
      const g = el('g');
      g.appendChild(el('title', {}, `${NOMBRES[p.area]} (${p.area}): PD ${p.pd}, ${p.categoria}, percentil ${p.percentil}`));
      g.appendChild(el('text', { x: X0 - 12, y: y + 23, 'text-anchor': 'end', class: 't-nombre' }, `${NOMBRES[p.area]} (${p.area})`));
      g.appendChild(el('rect', { x: X0, y: y + 7, width: Math.max(x(p.pd) - X0, 2), height: 22, rx: 3, class: `barra-cat cat-${p.cat + 1}` }));
      g.appendChild(el('text', { x: x(p.pd) + 8, y: y + 23, class: 't-val' }, String(p.pd)));
      g.appendChild(el('text', { x: 692, y: y + 17, class: 't-cat' }, p.categoria));
      g.appendChild(el('text', { x: 692, y: y + 31, class: 't-pc' }, `Percentil ${p.percentil}`));
      svg.appendChild(g);
    });

    const cont = $('grafica');
    cont.innerHTML = '';
    cont.appendChild(svg);

    const ley = $('leyenda');
    ley.innerHTML = '';
    CATEGORIAS.forEach((c, k) => {
      const item = celda('span', undefined, 'ley-item');
      item.appendChild(celda('i', undefined, `muestra cat-${k + 1}`));
      item.appendChild(document.createTextNode(`${c} (percentil ${PERCENTILES[k]})`));
      ley.appendChild(item);
    });
  }

  function armarTablas() {
    const r = calcularPuntajes();
    armarValidez(r);
    armarTablaRespuestas(r);
    armarTablaPuntajes(r);
    armarGrafica(r);
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
      ['Sexo', textoSexo()],
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

    const r = calcularPuntajes();
    filas.push(['Validez', 'Veracidad: respuestas A en VERA', r.vera]);
    filas.push(['Validez', 'Consistencia: inconsistencias', r.inconsistentes.length]);
    filas.push(['Validez', 'Aplicación válida', r.valida ? 'Sí' : 'No']);
    filas.push(['Validez', 'Retest', r.valida ? 'No' : 'Sí']);
    r.perfil.forEach((p) => {
      const n = `${NOMBRES[p.area]} (${p.area})`;
      filas.push(['Puntajes', `${n} · A (columna)`, p.a]);
      filas.push(['Puntajes', `${n} · B (fila)`, p.b]);
      filas.push(['Puntajes', `${n} · PD`, p.pd]);
      filas.push(['Puntajes', `${n} · Categoría`, p.categoria]);
      filas.push(['Puntajes', `${n} · Percentil`, p.percentil]);
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
