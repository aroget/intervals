import { redirect } from "next/navigation";

// Root → locale landing page
export default function Home() {
  redirect("/en");
}
