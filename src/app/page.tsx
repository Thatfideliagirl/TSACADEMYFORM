import { redirect } from "next/navigation";
import { getStaff } from "@/lib/staff";

// The home address just sends people to the right place.
export default async function Home() {
  redirect((await getStaff()) ? "/dashboard" : "/sign-in");
}
