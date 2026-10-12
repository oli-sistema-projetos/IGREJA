import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://oli-sistema-projetos.github.io",
]

const responseHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin") ?? ""
  const allowedOrigins = new Set([
    ...defaultAllowedOrigins,
    ...(Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((allowedOrigin) => allowedOrigin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  ])
  const corsHeaders = {
    ...responseHeaders,
    ...(allowedOrigins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  }

  if (request.method === "OPTIONS") {
    if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 })
    return new Response("ok", { headers: corsHeaders })
  }

  if (!allowedOrigins.has(origin)) {
    return Response.json({ error: "Origem não autorizada." }, { status: 403, headers: corsHeaders })
  }
  if (request.method !== "POST") {
    return Response.json({ error: "Método não permitido." }, { status: 405, headers: corsHeaders })
  }

  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Corpo JSON inválido." }, { status: 400, headers: corsHeaders })
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (query.length < 2 || query.length > 100) {
    return Response.json({ error: "A pesquisa deve ter entre 2 e 100 caracteres." }, { status: 400, headers: corsHeaders })
  }

  const apiKey = Deno.env.get("YOUTUBE_API_KEY")
  if (!apiKey) {
    console.error("Secret YOUTUBE_API_KEY não configurado.")
    return Response.json({ error: "Busca de playback não configurada no servidor." }, { status: 503, headers: corsHeaders })
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "6",
    q: `${query} playback`,
    key: apiKey,
  })

  try {
    const youtubeResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
    const data = await youtubeResponse.json() as {
      items?: Array<{
        id?: { videoId?: string }
        snippet?: {
          title?: string
          channelTitle?: string
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
        }
      }>
      error?: { message?: string }
    }

    if (!youtubeResponse.ok) {
      console.error("YouTube Data API recusou a busca.", youtubeResponse.status, data.error?.message)
      return Response.json(
        { error: "A busca no YouTube falhou. Verifique a configuração da API no Google Cloud." },
        { status: 502, headers: corsHeaders },
      )
    }

    const items = (data.items ?? []).flatMap((item) => {
      const videoId = item.id?.videoId
      const title = item.snippet?.title
      if (!videoId || !title) return []
      return [{
        id: { videoId },
        snippet: {
          title,
          channelTitle: item.snippet?.channelTitle ?? "",
          thumbnails: item.snippet?.thumbnails,
        },
      }]
    })

    return Response.json({ items }, { headers: corsHeaders })
  } catch (error) {
    console.error("Falha na comunicação com YouTube Data API.", error)
    return Response.json({ error: "Não foi possível consultar o YouTube agora." }, { status: 502, headers: corsHeaders })
  }
})
