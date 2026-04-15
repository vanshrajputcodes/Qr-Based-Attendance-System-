import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is authenticated teacher
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check teacher role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "teacher")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only teachers can create students" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { students } = body;

    if (!Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "students array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (students.length > 50) {
      return new Response(JSON.stringify({ error: "Maximum 50 students per batch" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const s of students) {
      const { email, password, full_name, roll_number, class: studentClass, batch, course } = s;

      if (!email || !password || !full_name || !roll_number) {
        results.push({ email: email || "unknown", success: false, error: "Missing required fields" });
        continue;
      }

      if (password.length < 6) {
        results.push({ email, success: false, error: "Password must be at least 6 characters" });
        continue;
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        results.push({ email, success: false, error: createError.message });
        continue;
      }

      const userId = newUser.user.id;

      // Update profile with additional fields
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name,
          roll_number,
          class: studentClass || null,
          batch: batch || null,
          course: course || null,
          onboarded: true,
        })
        .eq("user_id", userId);

      // Assign student role
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "student" });

      // Link to teacher
      await supabaseAdmin
        .from("teacher_students")
        .insert({ teacher_id: user.id, student_id: userId });

      results.push({ email, success: true });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-student error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
