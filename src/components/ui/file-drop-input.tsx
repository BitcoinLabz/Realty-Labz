"use client";

import { useId, useRef, useState } from "react";

export function FileDropInput({
  id,
  label = "File",
  accept,
  required,
  helperText,
  error,
}: {
  id?: string;
  label?: string;
  accept?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {/* A <label htmlFor> wrapping the drop zone gets click-to-browse for
          free via native input-focusing behavior — only drag-and-drop needs
          manual wiring below. */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          const files = e.dataTransfer.files;
          if (files.length > 0 && inputRef.current) {
            inputRef.current.files = files;
            setFileName(files[0].name);
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          name="file"
          type="file"
          accept={accept}
          required={required}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="hidden"
        />
        <span className="text-sm font-medium text-foreground">
          {fileName ?? "Drag and drop a file, or click to browse"}
        </span>
      </label>
      {helperText ? <p className="text-sm text-muted">{helperText}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
