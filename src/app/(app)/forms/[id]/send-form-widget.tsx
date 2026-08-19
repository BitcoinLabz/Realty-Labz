"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { sendFormSubmissionAction } from "@/app/actions/form-submissions";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";

const initialState: FormState = {};

export type SendableTemplate = {
  id: string;
  name: string;
  signers: { id: string; order: number; label: string }[];
};

export type SendFormClient = {
  id: string;
  name: string;
  email: string | null;
};

export function SendFormWidget({
  client,
  templates,
  deals,
  lockedDealId,
}: {
  client?: SendFormClient;
  templates: SendableTemplate[];
  // Deal picker options — ignored when lockedDealId is set.
  deals?: { id: string; propertyAddress: string }[];
  // When set (sending from a deal's own page), the deal is fixed and no
  // picker is shown — a hidden input carries it instead.
  lockedDealId?: string;
}) {
  const [state, formAction, isPending] = useActionState(sendFormSubmissionAction, initialState);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [keepForRecords, setKeepForRecords] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const succeeded = !state.error && !state.fieldErrors && state !== initialState;

  useEffect(() => {
    if (succeeded) formRef.current?.reset();
  }, [succeeded]);

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
  const canKeepForRecords = selectedTemplate?.signers.length === 1;

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted">
        No form templates yet — add one on the{" "}
        <Link href="/forms/templates" className="font-medium text-accent hover:opacity-80">
          Templates
        </Link>{" "}
        tab first.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
      {lockedDealId ? <input type="hidden" name="dealId" value={lockedDealId} /> : null}
      <input type="hidden" name="keepForRecords" value={keepForRecords ? "true" : "false"} />

      <Select
        label="Template"
        name="formTemplateId"
        value={templateId}
        onChange={(e) => {
          setTemplateId(e.target.value);
          setKeepForRecords(false);
        }}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>

      {!lockedDealId && deals && deals.length > 0 ? (
        <Select label="Link to a property/offer (optional)" name="dealId" defaultValue="">
          <option value="">None</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.propertyAddress}
            </option>
          ))}
        </Select>
      ) : null}

      {canKeepForRecords ? (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={keepForRecords}
            onChange={(e) => setKeepForRecords(e.target.checked)}
            className="mt-1"
          />
          I&apos;ll fill this out myself and keep it for my own records — don&apos;t send it to{" "}
          {client ? client.name : "the signer"} for signature.
        </label>
      ) : null}

      {!keepForRecords
        ? selectedTemplate?.signers.map((signer, i) => (
            <div key={signer.id} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={`${signer.label} name`}
                name={`name_${signer.id}`}
                type="text"
                defaultValue={i === 0 ? client?.name : undefined}
                required
                error={state.fieldErrors?.[`name_${signer.id}`]}
              />
              <Field
                label={`${signer.label} email`}
                name={`email_${signer.id}`}
                type="email"
                defaultValue={i === 0 ? (client?.email ?? undefined) : undefined}
                required
                error={state.fieldErrors?.[`email_${signer.id}`]}
              />
            </div>
          ))
        : null}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending…" : keepForRecords ? "Fill it out now" : "Send for signature"}
        </Button>
      </div>
    </form>
  );
}
