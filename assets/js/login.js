/* Ingreso, registro, "olvidé mi contraseña" y nueva contraseña (usa KAuth de auth.js). */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // Solo se aceptan rutas relativas simples para evitar redirecciones a otros sitios.
  let next = params.get("next") || "panel.html";
  if (!/^[A-Za-z0-9_\-./]+$/.test(next) || next.startsWith("/") || next.includes("..")) next = "panel.html";

  const form = $("auth-form");
  const msg = $("msg");
  const M = params.get("modo");
  // Los enlaces de recuperación de Supabase llegan con #...type=recovery
  const isRecovery = M === "nueva" || /type=recovery/.test(location.hash);
  let mode = isRecovery ? "nueva" : M === "registro" ? "up" : M === "olvide" ? "olvide" : "in";

  const OTRA = "__otra";
  const OTROS = "__otros";

  function show(text, type) {
    msg.textContent = text;
    msg.className = "form-msg " + (type === "ok" ? "is-ok" : "is-error");
  }
  function clear() { msg.textContent = ""; msg.className = "form-msg"; }
  const vis = (id, on) => { const el = $(id); if (el) el.hidden = !on; };

  // ---------- Listas desplegables del registro ----------
  const fill = (sel, items, placeholder, extra) => {
    sel.innerHTML = '<option value="">' + placeholder + "</option>" +
      items.map((v) => `<option value="${v.replace(/"/g, "&quot;")}">${v}</option>`).join("") + (extra || "");
  };
  const KP = window.KPERU || {};
  const KA = window.KAREAS || {};

  fill($("area"), Object.keys(KA), "Selecciona tu área", `<option value="${OTROS}">Otros (escribir)</option>`);
  fill($("esp"), [], "Primero elige tu área");
  $("esp").disabled = true;
  fill($("dep"), Object.keys(KP), "Selecciona");
  fill($("prov"), [], "Provincia");
  fill($("dist"), [], "Distrito");

  function syncArea() {
    const a = $("area").value;
    const otros = a === OTROS;
    vis("field-area-otra", otros);
    vis("field-esp", !otros);
    if (otros) { vis("field-esp-otra", true); return; }
    $("esp").disabled = !a;
    if (!a) { fill($("esp"), [], "Primero elige tu área"); vis("field-esp-otra", false); return; }
    fill($("esp"), KA[a] || [], "Selecciona tu especialidad", `<option value="${OTRA}">Otra (escribir)</option>`);
    vis("field-esp-otra", false);
  }
  $("area").addEventListener("change", syncArea);
  $("esp").addEventListener("change", () => vis("field-esp-otra", $("esp").value === OTRA));

  $("dep").addEventListener("change", () => {
    const d = $("dep").value;
    fill($("prov"), d ? Object.keys(KP[d] || {}) : [], d ? "Selecciona" : "Provincia");
    $("prov").disabled = !d;
    fill($("dist"), [], "Distrito"); $("dist").disabled = true; vis("field-dist-otro", false);
  });
  $("prov").addEventListener("change", () => {
    const d = $("dep").value, p = $("prov").value;
    fill($("dist"), p ? (KP[d][p] || []) : [], p ? "Selecciona" : "Distrito", p ? `<option value="${OTRA}">Mi distrito no aparece</option>` : "");
    $("dist").disabled = !p; vis("field-dist-otro", false);
  });
  $("dist").addEventListener("change", () => vis("field-dist-otro", $("dist").value === OTRA));

  // ---------- Modos de la pantalla ----------
  const TEXTOS = {
    in:     { titulo: "Ingresa a tu espacio",     sub: "Accede a tu agenda, notas e historial de pacientes.", btn: "Ingresar" },
    up:     { titulo: "Crea tu cuenta",           sub: "Cuéntanos quién eres para armar tu espacio de trabajo.", btn: "Crear cuenta" },
    olvide: { titulo: "Recupera tu contraseña",   sub: "Escribe tu correo y te enviaremos un enlace para crear una nueva.", btn: "Enviar enlace" },
    nueva:  { titulo: "Crea una nueva contraseña", sub: "Elige una contraseña de al menos 6 caracteres.", btn: "Guardar contraseña" }
  };

  function setMode(m) {
    mode = m;
    const t = TEXTOS[m];
    const up = m === "up", ingreso = m === "in";
    $("tab-in").setAttribute("aria-selected", String(ingreso));
    $("tab-up").setAttribute("aria-selected", String(up));
    $("titulo").textContent = t.titulo;
    $("subtitulo").textContent = t.sub;
    $("enviar").textContent = t.btn;

    $("auth-tabs").style.display = (m === "in" || m === "up") ? "" : "none";
    document.querySelectorAll("[data-reg]").forEach((el) => { el.hidden = !up; });
    $("field-email").hidden = m === "nueva";
    $("field-clave").hidden = m === "olvide";
    $("l-clave").textContent = m === "nueva" ? "Nueva contraseña" : "Contraseña";
    $("field-repetir").style.display = (up || m === "nueva") ? "" : "none";
    $("link-olvide").hidden = !ingreso;
    $("alt-volver").style.display = (m === "olvide" || m === "nueva") ? "" : "none";
    $("alt-inicio").style.display = (m === "olvide" || m === "nueva") ? "none" : "";
    $("clave").autocomplete = (up || m === "nueva") ? "new-password" : "current-password";
    if (up) syncArea();
    clear();
  }

  $("tab-in").addEventListener("click", () => setMode("in"));
  $("tab-up").addEventListener("click", () => setMode("up"));
  $("a-olvide").addEventListener("click", (e) => { e.preventDefault(); setMode("olvide"); });
  $("a-volver").addEventListener("click", (e) => { e.preventDefault(); if (isRecovery) location.replace("login.html"); else setMode("in"); });
  setMode(mode);

  if (!window.KAuth.configured) $("demo-note").style.display = "";

  // Si ya hay sesión se continúa directo, salvo que venga del enlace de recuperación.
  if (!isRecovery) window.KAuth.getUser().then((u) => { if (u) location.replace(next); });

  // ---------- Envío ----------
  function leerPerfil() {
    const get = (id) => $(id).value.trim();
    const areaSel = $("area").value;
    const area = areaSel === OTROS ? get("area-otra") : areaSel;
    const esp = areaSel === OTROS ? get("esp-otra") : ($("esp").value === OTRA ? get("esp-otra") : $("esp").value);
    const dist = $("dist").value === OTRA ? get("dist-otro") : $("dist").value;
    return {
      nombre: get("nombre"),
      celular: get("celular").replace(/[\s\-().]/g, "").replace(/^\+?51(?=9\d{8}$)/, ""),
      area, especialidad: esp,
      departamento: $("dep").value, provincia: $("prov").value, distrito: dist
    };
  }

  function validarPerfil(p) {
    if (p.nombre.length < 3) return "Escribe tu nombre completo.";
    if (!/^9\d{8}$/.test(p.celular)) return "Escribe un celular válido de 9 dígitos (empieza con 9).";
    if (!p.area) return "Indica tu área.";
    if (!p.especialidad) return "Indica tu especialidad.";
    if (!p.departamento || !p.provincia) return "Selecciona tu departamento y provincia.";
    if (!p.distrito) return "Indica tu distrito.";
    return "";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    const email = form.email.value.trim();
    const clave = form.clave.value;

    if (mode !== "nueva" && !/^\S+@\S+\.\S+$/.test(email)) return show("Escribe un correo válido.");
    if (mode !== "olvide" && clave.length < 6) return show("La contraseña debe tener al menos 6 caracteres.");
    if ((mode === "up" || mode === "nueva") && clave !== form.repetir.value) return show("Las contraseñas no coinciden.");

    let perfil = null;
    if (mode === "up") {
      perfil = leerPerfil();
      const err = validarPerfil(perfil);
      if (err) return show(err);
    }

    const btn = $("enviar");
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Un momento…";

    let res;
    if (mode === "up") res = await window.KAuth.signUp(email, clave, perfil);
    else if (mode === "in") res = await window.KAuth.signIn(email, clave);
    else if (mode === "olvide") res = await window.KAuth.resetPassword(email);
    else res = await window.KAuth.updatePassword(clave);

    btn.disabled = false;
    btn.textContent = label;

    if (!res.ok) return show(res.error || "No se pudo completar. Inténtalo de nuevo.");
    if (mode === "olvide") return show(res.demo
      ? "Modo demostración: no se envían correos porque Supabase no está configurado."
      : "Listo. Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña.", "ok");
    if (res.needsConfirm) return show("Cuenta creada. Revisa tu correo y confirma tu cuenta para poder ingresar.", "ok");

    show(mode === "nueva" ? "Contraseña actualizada. Entrando a tu espacio…" : "Listo. Entrando a tu espacio…", "ok");
    setTimeout(() => location.replace(mode === "nueva" ? "panel.html" : next), 400);
  });
})();
