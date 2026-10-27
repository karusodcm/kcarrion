/* =====================================================================
   site.js · navbar y footer compartidos de kcarrion

   Este archivo vive en kcarrion/assets/. Para que una página nueva tenga navbar y
   footer, agrega en su <head> las rutas hacia assets/ según su profundidad:
     En la raíz (kcarrion/):                 assets/site.css  y  assets/site.js
     A 2 niveles (psicologia/pruebas/):      ../../assets/site.css  y  ../../assets/site.js
     A 3 niveles (.../pruebas/casm83/):      ../../../assets/site.css  y  ../../../assets/site.js
   Ejemplo:
     <link rel="stylesheet" href="../../assets/site.css">
     <script src="../../assets/site.js" defer></script>
   (y, si es una página de contenido, <body class="sx-page" data-page="clave">)

   Los enlaces del menú y del footer se escriben aquí desde la raíz del sitio
   (kcarrion/) y el script los ajusta solo según la carpeta donde esté la página.

   Para cambiar el menú, el correo o las redes, edita solo SITE aquí abajo.
   ===================================================================== */
(() => {
  'use strict';

  // Raíz del sitio (kcarrion/): una carpeta arriba de assets/, donde está este script.
  // Así los enlaces funcionan igual abriendo los archivos directamente o desde un servidor.
  const SCRIPT = document.currentScript || document.querySelector('script[src$="site.js"]');
  const RAIZ = new URL('../', SCRIPT.src);

  // ===== CONFIGURACIÓN (edita solo esta parte) =====
  const SITE = {
    nombre: 'kcarrion',
    descripcion: 'Pruebas y recursos de orientación vocacional.',
    correo: 'tu-correo@ejemplo.com', // <- pon aquí tu correo real (lo usa la página Contacto)

    // Pon la dirección de cada perfil. Mientras sea '#', el icono se ve pero no lleva a ningún sitio.
    redes: [
      { id: 'facebook', nombre: 'Facebook', url: '#' },
      { id: 'instagram', nombre: 'Instagram', url: '#' },
      { id: 'linkedin', nombre: 'LinkedIn', url: '#' },
      { id: 'youtube', nombre: 'YouTube', url: '#' },
      { id: 'x', nombre: 'X', url: '#' }
    ],

    // Las rutas (href) se escriben desde la raíz del sitio (kcarrion/).
    // clave: se compara con data-page del <body> para marcar la opción activa
    menu: [
      { clave: 'inicio', texto: 'Inicio', href: 'index.html' },
      { clave: 'pruebas', texto: 'Pruebas', href: 'psicologia/pruebas/index.html' },
      { clave: 'recursos', texto: 'Recursos', href: 'psicologia/materiales/index.html' },
      { clave: 'contacto', texto: 'Contacto', href: 'contacto.html' }
    ],

    cta: { texto: 'Hacer la prueba', href: 'psicologia/pruebas/casm83/casm83.html' },

    // Columnas extra del footer
    pruebas: [{ texto: 'Inventario CASM83-R91', href: 'psicologia/pruebas/casm83/casm83.html' }],
    recursos: [
      { texto: 'Ficha técnica', href: 'psicologia/materiales/index.html#ficha' },
      { texto: 'Escalas del inventario', href: 'psicologia/materiales/index.html#escalas' },
      { texto: 'Cómo se califica', href: 'psicologia/materiales/index.html#calificacion' }
    ]
  };
  window.SITE = SITE;

  // ===== Iconos de redes (trazos de 24x24, estilo Feather) =====
  const ICONOS = {
    facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
    instagram: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>',
    youtube: '<path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>',
    x: '<path d="M4 4l16 16"/><path d="M20 4L4 20"/>'
  };

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Enlace interno: se resuelve desde la raíz del sitio
  const url = (ruta) => esc(new URL(ruta, RAIZ).href);

  // Página actual: data-page del <body> o, si falta, la carpeta donde está
  function paginaActual() {
    const d = document.body.dataset.page;
    if (d) return d;
    const ruta = location.pathname;
    if (ruta.includes('/pruebas/')) return 'pruebas';
    if (ruta.includes('/materiales/')) return 'recursos';
    if (ruta.includes('contacto')) return 'contacto';
    return 'inicio';
  }

  function marca() {
    return `<a class="sx-brand" href="${url('index.html')}" aria-label="${esc(SITE.nombre)}, ir al inicio">
      <span class="sx-brand__mark" aria-hidden="true">${esc(SITE.nombre.charAt(0))}</span>
      <span class="sx-brand__name">${esc(SITE.nombre)}</span>
    </a>`;
  }

  function enlaces(lista) {
    return lista.map((e) => `<li><a href="${url(e.href)}">${esc(e.texto)}</a></li>`).join('');
  }

  function crearNavbar() {
    const actual = paginaActual();
    const items = SITE.menu.map((m) =>
      `<li><a class="sx-link" href="${url(m.href)}"${m.clave === actual ? ' aria-current="page"' : ''}>${esc(m.texto)}</a></li>`
    ).join('');

    const nav = document.createElement('header');
    nav.className = 'sx-nav';
    nav.id = 'sx-nav';
    nav.innerHTML = `
      <div class="sx-nav__bar">
        ${marca()}
        <nav class="sx-menu" id="sx-menu" aria-label="Principal">
          <ul>${items}</ul>
          <a class="sx-btn sx-btn--primary sx-menu__cta" href="${url(SITE.cta.href)}">${esc(SITE.cta.texto)}</a>
        </nav>
        <button class="sx-burger" type="button" aria-expanded="false" aria-controls="sx-menu" aria-label="Abrir menú">
          <span></span><span></span><span></span>
        </button>
      </div>`;
    return nav;
  }

  function crearFooter() {
    const redes = SITE.redes.map((r) => {
      const externa = r.url && r.url !== '#';
      return `<a href="${esc(r.url || '#')}" aria-label="${esc(r.nombre)}" title="${esc(r.nombre)}"${externa ? ' target="_blank" rel="noopener noreferrer"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[r.id] || ''}</svg></a>`;
    }).join('');

    const pie = document.createElement('footer');
    pie.className = 'sx-footer';
    pie.innerHTML = `
      <div class="sx-footer__grid">
        <div>
          ${marca()}
          <p class="sx-footer__desc">${esc(SITE.descripcion)}</p>
          <h3>Redes</h3>
          <div class="sx-social">${redes}</div>
        </div>
        <div>
          <h3>Enlaces principales</h3>
          <ul>${enlaces(SITE.menu)}</ul>
        </div>
        <div>
          <h3>Pruebas</h3>
          <ul>${enlaces(SITE.pruebas)}</ul>
        </div>
        <div>
          <h3>Recursos</h3>
          <ul>${enlaces(SITE.recursos)}</ul>
        </div>
      </div>
      <div class="sx-footer__bottom">
        <p>© ${new Date().getFullYear()} ${esc(SITE.nombre)}. Todos los derechos reservados.</p>
        <p>Las pruebas son orientativas y no reemplazan la evaluación de un profesional.</p>
      </div>`;
    return pie;
  }

  function activarMenuMovil(nav) {
    const boton = nav.querySelector('.sx-burger');
    const cerrar = () => {
      nav.classList.remove('is-open');
      boton.setAttribute('aria-expanded', 'false');
      boton.setAttribute('aria-label', 'Abrir menú');
    };

    boton.addEventListener('click', () => {
      const abierto = nav.classList.toggle('is-open');
      boton.setAttribute('aria-expanded', String(abierto));
      boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    });

    nav.querySelectorAll('.sx-menu a').forEach((a) => a.addEventListener('click', cerrar));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
    document.addEventListener('click', (e) => { if (!nav.contains(e.target)) cerrar(); });
    window.matchMedia('(min-width: 861px)').addEventListener('change', cerrar);
  }

  function montar() {
    if (document.getElementById('sx-nav')) return; // ya montado
    const nav = crearNavbar();
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.appendChild(crearFooter());
    activarMenuMovil(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
