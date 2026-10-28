/* Panel privado de kcarrion: agenda (calendario), pacientes/historial y notas.
   Los datos viven en localStorage, separados por usuario: "kcarrion:data:<id>".
   Las entradas de la agenda se guardan en data.citas; el campo "tipo" distingue
   cita, reunión, evento, charla, reservado y no disponible (sin tipo = cita). */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const AREAS = ["Medicina", "Enfermería", "Psicología", "Trabajo social", "Nutrición", "Rehabilitación", "Otra"];

  const TIPOS = {
    cita:      { label: "Cita",          icon: "🩺", color: "#3b958d" },
    reunion:   { label: "Reunión",       icon: "👥", color: "#3f78b5" },
    evento:    { label: "Evento",        icon: "🎉", color: "#d08a1e" },
    charla:    { label: "Charla",        icon: "🎤", color: "#cf5a5a" },
    reservado: { label: "Reservado",     icon: "🔖", color: "#7a8a3a", block: true },
    nodisp:    { label: "No disponible", icon: "⛔", color: "#6b7a78", block: true }
  };
  const tipoOf = (c) => (TIPOS[c.tipo] ? c.tipo : "cita");
  const isBlock = (c) => Boolean(TIPOS[tipoOf(c)].block);

  // ---------- Fechas y horas ----------
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => fmt(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const longDate = (s) => cap(parse(s).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const shortDate = (s) => parse(s).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  const age = (s) => {
    if (!s) return "";
    const b = parse(s), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a >= 0 && a < 130 ? a + " años" : "";
  };
  const toMin = (h) => { const [a, b] = String(h || "0:0").split(":").map(Number); return (a || 0) * 60 + (b || 0); };
  const fromMin = (n) => { n = Math.max(0, Math.min(1439, n)); return pad(Math.floor(n / 60)) + ":" + pad(n % 60); };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let user, KEY, data;
  let selected = null;                       // paciente seleccionado
  let selDate = today();                     // día seleccionado en el calendario
  let cal = { y: new Date().getFullYear(), m: new Date().getMonth() };

  // ---------- Datos ----------
  function empty() { return { pacientes: [], citas: [], notas: [], evoluciones: [] }; }
  function normalize(d) {
    const out = empty();
    if (d && typeof d === "object") Object.keys(out).forEach((k) => { if (Array.isArray(d[k])) out[k] = d[k]; });
    return out;
  }
  function load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (e) { return empty(); }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); $("#save-error").style.display = "none"; }
    catch (e) { $("#save-error").style.display = ""; }
  }
  function commit() { persist(); renderAll(); }

  const patientName = (id) => { const p = data.pacientes.find((x) => x.id === id); return p ? p.nombre : ""; };

  function range(c) {
    if (c.todoDia) return [0, 1440];
    const s = toMin(c.hora);
    let e = c.horaFin ? toMin(c.horaFin) : s + (Number(c.duracion) || 60);
    if (e <= s) e = s + 1;
    return [s, e];
  }
  function timeLabel(c) {
    if (c.todoDia) return "Todo el día";
    if (c.horaFin) return c.hora + "–" + c.horaFin;
    if (c.duracion) return c.hora + "–" + fromMin(toMin(c.hora) + Number(c.duracion));
    return c.hora || "";
  }
  const titleOf = (c) => c.motivo || (tipoOf(c) === "cita" ? (c.area || "Cita") : TIPOS[tipoOf(c)].label);
  const sortItems = (arr) => arr.slice().sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || ((a.todoDia ? 0 : 1) - (b.todoDia ? 0 : 1)) || (a.hora || "").localeCompare(b.hora || ""));

  function findOverlap(n, ignoreId) {
    const [s, e] = range(n);
    return data.citas.find((c) => {
      if (c.id === ignoreId || c.fecha !== n.fecha || c.estado === "cancelada") return false;
      const [s2, e2] = range(c);
      return s < e2 && s2 < e;
    });
  }

  function flash(el, text, ok) {
    el.textContent = text;
    el.className = "form-msg " + (ok ? "is-ok" : "is-error");
    if (ok) setTimeout(() => { el.className = "form-msg"; el.textContent = ""; }, 2500);
  }

  // ---------- Entradas de la agenda ----------
  function agendaItem(c, opts = {}) {
    const t = tipoOf(c), T = TIPOS[t], block = Boolean(T.block);
    const doneLabel = t === "cita" ? "Atendida" : "Realizada";
    const overdue = !block && c.estado === "pendiente" && c.fecha < today();
    let badge = "";
    if (!block) {
      badge = c.estado === "atendida" ? `<span class="badge badge--done">${doneLabel}</span>`
        : c.estado === "cancelada" ? '<span class="badge badge--cancel">Cancelada</span>'
        : overdue ? '<span class="badge badge--warn">Por cerrar</span>' : '<span class="badge">Pendiente</span>';
    }
    // Etiquetas de prioridad (solo se muestran cuando aplican)
    if (c.urgente) badge += ' <span class="badge badge--urg">Urgente</span>';
    if (c.importante) badge += ' <span class="badge badge--imp">Importante</span>';
    const cls = c.estado === "atendida" ? " item--done" : c.estado === "cancelada" ? " item--cancel" : "";
    const name = t === "cita" ? (patientName(c.pacienteId) || "Personal") : "";
    const meta = [T.label, name, t === "cita" ? c.area : "", c.lugar].filter(Boolean).join(" · ");
    const whenMain = c.todoDia ? "Todo el día" : esc(c.hora);
    const whenSmall = opts.hideDate ? (c.todoDia || !c.horaFin ? "" : "– " + esc(c.horaFin)) : esc(shortDate(c.fecha));

    const id = esc(c.id);
    let actions = "";
    if (!block) {
      actions += c.estado === "pendiente"
        ? `<button class="btn btn--outline btn--xs" data-action="ev-ok" data-id="${id}">${doneLabel}</button>
           <button class="btn btn--ghost btn--xs" data-action="ev-no" data-id="${id}">Cancelar</button>`
        : `<button class="btn btn--ghost btn--xs" data-action="ev-reabrir" data-id="${id}">Reabrir</button>`;
    }
    actions += `<button class="btn btn--ghost btn--xs" data-action="ev-edit" data-id="${id}">Editar</button>
      <button class="btn btn--danger btn--xs" data-action="ev-del" data-id="${id}" aria-label="Eliminar">Eliminar</button>`;

    return `<div class="item item--t${cls}" style="--c:${T.color}">
      <div class="item__when"><span>${whenMain}</span><small>${whenSmall}</small></div>
      <div>
        <div class="item__title"><span aria-hidden="true">${T.icon}</span> ${esc(titleOf(c))} ${badge}</div>
        <div class="item__meta">${esc(meta)}</div>
      </div>
      <div class="item__actions">${actions}</div>
    </div>`;
  }

  // ---------- Render ----------
  function optionsPacientes(includeNone) {
    const none = includeNone ? '<option value="">— Sin paciente (personal) —</option>' : "";
    return none + data.pacientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("");
  }

  function renderSelects() {
    const keep = (sel, html) => { const v = sel.value; sel.innerHTML = html; if ([...sel.options].some((o) => o.value === v)) sel.value = v; };
    keep($("#ev-paciente"), optionsPacientes(true));
    keep($("#n-paciente"), optionsPacientes(true));
  }

  function renderStats() {
    const t = today(), w = addDays(7);
    const pend = data.citas.filter((c) => c.estado === "pendiente" && !isBlock(c));
    $("#st-hoy").textContent = pend.filter((c) => c.fecha === t).length;
    $("#st-semana").textContent = pend.filter((c) => c.fecha >= t && c.fecha <= w).length;
    $("#st-pac").textContent = data.pacientes.length;
    $("#st-notas").textContent = data.notas.length;
  }

  function renderResumen() {
    const t = today();
    const hoy = sortItems(data.citas.filter((c) => c.fecha === t && c.estado === "pendiente"));
    $("#lista-hoy").innerHTML = hoy.length ? hoy.map((c) => agendaItem(c, { hideDate: true })).join("") : '<div class="empty">No tienes nada pendiente para hoy.</div>';
    const cerrar = sortItems(data.citas.filter((c) => c.estado === "pendiente" && !isBlock(c) && c.fecha < t));
    $("#lista-cerrar").innerHTML = cerrar.length ? cerrar.map((c) => agendaItem(c)).join("") : '<div class="empty">Todo al día. No hay actividades por cerrar.</div>';
  }

  function renderCalendario(refocus) {
    const { y, m } = cal;
    $("#cal-titulo").textContent = cap(new Date(y, m, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" }));

    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7;                  // semana desde lunes
    const days = new Date(y, m + 1, 0).getDate();
    const cells = Math.ceil((offset + days) / 7) * 7;
    const start = new Date(y, m, 1 - offset);
    const t = today();

    const byDate = {};
    data.citas.forEach((c) => { if (c.estado !== "cancelada") (byDate[c.fecha] = byDate[c.fecha] || []).push(c); });

    let html = "";
    for (let i = 0; i < cells; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const ds = fmt(d);
      const items = sortItems(byDate[ds] || []);
      const blocked = items.some((c) => tipoOf(c) === "nodisp" && c.todoDia);
      const cls = ["cal-day", d.getMonth() !== m ? "is-out" : "", ds === t ? "is-today" : "", blocked ? "is-blocked" : ""].filter(Boolean).join(" ");
      const chips = items.slice(0, 2).map((c) =>
        `<span class="cal-chip" style="--c:${TIPOS[tipoOf(c)].color}">${c.todoDia ? "" : esc(c.hora) + " "}${esc(titleOf(c))}</span>`).join("");
      const more = items.length > 2 ? `<span class="cal-more">+${items.length - 2} más</span>` : "";
      const dots = items.length ? `<span class="cal-dots">${items.slice(0, 4).map((c) => `<i style="--c:${TIPOS[tipoOf(c)].color}"></i>`).join("")}</span>` : "";
      const label = d.toLocaleDateString("es-PE", { day: "numeric", month: "long" }) + (items.length ? ", " + items.length + (items.length === 1 ? " actividad" : " actividades") : ", sin actividades");
      html += `<button type="button" class="${cls}" data-action="dia-ver" data-fecha="${ds}" aria-pressed="${ds === selDate}" ${ds === t ? 'aria-current="date"' : ""} aria-label="${esc(label)}">
        <span class="cal-num">${d.getDate()}</span>${chips}${more}${dots}</button>`;
    }
    $("#cal-grid").innerHTML = html;
    if (refocus) { const el = $('.cal-day[data-fecha="' + selDate + '"]'); if (el) el.focus({ preventScroll: true }); }
  }

  function renderDia() {
    const items = sortItems(data.citas.filter((c) => c.fecha === selDate));
    const activos = items.filter((c) => c.estado !== "cancelada").length;
    $("#dia-panel").innerHTML = `
      <div class="toolbar">
        <div><h2 style="margin:0">${esc(longDate(selDate))}</h2>
          <div class="small">${items.length ? activos + (activos === 1 ? " actividad" : " actividades") : "Sin actividades"}</div></div>
        <button class="btn btn--outline btn--sm" type="button" data-action="dia-nuevo">+ Agregar</button>
      </div>
      <div class="list">${items.length ? items.map((c) => agendaItem(c, { hideDate: true })).join("") : '<div class="empty">Día libre. Usa “Agregar” para programar algo.</div>'}</div>`;
  }

  function renderLista() {
    const t = today();
    const f = $("#a-filtro").value;
    let list = data.citas;
    if (f === "proximas") list = list.filter((c) => c.estado === "pendiente" && c.fecha >= t);
    else if (f === "cerrar") list = list.filter((c) => c.estado === "pendiente" && !isBlock(c) && c.fecha < t);
    else if (f === "cerradas") list = list.filter((c) => c.estado !== "pendiente");
    list = sortItems(list);
    if (f === "cerradas") list.reverse();
    if (!list.length) { $("#lista-agenda").innerHTML = '<div class="empty">No hay entradas en esta vista.</div>'; return; }
    let html = "", last = "";
    list.forEach((c) => {
      if (c.fecha !== last) { last = c.fecha; html += `<div class="date-head">${esc(longDate(c.fecha))}</div>`; }
      html += `<div class="list" style="margin-bottom:.5rem">${agendaItem(c, { hideDate: true })}</div>`;
    });
    $("#lista-agenda").innerHTML = html;
  }

  function renderPacientes() {
    const q = $("#p-buscar").value.trim().toLowerCase();
    const list = data.pacientes
      .filter((p) => !q || p.nombre.toLowerCase().includes(q) || (p.documento || "").toLowerCase().includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    $("#lista-pacientes").innerHTML = list.length
      ? list.map((p) => `<button class="patient-btn" data-action="pac-ver" data-id="${esc(p.id)}" aria-current="${p.id === selected}">
          <b>${esc(p.nombre)}</b><span>${esc([p.documento, age(p.nacimiento)].filter(Boolean).join(" · ") || "Sin datos adicionales")}</span></button>`).join("")
      : `<div class="empty">${data.pacientes.length ? "Sin resultados." : "Aún no tienes pacientes registrados."}</div>`;
    renderDetalle();
  }

  function renderDetalle() {
    const box = $("#detalle-paciente");
    const p = data.pacientes.find((x) => x.id === selected);
    if (!p) { box.innerHTML = '<div class="empty">Selecciona un paciente para ver su historial.</div>'; return; }

    const entries = [];
    data.evoluciones.filter((e) => e.pacienteId === p.id).forEach((e) => entries.push({ orden: e.fecha + "~" + e.id, tipo: "evo", e }));
    data.citas.filter((c) => c.pacienteId === p.id && tipoOf(c) === "cita").forEach((c) => entries.push({ orden: c.fecha + (c.hora || ""), tipo: "cita", c }));
    entries.sort((a, b) => b.orden.localeCompare(a.orden));

    const tl = entries.length ? entries.map((x) => {
      if (x.tipo === "evo") {
        return `<div class="entry"><div class="entry__head"><b>${esc(shortDate(x.e.fecha))}</b><span class="badge">${esc(x.e.area)}</span><span>Evolución</span>
          <button class="btn btn--danger btn--xs" data-action="evo-del" data-id="${esc(x.e.id)}">Eliminar</button></div><p>${esc(x.e.texto)}</p></div>`;
      }
      const st = x.c.estado === "atendida" ? "Atendida" : x.c.estado === "cancelada" ? "Cancelada" : "Pendiente";
      return `<div class="entry"><div class="entry__head"><b>${esc(shortDate(x.c.fecha))}</b><span class="badge">${esc(x.c.area)}</span><span>Cita · ${esc(timeLabel(x.c))} · ${st}</span></div>
        ${x.c.motivo ? `<p>${esc(x.c.motivo)}</p>` : ""}</div>`;
    }).join("") : '<div class="empty">Sin registros todavía.</div>';

    const notas = data.notas.filter((n) => n.pacienteId === p.id).length;
    box.innerHTML = `
      <div class="toolbar">
        <div><h2 style="margin:0">${esc(p.nombre)}</h2>
          <div class="small">${esc([p.documento, age(p.nacimiento), p.contacto].filter(Boolean).join(" · "))}</div></div>
        <button class="btn btn--danger btn--sm" data-action="pac-del" data-id="${esc(p.id)}">Eliminar paciente</button>
      </div>
      ${p.motivo ? `<p><b>Motivo de consulta:</b> ${esc(p.motivo)}</p>` : ""}
      ${notas ? `<p class="small">${notas} nota(s) vinculada(s) en la pestaña Notas.</p>` : ""}
      <h3 style="margin-top:1.25rem">Registrar evolución</h3>
      <form id="evo-form" novalidate>
        <div class="form-row">
          <div class="field"><label for="e-fecha">Fecha</label><input class="input" id="e-fecha" name="fecha" type="date" value="${today()}" required></div>
          <div class="field"><label for="e-area">Área</label><select class="input" id="e-area" name="area">${AREAS.map((a) => `<option>${esc(a)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label for="e-texto">Observaciones</label><textarea class="input textarea" id="e-texto" name="texto" maxlength="3000" required></textarea></div>
        <div id="e-msg" class="form-msg" role="alert"></div>
        <button class="btn btn--primary btn--sm" type="submit">Agregar al historial</button>
      </form>
      <h3 style="margin-top:1.5rem">Historial</h3>
      <div class="timeline">${tl}</div>`;
  }

  function renderNotas() {
    const rank = { importante: 0, pendiente: 1, normal: 2 };
    const list = data.notas.slice().sort((a, b) => (rank[a.tipo] - rank[b.tipo]) || b.creada.localeCompare(a.creada));
    $("#lista-notas").innerHTML = list.length
      ? `<div class="notes-grid">${list.map((n) => {
          const who = patientName(n.pacienteId);
          return `<article class="note note--${esc(n.tipo)}">
            <h3>${esc(n.titulo)}</h3>
            ${n.texto ? `<p>${esc(n.texto)}</p>` : ""}
            <div class="note__foot"><span class="small">${esc(who || "Personal")} · ${esc(n.tipo)}</span>
            <button class="btn btn--danger btn--xs" data-action="nota-del" data-id="${esc(n.id)}">Eliminar</button></div></article>`;
        }).join("")}</div>`
      : '<div class="empty">Todavía no tienes notas.</div>';
  }

  function renderAll() {
    renderSelects();
    renderStats();
    renderResumen();
    renderCalendario();
    renderDia();
    renderLista();
    renderPacientes();
    renderNotas();
  }

  // ---------- Formulario de agenda (ventana / hoja inferior) ----------
  const dlg = () => $("#ev-dialog");
  const evForm = () => $("#ev-form");

  function syncTipoUI() {
    const f = evForm();
    const t = f.elements["tipo"].value || "cita";
    const T = TIPOS[t];
    $("#f-paciente").hidden = t !== "cita";
    $("#f-horas").hidden = f.todoDia.checked;
    const lbl = $("#l-titulo");
    lbl.textContent = t === "cita" ? "Motivo (opcional)" : T.block ? "Nota (opcional)" : "Título";
    $("#ev-motivo").placeholder = t === "cita" ? "Valoración inicial, seguimiento…" : T.block ? "Ej.: capacitación, trámite…" : "";
  }

  function openDialog(opts = {}) {
    const f = evForm();
    const c = opts.id ? data.citas.find((x) => x.id === opts.id) : null;
    f.reset();
    $("#ev-msg").className = "form-msg"; $("#ev-msg").textContent = "";
    renderSelects();

    f.elements["eid"].value = c ? c.id : "";
    f.elements["tipo"].value = c ? tipoOf(c) : (opts.tipo || "cita");
    f.pacienteId.value = c ? (c.pacienteId || "") : "";
    f.motivo.value = c ? (c.motivo || "") : "";
    f.fecha.value = c ? c.fecha : (opts.fecha || selDate);
    f.todoDia.checked = c ? Boolean(c.todoDia) : false;
    f.hora.value = c ? (c.hora || "") : "09:00";
    f.horaFin.value = c ? (c.horaFin || (c.hora && c.duracion ? fromMin(toMin(c.hora) + Number(c.duracion)) : "")) : "09:45";
    f.lugar.value = c ? (c.lugar || "") : "";
    f.urgencia.value = c && c.urgente ? "si" : "no";
    f.importancia.value = c && c.importante ? "si" : "no";

    $("#ev-titulo").textContent = c ? "Editar entrada" : "Nueva entrada";
    $("#ev-guardar").textContent = c ? "Guardar cambios" : "Guardar";
    syncTipoUI();
    if (!dlg().open) dlg().showModal();
    document.body.classList.add("dialog-open");
  }
  const closeDialog = () => { if (dlg().open) dlg().close(); };
  dlg().addEventListener("close", () => document.body.classList.remove("dialog-open"));

  function buildTipoChips() {
    $("#ev-tipos").insertAdjacentHTML("beforeend", Object.entries(TIPOS).map(([k, T]) =>
      `<label class="tipo-chip" style="--c:${T.color}"><input type="radio" name="tipo" value="${k}"><span><span aria-hidden="true">${T.icon}</span>${esc(T.label)}</span></label>`).join(""));
    $("#leyenda").innerHTML = Object.values(TIPOS).map((T) => `<span style="--c:${T.color}">${esc(T.label)}</span>`).join("");
  }

  $("#ev-form").addEventListener("change", (e) => {
    const f = evForm();
    if (e.target.name === "tipo" || e.target.name === "todoDia") syncTipoUI();
    if (e.target.name === "hora" && f.hora.value) {
      const dur = (f.elements["tipo"].value || "cita") === "cita" ? 45 : 60;
      if (!f.horaFin.value || toMin(f.horaFin.value) <= toMin(f.hora.value)) f.horaFin.value = fromMin(toMin(f.hora.value) + dur);
    }
  });

  $("#ev-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, m = $("#ev-msg");
    const tipo = f.elements["tipo"].value || "cita";
    const todoDia = f.todoDia.checked;
    const motivo = f.motivo.value.trim();
    if (!f.fecha.value) return flash(m, "Indica la fecha.");
    if (!todoDia) {
      if (!f.hora.value) return flash(m, "Indica la hora de inicio.");
      if (f.horaFin.value && toMin(f.horaFin.value) <= toMin(f.hora.value)) return flash(m, "La hora de fin debe ser posterior a la de inicio.");
    }
    if (!TIPOS[tipo].block && tipo !== "cita" && !motivo) return flash(m, "Escribe un título.");

    const id = f.elements["eid"].value || uid();
    const prev = data.citas.find((x) => x.id === id);
    const item = {
      id, tipo, estado: prev ? prev.estado : "pendiente",
      pacienteId: tipo === "cita" ? f.pacienteId.value : "",
      area: prev ? (prev.area || "") : "",
      fecha: f.fecha.value, todoDia,
      hora: todoDia ? "" : f.hora.value, horaFin: todoDia ? "" : f.horaFin.value,
      motivo, lugar: f.lugar.value.trim(),
      urgente: f.urgencia.value === "si",
      importante: f.importancia.value === "si"
    };

    const clash = findOverlap(item, id);
    if (clash && !(await askConfirm("Se cruza con «" + titleOf(clash) + "» (" + timeLabel(clash) + "). ¿Guardar de todas formas?", { titulo: "Horario cruzado", si: "Guardar" }))) return;

    if (prev) Object.assign(prev, item); else data.citas.push(item);
    selDate = item.fecha;
    const d = parse(item.fecha); cal = { y: d.getFullYear(), m: d.getMonth() };
    closeDialog();
    commit();
  });

  // Ventana emergente de confirmación (reemplaza a window.confirm)
  function askConfirm(texto, opts) {
    opts = opts || {};
    const d = $("#confirm-dialog"), si = $("#cf-si"), no = $("#cf-no");
    $("#cf-titulo").textContent = opts.titulo || "Confirmar";
    $("#cf-texto").textContent = texto;
    si.textContent = opts.si || "Aceptar";
    si.classList.toggle("btn--danger-solid", !!opts.peligro);
    si.classList.toggle("btn--primary", !opts.peligro);
    return new Promise((resolve) => {
      const done = (v) => { si.onclick = no.onclick = d.onclose = d.onclick = null; if (d.open) d.close(); resolve(v); };
      si.onclick = () => done(true);
      no.onclick = () => done(false);
      d.onclose = () => done(false);
      d.onclick = (e) => { if (e.target === d) done(false); };
      d.showModal();
      no.focus();
    });
  }

  $("#ev-cerrar").addEventListener("click", closeDialog);
  $("#ev-cancel").addEventListener("click", closeDialog);
  dlg().addEventListener("click", (e) => { if (e.target === dlg()) closeDialog(); });
  $("#btn-nuevo").addEventListener("click", () => openDialog({ fecha: selDate }));
  $("#fab-nuevo").addEventListener("click", () => openDialog({ fecha: selDate }));

  // ---------- Otros formularios ----------
  $("#paciente-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, m = $("#p-msg");
    const nombre = f.nombre.value.trim();
    if (!nombre) return flash(m, "Escribe el nombre.");
    const p = { id: uid(), nombre, documento: f.documento.value.trim(), nacimiento: f.nacimiento.value, contacto: f.contacto.value.trim(), motivo: f.motivo.value.trim(), creado: today() };
    data.pacientes.push(p);
    selected = p.id;
    f.reset();
    $("#nuevo-paciente").open = false;
    commit();
  });

  $("#nota-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, m = $("#n-msg");
    const titulo = f.titulo.value.trim();
    if (!titulo) return flash(m, "Escribe un título.");
    data.notas.push({ id: uid(), titulo, texto: f.texto.value.trim(), tipo: f.tipo.value, pacienteId: f.pacienteId.value, creada: new Date().toISOString() });
    f.titulo.value = ""; f.texto.value = "";
    commit();
    flash(m, "Nota guardada.", true);
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id !== "evo-form") return;
    e.preventDefault();
    const f = e.target, m = $("#e-msg");
    const texto = f.texto.value.trim();
    if (!texto || !f.fecha.value) return flash(m, "Completa la fecha y las observaciones.");
    data.evoluciones.push({ id: uid(), pacienteId: selected, fecha: f.fecha.value, area: f.area.value, texto });
    commit();
  });

  // ---------- Acciones ----------
  function setEstado(id, estado) { const c = data.citas.find((x) => x.id === id); if (c) { c.estado = estado; commit(); } }

  function selectDay(ds, refocus) {
    selDate = ds;
    const d = parse(ds);
    if (d.getFullYear() !== cal.y || d.getMonth() !== cal.m) cal = { y: d.getFullYear(), m: d.getMonth() };
    renderCalendario(refocus);
    renderDia();
    if (window.innerWidth <= 960) {
      $("#dia-panel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    }
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.action) {
      case "dia-ver": return selectDay(b.dataset.fecha, true);
      case "dia-nuevo": return openDialog({ fecha: selDate });
      case "ev-ok": return setEstado(id, "atendida");
      case "ev-no": return setEstado(id, "cancelada");
      case "ev-reabrir": return setEstado(id, "pendiente");
      case "ev-edit": return openDialog({ id });
      case "ev-del":
        if (await askConfirm("¿Eliminar esta entrada de la agenda?", { titulo: "Eliminar entrada", si: "Eliminar", peligro: true })) { data.citas = data.citas.filter((c) => c.id !== id); commit(); }
        return;
      case "pac-ver": selected = id; return renderPacientes();
      case "pac-del":
        if (await askConfirm("¿Eliminar este paciente con sus citas y su historial? Las notas quedarán como personales.", { titulo: "Eliminar paciente", si: "Eliminar", peligro: true })) {
          data.pacientes = data.pacientes.filter((p) => p.id !== id);
          data.citas = data.citas.filter((c) => c.pacienteId !== id);
          data.evoluciones = data.evoluciones.filter((x) => x.pacienteId !== id);
          data.notas.forEach((n) => { if (n.pacienteId === id) n.pacienteId = ""; });
          selected = null;
          commit();
        }
        return;
      case "evo-del":
        if (await askConfirm("¿Eliminar este registro del historial?", { titulo: "Eliminar registro", si: "Eliminar", peligro: true })) { data.evoluciones = data.evoluciones.filter((x) => x.id !== id); commit(); }
        return;
      case "nota-del":
        if (await askConfirm("¿Eliminar esta nota?", { titulo: "Eliminar nota", si: "Eliminar", peligro: true })) { data.notas = data.notas.filter((n) => n.id !== id); commit(); }
        return;
    }
  });

  // Calendario: navegación y vistas
  function moveMonth(delta) {
    const d = new Date(cal.y, cal.m + delta, 1);
    cal = { y: d.getFullYear(), m: d.getMonth() };
    renderCalendario();
  }
  $("#cal-prev").addEventListener("click", () => moveMonth(-1));
  $("#cal-next").addEventListener("click", () => moveMonth(1));
  $("#cal-hoy").addEventListener("click", () => selectDay(today(), false));

  function setVista(v) {
    $$(".seg__btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vista === v)));
    $("#vista-calendario").hidden = v !== "calendario";
    $("#vista-lista").hidden = v !== "lista";
    try { sessionStorage.setItem("kcarrion:vista", v); } catch (e) {}
  }
  $$(".seg__btn").forEach((b) => b.addEventListener("click", () => setVista(b.dataset.vista)));

  $("#a-filtro").addEventListener("change", renderLista);
  $("#p-buscar").addEventListener("input", renderPacientes);

  // ---------- Pestañas ----------
  function showTab(name) {
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    $$(".tab-panel").forEach((p) => { p.hidden = p.id !== "tab-" + name; });
    document.body.classList.toggle("on-agenda", name === "agenda");
    try { sessionStorage.setItem("kcarrion:tab", name); } catch (e) {}
  }
  $$(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  // ---------- Respaldo ----------
  $("#exportar").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ app: "kcarrion", version: 1, exportado: new Date().toISOString(), datos: data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kcarrion-respaldo-" + today() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    flash($("#r-msg"), "Respaldo descargado.", true);
  });

  $("#importar").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = normalize(parsed && parsed.datos ? parsed.datos : parsed);
        const total = Object.values(incoming).reduce((n, a) => n + a.length, 0);
        if (!total) return flash($("#r-msg"), "El archivo no contiene datos de kcarrion.");
        if (!(await askConfirm("Esto reemplazará tus datos actuales en este navegador. ¿Continuar?", { titulo: "Restaurar respaldo", si: "Continuar" }))) return;
        data = incoming; selected = null;
        commit();
        flash($("#r-msg"), "Datos restaurados.", true);
      } catch (err) { flash($("#r-msg"), "No se pudo leer el archivo. Verifica que sea un respaldo .json de kcarrion."); }
    };
    reader.readAsText(file);
  });

  $("#borrar-todo").addEventListener("click", async () => {
    if (!(await askConfirm("¿Borrar TODA tu información de este navegador? No se puede deshacer.", { titulo: "Borrar todo", si: "Borrar todo", peligro: true }))) return;
    data = empty(); selected = null;
    commit();
    flash($("#r-msg"), "Datos eliminados.", true);
  });

  // ---------- Inicio ----------
  (async function init() {
    user = await window.KAuth.getUser();
    if (!user) { location.replace("login.html?next=panel.html"); return; }
    KEY = "kcarrion:data:" + user.id;
    data = load();

    const nombre = (user.email || "").split("@")[0];
    $("#saludo").textContent = "Hola, " + nombre;
    $("#sesion").textContent = "Sesión iniciada como " + user.email + " · " + new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
    if (!window.KAuth.configured) $("#demo-note").style.display = "";

    buildTipoChips();
    renderAll();

    // Siempre se abre en Agenda (no se recuerda la última pestaña).
    let vista = "calendario";
    try { vista = sessionStorage.getItem("kcarrion:vista") || vista; } catch (e) {}
    setVista(vista === "lista" ? "lista" : "calendario");
    showTab("agenda");
  })();
})();
