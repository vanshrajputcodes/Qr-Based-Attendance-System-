import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, UserPlus, Trash2, Plus, Upload, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StudentEntry {
  id: string;
  roll_number: string;
  email: string;
  full_name: string;
  class: string;
  batch: string;
  course: string;
  password: string;
}

interface ResultEntry {
  email: string;
  success: boolean;
  error?: string;
}

const emptyStudent = (): StudentEntry => ({
  id: crypto.randomUUID(),
  roll_number: "",
  email: "",
  full_name: "",
  class: "",
  batch: "",
  course: "",
  password: "",
});

export default function CreateStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentEntry[]>(
    Array.from({ length: 5 }, emptyStudent)
  );
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<ResultEntry[] | null>(null);

  const updateStudent = (id: string, field: keyof StudentEntry, value: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const addRows = (count: number) => {
    setStudents((prev) => [...prev, ...Array.from({ length: count }, emptyStudent)]);
  };

  const removeRow = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const filledStudents = students.filter(
    (s) => s.email.trim() && s.full_name.trim() && s.roll_number.trim() && s.password.trim()
  );

  const handleSubmit = async () => {
    if (!user || filledStudents.length === 0) return;
    setSubmitting(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          students: filledStudents.map((s) => ({
            email: s.email.trim(),
            password: s.password.trim(),
            full_name: s.full_name.trim(),
            roll_number: s.roll_number.trim(),
            class: s.class.trim() || null,
            batch: s.batch.trim() || null,
            course: s.course.trim() || null,
          })),
        },
      });

      if (error) {
        toast.error("Failed: " + error.message);
      } else {
        const r = data.results as ResultEntry[];
        setResults(r);
        const successCount = r.filter((x) => x.success).length;
        const failCount = r.filter((x) => !x.success).length;
        if (successCount > 0) toast.success(`${successCount} students created successfully!`);
        if (failCount > 0) toast.error(`${failCount} students failed`);

        // Remove successful entries
        const successEmails = new Set(r.filter((x) => x.success).map((x) => x.email));
        setStudents((prev) =>
          prev.filter((s) => !successEmails.has(s.email.trim()))
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/students")}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <h1 className="font-display text-lg font-bold">Create Student Accounts</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 p-4">
        {/* Results */}
        {results && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="font-display text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {r.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span>{r.email}</span>
                  {r.error && <span className="text-xs text-destructive">— {r.error}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">
              <UserPlus className="mr-2 inline h-5 w-5" />
              Add Students ({filledStudents.length} ready)
            </CardTitle>
            <CardDescription>
              Fill in student details. Roll number, email, name, and password are required. 
              Students will be automatically added to your batch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Roll No.*</TableHead>
                    <TableHead>Name*</TableHead>
                    <TableHead>Email*</TableHead>
                    <TableHead>Password*</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={s.roll_number}
                          onChange={(e) => updateStudent(s.id, "roll_number", e.target.value)}
                          placeholder="2026001"
                          className="h-8 text-xs min-w-[90px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={s.full_name}
                          onChange={(e) => updateStudent(s.id, "full_name", e.target.value)}
                          placeholder="Student Name"
                          className="h-8 text-xs min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="email"
                          value={s.email}
                          onChange={(e) => updateStudent(s.id, "email", e.target.value)}
                          placeholder="student@email.com"
                          className="h-8 text-xs min-w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="password"
                          value={s.password}
                          onChange={(e) => updateStudent(s.id, "password", e.target.value)}
                          placeholder="••••••"
                          className="h-8 text-xs min-w-[100px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={s.class}
                          onChange={(e) => updateStudent(s.id, "class", e.target.value)}
                          placeholder="10th"
                          className="h-8 text-xs min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={s.batch}
                          onChange={(e) => updateStudent(s.id, "batch", e.target.value)}
                          placeholder="A"
                          className="h-8 text-xs min-w-[60px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={s.course}
                          onChange={(e) => updateStudent(s.id, "course", e.target.value)}
                          placeholder="BCA"
                          className="h-8 text-xs min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeRow(s.id)}
                          disabled={students.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => addRows(1)}>
                <Plus className="mr-1 h-3 w-3" /> Add 1 Row
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRows(5)}>
                <Plus className="mr-1 h-3 w-3" /> Add 5 Rows
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRows(10)}>
                <Plus className="mr-1 h-3 w-3" /> Add 10 Rows
              </Button>
              <Button variant="outline" size="sm" onClick={() => addRows(20)}>
                <Plus className="mr-1 h-3 w-3" /> Add 20 Rows
              </Button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || filledStudents.length === 0}
              className="mt-6 w-full"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Create {filledStudents.length} Student{filledStudents.length !== 1 ? "s" : ""}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
