"use client";

import { startTransition, type FormEvent } from "react";

// React clears a <form action={...}> after every submit -- including one the
// server rejected -- so a single bad field (a 4-digit ZIP) wiped everything
// the person had typed, and the browser's "required" check then silently
// blocked the next Save (2026-11-28). Submitting through onSubmit instead
// keeps what they typed on screen while the error shows. useActionState's
// pending flag and returned state work exactly the same; a form that should
// clear after a successful save still does so itself (formRef.reset()).
export function submitKeepingValues(action: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => action(formData));
  };
}
