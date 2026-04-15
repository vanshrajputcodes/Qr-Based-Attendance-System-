import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import {
  Sparkles, ArrowLeft, Plus, Check, Clock, Star, BookOpen,
  Trash2, Loader2, Lightbulb, Target, Flame
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

const CATEGORIES = [
  "Mathematics", "Science", "English", "History", "Coding",
  "Art", "Reading", "Music", "Physical Fitness", "General Study",
];

const CATEGORY_ICONS: Record<string, string> = {
  Mathematics: "📐", Science: "🔬", English: "📝", History: "📜",
  Coding: "💻", Art: "🎨", Reading: "📖", Music: "🎵",
  "Physical Fitness": "💪", "General Study": "📚",
};

interface TaskTemplate {
  id: string;
  category: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  difficulty: number;
}

interface StudentInterest {
  id: string;
  category: string;
  proficiency: number;
}

interface StudentTask {
  id: string;
  template_id: string | null;
  custom_title: string | null;
  status: string;
  planned_date: string;
  completed_at: string | null;
  notes: string | null;
  task_templates?: { title: string; category: string; duration_minutes: number } | null;
}

export default function FreePeriodPlanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [interests, setInterests] = useState<StudentInterest[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [interestDialogOpen, setInterestDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [proficiency, setProficiency] = useState([3]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("student_interests").select("*").eq("student_id", user.id),
      supabase.from("task_templates").select("*"),
      supabase.from("student_tasks")
        .select("*, task_templates(title, category, duration_minutes)")
        .eq("student_id", user.id)
        .eq("planned_date", new Date().toISOString().split("T")[0])
        .order("created_at", { ascending: false }),
    ]).then(([intRes, tmplRes, taskRes]) => {
      setInterests((intRes.data as StudentInterest[]) || []);
      setTemplates((tmplRes.data as TaskTemplate[]) || []);
      setTasks((taskRes.data as StudentTask[]) || []);
      setLoading(false);
    });
  }, [user]);

  const suggestedTasks = useMemo(() => {
    if (interests.length === 0) return [];

    const interestMap = new Map(interests.map((i) => [i.category, i.proficiency]));
    const todayTaskTemplateIds = new Set(tasks.map((t) => t.template_id));

    return templates
      .filter((t) => interestMap.has(t.category) && !todayTaskTemplateIds.has(t.id))
      .map((t) => {
        const prof = interestMap.get(t.category)!;
        // Higher score = better match. Prefer tasks close to proficiency level
        const diffMatch = 5 - Math.abs(t.difficulty - prof);
        const interestBoost = prof;
        return { ...t, score: diffMatch * 2 + interestBoost };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [interests, templates, tasks]);

  const addInterest = async () => {
    if (!selectedCategory || !user) return;
    const existing = interests.find((i) => i.category === selectedCategory);
    if (existing) {
      await supabase
        .from("student_interests")
        .update({ proficiency: proficiency[0] })
        .eq("id", existing.id);
      setInterests((prev) =>
        prev.map((i) => (i.id === existing.id ? { ...i, proficiency: proficiency[0] } : i))
      );
    } else {
      const { data } = await supabase
        .from("student_interests")
        .insert({ student_id: user.id, category: selectedCategory, proficiency: proficiency[0] })
        .select()
        .single();
      if (data) setInterests((prev) => [...prev, data as StudentInterest]);
    }
    toast.success(`${selectedCategory} saved!`);
    setSelectedCategory(null);
    setProficiency([3]);
    setInterestDialogOpen(false);
  };

  const removeInterest = async (id: string) => {
    await supabase.from("student_interests").delete().eq("id", id);
    setInterests((prev) => prev.filter((i) => i.id !== id));
    toast.success("Interest removed");
  };

  const addTaskFromTemplate = async (template: TaskTemplate) => {
    if (!user) return;
    const { data } = await supabase
      .from("student_tasks")
      .insert({
        student_id: user.id,
        template_id: template.id,
        planned_date: new Date().toISOString().split("T")[0],
      })
      .select("*, task_templates(title, category, duration_minutes)")
      .single();
    if (data) {
      setTasks((prev) => [data as StudentTask, ...prev]);
      toast.success("Task added to your plan!");
    }
  };

  const toggleTaskComplete = async (task: StudentTask) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const completedAt = newStatus === "completed" ? new Date().toISOString() : null;
    await supabase
      .from("student_tasks")
      .update({ status: newStatus, completed_at: completedAt })
      .eq("id", task.id);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus, completed_at: completedAt } : t))
    );
  };

  const deleteTask = async (id: string) => {
    await supabase.from("student_tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalMinutes = tasks.reduce(
    (sum, t) => sum + ((t.task_templates as any)?.duration_minutes || 0),
    0
  );

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/student")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold">Free-Period Planner</h1>
              <p className="text-xs text-muted-foreground">Smart task suggestions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="flex flex-col items-center p-3">
              <Target className="mb-1 h-5 w-5 text-primary" />
              <span className="font-display text-xl font-bold">{tasks.length}</span>
              <span className="text-xs text-muted-foreground">Planned</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-3">
              <Flame className="mb-1 h-5 w-5 text-accent" />
              <span className="font-display text-xl font-bold">{completedCount}</span>
              <span className="text-xs text-muted-foreground">Done</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center p-3">
              <Clock className="mb-1 h-5 w-5 text-muted-foreground" />
              <span className="font-display text-xl font-bold">{totalMinutes}</span>
              <span className="text-xs text-muted-foreground">Minutes</span>
            </CardContent>
          </Card>
        </div>

        {/* Interests Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base">Your Interests</CardTitle>
              <Dialog open={interestDialogOpen} onOpenChange={setInterestDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Interest</DialogTitle>
                    <DialogDescription>
                      Select a category and rate your proficiency
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <Badge
                          key={cat}
                          variant={selectedCategory === cat ? "default" : "outline"}
                          className="cursor-pointer text-sm"
                          onClick={() => setSelectedCategory(cat)}
                        >
                          {CATEGORY_ICONS[cat]} {cat}
                        </Badge>
                      ))}
                    </div>
                    {selectedCategory && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Proficiency</span>
                          <span className="text-sm text-muted-foreground">
                            {proficiency[0] === 1
                              ? "Beginner"
                              : proficiency[0] === 2
                                ? "Elementary"
                                : proficiency[0] === 3
                                  ? "Intermediate"
                                  : proficiency[0] === 4
                                    ? "Advanced"
                                    : "Expert"}
                          </span>
                        </div>
                        <Slider
                          value={proficiency}
                          onValueChange={setProficiency}
                          min={1}
                          max={5}
                          step={1}
                        />
                        <Button className="mt-3 w-full" onClick={addInterest}>
                          Save Interest
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {interests.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                <Lightbulb className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                Add your interests to get personalized task suggestions!
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => (
                  <Badge
                    key={i.id}
                    variant="secondary"
                    className="group cursor-pointer gap-1 pr-1 text-sm"
                    onClick={() => removeInterest(i.id)}
                  >
                    {CATEGORY_ICONS[i.category]} {i.category}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {"★".repeat(i.proficiency)}
                    </span>
                    <Trash2 className="ml-1 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 text-destructive" />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggestions */}
        {suggestedTasks.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" /> Suggested for You
              </CardTitle>
              <CardDescription>Based on your interests & proficiency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestedTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border bg-secondary/30 p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{CATEGORY_ICONS[t.category]}</span>
                      <span className="text-sm font-medium">{t.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {t.duration_minutes}m
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" /> {"★".repeat(t.difficulty)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => addTaskFromTemplate(t)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Today's Plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Today's Plan
            </CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No tasks planned yet. Add from suggestions above!
              </p>
            ) : (
              tasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    t.status === "completed" ? "bg-primary/5 border-primary/20" : "bg-card"
                  }`}
                >
                  <button
                    onClick={() => toggleTaskComplete(t)}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      t.status === "completed"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {t.status === "completed" && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1">
                    <span
                      className={`text-sm font-medium ${
                        t.status === "completed" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {(t.task_templates as any)?.title || t.custom_title}
                    </span>
                    {(t.task_templates as any)?.duration_minutes && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />{" "}
                        {(t.task_templates as any).duration_minutes} min
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteTask(t.id)}
                    className="text-destructive/60 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
