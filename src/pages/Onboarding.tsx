import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { GraduationCap, BookOpen, Loader2 } from "lucide-react";

export default function Onboarding() {
  const { user, profile, role, setRole, updateProfile, loading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher" | null>(null);
  const [institution, setInstitution] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile?.onboarded && role) return <Navigate to="/" replace />;

  const handleComplete = async () => {
    if (!selectedRole) return;
    setSubmitting(true);
    try {
      const { error } = await setRole(selectedRole);
      if (error) throw error;
      await updateProfile({
        institution,
        onboarded: true,
        ...(selectedRole === "student" && rollNumber ? { roll_number: rollNumber } : {}),
      });
      toast.success("You're all set!");
    } catch (err: any) {
      toast.error(err.message || "Failed to complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Welcome to Attendu</h1>
          <p className="mt-2 text-muted-foreground">Tell us about yourself to get started</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${selectedRole === "student" ? "ring-2 ring-primary shadow-md" : ""}`}
            onClick={() => setSelectedRole("student")}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-xl ${selectedRole === "student" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                <GraduationCap className="h-7 w-7" />
              </div>
              <h3 className="font-display font-semibold">Student</h3>
              <p className="mt-1 text-xs text-muted-foreground">Scan QR to mark attendance</p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${selectedRole === "teacher" ? "ring-2 ring-primary shadow-md" : ""}`}
            onClick={() => setSelectedRole("teacher")}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-xl ${selectedRole === "teacher" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                <BookOpen className="h-7 w-7" />
              </div>
              <h3 className="font-display font-semibold">Teacher</h3>
              <p className="mt-1 text-xs text-muted-foreground">Create sessions & track</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Details</CardTitle>
            <CardDescription>Your school, college, or university</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="institution">Institution</Label>
              <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. IIT Delhi" />
            </div>
            {selectedRole === "student" && (
              <div>
                <Label htmlFor="rollNumber">Roll Number</Label>
                <Input id="rollNumber" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="e.g. 2024CS101" required />
              </div>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" disabled={!selectedRole || submitting} onClick={handleComplete}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Get Started
        </Button>
      </div>
    </div>
  );
}
