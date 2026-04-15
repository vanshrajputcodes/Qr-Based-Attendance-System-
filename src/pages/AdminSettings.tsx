import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Loader2, Settings, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminSettings() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [qrInterval, setQrInterval] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "qr_refresh_interval")
        .maybeSingle();
      if (data) setQrInterval(parseInt(data.value) || 20);
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const saveInterval = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ value: String(qrInterval), updated_at: new Date().toISOString() })
      .eq("key", "qr_refresh_interval");

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success(`QR refresh interval set to ${qrInterval} seconds`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Admin access required</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="font-display text-lg font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" /> Admin Settings
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              QR Code Refresh Timer
            </CardTitle>
            <CardDescription>
              Control how frequently the QR code rotates during attendance sessions.
              Lower values = more secure but harder to scan. Default: 20 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">3 sec</span>
                <span className="text-3xl font-bold text-primary">{qrInterval}s</span>
                <span className="text-sm text-muted-foreground">180 sec</span>
              </div>
              <Slider
                value={[qrInterval]}
                onValueChange={([v]) => setQrInterval(v)}
                min={3}
                max={180}
                step={1}
                className="w-full"
              />
              <div className="flex gap-2 flex-wrap">
                {[3, 5, 10, 20, 30, 60, 120, 180].map((v) => (
                  <Button
                    key={v}
                    variant={qrInterval === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQrInterval(v)}
                  >
                    {v}s
                  </Button>
                ))}
              </div>
            </div>
            <Button onClick={saveInterval} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Timer Setting
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
