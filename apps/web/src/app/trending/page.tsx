import { redirect } from "next/navigation";

/** Legacy route — token trending removed; terminal is prediction markets only. */
export default function TrendingRedirectPage() {
  redirect("/");
}
