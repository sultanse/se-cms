import { Octokit } from "octokit"

const github = new Octokit({
  auth: import.meta.env.VITE_GITHUB_TOKEN || "",
})

type TranslationLocale = "ar" | "en"
type JsonObject = { [key: string]: unknown }

const translationPaths = (locale: TranslationLocale) => [
  `src/i18n/${locale}.json`,
  `src/i18n/locales/${locale}.json`,
]

async function getTranslationFile(
  owner: string,
  repo: string,
  locale: TranslationLocale
): Promise<JsonObject> {
  for (const path of translationPaths(locale)) {
    try {
      const { data } = await github.rest.repos.getContent({
        owner,
        repo,
        path,
      })

      if (Array.isArray(data) || data.type !== "file" || !data.content) {
        continue
      }

      const binary = atob(data.content.replace(/\n/g, ""))
      const bytes = Uint8Array.from(binary, (character: string) =>
        character.charCodeAt(0)
      )
      const json = JSON.parse(new TextDecoder().decode(bytes))
      if (json !== null && typeof json === "object" && !Array.isArray(json)) {
        return json as JsonObject
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) continue
      throw error
    }
  }

  throw new Error(`Could not find ${locale}.json in ${owner}/${repo}`)
}

export async function getRepositoryLocales(owner: string, repo: string) {
  const [ar, en] = await Promise.all([
    getTranslationFile(owner, repo, "ar"),
    getTranslationFile(owner, repo, "en"),
  ])

  return { ar, en }
}

export async function getRepository(
  owner: string,
  repo: string
): Promise<Awaited<ReturnType<typeof github.rest.repos.get>>["data"]> {
  try {
    const { data } = await github.rest.repos.get({
      owner,
      repo,
    })
    return data
  } catch (error) {
    console.error("Error fetching GitHub repository data:", error)
    throw error
  }
}

export async function getAllRepositories() {
  try {
    const { data } = await github.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      page: 1,
      sort: "updated",
      direction: "desc",
    })

    return data
  } catch (error) {
    console.error("Error fetching GitHub repositories:", error)
    throw error
  }
}
