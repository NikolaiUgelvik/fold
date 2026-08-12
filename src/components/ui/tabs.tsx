import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation="horizontal"
      className={cn("group/tabs flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant="line"
      className={cn("group/tabs-list inline-flex h-9 w-fit items-center justify-center gap-1 bg-transparent p-0.75 text-muted-foreground", className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex tab-trigger-height flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity data-[state=active]:after:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

function TabBar({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsList className={cn("h-8 w-full justify-start gap-5 rounded-none border-b px-5 py-0", className)} {...props} />
}

function TabBarTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsTrigger
      className={cn("h-full flex-none items-end rounded-none px-0 pb-1 text-label font-bold tracking-label data-[state=active]:text-ring after:bg-ring", className)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
}

export { TabBar, TabBarTrigger, Tabs, TabsContent }
