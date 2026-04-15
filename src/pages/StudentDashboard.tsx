import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { QrCode, LogOut, CheckCircle, XCircle, Camera, Loader2, Sparkles, PartyPopper, UserCircle } from "lucide-react";
import QrScanner from "@/components/QrScanner";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import type { Tables } from "@/integrations/supabase/types";

type AttendanceRecord = Tables<"attendance"> & { sessions?: { started_at: string; subjects?: { name: string } | null; rooms?: { name: string } | null } | null };

type LocationSnapshot = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

const VERIFY_ATTENDANCE_TIMEOUT_MS = 6000;
const LOCATION_CACHE_MAX_AGE_MS = 60_000;
const LOCATION_STORAGE_KEY = "attendu:last-location";

export default function StudentDashboard() {
  const { user, profile, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationReady, setLocationReady] = useState(false);
  const locationRef = useRef<LocationSnapshot | null>(null);
  const locationRequestRef = useRef<Promise<LocationSnapshot | null> | null>(null);

  const fireConfetti = () => {
    const duration = 2000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#22c55e", "#3b82f6", "#f59e0b"] });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#22c55e", "#3b82f6", "#f59e0b"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const fetchAttendance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("attendance")
      .select("*, sessions(started_at, subjects(name), rooms:rooms!sessions_room_id_fkey(name))")
      .eq("student_id", user.id)
      .order("marked_at", { ascending: false })
      .limit(50);

    setAttendance((data as AttendanceRecord[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchAttendance();
  }, [user, fetchAttendance]);

  const isFreshLocation = useCallback((value: LocationSnapshot | null) => {
    if (!value) return false;
    return Date.now() - value.timestamp < LOCATION_CACHE_MAX_AGE_MS;
  }, []);

  const persistLocation = useCallback((value: LocationSnapshot) => {
    locationRef.current = value;
    setLocationReady(true);
    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(value));
  }, []);

  const readStoredLocation = useCallback((): LocationSnapshot | null => {
    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocationSnapshot;
      return Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng) && Number.isFinite(parsed?.timestamp)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }, []);

  const requestLocation = useCallback((options: PositionOptions) => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }, []);

  const warmLocation = useCallback(async () => {
    if (!("geolocation" in navigator)) return null;

    if (isFreshLocation(locationRef.current)) {
      setLocationReady(true);
      return locationRef.current;
    }

    const storedLocation = readStoredLocation();
    if (isFreshLocation(storedLocation)) {
      locationRef.current = storedLocation;
      setLocationReady(true);
      return storedLocation;
    }

    if (locationRequestRef.current) return locationRequestRef.current;

    locationRequestRef.current = requestLocation({
      enableHighAccuracy: true,
      timeout: 2500,
      maximumAge: LOCATION_CACHE_MAX_AGE_MS,
    })
      .then((position) => {
        const snapshot = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 50,
          timestamp: Date.now(),
        } satisfies LocationSnapshot;

        persistLocation(snapshot);
        return snapshot;
      })
      .catch(() => null)
      .finally(() => {
        locationRequestRef.current = null;
      });

    return locationRequestRef.current;
  }, [isFreshLocation, persistLocation, readStoredLocation, requestLocation]);

  useEffect(() => {
    if (!user) return;
    void warmLocation();
  }, [user, warmLocation]);

  useEffect(() => {
    if (!scanning) return;
    void warmLocation();
  }, [scanning, warmLocation]);

  const getFastLocation = useCallback(async () => {
    const currentLocation = locationRef.current;
    if (isFreshLocation(currentLocation)) return currentLocation;

    const warmedLocation = await warmLocation();
    if (warmedLocation && isFreshLocation(warmedLocation)) return warmedLocation;

    try {
      const position = await requestLocation({
        enableHighAccuracy: true,
        timeout: 3000,
        maximumAge: LOCATION_CACHE_MAX_AGE_MS,
      });

      const snapshot = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? 50,
        timestamp: Date.now(),
      } satisfies LocationSnapshot;

      persistLocation(snapshot);
      return snapshot;
    } catch (error: any) {
      const message = error?.code === 1
        ? "Location permission denied — please allow location access"
        : "Location not available fast enough — please try again";

      throw new Error(message);
    }
  }, [isFreshLocation, persistLocation, requestLocation, warmLocation]);

  const getDeviceHash = async (): Promise<string> => {
    const raw = [navigator.userAgent, navigator.language, screen.width, screen.height].join("|");
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const verifyAttendanceRequest = async (payload: {
    sessionId: string;
    token: string;
    expiry: number;
    lat: number;
    lng: number;
    accuracy: number;
    deviceHash: string;
  }) => {
    if (!session?.access_token) {
      throw new Error("Session expired — please sign in again");
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), VERIFY_ATTENDANCE_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-attendance`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : `Verification failed (${response.status})`
        );
      }

      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Verification timed out — please scan again");
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handleScan = useCallback(async (data: string) => {
    setScanning(false);
    setVerifying(true);

    try {
      let parsed: { sessionId?: string; token?: string; expiry?: number };
      try {
        parsed = JSON.parse(data);
      } catch {
        toast.error("Invalid QR code — not a valid attendance code");
        setVerifying(false);
        return;
      }

      if (!parsed.sessionId || !parsed.token || typeof parsed.expiry !== "number") {
        toast.error("Invalid QR code — missing session data");
        return;
      }

      const location = await getFastLocation();

      const deviceHash = await getDeviceHash();

      const result = await verifyAttendanceRequest({
        sessionId: parsed.sessionId,
        token: parsed.token,
        expiry: parsed.expiry,
        lat: location.lat,
        lng: location.lng,
        accuracy: location.accuracy,
        deviceHash,
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      fireConfetti();
      setSuccessAnim(true);
      toast.success("Attendance marked successfully");

      await fetchAttendance();

      setTimeout(() => setSuccessAnim(false), 3000);
    } catch (err: any) {
      console.error("Scan error:", err);
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }, [fetchAttendance, getFastLocation, session]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalClasses = attendance.length;
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">Attendu</h1>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {successAnim ? (
          <Card className="animate-scale-in border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-fade-in">
                <PartyPopper className="h-10 w-10 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-primary animate-fade-in">Attendance Marked!</h2>
              <p className="text-sm text-muted-foreground animate-fade-in">You're all set ✅</p>
            </CardContent>
          </Card>
        ) : scanning ? (
          <Card>
            <CardContent className="p-4">
              <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
            </CardContent>
          </Card>
        ) : verifying ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Marking your attendance...</p>
              <p className="text-xs text-muted-foreground">This usually completes in under 2 seconds.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Button onClick={() => setScanning(true)} className="py-8 text-base" size="lg">
              <Camera className="mr-2 h-5 w-5" /> Scan QR
            </Button>
            <Button onClick={() => navigate("/student/profile")} variant="outline" className="py-8 text-base" size="lg">
              <UserCircle className="mr-2 h-5 w-5" /> Profile
            </Button>
            <Button onClick={() => navigate("/planner")} variant="outline" className="py-8 text-base" size="lg">
              <Sparkles className="mr-2 h-5 w-5 text-accent" /> Planner
            </Button>
          </div>
        )}

        {!scanning && !verifying && !successAnim && (
          <p className="text-center text-xs text-muted-foreground">
            {locationReady ? "Location is ready for fast attendance marking." : "Enable location once to make QR scans faster."}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <span className="font-display text-2xl font-bold text-primary">{percentage}%</span>
              <span className="text-xs text-muted-foreground">Attendance</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <span className="font-display text-2xl font-bold text-success">{presentCount}</span>
              <span className="text-xs text-muted-foreground">Present</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <span className="font-display text-2xl font-bold">{totalClasses}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </CardContent>
          </Card>
        </div>

        {/* Recent Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent Attendance</CardTitle>
            <CardDescription>Your latest records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {attendance.length === 0 && <p className="text-sm text-muted-foreground">No attendance records yet.</p>}
            {attendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-3">
                  {a.status === "present" ? (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{(a.sessions as any)?.subjects?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">
                      {(a.sessions as any)?.rooms?.name} · {new Date(a.marked_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(a.marked_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}