(() => {
'use strict';
const AREAS = ['CCFM','CCSS','CCNA','CCCO','ARTE','BURO','CCEP','HAA','FINA','LING','JURI','VERA','CONS'];
const COLUMNAS = 13, FILAS = 11, TOTAL = COLUMNAS * FILAS;   // 143
const N_AREAS = 11, COL_VERA = 11, COL_CONS = 12, LIMITE_INVALIDO = 5;
const NOMBRES = {
  CCFM: 'Ciencias Físico-Matemática', CCSS: 'Ciencias Sociales', CCNA: 'Ciencias Naturales',
  CCCO: 'Ciencias de la Comunicación', ARTE: 'Artes', BURO: 'Burocracia',
  CCEP: 'Ciencias Económicas Políticas', HAA: 'Institutos Armados', FINA: 'Finanzas',
  LING: 'Lingüística', JURI: 'Jurisprudencia'
};
const PARES_CONS = [[13,131],[26,132],[39,133],[52,134],[65,135],[78,136],[91,137],[104,138],[117,139],[130,140],[143,1]];
const CATEGORIAS = ['Desinterés','Bajo','Promedio bajo','Indecisión','Promedio alto','Alto','Muy alto'];
const PERCENTILES = ['1–14','15–29','30–39','40–60','61–74','75–89','90–99'];
const BAREMO = {
  varon: {
    CCFM: [4,7,9,13,15,17,22], CCSS: [3,6,8,12,14,16,22], CCNA: [4,7,9,13,15,18,22],
    CCCO: [2,4,6,10,13,17,22], ARTE: [2,4,6,10,14,17,22], BURO: [3,5,7,11,13,16,22],
    CCEP: [3,5,7,12,14,17,22], HAA: [3,5,7,12,14,17,22], FINA: [2,4,6,10,12,16,22],
    LING: [2,4,6,9,12,15,22], JURI: [2,4,6,10,13,16,22]
  },
  mujer: {
    CCFM: [2,4,6,11,14,17,22], CCSS: [4,7,9,14,16,19,22], CCNA: [3,5,7,12,14,17,22],
    CCCO: [2,4,6,11,13,16,22], ARTE: [2,4,6,11,13,16,22], BURO: [4,7,9,14,16,19,22],
    CCEP: [2,5,7,12,14,17,22], HAA: [2,4,6,9,12,15,22], FINA: [2,5,7,12,14,17,22],
    LING: [2,5,7,12,14,17,22], JURI: [2,4,6,11,13,16,22]
  }
};
const CLAVE = 'casm83-calificacion';

// respuestas[i]: '' | 'a' | 'b' | 'ab'
let respuestas = new Array(TOTAL).fill('');
let sexo = '';

const $ = (id) => document.getElementById(id);
const celda = (tag, texto, clase) => {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
};

// ---- Guardado local ----
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify({ respuestas, sexo })); } catch (e) {}
}
function cargar() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE));
    if (g && Array.isArray(g.respuestas) && g.respuestas.length === TOTAL) {
      respuestas = g.respuestas.map((r) => (['a','b','ab'].includes(r) ? r : ''));
      sexo = ['varon','mujer'].includes(g.sexo) ? g.sexo : '';
    }
  } catch (e) {}
}

// ---- Tabla para marcar ----
function construirTabla() {
  const t = $('tabla');
  t.innerHTML = '';
  const cab = t.createTHead().insertRow();
  cab.appendChild(celda('th', ''));
  AREAS.forEach((a) => cab.appendChild(celda('th', a)));
  cab.appendChild(celda('th', 'Σ B fila'));

  const cuerpo = t.createTBody();
  for (let f = 0; f < FILAS; f++) {
    const tr = cuerpo.insertRow();
    const th = celda('th', AREAS[f]); th.scope = 'row';
    tr.appendChild(th);
    for (let c = 0; c < COLUMNAS; c++) {
      const i = f * COLUMNAS + c;
      const td = celda('td', undefined, 'celda');
      td.dataset.i = i;
      td.appendChild(celda('span', String(i + 1), 'n'));
      ['a', 'b'].forEach((letra) => {
        const noA = letra === 'a' && c === COL_CONS;
        const noB = letra === 'b' && c >= N_AREAS;
        const b = celda('button', letra.toUpperCase(), 'm ' + letra + (noA || noB ? ' x' : ''));
        b.type = 'button';
        b.dataset.letra = letra;
        b.setAttribute('aria-label', `Pregunta ${i + 1}, opción ${letra.toUpperCase()}`);
        td.appendChild(b);
      });
      tr.appendChild(td);
    }
    const tot = celda('td', '0', 'tot'); tot.id = 'tb-' + f;
    tr.appendChild(tot);
  }
  const pie = t.createTFoot().insertRow();
  pie.appendChild(celda('th', 'Σ A col.'));
  for (let c = 0; c < COLUMNAS; c++) {
    const td = celda('td', c === COL_CONS ? '—' : '0'); td.id = 'ta-' + c;
    pie.appendChild(td);
  }
  pie.appendChild(celda('td', ''));

  t.addEventListener('click', (ev) => {
    const b = ev.target.closest('.m');
    if (!b) return;
    const i = Number(b.closest('td').dataset.i);
    const l = b.dataset.letra;
    let r = respuestas[i];
    r = r.includes(l) ? r.replace(l, '') : (r + l).split('').sort().join('');
    respuestas[i] = r;
    guardar();
    pintarCelda(i);
    actualizarTotales();
    if ($('mensaje').textContent) $('mensaje').textContent = '';
  });
}

function pintarCelda(i) {
  const td = $('tabla').querySelector(`td[data-i="${i}"]`);
  const r = respuestas[i];
  td.querySelectorAll('.m').forEach((b) => b.classList.toggle('on', r.includes(b.dataset.letra)));
  td.classList.toggle('ok', r !== '');
  td.classList.remove('falta');
}

function actualizarTotales() {
  const colA = new Array(COLUMNAS).fill(0), filaB = new Array(FILAS).fill(0);
  respuestas.forEach((r, i) => {
    const f = Math.floor(i / COLUMNAS), c = i % COLUMNAS;
    if (r.includes('a') && c !== COL_CONS) colA[c]++;
    if (r.includes('b') && c < N_AREAS) filaB[f]++;
  });
  colA.forEach((n, c) => { if (c !== COL_CONS) $('ta-' + c).textContent = n; });
  filaB.forEach((n, f) => { $('tb-' + f).textContent = n; });
  const hechas = respuestas.filter((r) => r !== '').length;
  $('progreso').textContent = `${hechas} de ${TOTAL} preguntas marcadas`;
  $('barra-fill').style.width = (hechas / TOTAL * 100) + '%';
}

// ---- Calificación ----
function calcular() {
  const colA = new Array(COLUMNAS).fill(0), filaB = new Array(FILAS).fill(0);
  respuestas.forEach((r, i) => {
    const f = Math.floor(i / COLUMNAS), c = i % COLUMNAS;
    if (r.includes('a')) colA[c]++;
    if (r.includes('b') && c < N_AREAS) filaB[f]++;
  });
  const perfil = AREAS.slice(0, N_AREAS).map((area, k) => {
    const pd = colA[k] + filaB[k];
    const lim = BAREMO[sexo][area];
    let cat = lim.findIndex((max) => pd <= max);
    if (cat === -1) cat = lim.length - 1;
    return { area, a: colA[k], b: filaB[k], pd, cat, categoria: CATEGORIAS[cat], percentil: PERCENTILES[cat] };
  });
  const vera = colA[COL_VERA];
  const inconsistentes = PARES_CONS.filter(([x, y]) => respuestas[x - 1] !== respuestas[y - 1]);
  const veraOk = vera < LIMITE_INVALIDO, consOk = inconsistentes.length < LIMITE_INVALIDO;
  return { perfil, vera, veraOk, inconsistentes, consOk, valida: veraOk && consOk };
}

function armarValidez(r) {
  const cont = $('validez'); cont.innerHTML = '';
  const tarjeta = (tit, val, nota, ok, det) => {
    const d = celda('div', undefined, 'vcard' + (ok ? '' : ' mal'));
    d.appendChild(celda('div', tit, 'v-tit'));
    d.appendChild(celda('div', val, 'v-val'));
    d.appendChild(celda('div', (ok ? '✓ ' : '✕ ') + nota, 'v-nota'));
    if (det) d.appendChild(celda('div', det, 'v-det'));
    cont.appendChild(d);
  };
  tarjeta('Veracidad (VERA)', `${r.vera} resp. "A"`,
    r.veraOk ? 'Válida (menos de 5)' : 'Anula la aplicación (5 o más)', r.veraOk);
  const pares = r.inconsistentes.map(([x, y]) => `${x}↔${y}`).join(', ');
  tarjeta('Consistencia (CONS)', `${r.inconsistentes.length} inconsistencias`,
    r.consOk ? 'Consistente (menos de 5)' : 'Anula la aplicación (5 o más)', r.consOk,
    pares ? `Pares distintos: ${pares}` : 'Los 11 pares coinciden');
  tarjeta('¿Aplicar retest?', r.valida ? 'No' : 'Sí',
    r.valida ? 'Aplicación válida: el perfil se puede interpretar' : 'Aplicación no válida: no interpretar el perfil', r.valida);
}

function armarTablaPuntajes(r) {
  $('baremo-sexo').textContent = sexo === 'varon' ? 'varones' : 'mujeres';
  const p = $('tabla-puntajes'); p.innerHTML = '';
  const cab = p.createTHead().insertRow();
  ['Área','A (col.)','B (fila)','PD','Categoría','Percentil'].forEach((x) => cab.appendChild(celda('th', x)));
  const cuerpo = p.createTBody();
  r.perfil.forEach((x) => {
    const tr = cuerpo.insertRow();
    const th = celda('th', `${NOMBRES[x.area]} (${x.area})`); th.scope = 'row';
    tr.appendChild(th);
    tr.appendChild(celda('td', String(x.a)));
    tr.appendChild(celda('td', String(x.b)));
    tr.appendChild(celda('td', String(x.pd), 'tot'));
    tr.appendChild(celda('td', x.categoria));
    tr.appendChild(celda('td', x.percentil));
  });
}

function armarGrafica(r) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, texto) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const W = 900, FILA = 36, TOP = 8, X0 = 310, ANCHO = 350, MAX = 22;
  const H = TOP + FILA * N_AREAS + 40, base = TOP + FILA * N_AREAS;
  const x = (v) => X0 + (v / MAX) * ANCHO;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'grafica', role: 'img',
    'aria-label': 'Perfil de intereses: ' + r.perfil.map((p) => `${NOMBRES[p.area]} ${p.pd}`).join('; ') });
  r.perfil.forEach((p, i) => {
    if (i % 2 === 0) svg.appendChild(el('rect', { x: 0, y: TOP + i * FILA, width: W, height: FILA, class: 'fila-alt' }));
  });
  for (let v = 0; v <= MAX; v += 2) {
    svg.appendChild(el('line', { x1: x(v), x2: x(v), y1: TOP, y2: base, class: v === 0 ? 'eje-linea' : 'rejilla' }));
    svg.appendChild(el('text', { x: x(v), y: base + 16, 'text-anchor': 'middle', class: 't-eje' }, String(v)));
  }
  svg.appendChild(el('text', { x: X0 + ANCHO / 2, y: base + 34, 'text-anchor': 'middle', class: 't-eje' }, 'Puntaje directo (0 – 22)'));
  r.perfil.forEach((p, i) => {
    const y = TOP + i * FILA, g = el('g');
    g.appendChild(el('title', {}, `${NOMBRES[p.area]} (${p.area}): PD ${p.pd}, ${p.categoria}, percentil ${p.percentil}`));
    g.appendChild(el('text', { x: X0 - 12, y: y + 23, 'text-anchor': 'end', class: 't-nombre' }, `${NOMBRES[p.area]} (${p.area})`));
    g.appendChild(el('rect', { x: X0, y: y + 7, width: Math.max(x(p.pd) - X0, 2), height: 22, rx: 3, class: `barra-cat cat-${p.cat + 1}` }));
    g.appendChild(el('text', { x: x(p.pd) + 8, y: y + 23, class: 't-val' }, String(p.pd)));
    g.appendChild(el('text', { x: 692, y: y + 17, class: 't-cat' }, p.categoria));
    g.appendChild(el('text', { x: 692, y: y + 31, class: 't-pc' }, `Percentil ${p.percentil}`));
    svg.appendChild(g);
  });
  $('grafica').innerHTML = ''; $('grafica').appendChild(svg);
  const ley = $('leyenda'); ley.innerHTML = '';
  CATEGORIAS.forEach((c, k) => {
    const item = celda('span', undefined, 'ley-item');
    item.appendChild(celda('i', undefined, `muestra cat-${k + 1}`));
    item.appendChild(document.createTextNode(`${c} (percentil ${PERCENTILES[k]})`));
    ley.appendChild(item);
  });
}

// ---- Botones ----
function verResultados() {
  const msg = $('mensaje');
  const faltan = [];
  respuestas.forEach((r, i) => { if (r === '') faltan.push(i); });
  const sinSexo = sexo === '';

  $('sexo').classList.toggle('error', sinSexo);
  faltan.forEach((i) => $('tabla').querySelector(`td[data-i="${i}"]`).classList.add('falta'));

  if (faltan.length > 0 || sinSexo) {
    const partes = [];
    if (sinSexo) partes.push('selecciona el sexo para el baremo');
    if (faltan.length > 0) {
      partes.push(faltan.length === 1
        ? `falta la pregunta ${faltan[0] + 1}`
        : `faltan ${faltan.length} preguntas (la primera es la ${faltan[0] + 1})`);
    }
    msg.textContent = 'Para ver los resultados ' + partes.join(' y ') + '.';
    if (faltan.length > 0) {
      $('tabla').querySelector(`td[data-i="${faltan[0]}"]`).scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return;
  }
  msg.textContent = '';
  const r = calcular();
  armarValidez(r); armarTablaPuntajes(r); armarGrafica(r);
  $('vista-tabla').classList.add('hidden');
  $('vista-resultados').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('btn-resultados').addEventListener('click', verResultados);
$('btn-volver').addEventListener('click', () => {
  $('vista-resultados').classList.add('hidden');
  $('vista-tabla').classList.remove('hidden');
  window.scrollTo({ top: 0 });
});
$('btn-imprimir').addEventListener('click', () => window.print());
$('btn-limpiar').addEventListener('click', () => {
  if (!confirm('¿Borrar todas las marcas de la tabla?')) return;
  respuestas = new Array(TOTAL).fill('');
  guardar();
  respuestas.forEach((_, i) => pintarCelda(i));
  actualizarTotales();
  $('mensaje').textContent = '';
});
$('sexo').addEventListener('change', (e) => {
  sexo = e.target.value; e.target.classList.remove('error'); guardar();
});

// ---- Inicio ----
cargar();
construirTabla();
$('sexo').value = sexo;
respuestas.forEach((_, i) => pintarCelda(i));
actualizarTotales();
})();
