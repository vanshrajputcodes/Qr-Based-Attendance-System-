-- Allow teachers to manually mark attendance for students in their own sessions
CREATE POLICY "Teachers can mark attendance for own sessions"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions
    WHERE sessions.id = attendance.session_id
    AND sessions.teacher_id = auth.uid()
  )
  AND has_role(auth.uid(), 'teacher'::app_role)
);