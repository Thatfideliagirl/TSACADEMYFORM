"use client";

import { startTransition, useActionState } from "react";

// React normally wipes a form after it is sent. That is a bad experience when the server says
// "wrong code" and the person has to type everything again. This keeps what they typed.
export function useKeepValues<S>(fn: (prev: Awaited<S>, formData: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState(fn, undefined as Awaited<S>);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, pending, onSubmit };
}
