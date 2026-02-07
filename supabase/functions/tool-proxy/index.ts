import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ToolProxyBody = {
  apiUrl: string;
  endpoint: string;
  params?: Record<string, unknown>;
};

async function fetchJson(url: string, params: Record<string, unknown>) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  });

  const text = await resp.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!resp.ok) {
    return {
      success: false,
      error: `Upstream tool API error (HTTP ${resp.status})`,
      data: {
        url,
        status: resp.status,
        body: parsed ?? text,
      },
    };
  }

  // Upstream generally already returns { success, data, error }
  if (parsed && typeof parsed === "object" && (parsed as any).success !== undefined) {
    return parsed;
  }

  return { success: true, data: parsed as Record<string, unknown> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ToolProxyBody;
    const apiUrl = body.apiUrl?.trim();
    const endpointRaw = body.endpoint?.trim();

    if (!apiUrl || !endpointRaw) {
      return new Response(JSON.stringify({ success: false, error: "Missing apiUrl or endpoint" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoint = endpointRaw.startsWith("/") ? endpointRaw : `/${endpointRaw}`;
    const params = body.params ?? {};

    // Some environments used a misspelt path (hackhaton). We try both for robustness.
    const url1 = `${apiUrl.replace(/\/$/, "")}/hackhaton${endpoint}`;
    const url2 = `${apiUrl.replace(/\/$/, "")}/hackathon${endpoint}`;

    try {
      const res1 = await fetchJson(url1, params);
      // If the endpoint exists but returns a domain-level error, pass it through.
      // Only retry the alternate path when it's an obvious 404 or network-level issue.
      if ((res1 as any)?.error && /HTTP 404/.test(String((res1 as any).error))) {
        return new Response(JSON.stringify(await fetchJson(url2, params)), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(res1), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      // Network error on the first path: retry the second path once.
      const res2 = await fetchJson(url2, params);
      return new Response(JSON.stringify(res2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("tool-proxy error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
