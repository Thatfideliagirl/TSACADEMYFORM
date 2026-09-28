import { redirect } from "next/navigation";

// Old address. Kept so any link already shared still works.
export default function Activate() {
  redirect("/sign-up");
}
