/**
 * Frontend API client communicating with /api/* routes
 */

export async function createShareBatch(files) {
  const response = await fetch('/api/shares/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to create share batch.');
  }

  return data;
}

export async function getShareByCode(code) {
  const response = await fetch(`/api/shares/${encodeURIComponent(code)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Share not found or expired.');
  }

  return data;
}

export async function getHealthStatus() {
  try {
    const response = await fetch('/api/health');
    return await response.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}
