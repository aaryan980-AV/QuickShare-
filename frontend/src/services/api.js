/**
 * Frontend API client communicating with /api/* routes
 */

export async function createShareBatch(files, options = {}) {
  const { password, selfDestruct, expirySeconds } = options;

  const response = await fetch('/api/shares/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files,
      clientOrigin: window.location.origin,
      password: password || undefined,
      selfDestruct: Boolean(selfDestruct),
      expirySeconds: expirySeconds ? Number(expirySeconds) : undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create share batch.');
  }

  return data;
}

export async function getShareByCode(code, password) {
  const cleanCode = String(code).replace(/\D/g, '');
  const url = password
    ? `/api/shares/${encodeURIComponent(cleanCode)}?password=${encodeURIComponent(password)}`
    : `/api/shares/${encodeURIComponent(cleanCode)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Share not found or expired.');
    error.status = response.status;
    error.requiresPassword = data.requiresPassword;
    throw error;
  }

  return data;
}

export async function notifyDownloaded(code) {
  try {
    const cleanCode = String(code).replace(/\D/g, '');
    await fetch(`/api/shares/${encodeURIComponent(cleanCode)}/downloaded`, {
      method: 'POST',
    });
  } catch (e) {
    console.warn('Could not notify download event:', e);
  }
}

export async function getHealthStatus() {
  try {
    const response = await fetch('/api/health');
    return await response.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}
