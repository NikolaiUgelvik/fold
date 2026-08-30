import { type ReactNode, useId } from "react"

import { Input } from "@/components/ui/input"

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-2xs leading-4 text-muted-foreground">{hint}</p>}
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
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
}) {
  const id = useId()

  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value))
            onChange(Math.min(max, Math.max(min, step === 1 ? Math.round(value) : value)))
        }}
      />
    </Field>
  )
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()

  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        className="h-9 cursor-pointer p-1"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
}: {
  value: string
  onChange: (value: string) => void
  options: Record<string, string>
  id?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      className={`h-9 rounded-md border border-input px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${className}`}
      value={value}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
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
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  description: string
  className?: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border bg-card p-3 text-xs text-card-foreground ${className}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-ring"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong className="block">{title}</strong>
        <span className="mt-0.5 block text-2xs leading-4 text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}
