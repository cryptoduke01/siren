import { redirect } from "next/navigation";

/** Legacy /launch URL — token launchpad docs removed; execution focus only. */
export default function LaunchRedirect() {
  redirect("/terminal");
}
