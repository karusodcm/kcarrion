/* Pantalla de ingreso y registro (usa KAuth de auth.js). */
(function () {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // Solo se aceptan rutas relativas simples para evitar redirecciones a otros sitios.
  let next = params.get("next") || "panel.html";
  if (!/^[A-Za-z0-9_\-./]+$/.test(next) || next.startsWith("/") || next.includes("..")) next = "panel.html";

  const form = $("auth-form");
  const msg = $("msg");
  let mode = params.get("modo") === "registro" ? "up" : "in";

  function show(text, type) {
    msg.textContent = text;
    msg.className = "form-msg " + (type === "ok" ? "is-ok" : "is-error");
  }
  function clear() { msg.textContent = ""; msg.className = "form-msg"; }

  function setMode(m) {
    mode = m;
    const up = m === "up";
    $("tab-in").setAttribute("aria-selected", String(!up));
    $("tab-up").setAttribute("aria-selected", String(up));
    $("titulo").textContent = up ? "Crea tu cuenta" : "Ingresa a tu espacio";
    $("subtitulo").textContent = up
      ? "Regístrate para usar tu agenda, notas e historial de pacientes."
      : "Accede a tu agenda, notas e historial de pacientes.";
    $("enviar").textContent = up ? "Crear cuenta" : "Ingresar";
    $("field-repetir").style.display = up ? "" : "none";
    $("clave").autocomplete = up ? "new-password" : "current-password";
    clear();
  }

  $("tab-in").addEventListener("click", () => setMode("in"));
  $("tab-up").addEventListener("click", () => setMode("up"));
  setMode(mode);

  if (!window.KAuth.configured) $("demo-note").style.display = "";

  // Si ya hay sesión, se continúa directo.
  window.KAuth.getUser().then((u) => { if (u) location.replace(next); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clear();
    const email = form.email.value.trim();
    const clave = form.clave.value;

    if (!/^\S+@\S+\.\S+$/.test(email)) return show("Escribe un correo válido.");
    if (clave.length < 6) return show("La contraseña debe tener al menos 6 caracteres.");
    if (mode === "up" && clave !== form.repetir.value) return show("Las contraseñas no coinciden.");

    const btn = $("enviar");
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Un momento…";

    const res = mode === "up" ? await window.KAuth.signUp(email, clave) : await window.KAuth.signIn(email, clave);

    btn.disabled = false;
    btn.textContent = label;

    if (!res.ok) return show(res.error || "No se pudo completar. Inténtalo de nuevo.");
    if (res.needsConfirm) return show("Cuenta creada. Revisa tu correo y confirma tu cuenta para poder ingresar.", "ok");

    show("Listo. Entrando a tu espacio…", "ok");
    setTimeout(() => location.replace(next), 400);
  });
})();
