/* Autenticación de kcarrion.
   - Con SUPABASE_URL y SUPABASE_ANON_KEY en config.js: usa Supabase Auth (correo y contraseña).
   - Sin ellas: modo demostración local (no es seguridad real, solo para probar el panel).
   Expone window.KAuth. */
(function () {
  const cfg = window.KCARRION_CONFIG || {};
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js";
  const DEMO_KEY = "kcarrion_demo_session";
  const DEMO_PROFILES = "kcarrion_demo_profiles";   // perfiles del modo demostración, por correo
  const FLAG_KEY = "kcarrion_logged";

  const configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  let client = null;

  function setFlag(on) {
    try { on ? localStorage.setItem(FLAG_KEY, "1") : localStorage.removeItem(FLAG_KEY); } catch (e) {}
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) return resolve();
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar Supabase. Revisa tu conexión a internet."));
      document.head.appendChild(s);
    });
  }

  async function getClient() {
    if (client) return client;
    await loadSdk();
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  function friendly(error) {
    const m = (error && error.message) || "";
    if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/email not confirmed/i.test(m)) return "Confirma tu correo desde el mensaje que te enviamos y vuelve a ingresar.";
    if (/already registered|already been registered/i.test(m)) return "Ese correo ya tiene una cuenta. Prueba iniciar sesión.";
    if (/password should be at least/i.test(m)) return "La contraseña es muy corta (mínimo 6 caracteres).";
    if (/same password|different from the old/i.test(m)) return "La nueva contraseña debe ser distinta a la anterior.";
    if (/rate limit/i.test(m)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    return m || "Ocurrió un error. Inténtalo de nuevo.";
  }

  function demoProfiles() {
    try { return JSON.parse(localStorage.getItem(DEMO_PROFILES) || "{}") || {}; } catch (e) { return {}; }
  }
  function demoUser(email, perfil) {
    const mail = email.toLowerCase();
    const saved = perfil || demoProfiles()[mail] || null;
    return { id: "demo-" + mail, email: mail, demo: true, perfil: saved };
  }

  /** Datos del perfil guardados con el registro (user_metadata de Supabase). */
  function perfilOf(u) {
    const m = (u && u.user_metadata) || {};
    const keys = ["nombre", "celular", "area", "especialidad", "departamento", "provincia", "distrito"];
    if (!keys.some((k) => m[k])) return null;
    const p = {};
    keys.forEach((k) => { p[k] = m[k] || ""; });
    return p;
  }

  function pageUrl(name) { return new URL(name, location.href).href; }

  const KAuth = {
    configured,
    mode: configured ? "supabase" : "demo",

    /** Devuelve { id, email } si hay sesión activa, o null. */
    async getUser() {
      if (!configured) {
        try {
          const raw = localStorage.getItem(DEMO_KEY);
          const u = raw ? JSON.parse(raw) : null;
          setFlag(Boolean(u));
          return u;
        } catch (e) { return null; }
      }
      try {
        const sb = await getClient();
        const { data } = await sb.auth.getSession();
        const u = data && data.session ? data.session.user : null;
        setFlag(Boolean(u));
        return u ? { id: u.id, email: u.email, perfil: perfilOf(u) } : null;
      } catch (e) { return null; }
    },

    /** Devuelve { ok, error?, needsConfirm? } */
    async signIn(email, password) {
      if (!configured) {
        try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser(email))); } catch (e) {}
        setFlag(true);
        return { ok: true };
      }
      try {
        const sb = await getClient();
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, error: friendly(error) };
        setFlag(true);
        return { ok: true };
      } catch (e) { return { ok: false, error: friendly(e) }; }
    },

    /** perfil: { nombre, celular, area, especialidad, departamento, provincia, distrito } */
    async signUp(email, password, perfil) {
      if (!configured) {
        try {
          const all = demoProfiles();
          all[email.toLowerCase()] = perfil;
          localStorage.setItem(DEMO_PROFILES, JSON.stringify(all));
          localStorage.setItem(DEMO_KEY, JSON.stringify(demoUser(email, perfil)));
        } catch (e) {}
        setFlag(true);
        return { ok: true };
      }
      try {
        const sb = await getClient();
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: perfil || {}, emailRedirectTo: pageUrl("login.html") }
        });
        if (error) return { ok: false, error: friendly(error) };
        if (data && data.session) { setFlag(true); return { ok: true }; }
        return { ok: true, needsConfirm: true };
      } catch (e) { return { ok: false, error: friendly(e) }; }
    },

    /** Actualiza el perfil de la sesión actual. Devuelve { ok, error?, user? } */
    async updateProfile(perfil) {
      if (!configured) {
        try {
          const raw = localStorage.getItem(DEMO_KEY);
          const u = raw ? JSON.parse(raw) : null;
          if (!u) return { ok: false, error: "Tu sesión venció. Ingresa de nuevo." };
          u.perfil = perfil;
          const all = demoProfiles(); all[u.email] = perfil;
          localStorage.setItem(DEMO_PROFILES, JSON.stringify(all));
          localStorage.setItem(DEMO_KEY, JSON.stringify(u));
          return { ok: true, user: u };
        } catch (e) { return { ok: false, error: "No se pudo guardar en este navegador." }; }
      }
      try {
        const sb = await getClient();
        const { data, error } = await sb.auth.updateUser({ data: perfil });
        if (error) return { ok: false, error: friendly(error) };
        // Copia a la tabla "perfiles" (si ya ejecutaste supabase-perfiles.sql); si no existe, no pasa nada.
        try {
          await sb.from("perfiles").upsert(Object.assign({ id: data.user.id, correo: data.user.email, actualizado: new Date().toISOString() }, perfil));
        } catch (e) {}
        return { ok: true, user: { id: data.user.id, email: data.user.email, perfil: perfilOf(data.user) } };
      } catch (e) { return { ok: false, error: friendly(e) }; }
    },

    /** Envía el correo para restablecer la contraseña. */
    async resetPassword(email) {
      if (!configured) return { ok: true, demo: true };
      try {
        const sb = await getClient();
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: pageUrl("login.html?modo=nueva") });
        if (error) return { ok: false, error: friendly(error) };
        return { ok: true };
      } catch (e) { return { ok: false, error: friendly(e) }; }
    },

    /** Guarda la nueva contraseña (requiere la sesión abierta por el enlace del correo). */
    async updatePassword(password) {
      if (!configured) return { ok: false, error: "En modo demostración no hay contraseñas que restablecer." };
      try {
        const sb = await getClient();
        const { data } = await sb.auth.getSession();
        if (!data || !data.session) return { ok: false, error: "El enlace venció o ya se usó. Pide uno nuevo desde “Olvidé mi contraseña”." };
        const { error } = await sb.auth.updateUser({ password });
        if (error) return { ok: false, error: friendly(error) };
        return { ok: true };
      } catch (e) { return { ok: false, error: friendly(e) }; }
    },

    async signOut() {
      setFlag(false);
      if (!configured) {
        try { localStorage.removeItem(DEMO_KEY); } catch (e) {}
        return;
      }
      try { const sb = await getClient(); await sb.auth.signOut(); } catch (e) {}
    }
  };

  window.KAuth = KAuth;
})();
