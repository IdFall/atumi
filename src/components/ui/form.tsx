import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && !error ? <span className="text-neutral-500">{hint}</span> : null}
      {error ? (
        <span className="text-red-700 dark:text-red-400" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { invalid, className, ...rest } = props;
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`rounded-lg border px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-600 ${
        invalid ? "border-red-600" : "border-neutral-300 dark:border-neutral-700"
      } bg-transparent ${className ?? ""}`}
    />
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg p-3 text-sm ${
        tone === "error"
          ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
          : "bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
      }`}
    >
      {children}
    </p>
  );
}
