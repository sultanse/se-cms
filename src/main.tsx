import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router"
import "./index.css"
import { AppProviders } from "@/components/providers"
import { Spinner } from "@/components/ui/spinner"
import { fetchRepositories } from "@/stores/github-store"
import App from "./App"

void fetchRepositories()

const TranslationEditorPage = lazy(
  () => import("@/pages/TranslationEditorPage")
)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="grid min-h-svh place-items-center">
              <Spinner className="text-muted-foreground" />
            </div>
          }
        >
          <Routes>
            <Route key="home" path="/" element={<App />} />
            <Route
              key="translations"
              path="/translations"
              element={<TranslationEditorPage />}
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppProviders>
  </StrictMode>
)
