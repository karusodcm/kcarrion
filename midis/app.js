/* ============================================================
   Configuración
   - Si subes datos.csv junto a esta página, deja "datos.csv".
   - Si prefieres leer el Google Sheet publicado, pega aquí el
     enlace CSV que te da "Archivo > Compartir > Publicar en la Web".
   ============================================================ */
const CSV_URL = "datos.csv";

const POR_PAGINA = 100;
const ES_ENLACE = /^https?:\/\//i;

let datos = [];          // todas las filas ya preparadas
let filtrados = [];      // resultado actual
let mostrados = 0;       // cuántas filas se ven
let filtroTipo = "todos";

const $q = document.getElementById("q");
const $limpiar = document.getElementById("limpiar");
const $resultados = document.getElementById("resultados");
const $contador = document.getElementById("contador");
const $vacio = document.getElementById("vacio");
const $mas = document.getElementById("mas");
const $aviso = document.getElementById("aviso");
const $toast = document.getElementById("toast");

/* ---------- Lectura del CSV (maneja comillas, comas y saltos de línea) ---------- */
function parsearCSV(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // quita BOM
  const filas = [];
  let fila = [], campo = "", entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else entreComillas = false;
      } else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some(v => v.trim() !== "")) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    if (fila.some(v => v.trim() !== "")) filas.push(fila);
  }
  return filas;
}

/* ---------- Normalizar texto: sin tildes, minúsculas ---------- */
function normalizar(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function prepararDatos(filas) {
  return filas.slice(1).map(f => {
    const ruc = (f[0] || "").trim();
    const nombre = (f[1] || "").trim();
    const mpv = (f[2] || "").trim();
    const esEnlace = ES_ENLACE.test(mpv);
    let dominio = "";
    if (esEnlace) { try { dominio = new URL(mpv).hostname; } catch (e) {} }
    return {
      ruc, nombre, mpv, esEnlace, dominio,
      rucValido: /^\d{11}$/.test(ruc),
      clave: normalizar(`${ruc} ${nombre} ${mpv}`)
    };
  }).filter(d => d.nombre || d.ruc || d.mpv);
}

/* ---------- Carga ---------- */
async function cargar() {
  try {
    const r = await fetch(CSV_URL);
    if (!r.ok) throw new Error("HTTP " + r.status);
    iniciar(await r.text());
  } catch (err) {
    mostrarAvisoCarga();
  }
}

function iniciar(texto) {
  datos = prepararDatos(parsearCSV(texto));
  $aviso.hidden = true;
  buscar();
}

function mostrarAvisoCarga() {
  $aviso.hidden = false;
  $aviso.innerHTML =
    "<strong>No se pudo leer el archivo de datos.</strong> " +
    "Esto pasa cuando la página se abre haciendo doble clic en el archivo (file://). " +
    "Súbela a tu hosting o ábrela desde un servidor local. También puedes cargar el CSV a mano:<br>" +
    '<label>Elegir archivo CSV<input type="file" accept=".csv,text/csv"></label>';
  $aviso.querySelector("input").addEventListener("change", e => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    archivo.text().then(iniciar);
  });
}

/* ---------- Búsqueda ---------- */
function buscar() {
  const terminos = normalizar($q.value).split(/\s+/).filter(Boolean);
  $limpiar.hidden = $q.value === "";

  filtrados = datos.filter(d => {
    if (filtroTipo === "enlace" && !d.esEnlace) return false;
    if (filtroTipo === "correo" && d.esEnlace) return false;
    return terminos.every(t => d.clave.includes(t));
  });

  mostrados = 0;
  $resultados.innerHTML = "";
  dibujarMas(terminos);
}

function dibujarMas(terminos) {
  terminos = terminos || normalizar($q.value).split(/\s+/).filter(Boolean);
  const lote = filtrados.slice(mostrados, mostrados + POR_PAGINA);
  const html = lote.map(d => filaHTML(d, terminos)).join("");
  $resultados.insertAdjacentHTML("beforeend", html);
  mostrados += lote.length;

  const total = datos.length.toLocaleString("es-PE");
  const n = filtrados.length.toLocaleString("es-PE");
  $contador.textContent = filtrados.length === datos.length
    ? `${total} entidades`
    : `${n} de ${total} entidades`;

  $vacio.hidden = filtrados.length !== 0 || datos.length === 0;

  const faltan = filtrados.length - mostrados;
  $mas.hidden = faltan <= 0;
  if (faltan > 0) $mas.textContent = `Mostrar más (${faltan.toLocaleString("es-PE")} restantes)`;
}

/* ---------- Dibujo de cada fila ---------- */
function escapar(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Resalta los términos buscados ignorando tildes y mayúsculas.
function resaltar(texto, terminos) {
  if (!terminos.length) return escapar(texto);
  const base = normalizar(texto);
  // normalizar() puede cambiar la longitud en casos raros; si pasa, no resaltamos.
  if (base.length !== texto.length) return escapar(texto);
  const marcas = new Array(texto.length).fill(false);
  terminos.forEach(t => {
    let i = base.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length; k++) marcas[k] = true;
      i = base.indexOf(t, i + t.length);
    }
  });
  let out = "", abierto = false;
  for (let i = 0; i < texto.length; i++) {
    if (marcas[i] && !abierto) { out += "<mark>"; abierto = true; }
    if (!marcas[i] && abierto) { out += "</mark>"; abierto = false; }
    out += escapar(texto[i]);
  }
  return out + (abierto ? "</mark>" : "");
}

function filaHTML(d, terminos) {
  const ruc = d.ruc
    ? `<span class="ruc${d.rucValido ? "" : " invalido"}">${resaltar(d.ruc, terminos)}</span>`
    : `<span class="ruc invalido">Sin RUC</span>`;

  const acceso = d.esEnlace
    ? `<a class="btn-abrir" href="${escapar(d.mpv)}" target="_blank" rel="noopener noreferrer">Abrir mesa de partes</a>
       <button type="button" class="btn-copiar" data-copiar="${escapar(d.mpv)}" data-msg="Enlace copiado">Copiar enlace</button>
       <span class="dominio">${escapar(d.dominio)}</span>`
    : `<span class="etiqueta-texto">${escapar(d.mpv || "Sin dato")}</span>`;

  const copiarRuc = d.ruc
    ? ` <button type="button" class="btn-copiar" data-copiar="${escapar(d.ruc)}" data-msg="RUC copiado" aria-label="Copiar RUC ${escapar(d.ruc)}">Copiar</button>`
    : "";

  return `<div class="fila" role="row">
    <div role="cell">${ruc}${copiarRuc}</div>
    <div role="cell" class="entidad">${resaltar(d.nombre, terminos)}</div>
    <div role="cell" class="acciones">${acceso}</div>
  </div>`;
}

/* ---------- Copiar al portapapeles ---------- */
let temporizadorToast;
function avisar(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => ($toast.hidden = true), 1800);
}

async function copiar(texto, msg) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const t = document.createElement("textarea");
    t.value = texto; document.body.appendChild(t); t.select();
    document.execCommand("copy"); t.remove();
  }
  avisar(msg);
}

/* ---------- Eventos ---------- */
let esperaBusqueda;
$q.addEventListener("input", () => {
  clearTimeout(esperaBusqueda);
  esperaBusqueda = setTimeout(buscar, 120);
});

$limpiar.addEventListener("click", () => { $q.value = ""; buscar(); $q.focus(); });

document.querySelector(".filtros").addEventListener("click", e => {
  const b = e.target.closest(".filtro");
  if (!b) return;
  document.querySelectorAll(".filtro").forEach(x => x.classList.toggle("activo", x === b));
  filtroTipo = b.dataset.filtro;
  buscar();
});

$mas.addEventListener("click", () => dibujarMas());

$resultados.addEventListener("click", e => {
  const b = e.target.closest("[data-copiar]");
  if (b) copiar(b.dataset.copiar, b.dataset.msg);
});

// Atajo: "/" lleva el cursor al buscador
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== $q) { e.preventDefault(); $q.focus(); $q.select(); }
  if (e.key === "Escape" && document.activeElement === $q && $q.value) { $q.value = ""; buscar(); }
});

cargar();
