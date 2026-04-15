
-- Student interests table
CREATE TABLE public.student_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  category text NOT NULL,
  proficiency integer NOT NULL DEFAULT 3 CHECK (proficiency >= 1 AND proficiency <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, category)
);

ALTER TABLE public.student_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own interests" ON public.student_interests
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own interests" ON public.student_interests
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own interests" ON public.student_interests
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own interests" ON public.student_interests
  FOR DELETE USING (auth.uid() = student_id);

-- Task templates table (pre-defined tasks by category)
CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  difficulty integer NOT NULL DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view task templates" ON public.task_templates
  FOR SELECT USING (true);

-- Seed task templates
INSERT INTO public.task_templates (category, title, description, duration_minutes, difficulty) VALUES
  ('Mathematics', 'Practice Algebra Problems', 'Solve 10 algebra equations from your textbook', 30, 3),
  ('Mathematics', 'Mental Math Challenge', 'Practice rapid mental calculations for speed', 15, 2),
  ('Mathematics', 'Geometry Visualizations', 'Draw and label geometric shapes and theorems', 25, 3),
  ('Mathematics', 'Statistics Practice', 'Work through probability and statistics problems', 30, 4),
  ('Science', 'Review Lab Notes', 'Go through recent lab experiments and summarize findings', 20, 2),
  ('Science', 'Read Science Article', 'Read and summarize a recent scientific discovery', 25, 2),
  ('Science', 'Concept Map Creation', 'Create a concept map linking related science topics', 30, 3),
  ('Science', 'Formula Revision', 'Revise and practice key scientific formulas', 20, 3),
  ('English', 'Creative Writing', 'Write a short story or poem on a topic of choice', 30, 3),
  ('English', 'Vocabulary Building', 'Learn 10 new words with meanings and sentences', 20, 2),
  ('English', 'Essay Outline', 'Create an outline for an argumentative essay', 25, 3),
  ('English', 'Grammar Practice', 'Complete grammar exercises focusing on common errors', 20, 2),
  ('History', 'Timeline Creation', 'Create a timeline of key events from current chapter', 25, 2),
  ('History', 'Historical Analysis', 'Compare two historical events and write analysis', 30, 4),
  ('History', 'Map Study', 'Study and annotate historical maps', 20, 2),
  ('Coding', 'Solve Coding Problems', 'Practice 3 coding problems on arrays or strings', 30, 3),
  ('Coding', 'Build a Mini Project', 'Work on a small coding project or feature', 45, 4),
  ('Coding', 'Learn New Concept', 'Watch a tutorial and take notes on a new programming concept', 30, 3),
  ('Coding', 'Debug Practice', 'Find and fix bugs in sample code snippets', 20, 3),
  ('Art', 'Sketch Practice', 'Practice sketching objects around you', 30, 2),
  ('Art', 'Color Theory Study', 'Study color combinations and create a color palette', 20, 2),
  ('Reading', 'Read a Book Chapter', 'Read one chapter and write a brief summary', 30, 2),
  ('Reading', 'Speed Reading Practice', 'Practice reading faster with comprehension checks', 20, 3),
  ('Music', 'Practice Instrument', 'Practice scales or a piece on your instrument', 30, 3),
  ('Music', 'Music Theory', 'Study and practice music theory concepts', 25, 3),
  ('Physical Fitness', 'Quick Workout', 'Do a 15-minute bodyweight workout routine', 15, 2),
  ('Physical Fitness', 'Stretching & Yoga', 'Follow a guided stretching or yoga routine', 20, 1),
  ('General Study', 'Flashcard Review', 'Create or review flashcards for any subject', 20, 2),
  ('General Study', 'Mind Mapping', 'Create a mind map for a difficult topic', 25, 3),
  ('General Study', 'Teach a Peer', 'Explain a concept you know well to a classmate', 20, 3);

-- Student planned tasks table
CREATE TABLE public.student_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  template_id uuid REFERENCES public.task_templates(id) ON DELETE SET NULL,
  custom_title text,
  status text NOT NULL DEFAULT 'pending',
  planned_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own tasks" ON public.student_tasks
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own tasks" ON public.student_tasks
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own tasks" ON public.student_tasks
  FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Students can delete own tasks" ON public.student_tasks
  FOR DELETE USING (auth.uid() = student_id);
