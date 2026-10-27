/* Autenticación de kcarrion.
   - Con SUPABASE_URL y SUPABASE_ANON_KEY en config.js: usa Supabase Auth (correo y contraseña).
   - Sin ellas: modo demostración local (no es seguridad real, solo para probar el panel).
   Expone window.KAuth. */
(function () {
  const cfg = window.KCARRION_CONFIG || {};
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js";
  const DEMO_KEY = "kcarrion_demo_session";
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
    if (/rate limit/i.test(m)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
    return m || "Ocurrió un error. Inténtalo de nuevo.";
  }

  function demoUser(email) {
    return { id: "demo-" + email.toLowerCase(), email: email.toLowerCase(), demo: true };
  }

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
        return u ? { id: u.id, email: u.email } : null;
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

    async signUp(email, password) {
      if (!configured) return KAuth.signIn(email, password);
      try {
        const sb = await getClient();
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) return { ok: false, error: friendly(error) };
        if (data && data.session) { setFlag(true); return { ok: true }; }
        return { ok: true, needsConfirm: true };
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
