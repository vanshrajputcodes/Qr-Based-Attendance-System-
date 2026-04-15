import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Square, Users, Clock, Monitor, Loader2, CheckCircle, UserPlus, Search } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const DEFAULT_QR_ROTATE_INTERVAL = 20; // seconds fallback

interface AttendanceWithProfile {
  id: string;
  student_id: string;
  marked_at: string;
  status: string;
  profiles: { full_name: string | null; roll_number: string | null } | null;
}

export default function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<Tables<"sessions"> | null>(null);
  const [room, setRoom] = useState<Tables<"rooms"> | null>(null);
  const [subject, setSubject] = useState<Tables<"subjects"> | null>(null);
  const [qrData, setQrData] = useState("");
  const [countdown, setCountdown] = useState(DEFAULT_QR_ROTATE_INTERVAL);
  const [qrInterval, setQrInterval] = useState(DEFAULT_QR_ROTATE_INTERVAL);
  const [attendanceList, setAttendanceList] = useState<AttendanceWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tvMode, setTvMode] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [teacherStudents, setTeacherStudents] = useState<{ student_id: string; full_name: string | null; roll_number: string | null }[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const fetchAttendance = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await supabase
      .from("attendance")
      .select("id, student_id, marked_at, status")
      .eq("session_id", sessionId)
      .order("marked_at", { ascending: false });

    if (data && data.length > 0) {
      // Fetch profile names for all students
      const studentIds = data.map((a) => a.student_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, roll_number")
        .in("user_id", studentIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, { full_name: p.full_name, roll_number: p.roll_number }]) || []);

      setAttendanceList(
        data.map((a) => ({
          ...a,
          profiles: profileMap.get(a.student_id) || { full_name: null, roll_number: null },
        }))
      );
    } else {
      setAttendanceList([]);
    }
  }, [sessionId]);

  // Fetch session data
  useEffect(() => {
    if (!sessionId || !user) return;
    const fetchSession = async () => {
      const { data: sessionData } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (!sessionData) { navigate("/"); return; }
      setSession(sessionData);

      const [roomRes, subjectRes] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", sessionData.room_id).single(),
        supabase.from("subjects").select("*").eq("id", sessionData.subject_id).single(),
      ]);
      setRoom(roomRes.data);
      setSubject(subjectRes.data);
      setLoading(false);
    };
    fetchSession();
    fetchAttendance();
  }, [sessionId, user, fetchAttendance]);

  // Generate QR token
  // Fetch QR interval setting
  useEffect(() => {
    const fetchInterval = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "qr_refresh_interval")
        .maybeSingle();
      if (data) {
        const val = parseInt(data.value) || DEFAULT_QR_ROTATE_INTERVAL;
        setQrInterval(val);
        setCountdown(val);
      }
    };
    fetchInterval();
  }, []);

  const generateQrToken = useCallback(async () => {
    if (!sessionId || !session) return;
    try {
      const { data, error } = await supabase.functions.invoke("generate-qr-token", {
        body: { sessionId },
      });
      if (error) throw error;
      setQrData(JSON.stringify({ sessionId, token: data.token, expiry: data.expiry }));
      setCountdown(qrInterval);
    } catch (err) {
      console.error("Failed to generate QR token:", err);
    }
  }, [sessionId, session, qrInterval]);

  // QR rotation
  useEffect(() => {
    if (!session || session.status !== "active") return;
    generateQrToken();
    const interval = setInterval(generateQrToken, qrInterval * 1000);
    return () => clearInterval(interval);
  }, [session, generateQrToken, qrInterval]);

  // Countdown timer
  useEffect(() => {
    if (!session || session.status !== "active") return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? qrInterval : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [session, qrInterval]);

  // Realtime attendance subscription
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance", filter: `session_id=eq.${sessionId}` },
        () => {
          // Refresh the full attendance list to get student names
          fetchAttendance();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchAttendance]);

  useEffect(() => {
    if (!sessionId || session?.status !== "active") return;

    const interval = window.setInterval(() => {
      fetchAttendance();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [sessionId, session?.status, fetchAttendance]);

  const fetchTeacherStudents = async () => {
    if (!user) return;
    setLoadingStudents(true);
    const { data: links } = await supabase
      .from("teacher_students")
      .select("student_id")
      .eq("teacher_id", user.id);

    if (links && links.length > 0) {
      const sids = links.map((l) => l.student_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, roll_number")
        .in("user_id", sids);

      setTeacherStudents(
        (profiles || []).map((p) => ({ student_id: p.user_id, full_name: p.full_name, roll_number: p.roll_number }))
      );
    }
    setLoadingStudents(false);
  };

  const handleManualOpen = (open: boolean) => {
    setManualDialogOpen(open);
    if (open) {
      setSelectedStudents(new Set());
      setManualSearch("");
      fetchTeacherStudents();
    }
  };

  const toggleStudent = (sid: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  const markManualAttendance = async () => {
    if (!sessionId || selectedStudents.size === 0) return;
    setMarkingAttendance(true);

    const alreadyMarked = new Set(attendanceList.map((a) => a.student_id));
    const toMark = [...selectedStudents].filter((sid) => !alreadyMarked.has(sid));

    if (toMark.length === 0) {
      toast.error("Selected students are already marked present");
      setMarkingAttendance(false);
      return;
    }

    const rows = toMark.map((sid) => ({
      session_id: sessionId,
      student_id: sid,
      status: "present" as const,
    }));

    const { error } = await supabase.from("attendance").insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${toMark.length} student(s) marked present!`);
      setManualDialogOpen(false);
      fetchAttendance();
    }
    setMarkingAttendance(false);
  };

  const filteredTeacherStudents = teacherStudents.filter((s) => {
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return (s.full_name?.toLowerCase().includes(q)) || (s.roll_number?.toLowerCase().includes(q));
  });

  const endSession = async () => {
    if (!sessionId) return;
    await supabase.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
    toast.success("Session ended");
    navigate("/");
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!session) return null;

  const presentCount = attendanceList.length;

  if (tvMode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-foreground">{subject?.name}</h1>
          <p className="mt-2 text-xl text-muted-foreground">{room?.name}</p>
        </div>
        <div className="rounded-3xl bg-card p-8 shadow-2xl">
          {qrData ? (
            <QRCodeSVG value={qrData} size={400} level="H" includeMargin />
          ) : (
            <div className="flex h-[400px] w-[400px] items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          )}
        </div>
        <div className="mt-8 flex items-center gap-8">
          <div className="flex items-center gap-2 text-2xl">
            <Users className="h-8 w-8 text-primary" />
            <span className="font-display font-bold">{presentCount}</span>
            <span className="text-muted-foreground">present</span>
          </div>
          <div className="flex items-center gap-2 text-2xl">
            <Clock className="h-8 w-8 text-warning" />
            <span className="font-display font-bold">{countdown}s</span>
          </div>
        </div>
        <Button variant="ghost" className="mt-6" onClick={() => setTvMode(false)}>Exit TV Mode</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setTvMode(true)}>
              <Monitor className="mr-1 h-4 w-4" /> TV Mode
            </Button>
            <Button variant="destructive" size="sm" onClick={endSession}>
              <Square className="mr-1 h-4 w-4" /> End Session
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-4">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">{subject?.name}</h1>
          <p className="text-muted-foreground">{room?.name}</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center p-6">
            {qrData ? (
              <QRCodeSVG value={qrData} size={280} level="H" includeMargin />
            ) : (
              <div className="flex h-[280px] w-[280px] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            )}
            <div className="mt-4 flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning" />
              <span>Refreshes in <strong>{countdown}s</strong></span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center p-6">
              <Users className="mb-2 h-8 w-8 text-primary" />
              <span className="font-display text-3xl font-bold">{presentCount}</span>
              <span className="text-sm text-muted-foreground">Present</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-6">
              <Clock className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="font-display text-3xl font-bold">
                {Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000)}
              </span>
              <span className="text-sm text-muted-foreground">Minutes</span>
            </CardContent>
          </Card>
        </div>

        {/* Attendance List with Student Names */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-lg">Students Present ({presentCount})</CardTitle>
            <Dialog open={manualDialogOpen} onOpenChange={handleManualOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <UserPlus className="mr-1 h-4 w-4" /> Manual Add
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="font-display">Mark Attendance Manually</DialogTitle>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or roll number..."
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex-1 overflow-y-auto max-h-[50vh] border rounded-md">
                  {loadingStudents ? (
                    <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                  ) : filteredTeacherStudents.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No students found. Add students from Manage Students first.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Roll No.</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTeacherStudents.map((s) => {
                          const alreadyPresent = attendanceList.some((a) => a.student_id === s.student_id);
                          return (
                            <TableRow key={s.student_id} className={alreadyPresent ? "opacity-50" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={alreadyPresent || selectedStudents.has(s.student_id)}
                                  disabled={alreadyPresent}
                                  onCheckedChange={() => toggleStudent(s.student_id)}
                                />
                              </TableCell>
                              <TableCell>
                                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{s.roll_number || "—"}</span>
                              </TableCell>
                              <TableCell className="font-medium">{s.full_name || "Unknown"}</TableCell>
                              <TableCell className="text-center">
                                {alreadyPresent ? (
                                  <span className="text-xs text-green-600 font-medium">✓ Present</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <Button
                  onClick={markManualAttendance}
                  disabled={selectedStudents.size === 0 || markingAttendance}
                  className="w-full"
                >
                  {markingAttendance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Mark {selectedStudents.size} Student(s) Present
                </Button>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {attendanceList.length === 0 && (
              <p className="text-sm text-muted-foreground">No students have scanned yet.</p>
            )}
            {attendanceList.map((a, index) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                  <div>
                    <span className="text-sm font-medium">{a.profiles?.full_name || "Unknown Student"}</span>
                    {a.profiles?.roll_number && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{a.profiles.roll_number}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.marked_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}