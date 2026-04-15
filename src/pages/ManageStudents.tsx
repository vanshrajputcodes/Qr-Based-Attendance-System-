import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Search, UserPlus, Trash2, Loader2, Users, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StudentWithStats {
  student_id: string;
  full_name: string | null;
  roll_number: string | null;
  classes_attended: number;
  total_classes: number;
  percentage: number;
}

export default function ManageStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addRollNumber, setAddRollNumber] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchStudents = async () => {
    if (!user) return;

    // 1. Get linked student IDs
    const { data: links } = await supabase
      .from("teacher_students")
      .select("student_id")
      .eq("teacher_id", user.id);

    if (!links || links.length === 0) {
      setStudents([]);
      setLoading(false);
      return;
    }

    const studentIds = links.map((l) => l.student_id);

    // 2. Get profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, roll_number")
      .in("user_id", studentIds);

    // 3. Get total sessions by this teacher
    const { data: allSessions } = await supabase
      .from("sessions")
      .select("id")
      .eq("teacher_id", user.id);

    const totalClasses = allSessions?.length || 0;
    const sessionIds = allSessions?.map((s) => s.id) || [];

    // 4. Get attendance counts per student for teacher's sessions
    let attendanceCounts: Record<string, number> = {};
    if (sessionIds.length > 0) {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("student_id, session_id")
        .in("student_id", studentIds)
        .in("session_id", sessionIds);

      if (attendanceData) {
        for (const a of attendanceData) {
          attendanceCounts[a.student_id] = (attendanceCounts[a.student_id] || 0) + 1;
        }
      }
    }

    // 5. Merge
    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
    const result: StudentWithStats[] = studentIds.map((sid) => {
      const p = profileMap.get(sid);
      const attended = attendanceCounts[sid] || 0;
      return {
        student_id: sid,
        full_name: p?.full_name || null,
        roll_number: p?.roll_number || null,
        classes_attended: attended,
        total_classes: totalClasses,
        percentage: totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 0,
      };
    });

    result.sort((a, b) => (a.roll_number || "").localeCompare(b.roll_number || ""));
    setStudents(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [user]);

  const addStudent = async () => {
    if (!user || !addRollNumber.trim()) return;
    setAdding(true);

    // Find student by roll number
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, full_name, roll_number")
      .eq("roll_number", addRollNumber.trim())
      .maybeSingle();

    if (!profile) {
      toast.error("No student found with this roll number");
      setAdding(false);
      return;
    }

    // Check if already added
    const { data: existing } = await supabase
      .from("teacher_students")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("student_id", profile.user_id)
      .maybeSingle();

    if (existing) {
      toast.error("Student already added");
      setAdding(false);
      return;
    }

    const { error } = await supabase.from("teacher_students").insert({
      teacher_id: user.id,
      student_id: profile.user_id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${profile.full_name || "Student"} added!`);
      setAddRollNumber("");
      setAddDialogOpen(false);
      fetchStudents();
    }
    setAdding(false);
  };

  const removeStudent = async (studentId: string, name: string | null) => {
    if (!user) return;
    const { error } = await supabase
      .from("teacher_students")
      .delete()
      .eq("teacher_id", user.id)
      .eq("student_id", studentId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${name || "Student"} removed`);
      setStudents((prev) => prev.filter((s) => s.student_id !== studentId));
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        (s.full_name && s.full_name.toLowerCase().includes(q)) ||
        (s.roll_number && s.roll_number.toLowerCase().includes(q))
    );
  }, [students, searchQuery]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="font-display text-lg font-bold">Manage Students</h1>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-1 h-4 w-4" /> Add by Roll
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add Student by Roll Number</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Enter roll number"
                  value={addRollNumber}
                  onChange={(e) => setAddRollNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStudent()}
                />
                <Button onClick={addStudent} className="w-full" disabled={adding || !addRollNumber.trim()}>
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Add Student
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {/* Create Students Button */}
        <Button variant="outline" className="w-full" onClick={() => navigate("/teacher/students/create")}>
          <UserPlus className="mr-2 h-4 w-4" /> Create New Student Accounts
        </Button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="font-display text-2xl font-bold">{students.length}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <GraduationCap className="h-8 w-8 text-primary" />
              <div>
                <p className="font-display text-2xl font-bold">
                  {students.length > 0 ? Math.round(students.reduce((a, s) => a + s.percentage, 0) / students.length) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Attendance</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Students ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {students.length === 0 ? "No students added yet. Use 'Add Student' to add by roll number." : "No matching students found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Roll No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Attended</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Attendance %</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s, i) => (
                      <TableRow key={s.student_id}>
                        <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>
                          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">{s.roll_number || "—"}</span>
                        </TableCell>
                        <TableCell className="font-medium">{s.full_name || "Unknown"}</TableCell>
                        <TableCell className="text-center">{s.classes_attended}</TableCell>
                        <TableCell className="text-center">{s.total_classes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={s.percentage} className="h-2 flex-1" />
                            <span className={`text-xs font-bold ${s.percentage >= 75 ? "text-green-600" : s.percentage >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                              {s.percentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => removeStudent(s.student_id, s.full_name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
