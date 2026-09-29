// A message at the top of a page. Pages pass in what came back in the address.
export function Banner({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return error ? (
    <p role="alert" className="rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm font-medium text-fail">{error}</p>
  ) : (
    <p role="status" className="rounded-xl bg-[#e1f2e9] px-4 py-3 text-sm font-medium text-pass">{ok}</p>
  );
}
