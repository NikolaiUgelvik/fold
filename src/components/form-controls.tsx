import { type ReactNode, useId, useState } from "react"

import { Input } from "@/components/ui/input"

export type FieldMetadata = {
  state?: "default" | "inherited" | "custom" | "mixed"
  onReset?: () => void
}

function FieldStatus({ label, state, onReset }: FieldMetadata & { label: string }) {
  if (!state && !onReset) return null
  const labels = {
    default: "Notebook default",
    inherited: "Inherited",
    custom: "Custom",
    mixed: "Inherited / custom",
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
      {state && <span className="text-muted-foreground">{labels[state]}</span>}
      {onReset && (
        <button
          type="button"
          className="rounded text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Reset ${label} to notebook defaults`}
          onClick={onReset}
        >
          Reset
        </button>
      )}
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  state,
  onReset,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
} & FieldMetadata) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label className="text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      <FieldStatus label={label} state={state} onReset={onReset} />
      {hint && <p className="text-xs leading-4 text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
  mixed = false,
  state,
  onReset,
}: {
  label: string
  value: number | undefined
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
  mixed?: boolean
} & FieldMetadata) {
  const id = useId()
  const [draft, setDraft] = useState<{ text: string; committed: number | undefined } | null>(null)
  const displayValue =
    draft && Object.is(draft.committed, value) ? draft.text : mixed ? "" : (value ?? "")

  return (
    <Field label={label} htmlFor={id} state={state} onReset={onReset}>
      <Input
        id={id}
        type="number"
        value={displayValue}
        placeholder={mixed ? "Mixed" : undefined}
        aria-label={mixed ? `${label} (mixed values)` : undefined}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const parsed = event.target.valueAsNumber
          const valid = Number.isFinite(parsed) && parsed >= min && parsed <= max
          const committed = valid ? (step === 1 ? Math.round(parsed) : parsed) : value
          setDraft({ text: event.target.value, committed })
          if (valid && committed !== undefined) onChange(committed)
        }}
        onBlur={(event) => {
          const parsed = event.target.valueAsNumber
          if (Number.isFinite(parsed)) {
            const committed = Math.min(max, Math.max(min, step === 1 ? Math.round(parsed) : parsed))
            if (!Object.is(committed, value)) onChange(committed)
          }
          setDraft(null)
        }}
      />
    </Field>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  mixed = false,
  disabled,
  state,
  onReset,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  mixed?: boolean
  disabled?: boolean
} & FieldMetadata) {
  const id = useId()

  return (
    <Field label={label} htmlFor={id} state={state} onReset={onReset}>
      <div className="relative flex h-9 items-center gap-2 rounded-md border border-input bg-card px-2 text-sm focus-within:ring-2 focus-within:ring-ring">
        <Input
          id={id}
          className={
            mixed
              ? "absolute inset-0 h-full w-full cursor-pointer opacity-0"
              : "h-7 w-10 cursor-pointer border-0 p-0 shadow-none"
          }
          type="color"
          value={value ?? "#000000"}
          disabled={disabled}
          aria-label={mixed ? `${label} (mixed values; choose color)` : label}
          onChange={(event) => onChange(event.target.value)}
        />
        <span aria-hidden="true" className="pointer-events-none">
          {mixed ? "Mixed · choose color" : value}
        </span>
      </div>
    </Field>
  )
}

export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

export function SelectControl({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  className = "w-full bg-card",
  disabled = false,
  mixed = false,
}: {
  value: string | undefined
  onChange: (value: string) => void
  options: Record<string, string>
  id?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
  mixed?: boolean
}) {
  return (
    <select
      id={id}
      className={`h-9 rounded-md border border-input px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${className}`}
      value={mixed ? "" : value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {mixed && (
        <option value="" disabled>
          Mixed
        </option>
      )}
      {Object.entries(options).map(([optionValue, label]) => (
        <option value={optionValue} key={optionValue}>
          {label}
        </option>
      ))}
    </select>
  )
}

export function CheckboxField({
  checked,
  onChange,
  title,
  description,
  className = "",
  mixed = false,
  disabled,
  state,
  onReset,
}: {
  checked: boolean | undefined
  onChange: (checked: boolean) => void
  title: string
  description: string
  className?: string
  mixed?: boolean
  disabled?: boolean
} & FieldMetadata) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-card p-3 text-sm text-card-foreground">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-ring"
          checked={checked ?? false}
          disabled={disabled}
          aria-checked={mixed ? "mixed" : checked}
          ref={(input) => {
            if (input) input.indeterminate = mixed
          }}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          <strong className="block">
            {title}
            {mixed ? " · Mixed" : ""}
          </strong>
          <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
            {description}
          </span>
        </span>
      </label>
      <FieldStatus label={title} state={state} onReset={onReset} />
    </div>
  )
}
