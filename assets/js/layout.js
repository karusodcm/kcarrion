/* Navbar y footer compartidos de kcarrion.
   Uso: <body data-root="./"> + <div id="site-navbar"></div> ... <div id="site-footer"></div>
   Requiere config.js y auth.js cargados antes (KAuth). */
(function () {
  const root = document.body.dataset.root || "./";

  const navbar = `
  <header class="navbar">
    <div class="container navbar__inner">
      <a class="brand" href="${root}index.html" aria-label="kcarrion, inicio">
        <span class="brand__mark">k</span>kcarrion
      </a>
      <nav class="nav" aria-label="Principal">
        <a href="${root}index.html#inicio">Inicio</a>
        <a href="${root}index.html#areas">Áreas</a>
        <a href="${root}index.html#recursos">Recursos</a>
        <a href="${root}index.html#capacitaciones">Capacitaciones</a>
        <a href="${root}index.html#pruebas">Pruebas</a>
        <a href="${root}index.html#herramientas">Herramientas</a>
        <a href="${root}index.html#contacto">Contacto</a>
      </nav>
      <div class="user-menu" id="user-menu">
        <button class="user-menu__btn" id="user-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="user-panel" aria-label="Cuenta de usuario">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/></svg>
          <i class="user-menu__dot" id="user-dot" hidden></i>
        </button>
        <div class="user-menu__panel" id="user-panel" hidden></div>
      </div>
      <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">☰</button>
    </div>
  </header>`;

  const footer = `
  <footer class="footer">
    <div class="container">
      <div class="footer__grid">
        <div>
          <a class="brand" href="${root}index.html"><span class="brand__mark">k</span>kcarrion</a>
          <p>Evaluación integral de la persona: medicina, enfermería, psicología y trabajo social en un mismo lugar.</p>
          <div class="social" aria-label="Redes sociales">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">ig</a>
            <a href="#" aria-label="LinkedIn">in</a>
            <a href="#" aria-label="YouTube">▶</a>
          </div>
        </div>
        <div>
          <h4>Sitio</h4>
          <ul>
            <li><a href="${root}index.html#areas">Áreas</a></li>
            <li><a href="${root}index.html#recursos">Recursos</a></li>
            <li><a href="${root}index.html#capacitaciones">Capacitaciones y talleres</a></li>
            <li><a href="${root}index.html#pruebas">Pruebas</a></li>
            <li><a href="${root}index.html#herramientas">Herramientas</a></li>
          </ul>
        </div>
        <div>
          <h4>Mi espacio</h4>
          <ul>
            <li><a href="${root}login.html">Ingresar o crear cuenta</a></li>
            <li><a href="${root}panel.html">Agenda y notas</a></li>
            <li><a href="${root}panel.html">Historial de pacientes</a></li>
          </ul>
        </div>
        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Política de datos personales</a></li>
            <li><a href="#">Términos y condiciones</a></li>
          </ul>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© ${new Date().getFullYear()} kcarrion. Todos los derechos reservados.</span>
        <span>La información de salud se trata con confidencialidad.</span>
      </div>
    </div>
  </footer>`;

  const nb = document.getElementById("site-navbar");
  const ft = document.getElementById("site-footer");
  if (nb) nb.outerHTML = navbar;
  if (ft) ft.outerHTML = footer;

  // Menú móvil
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) nav.classList.remove("is-open");
    });
  }

  // ---------- Menú de usuario ----------
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const btn = document.getElementById("user-btn");
  const panel = document.getElementById("user-panel");
  const dot = document.getElementById("user-dot");

  function row(label, value) {
    return `<div class="user-card__row"><dt>${label}</dt><dd>${value ? esc(value) : "<span class='user-card__empty'>Sin registrar</span>"}</dd></div>`;
  }

  function paint(logged, user) {
    if (!panel) return;
    dot.hidden = !logged;
    if (!logged) {
      panel.innerHTML = `
        <p class="user-card__hello">¿Aún no ingresas?</p>
        <div class="user-card__links">
          <a class="btn btn--primary btn--sm btn--block" href="${root}login.html?next=panel.html">Ingresar</a>
          <a class="btn btn--outline btn--sm btn--block" href="${root}login.html?modo=registro">Registrarse</a>
          <a class="user-card__forgot" href="${root}login.html?modo=olvide">Olvidé mi contraseña</a>
        </div>`;
      return;
    }
    if (!user) { panel.innerHTML = '<p class="user-card__hello">Cargando tu cuenta…</p>'; return; }
    const p = user.perfil || {};
    const nombre = p.nombre || (user.email || "").split("@")[0];
    const lugar = [p.departamento, p.provincia, p.distrito].filter(Boolean).join(" / ");
    panel.innerHTML = `
      <div class="user-card__head">
        <span class="user-card__avatar" aria-hidden="true">${esc((nombre[0] || "?").toUpperCase())}</span>
        <div><b>${esc(nombre)}</b><span>${esc(user.email || "")}</span></div>
      </div>
      <dl class="user-card__list">
        ${row("Nombre", p.nombre)}
        ${row("Área", p.area)}
        ${row("Especialidad", p.especialidad)}
        ${row("Celular", p.celular)}
        ${row("Correo", user.email)}
        ${row("Departamento / Provincia / Distrito", lugar)}
      </dl>
      <div class="user-card__links">
        <a class="btn btn--outline btn--sm btn--block" href="${root}panel.html">Mi panel</a>
        <a class="btn btn--outline btn--sm btn--block" href="${root}perfil.html">Editar mis datos</a>
        <button class="btn btn--primary btn--sm btn--block" type="button" id="nav-logout">Salir</button>
      </div>`;
    const out = document.getElementById("nav-logout");
    if (out) out.addEventListener("click", async () => {
      if (window.KAuth) await window.KAuth.signOut();
      location.href = root + "index.html";
    });
  }

  function setOpen(open) {
    if (!btn || !panel) return;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }
  if (btn && panel) {
    btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(panel.hidden); });
    document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { setOpen(false); btn.focus(); } });
  }

  let quick = false;
  try { quick = localStorage.getItem("kcarrion_logged") === "1"; } catch (e) {}
  paint(quick, null);
  if (window.KAuth) window.KAuth.getUser().then((u) => paint(Boolean(u), u));
})();
