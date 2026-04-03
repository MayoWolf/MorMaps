const TBA_BASE_URL = "https://www.thebluealliance.com/api/v3";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  const apiKey = process.env.TBA_API_KEY;
  const eventKey = (event.queryStringParameters?.eventKey || "2026caasv").toLowerCase();

  if (!apiKey) {
    return json(500, {
      error: "Missing TBA_API_KEY in Netlify environment variables.",
    });
  }

  try {
    const requestOptions = {
      headers: {
        "X-TBA-Auth-Key": apiKey,
      },
    };

    const [teamsResponse, matchesResponse] = await Promise.all([
      fetch(`${TBA_BASE_URL}/event/${eventKey}/teams/simple`, requestOptions),
      fetch(`${TBA_BASE_URL}/event/${eventKey}/matches/simple`, requestOptions),
    ]);

    const failingResponse = !teamsResponse.ok ? teamsResponse : !matchesResponse.ok ? matchesResponse : null;
    if (failingResponse) {
      return json(failingResponse.status, {
        error: `TBA request failed with status ${failingResponse.status}.`,
      });
    }

    const [teams, matches] = await Promise.all([teamsResponse.json(), matchesResponse.json()]);

    return json(200, {
      eventKey,
      teams,
      matches,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown TBA proxy error.",
    });
  }
};
