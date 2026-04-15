import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, User, Hash, Building, BookOpen, CalendarCheck, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubjectStat {
  name: string;
  attended: number;
  total: number;
  percentage: number;
}

export default function StudentProfile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [totalClasses, setTotalClasses] = useState(0);
  const [attended, setAttended] = useState(0);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    // Get all attendance records with session+subject info
    const { data: records } = await supabase
      .from("attendance")
      .select("session_id, status, sessions(id, subject_id, subjects(name))")
      .eq("student_id", user.id);

    const attendanceRecords = records || [];
    const presentRecords = attendanceRecords.filter((r) => r.status === "present");

    // Get unique session IDs the student attended
    const attendedSessionIds = new Set(presentRecords.map((r) => r.session_id));

    // Get all sessions from teachers this student is linked to
    // We count total as all sessions the student has attendance for
    setAttended(attendedSessionIds.size);
    setTotalClasses(attendanceRecords.length);

    // Subject-wise breakdown
    const subjectMap = new Map<string, { attended: number; total: number }>();
    for (const r of attendanceRecords) {
      const subjectName = (r.sessions as any)?.subjects?.name || "Unknown";
      const entry = subjectMap.get(subjectName) || { attended: 0, total: 0 };
      entry.total++;
      if (r.status === "present") entry.attended++;
      subjectMap.set(subjectName, entry);
    }

    setSubjectStats(
      Array.from(subjectMap.entries()).map(([name, s]) => ({
        name,
        attended: s.attended,
        total: s.total,
        percentage: s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0,
      }))
    );

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const percentage = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 0;
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/student")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="font-display text-lg font-bold">My Profile</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* Profile Card */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <Avatar className="h-20 w-20 text-2xl">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-1">
              <h2 className="font-display text-xl font-bold">{profile?.full_name || "Student"}</h2>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Hash className="h-3 w-3" />
                  {profile?.roll_number || "N/A"}
                </Badge>
                {profile?.institution && (
                  <Badge variant="outline" className="gap-1">
                    <Building className="h-3 w-3" />
                    {profile.institution}
                  </Badge>
                )}
              </div>
              {(profile?.course || profile?.class || profile?.batch) && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  {profile?.course && (
                    <Badge variant="outline" className="gap-1">
                      <BookOpen className="h-3 w-3" />
                      {profile.course}
                    </Badge>
                  )}
                  {profile?.class && (
                    <Badge variant="outline" className="gap-1">
                      Class: {profile.class}
                    </Badge>
                  )}
                  {profile?.batch && (
                    <Badge variant="outline" className="gap-1">
                      Batch: {profile.batch}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <CalendarCheck className="h-5 w-5 text-primary mb-1" />
              <span className="font-display text-2xl font-bold">{attended}</span>
              <span className="text-xs text-muted-foreground">Attended</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <BookOpen className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="font-display text-2xl font-bold">{totalClasses}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-4">
              <BarChart3 className="h-5 w-5 mb-1" style={{ color: percentage >= 75 ? "hsl(var(--primary))" : percentage >= 50 ? "hsl(var(--accent))" : "hsl(var(--destructive))" }} />
              <span className={`font-display text-2xl font-bold ${percentage >= 75 ? "text-primary" : percentage >= 50 ? "text-accent" : "text-destructive"}`}>
                {percentage}%
              </span>
              <span className="text-xs text-muted-foreground">Attendance</span>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Attendance</span>
              <span className={`font-bold ${percentage >= 75 ? "text-primary" : percentage >= 50 ? "text-accent" : "text-destructive"}`}>
                {percentage}%
              </span>
            </div>
            <Progress value={percentage} className="h-3" />
          </CardContent>
        </Card>

        {/* Subject-wise Breakdown */}
        {subjectStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Subject-wise Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subjectStats.map((s) => (
                <div key={s.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.attended}/{s.total} ·{" "}
                      <span className={`font-bold ${s.percentage >= 75 ? "text-primary" : s.percentage >= 50 ? "text-accent" : "text-destructive"}`}>
                        {s.percentage}%
                      </span>
                    </span>
                  </div>
                  <Progress value={s.percentage} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
