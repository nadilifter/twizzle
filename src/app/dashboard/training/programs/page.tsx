import { redirect } from "next/navigation";

// Redirect from old programs path to new registrations path
export default function OldProgramsPage() {
  redirect("/dashboard/registrations/programs");
}
