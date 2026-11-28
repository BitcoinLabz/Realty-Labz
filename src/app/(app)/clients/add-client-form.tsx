"use client";

import { Plus } from "lucide-react";
import { ModalButton } from "@/components/ui/modal";
import { ClientForm } from "./client-form";

// "Add a client" button + popup (2026-11-28). A client component because the
// popup hands its close function to the form, and a server page can't pass
// functions to the browser. Mileage and Income & Expenses follow the same
// shape: a small wrapper like this around ModalButton and their own form.
export function AddClientButton({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <ModalButton label="Add a client" title="Add a client" icon={<Plus size={16} />} defaultOpen={defaultOpen}>
      {(close) => <ClientForm onDone={close} onCancel={close} inModal />}
    </ModalButton>
  );
}
