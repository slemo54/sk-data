const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function supabaseFetch(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase ${response.status}`);
  }
  return data;
}

async function getUser(authHeader) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
      Authorization: authHeader,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || 'Sessione non valida');
  }
  return data;
}

async function isAdmin(email) {
  if (email === 'kim@mammajumboshrimp.com') return true;
  try {
    const rows = await supabaseFetch(`/rest/v1/admin_whitelist?select=email&email=eq.${encodeURIComponent(email)}&limit=1`);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    send(res, 500, { error: 'Server delete non configurato' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      send(res, 401, { error: 'Sessione mancante' });
      return;
    }

    const { contactId } = await readBody(req);
    if (!contactId || typeof contactId !== 'string') {
      send(res, 400, { error: 'contactId mancante' });
      return;
    }

    const user = await getUser(authHeader);
    const email = user.email;
    if (!email) {
      send(res, 401, { error: 'Email utente non trovata' });
      return;
    }

    const contacts = await supabaseFetch(`/rest/v1/contacts?select=id,assigned_to&id=eq.${encodeURIComponent(contactId)}&limit=1`);
    const contact = contacts?.[0];
    if (!contact) {
      send(res, 404, { error: 'Contatto non trovato' });
      return;
    }

    const allowed = contact.assigned_to === email || await isAdmin(email);
    if (!allowed) {
      send(res, 403, { error: 'Puoi eliminare solo contatti assegnati a te' });
      return;
    }

    const deleted = await supabaseFetch(`/rest/v1/contacts?id=eq.${encodeURIComponent(contactId)}&select=id`, {
      method: 'DELETE',
      headers: {
        Prefer: 'return=representation',
      },
    });

    if (!deleted?.length) {
      send(res, 409, { error: 'Il database non ha cancellato il contatto' });
      return;
    }

    send(res, 200, { id: deleted[0].id });
  } catch (error) {
    send(res, 500, { error: error.message || 'Eliminazione fallita' });
  }
}
