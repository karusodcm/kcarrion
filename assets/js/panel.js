/* Panel privado de kcarrion: agenda, pacientes/historial y notas.
   Los datos viven en localStorage, separados por usuario: "kcarrion:data:<id>". */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const AREAS = ["Medicina", "Enfermería", "Psicología", "Trabajo social", "Nutrición", "Rehabilitación", "Otra"];

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const today = () => fmt(new Date());
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const longDate = (s) => parse(s).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortDate = (s) => parse(s).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
  const age = (s) => {
    if (!s) return "";
    const b = parse(s), n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
    return a >= 0 && a < 130 ? a + " años" : "";
  };

  let user, KEY, data;
  let selected = null;

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
  const sortCitas = (arr) => arr.slice().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  function flash(el, text, ok) {
    el.textContent = text;
    el.className = "form-msg " + (ok ? "is-ok" : "is-error");
    if (ok) setTimeout(() => { el.className = "form-msg"; el.textContent = ""; }, 2500);
  }

  // ---------- Render ----------
  function optionsPacientes(includeNone) {
    const none = includeNone ? '<option value="">— Sin paciente (personal) —</option>' : "";
    return none + data.pacientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("");
  }

  function renderSelects() {
    const keep = (sel, html) => { const v = sel.value; sel.innerHTML = html; if ([...sel.options].some((o) => o.value === v)) sel.value = v; };
    keep($("#c-paciente"), optionsPacientes(true));
    keep($("#n-paciente"), optionsPacientes(true));
    keep($("#c-area"), AREAS.map((a) => `<option>${esc(a)}</option>`).join(""));
  }

  function citaItem(c, opts = {}) {
    const name = patientName(c.pacienteId);
    const overdue = c.estado === "pendiente" && c.fecha < today();
    const badge = c.estado === "atendida" ? '<span class="badge badge--done">Atendida</span>'
      : c.estado === "cancelada" ? '<span class="badge badge--cancel">Cancelada</span>'
      : overdue ? '<span class="badge badge--warn">Por cerrar</span>' : '<span class="badge">Pendiente</span>';
    const cls = c.estado === "atendida" ? " item--done" : c.estado === "cancelada" ? " item--cancel" : "";
    const actions = (c.estado === "pendiente"
      ? `<button class="btn btn--outline btn--xs" data-action="cita-ok" data-id="${esc(c.id)}">Atendida</button>
         <button class="btn btn--ghost btn--xs" data-action="cita-no" data-id="${esc(c.id)}">Cancelar</button>`
      : `<button class="btn btn--ghost btn--xs" data-action="cita-reabrir" data-id="${esc(c.id)}">Reabrir</button>`)
      + `<button class="btn btn--danger btn--xs" data-action="cita-del" data-id="${esc(c.id)}" aria-label="Eliminar cita">Eliminar</button>`;
    return `<div class="item${cls}">
      <div class="item__when">${esc(c.hora)}<small>${esc(shortDate(c.fecha))}</small></div>
      <div>
        <div class="item__title">${esc(c.motivo || c.area)} ${badge}</div>
        <div class="item__meta">${esc(name || "Personal")} · ${esc(c.area)}${c.duracion ? " · " + esc(c.duracion) + " min" : ""}</div>
      </div>
      ${opts.noActions ? "" : `<div class="item__actions">${actions}</div>`}
    </div>`;
  }

  function renderStats() {
    const t = today(), w = addDays(7);
    const pend = data.citas.filter((c) => c.estado === "pendiente");
    $("#st-hoy").textContent = pend.filter((c) => c.fecha === t).length;
    $("#st-semana").textContent = pend.filter((c) => c.fecha >= t && c.fecha <= w).length;
    $("#st-pac").textContent = data.pacientes.length;
    $("#st-notas").textContent = data.notas.length;
  }

  function renderResumen() {
    const t = today();
    const hoy = sortCitas(data.citas.filter((c) => c.fecha === t && c.estado === "pendiente"));
    $("#lista-hoy").innerHTML = hoy.length ? hoy.map((c) => citaItem(c)).join("") : '<div class="empty">No tienes citas pendientes para hoy.</div>';
    const cerrar = sortCitas(data.citas.filter((c) => c.estado === "pendiente" && c.fecha < t));
    $("#lista-cerrar").innerHTML = cerrar.length ? cerrar.map((c) => citaItem(c)).join("") : '<div class="empty">Todo al día. No hay citas por cerrar.</div>';
  }

  function renderAgenda() {
    const t = today();
    const f = $("#a-filtro").value;
    let list = data.citas;
    if (f === "proximas") list = list.filter((c) => c.estado === "pendiente" && c.fecha >= t);
    else if (f === "cerrar") list = list.filter((c) => c.estado === "pendiente" && c.fecha < t);
    else if (f === "cerradas") list = list.filter((c) => c.estado !== "pendiente");
    list = sortCitas(list);
    if (f === "cerradas") list.reverse();
    if (!list.length) { $("#lista-agenda").innerHTML = '<div class="empty">No hay citas en esta vista.</div>'; return; }
    let html = "", last = "";
    list.forEach((c) => {
      if (c.fecha !== last) { last = c.fecha; html += `<div class="date-head">${esc(longDate(c.fecha))}</div>`; }
      html += `<div class="list" style="margin-bottom:.5rem">${citaItem(c)}</div>`;
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
    data.evoluciones.filter((e) => e.pacienteId === p.id).forEach((e) => entries.push({ fecha: e.fecha, orden: e.fecha + "~" + e.id, tipo: "evo", e }));
    data.citas.filter((c) => c.pacienteId === p.id).forEach((c) => entries.push({ fecha: c.fecha, orden: c.fecha + (c.hora || ""), tipo: "cita", c }));
    entries.sort((a, b) => b.orden.localeCompare(a.orden));

    const tl = entries.length ? entries.map((x) => {
      if (x.tipo === "evo") {
        return `<div class="entry"><div class="entry__head"><b>${esc(shortDate(x.e.fecha))}</b><span class="badge">${esc(x.e.area)}</span><span>Evolución</span>
          <button class="btn btn--danger btn--xs" data-action="evo-del" data-id="${esc(x.e.id)}">Eliminar</button></div><p>${esc(x.e.texto)}</p></div>`;
      }
      const st = x.c.estado === "atendida" ? "Atendida" : x.c.estado === "cancelada" ? "Cancelada" : "Pendiente";
      return `<div class="entry"><div class="entry__head"><b>${esc(shortDate(x.c.fecha))}</b><span class="badge">${esc(x.c.area)}</span><span>Cita · ${esc(x.c.hora)} · ${st}</span></div>
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
    renderAgenda();
    renderPacientes();
    renderNotas();
  }

  // ---------- Formularios ----------
  $("#cita-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, m = $("#c-msg");
    if (!f.fecha.value || !f.hora.value) return flash(m, "Indica fecha y hora.");
    data.citas.push({
      id: uid(), pacienteId: f.pacienteId.value, fecha: f.fecha.value, hora: f.hora.value,
      area: f.area.value, duracion: Number(f.duracion.value) || 0, motivo: f.motivo.value.trim(), estado: "pendiente"
    });
    f.motivo.value = "";
    commit();
    flash(m, "Cita agendada.", true);
  });

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
  function setCita(id, estado) { const c = data.citas.find((x) => x.id === id); if (c) { c.estado = estado; commit(); } }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const id = b.dataset.id;
    switch (b.dataset.action) {
      case "cita-ok": return setCita(id, "atendida");
      case "cita-no": return setCita(id, "cancelada");
      case "cita-reabrir": return setCita(id, "pendiente");
      case "cita-del":
        if (confirm("¿Eliminar esta cita?")) { data.citas = data.citas.filter((c) => c.id !== id); commit(); }
        return;
      case "pac-ver": selected = id; return renderPacientes();
      case "pac-del":
        if (confirm("¿Eliminar este paciente con sus citas y su historial? Las notas quedarán como personales.")) {
          data.pacientes = data.pacientes.filter((p) => p.id !== id);
          data.citas = data.citas.filter((c) => c.pacienteId !== id);
          data.evoluciones = data.evoluciones.filter((x) => x.pacienteId !== id);
          data.notas.forEach((n) => { if (n.pacienteId === id) n.pacienteId = ""; });
          selected = null;
          commit();
        }
        return;
      case "evo-del":
        if (confirm("¿Eliminar este registro del historial?")) { data.evoluciones = data.evoluciones.filter((x) => x.id !== id); commit(); }
        return;
      case "nota-del":
        if (confirm("¿Eliminar esta nota?")) { data.notas = data.notas.filter((n) => n.id !== id); commit(); }
        return;
    }
  });

  $("#a-filtro").addEventListener("change", renderAgenda);
  $("#p-buscar").addEventListener("input", renderPacientes);

  // ---------- Pestañas ----------
  function showTab(name) {
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    $$(".tab-panel").forEach((p) => { p.hidden = p.id !== "tab-" + name; });
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
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = normalize(parsed && parsed.datos ? parsed.datos : parsed);
        const total = Object.values(incoming).reduce((n, a) => n + a.length, 0);
        if (!total) return flash($("#r-msg"), "El archivo no contiene datos de kcarrion.");
        if (!confirm("Esto reemplazará tus datos actuales en este navegador. ¿Continuar?")) return;
        data = incoming; selected = null;
        commit();
        flash($("#r-msg"), "Datos restaurados.", true);
      } catch (err) { flash($("#r-msg"), "No se pudo leer el archivo. Verifica que sea un respaldo .json de kcarrion."); }
    };
    reader.readAsText(file);
  });

  $("#borrar-todo").addEventListener("click", () => {
    if (!confirm("¿Borrar TODA tu información de este navegador? No se puede deshacer.")) return;
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

    $("#c-fecha").value = today();
    renderAll();
    let tab = "resumen";
    try { tab = sessionStorage.getItem("kcarrion:tab") || tab; } catch (e) {}
    showTab($("#tab-" + tab) ? tab : "resumen");
  })();
})();
