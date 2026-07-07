const BASE = '/v1/server';

async function apiFetch(endpoint, apiKey, baseUrl, options = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  const response = await fetch(url, {
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`API ${response.status}${body ? `: ${body}` : ''}`);
  }

  return response.json();
}

export async function getServerInfo(apiKey, baseUrl) {
  return apiFetch(`${BASE}`, apiKey, baseUrl);
}

export async function getServerPlayers(apiKey, baseUrl) {
  return apiFetch(`${BASE}/players`, apiKey, baseUrl);
}

export async function getServerQueue(apiKey, baseUrl) {
  return apiFetch(`${BASE}/queue`, apiKey, baseUrl);
}

export async function getServerBans(apiKey, baseUrl) {
  return apiFetch(`${BASE}/bans`, apiKey, baseUrl);
}

export async function announceMessage(apiKey, baseUrl, message) {
  return apiFetch(`${BASE}/announce`, apiKey, baseUrl, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function shutdownServer(apiKey, baseUrl) {
  return apiFetch(`${BASE}/shutdown`, apiKey, baseUrl, {
    method: 'POST',
  });
}

export async function updateServerSetting(apiKey, baseUrl, settings) {
  return apiFetch(`${BASE}/setSetting`, apiKey, baseUrl, {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export async function toggleBan(apiKey, baseUrl, userId, banned) {
  return apiFetch(`${BASE}/banplayer`, apiKey, baseUrl, {
    method: 'POST',
    body: JSON.stringify({ UserId: userId, Banned: banned }),
  });
}

export async function kickPlayer(apiKey, baseUrl, userId, reason) {
  return apiFetch(`${BASE}/moderation/kick`, apiKey, baseUrl, {
    method: 'POST',
    body: JSON.stringify({ UserId: userId, ModerationReason: reason }),
  });
}

export async function setBanner(apiKey, baseUrl, banner) {
  return apiFetch(`${BASE}/setbanner`, apiKey, baseUrl, {
    method: 'POST',
    body: JSON.stringify({ banner }),
  });
}
