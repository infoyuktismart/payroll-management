declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-token",
};

serve(async (req: Request) => {
  // 1. Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Security Check: Validate Hardware Device Authorization Token
    const deviceToken = req.headers.get("x-device-token");
    if (!deviceToken) {
      return new Response(JSON.stringify({ error: "Missing authorization device token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query active biometric device profiles
    const { data: device, error: devError } = await supabase
      .from("biometric_devices")
      .select("*")
      .eq("secret_token", deviceToken)
      .eq("is_active", true)
      .single();

    if (devError || !device) {
      return new Response(JSON.stringify({ error: "Unauthorized or inactive hardware device connection" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse Device Punch JSON Payload
    const body = await req.json();
    const { user_id, timestamp } = body;

    if (!user_id || !timestamp) {
      return new Response(JSON.stringify({ error: "Missing required fields: user_id and timestamp" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Map Device Badge ID to Employee Record
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id")
      .eq("biometric_id", user_id.toString())
      .single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: `Biometric User ID ${user_id} not mapped to any active employee profile` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const punchDate = new Date(timestamp).toISOString().split("T")[0];
    const punchTime = new Date(timestamp).toISOString();

    // 5. Query Existing Punches to Toggle Check-In vs Check-Out
    const { data: existingPunch } = await supabase
      .from("attendance_punches")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("date", punchDate)
      .maybeSingle();

    if (!existingPunch) {
      // First punch -> Create new attendance punch row as Check-In
      const { error: insertError } = await supabase
        .from("attendance_punches")
        .insert({
          employee_id: employee.id,
          date: punchDate,
          punch_in: punchTime,
          ip_address: `Hardware Webhook: ${device.device_name} (${device.location})`
        });

      if (insertError) throw insertError;
      return new Response(JSON.stringify({ message: "Check-In recorded successfully" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Subsequent punch -> Update check-out timestamp and working hours calculation
      const checkInTime = new Date(existingPunch.punch_in);
      const checkOutTime = new Date(punchTime);
      const workingHours = ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2);

      const { error: updateError } = await supabase
        .from("attendance_punches")
        .update({
          punch_out: punchTime,
          working_hours: parseFloat(workingHours)
        })
        .eq("id", existingPunch.id);

      if (updateError) throw updateError;
      return new Response(JSON.stringify({ message: "Check-Out updated successfully", hours: workingHours }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
