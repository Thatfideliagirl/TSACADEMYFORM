// Shown to a student when a form link cannot be used. Plain words, no jargon.
export function FormProblem({ kind }: { kind: "missing" | "setup" }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h1 className="font-display text-2xl font-semibold">{kind === "missing" ? "This form link is not valid" : "This form is not ready yet"}</h1>
      <p className="mt-3 text-muted">
        {kind === "missing"
          ? "The link may have been typed wrongly or the form was removed. Ask your moderator to send you the link again."
          : "Something is not set up correctly on our side. Please tell your moderator, and try again later."}
      </p>
    </div>
  );
}
