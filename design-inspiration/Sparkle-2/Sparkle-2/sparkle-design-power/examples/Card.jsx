/**
 * Sparkle Design System - Card Component
 * 
 * Basic card container with optional header and footer.
 * 
 * Usage:
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *   </CardHeader>
 *   <CardContent>Content here</CardContent>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 */

import React from "react"
import { cn } from "./utils"

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "bg-sparkle-card rounded-xl border border-sparkle-border overflow-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn("p-5 pb-0", className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn("text-lg font-semibold text-sparkle-text", className)} {...props}>
      {children}
    </h3>
  )
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn("text-sm text-sparkle-text-secondary mt-1", className)} {...props}>
      {children}
    </p>
  )
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn("p-5 pt-0 flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  )
}
