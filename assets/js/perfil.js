/* Edición de los datos del perfil (usa KAuth de auth.js). */
(function () {
  const $ = (id) => document.getElementById(id);
  const KP = window.KPERU || {}, KA = window.KAREAS || {};
  const OTRA = "__otra", OTROS = "__otros";
  const msg = $("msg");
  const vis = (id, on) => { $(id).hidden = !on; };
  const show = (t, ok) => { msg.textContent = t; msg.className = "form-msg " + (ok ? "is-ok" : "is-error"); };
  const clear = () => { msg.textContent = ""; msg.className = "form-msg"; };
  const fill = (sel, items, ph, extra) => {
    sel.innerHTML = '<option value="">' + ph + "</option>" +
      items.map((v) => `<option value="${v.replace(/"/g, "&quot;")}">${v}</option>`).join("") + (extra || "");
  };

  fill($("area"), Object.keys(KA), "Selecciona tu área", `<option value="${OTROS}">Otros (escribir)</option>`);
  fill($("dep"), Object.keys(KP), "Selecciona");

  function syncArea() {
    const a = $("area").value, otros = a === OTROS;
    vis("field-area-otra", otros);
    vis("field-esp", !otros);
    if (otros) { vis("field-esp-otra", true); return; }
    $("esp").disabled = !a;
    fill($("esp"), a ? (KA[a] || []) : [], a ? "Selecciona tu especialidad" : "Primero elige tu área", a ? `<option value="${OTRA}">Otra (escribir)</option>` : "");
    vis("field-esp-otra", false);
  }
  function syncDep() {
    const d = $("dep").value;
    fill($("prov"), d ? Object.keys(KP[d] || {}) : [], d ? "Selecciona" : "Provincia");
    $("prov").disabled = !d;
    fill($("dist"), [], "Distrito"); $("dist").disabled = true; vis("field-dist-otro", false);
  }
  function syncProv() {
    const d = $("dep").value, p = $("prov").value;
    fill($("dist"), p ? (KP[d][p] || []) : [], p ? "Selecciona" : "Distrito", p ? `<option value="${OTRA}">Mi distrito no aparece</option>` : "");
    $("dist").disabled = !p; vis("field-dist-otro", false);
  }
  $("area").addEventListener("change", syncArea);
  $("esp").addEventListener("change", () => vis("field-esp-otra", $("esp").value === OTRA));
  $("dep").addEventListener("change", syncDep);
  $("prov").addEventListener("change", syncProv);
  $("dist").addEventListener("change", () => vis("field-dist-otro", $("dist").value === OTRA));

  // Carga los valores guardados en los campos
  function cargar(user) {
    const p = user.perfil || {};
    $("nombre").value = p.nombre || "";
    $("email").value = user.email || "";
    $("celular").value = p.celular || "";

    if (p.area && KA[p.area]) $("area").value = p.area;
    else if (p.area) { $("area").value = OTROS; $("area-otra").value = p.area; }
    syncArea();
    if ($("area").value === OTROS) $("esp-otra").value = p.especialidad || "";
    else if (p.especialidad && (KA[p.area] || []).includes(p.especialidad)) $("esp").value = p.especialidad;
    else if (p.especialidad) { $("esp").value = OTRA; $("esp-otra").value = p.especialidad; vis("field-esp-otra", true); }

    if (p.departamento && KP[p.departamento]) {
      $("dep").value = p.departamento; syncDep();
      if (p.provincia && KP[p.departamento][p.provincia]) {
        $("prov").value = p.provincia; syncProv();
        if (p.distrito && KP[p.departamento][p.provincia].includes(p.distrito)) $("dist").value = p.distrito;
        else if (p.distrito) { $("dist").value = OTRA; $("dist-otro").value = p.distrito; vis("field-dist-otro", true); }
      }
    }
  }

  function leer() {
    const g = (id) => $(id).value.trim();
    const a = $("area").value;
    return {
      nombre: g("nombre"),
      celular: g("celular").replace(/[\s\-().]/g, "").replace(/^\+?51(?=9\d{8}$)/, ""),
      area: a === OTROS ? g("area-otra") : a,
      especialidad: a === OTROS ? g("esp-otra") : ($("esp").value === OTRA ? g("esp-otra") : $("esp").value),
      departamento: $("dep").value, provincia: $("prov").value,
      distrito: $("dist").value === OTRA ? g("dist-otro") : $("dist").value
    };
  }
  function validar(p) {
    if (p.nombre.length < 3) return "Escribe tu nombre completo.";
    if (!/^9\d{8}$/.test(p.celular)) return "Escribe un celular válido de 9 dígitos (empieza con 9).";
    if (!p.area) return "Indica tu área.";
    if (!p.especialidad) return "Indica tu especialidad.";
    if (!p.departamento || !p.provincia) return "Selecciona tu departamento y provincia.";
    if (!p.distrito) return "Indica tu distrito.";
    return "";
  }

  window.KAuth.getUser().then((user) => {
    if (!user) { location.replace("login.html?next=perfil.html"); return; }
    cargar(user);
    $("perfil-form").addEventListener("submit", async (e) => {
      e.preventDefault(); clear();
      const perfil = leer(), err = validar(perfil);
      if (err) return show(err);
      const btn = $("guardar"), label = btn.textContent;
      btn.disabled = true; btn.textContent = "Guardando…";
      const res = await window.KAuth.updateProfile(perfil);
      btn.disabled = false; btn.textContent = label;
      if (!res.ok) return show(res.error || "No se pudieron guardar los cambios.");
      show("Datos actualizados.", true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
})();
