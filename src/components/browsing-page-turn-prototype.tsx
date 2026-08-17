// PROTOTYPE ONLY: a disposable visual probe for issue #9. Do not ship this component.
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"

type Variant = "spine" | "corner" | "lift"
type Turn = "forward" | "backward" | null

type VariantDetails = {
  name: string
  summary: string
  verdict: string
}

const variants: Record<Variant, VariantDetails> = {
  spine: {
    name: "Spine sweep",
    summary: "A continuous curved sheet rolls around the spine.",
    verdict: "Best if the turn should feel like one flexible, folded sheet.",
  },
  corner: {
    name: "Corner lead",
    summary: "The free corner moves first and pulls the sheet across.",
    verdict: "Best if the turn should show a crisp crease and paper tension.",
  },
  lift: {
    name: "Lift and settle",
    summary: "The sheet lifts above the Page Block, then settles directly.",
    verdict: "Best if clarity and a restrained motion matter more than a long curl.",
  },
}

const order: Variant[] = ["spine", "corner", "lift"]

function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get("variant")
  return value === "corner" || value === "lift" ? value : "spine"
}

function PageTurnModel({ variant, turn }: { variant: Variant; turn: Turn }) {
  const classes = `page-turn-model page-turn-model--${variant} ${turn ? `is-turning is-turning--${turn}` : ""}`
  return (
    <div className={classes}>
      <div className="page-turn-model__shadow" />
      <div className="page-turn-model__spread">
        <div className="page-turn-model__page page-turn-model__page--left">
          <span>12</span>
          <i />
          <i />
          <i />
        </div>
        <div className="page-turn-model__spine" />
        <div className="page-turn-model__page page-turn-model__page--right">
          <span>13</span>
          <i />
          <i />
          <i />
        </div>
        <div className="page-turn-model__leaf" aria-hidden="true">
          <b />
          <b />
          <b />
        </div>
      </div>
    </div>
  )
}

// Three visual motion models, switchable with ?prototype=page-turn&variant=.
export function BrowsingPageTurnPrototype({
  currentPage,
  totalPages,
  onCurrentPageChange,
}: {
  currentPage: number
  totalPages: number
  onCurrentPageChange: (page: number) => void
}) {
  const [variant, setVariant] = useState(readVariant)
  const [turn, setTurn] = useState<Turn>(null)
  const [status, setStatus] = useState("Choose a nearby page to watch one leaf turn.")

  const chooseVariant = (next: Variant) => {
    const url = new URL(window.location.href)
    url.searchParams.set("variant", next)
    window.history.replaceState({}, "", url)
    setVariant(next)
    setStatus(`${variants[next].name} selected. ${variants[next].summary}`)
  }

  const move = (direction: Exclude<Turn, null>) => {
    const nextPage = currentPage + (direction === "forward" ? 1 : -1)
    if (nextPage < 1 || nextPage > totalPages || turn) return
    setTurn(direction)
    setStatus(`Turning one Folded Sheet toward page ${nextPage}.`)
    window.setTimeout(() => {
      onCurrentPageChange(nextPage)
      setTurn(null)
      setStatus(`Settled on page ${nextPage}.`)
    }, 760)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches("input, select, textarea, [contenteditable]")) return
      if (event.key === "ArrowLeft") move("backward")
      if (event.key === "ArrowRight") move("forward")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  const previousVariant = order[(order.indexOf(variant) + order.length - 1) % order.length]
  const nextVariant = order[(order.indexOf(variant) + 1) % order.length]

  return (
    <main className="prototype-page-turn">
      <header className="prototype-page-turn__header">
        <div>
          <p className="prototype-page-turn__eyebrow">Prototype · not V1 code</p>
          <h2>How should one Folded Sheet turn?</h2>
          <p>
            Compare three motion models at one default resting spread. Nearby pages animate one
            leaf; a distant selection settles directly.
          </p>
        </div>
        <span className="prototype-page-turn__badge">
          Page {currentPage} of {totalPages}
        </span>
      </header>

      <section
        className="prototype-page-turn__stage"
        aria-label="Physical Design Preview motion study"
      >
        <PageTurnModel variant={variant} turn={turn} />
        <div className="prototype-page-turn__caption">
          <strong>{variants[variant].name}</strong>
          <span>{variants[variant].summary}</span>
        </div>
      </section>

      <section className="prototype-page-turn__controls" aria-label="Prototype controls">
        <div className="prototype-page-turn__control-group">
          <span className="prototype-page-turn__label">Nearby navigation</span>
          <div className="prototype-page-turn__actions">
            <Button
              variant="outline"
              aria-label="Turn to previous page"
              disabled={currentPage === 1 || Boolean(turn)}
              onClick={() => move("backward")}
            >
              <ArrowLeft /> Previous
            </Button>
            <Button
              aria-label="Turn to next page"
              disabled={currentPage === totalPages || Boolean(turn)}
              onClick={() => move("forward")}
            >
              Next <ArrowRight />
            </Button>
          </div>
        </div>
        <label className="prototype-page-turn__control-group">
          <span className="prototype-page-turn__label">Distant page jump</span>
          <select
            aria-label="Jump directly to page"
            value={currentPage}
            onChange={(event) => {
              const page = Number(event.target.value)
              onCurrentPageChange(page)
              setTurn(null)
              setStatus(`Jumped directly and settled on page ${page}.`)
            }}
          >
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <option key={page} value={page}>
                Page {page}
              </option>
            ))}
          </select>
        </label>
      </section>

      <p className="prototype-page-turn__status" aria-live="polite">
        {status}
      </p>
      <aside className="prototype-page-turn__decision">
        <strong>What to judge</strong>
        <span>{variants[variant].verdict}</span>
        <span>Does the opening still read as a Page Block rather than separate cards?</span>
      </aside>

      <nav className="prototype-variant-switcher" aria-label="Prototype variants">
        <button
          type="button"
          aria-label="Previous prototype variant"
          onClick={() => chooseVariant(previousVariant)}
        >
          <ChevronLeft />
        </button>
        <span>
          {variant.toUpperCase()} · {variants[variant].name}
        </span>
        <button
          type="button"
          aria-label="Next prototype variant"
          onClick={() => chooseVariant(nextVariant)}
        >
          <ChevronRight />
        </button>
      </nav>
    </main>
  )
}
