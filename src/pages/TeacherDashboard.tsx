import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Plus, MapPin, Play, Square, LogOut, QrCode, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Room = Tables<"rooms">;
type Subject = Tables<"subjects">;
type Session = Tables<"sessions">;

export default function TeacherDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Create room state
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomLat, setNewRoomLat] = useState("");
  const [newRoomLng, setNewRoomLng] = useState("");
  const [newRoomRadius, setNewRoomRadius] = useState("25");
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Create subject state
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [selectedRoomForSubject, setSelectedRoomForSubject] = useState("");

  // Start session state
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const fetchData = async () => {
    if (!user) return;
    const [roomsRes, subjectsRes, sessionsRes] = await Promise.all([
      supabase.from("rooms").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false }),
      supabase.from("subjects").select("*").eq("teacher_id", user.id).order("created_at", { ascending: false }),
      supabase.from("sessions").select("*").eq("teacher_id", user.id).eq("status", "active"),
    ]);
    setRooms(roomsRes.data || []);
    setSubjects(subjectsRes.data || []);
    setActiveSessions(sessionsRes.data || []);
    setLoadingData(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const detectLocation = () => {
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewRoomLat(pos.coords.latitude.toFixed(6));
        setNewRoomLng(pos.coords.longitude.toFixed(6));
        setDetectingLocation(false);
        toast.success("Location detected!");
      },
      () => { setDetectingLocation(false); toast.error("Could not detect location"); }
    );
  };

  const createRoom = async () => {
    if (!user || !newRoomName || !newRoomLat || !newRoomLng) return;
    const { error } = await supabase.from("rooms").insert({
      teacher_id: user.id,
      name: newRoomName,
      latitude: parseFloat(newRoomLat),
      longitude: parseFloat(newRoomLng),
      radius_meters: parseInt(newRoomRadius) || 25,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Room created!");
    setRoomDialogOpen(false);
    setNewRoomName(""); setNewRoomLat(""); setNewRoomLng("");
    fetchData();
  };

  const createSubject = async () => {
    if (!user || !newSubjectName || !selectedRoomForSubject) return;
    const { error } = await supabase.from("subjects").insert({
      teacher_id: user.id,
      room_id: selectedRoomForSubject,
      name: newSubjectName,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Subject created!");
    setSubjectDialogOpen(false);
    setNewSubjectName(""); setSelectedRoomForSubject("");
    fetchData();
  };

  const startSession = async () => {
    if (!user || !selectedRoom || !selectedSubject) return;
    // Generate a random HMAC secret
    const secret = crypto.randomUUID() + crypto.randomUUID();
    const { data, error } = await supabase.from("sessions").insert({
      teacher_id: user.id,
      room_id: selectedRoom,
      subject_id: selectedSubject,
      hmac_secret: secret,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setSessionDialogOpen(false);
    navigate(`/session/${data.id}`);
  };

  const endSession = async (sessionId: string) => {
    await supabase.from("sessions").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", sessionId);
    toast.success("Session ended");
    fetchData();
  };

  const filteredSubjects = subjects.filter((s) => s.room_id === selectedRoom);

  if (loadingData) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <QrCode className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">Attendu</h1>
              <p className="text-xs text-muted-foreground">Teacher Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4">
        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="font-display text-lg text-primary">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeSessions.map((s) => {
                const room = rooms.find((r) => r.id === s.room_id);
                const subject = subjects.find((sub) => sub.id === s.subject_id);
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-card p-3">
                    <div>
                      <p className="font-medium">{subject?.name} — {room?.name}</p>
                      <p className="text-xs text-muted-foreground">Started {new Date(s.started_at).toLocaleTimeString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => navigate(`/session/${s.id}`)}>
                        <QrCode className="mr-1 h-3 w-3" /> View QR
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => endSession(s.id)}>
                        <Square className="mr-1 h-3 w-3" /> End
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto flex-col gap-2 py-6">
                <Plus className="h-5 w-5" />
                <span>Create Room</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Create Room</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Room Name</Label>
                  <Input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Room 301" />
                </div>
                <Button variant="secondary" onClick={detectLocation} disabled={detectingLocation} className="w-full">
                  <MapPin className="mr-2 h-4 w-4" />{detectingLocation ? "Detecting..." : "Auto-detect Location"}
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Latitude</Label>
                    <Input value={newRoomLat} onChange={(e) => setNewRoomLat(e.target.value)} placeholder="28.6139" />
                  </div>
                  <div className="space-y-2">
                    <Label>Longitude</Label>
                    <Input value={newRoomLng} onChange={(e) => setNewRoomLng(e.target.value)} placeholder="77.2090" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Radius (meters)</Label>
                  <Input type="number" value={newRoomRadius} onChange={(e) => setNewRoomRadius(e.target.value)} />
                </div>
                <Button onClick={createRoom} className="w-full">Create Room</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-auto flex-col gap-2 py-6" disabled={rooms.length === 0}>
                <Plus className="h-5 w-5" />
                <span>Add Subject</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Add Subject</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select value={selectedRoomForSubject} onValueChange={setSelectedRoomForSubject}>
                    <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Subject Name</Label>
                  <Input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="Data Structures" />
                </div>
                <Button onClick={createSubject} className="w-full">Add Subject</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-auto flex-col gap-2 py-6" disabled={rooms.length === 0 || subjects.length === 0}>
                <Play className="h-5 w-5" />
                <span>Start Session</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Start Attendance Session</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select value={selectedRoom} onValueChange={(v) => { setSelectedRoom(v); setSelectedSubject(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selectedRoom && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {filteredSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={startSession} className="w-full" disabled={!selectedRoom || !selectedSubject}>
                  <Play className="mr-2 h-4 w-4" /> Start Session
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Manage Students */}
        <Button variant="outline" className="w-full" onClick={() => navigate("/teacher/students")}>
          <Users className="mr-2 h-4 w-4" /> Manage Students
        </Button>

        {/* Rooms & Subjects */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Rooms ({rooms.length})</CardTitle>
              <CardDescription>Your classrooms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet. Create one to get started.</p>}
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{r.radius_meters}m radius</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Subjects ({subjects.length})</CardTitle>
              <CardDescription>Your subjects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {subjects.length === 0 && <p className="text-sm text-muted-foreground">No subjects yet. Add one after creating a room.</p>}
              {subjects.map((s) => {
                const room = rooms.find((r) => r.id === s.room_id);
                return (
                  <div key={s.id} className="rounded-lg bg-secondary/50 p-3">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{room?.name}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
