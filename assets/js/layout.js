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
      <button class="nav-toggle" aria-label="Abrir menú" aria-expanded="false">☰</button>
      <nav class="nav" aria-label="Principal">
        <a href="${root}index.html#inicio">Inicio</a>
        <a href="${root}index.html#areas">Áreas</a>
        <a href="${root}index.html#recursos">Recursos</a>
        <a href="${root}index.html#capacitaciones">Capacitaciones</a>
        <a href="${root}index.html#pruebas">Pruebas</a>
        <a href="${root}index.html#herramientas">Herramientas</a>
        <a href="${root}index.html#contacto">Contacto</a>
        <div class="nav__cta" id="nav-cta"></div>
      </nav>
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

  // Botones de acceso según la sesión
  const cta = document.getElementById("nav-cta");
  function paint(logged) {
    if (!cta) return;
    cta.innerHTML = logged
      ? `<a class="btn btn--primary btn--sm" href="${root}panel.html">Mi panel</a>
         <button class="btn btn--ghost btn--sm" type="button" id="nav-logout">Salir</button>`
      : `<a class="btn btn--ghost btn--sm" href="${root}login.html?next=panel.html">Ingresar</a>
         <a class="btn btn--primary btn--sm" href="${root}login.html?modo=registro">Crear cuenta</a>`;
    const out = document.getElementById("nav-logout");
    if (out) out.addEventListener("click", async () => {
      if (window.KAuth) await window.KAuth.signOut();
      location.href = root + "index.html";
    });
  }

  let quick = false;
  try { quick = localStorage.getItem("kcarrion_logged") === "1"; } catch (e) {}
  paint(quick);
  if (window.KAuth) window.KAuth.getUser().then((u) => paint(Boolean(u)));
})();
