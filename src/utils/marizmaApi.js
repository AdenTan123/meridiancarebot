export async function shutdownServer(apiKey, baseUrl) {
  if (!apiKey || !baseUrl) {
    throw new Error('API Key and Base URL must be configured via /marizma setup');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/shutdown`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      reason: 'SSU session ended via Discord bot',
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Shutdown API returned ${response.status}: ${body}`);
  }

  return response.json();
}
