(() => {
  const PROJECT_REF = 'mzjtdcpbvoximdukpukd';
  const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
  const PUBLISHABLE_KEY = 'sb_publishable_3krFoyWgVzrZP1g_pUy32g_iIn1AdYb';
  const RELEASE = document.querySelector('meta[name="capdent-release"]')?.content || 'clinic-admin-unknown';
  const sent = new Map();

  function getAccessToken() {
    try {
      const raw = localStorage.getItem(`sb-${PROJECT_REF}-auth-token`);
      if (!raw) return null;
      const stored = JSON.parse(raw);
      return stored?.access_token || stored?.currentSession?.access_token || null;
    } catch {
      return null;
    }
  }

  function sanitize(value, maximum = 1000) {
    return String(value || '')
      .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .slice(0, maximum);
  }

  async function report(kind, message, stack) {
    const token = getAccessToken();
    if (!token) return;

    const cleanMessage = sanitize(message) || 'Unknown Clinic Admin client error';
    const fingerprint = `${kind}:${cleanMessage}:${location.pathname}`;
    const previous = sent.get(fingerprint) || 0;
    if (Date.now() - previous < 60_000) return;
    sent.set(fingerprint, Date.now());

    const payload = {
      p_release: RELEASE,
      p_route: `${location.pathname}${location.hash}`.slice(0, 300),
      p_message: cleanMessage,
      p_stack: sanitize(stack, 4000) || null,
      p_context: {
        kind,
        online: navigator.onLine,
        visibility: document.visibilityState,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        language: navigator.language,
      },
      p_user_agent: sanitize(navigator.userAgent, 500),
    };

    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_admin_client_error`, {
        method: 'POST',
        keepalive: true,
        headers: {
          apikey: PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Monitoring must never interrupt Clinic Admin.
    }
  }

  window.addEventListener('error', (event) => {
    report('window_error', event.message, event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    report('unhandled_rejection', reason?.message || reason, reason?.stack);
  });
})();
