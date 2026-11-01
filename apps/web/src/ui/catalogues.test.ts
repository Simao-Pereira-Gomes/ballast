import { readFileSync } from "node:fs"
import { locales } from "@ballast/core"
import { describe, expect, it } from "vitest"

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"))

const keysOf = (locale: string): string[] => {
  const catalogue = read(`../../messages/${locale}.json`)
  if (typeof catalogue !== "object" || catalogue === null) throw new Error(`${locale}.json`)
  return Object.keys(catalogue).toSorted()
}

describe("message catalogues", () => {
  it("cover exactly the languages the core knows", () => {
    expect(read("../../project.inlang/settings.json")).toMatchObject({ locales })
  })

  // A message missing from one catalogue would silently fall back to English.
  it.each(locales)("%s has every message and nothing extra", (locale) => {
    expect(keysOf(locale)).toEqual(keysOf("en"))
  })
})
