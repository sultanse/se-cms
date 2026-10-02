import { DirectionProvider } from "@base-ui/react/direction-provider"
import { useEffect } from "react"
import type { PropsWithChildren } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLanguage } from "@/hooks/use-language"

export function AppProviders({ children }: PropsWithChildren) {
  const { language, direction } = useLanguage()

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
    localStorage.setItem("language", language)
  }, [direction, language])

  return (
    <ThemeProvider>
      <DirectionProvider direction={direction}>
        <TooltipProvider>{children}</TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  )
}
