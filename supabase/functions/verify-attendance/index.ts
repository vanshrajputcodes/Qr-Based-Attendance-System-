import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId, token, expiry, lat, lng, deviceHash, accuracy } = await req.json();

    // Validate input
    if (!sessionId || !token || typeof expiry !== "number" || lat === undefined || lng === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (![lat, lng, expiry].every((value) => Number.isFinite(value))) {
      return new Response(JSON.stringify({ error: "Invalid attendance payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get session with room data
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("*, rooms(*)")
      .eq("id", sessionId)
      .eq("status", "active")
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: "Session not found or has ended" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = Date.now();
    const allowedSkewMs = 5000;
    const maxFutureWindowMs = 30000;
    const expectedToken = await hmacSign(session.hmac_secret, `${sessionId}:${expiry}`);
    const tokenValid = token === expectedToken && expiry >= now - allowedSkewMs && expiry <= now + maxFutureWindowMs;

    if (!tokenValid) {
      return new Response(JSON.stringify({ error: "QR expired — please scan the latest code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log geofence data (location is collected but not enforced)
    const room = session.rooms;
    if (room) {
      const distance = haversineDistance(lat, lng, room.latitude, room.longitude);
      console.log(`Student location: ${Math.round(distance)}m from room (radius: ${room.radius_meters}m)`);
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Already marked — attendance was already recorded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark attendance
    const { error: insertError } = await supabase.from("attendance").insert({
      session_id: sessionId,
      student_id: user.id,
      latitude: lat,
      longitude: lng,
      device_hash: deviceHash || null,
      status: "present",
    });

    if (insertError) {
      console.error("Insert attendance error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to mark attendance" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-link student to teacher if not already linked
    const teacherId = session.teacher_id;
    const { data: existingLink } = await supabase
      .from("teacher_students")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (!existingLink) {
      await supabase.from("teacher_students").insert({
        teacher_id: teacherId,
        student_id: user.id,
      });
    }

    return new Response(JSON.stringify({ success: true, message: "Attendance marked!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify-attendance error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
