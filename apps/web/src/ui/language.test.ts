import { describe, expect, it } from "vitest"
import { languagesFromHeader, negotiateLocale } from "./language.ts"

describe("languagesFromHeader", () => {
  it("orders an Accept-Language header by preference", () => {
    expect(languagesFromHeader("fr;q=0.5, pt-BR, en;q=0.8")).toEqual(["pt-BR", "en", "fr"])
  })

  it("keeps header order for equal weights and skips the wildcard", () => {
    expect(languagesFromHeader("de, *;q=0.1, en")).toEqual(["de", "en"])
  })

  it("returns nothing for a missing header", () => {
    expect(languagesFromHeader(null)).toEqual([])
  })
})

describe("negotiateLocale", () => {
  it("matches an interface language exactly", () => {
    expect(negotiateLocale(["pt-PT"])).toBe("pt-PT")
    expect(negotiateLocale(["en"])).toBe("en")
  })

  it("matches by language when the region differs", () => {
    expect(negotiateLocale(["pt"])).toBe("pt-PT")
    expect(negotiateLocale(["pt-BR"])).toBe("pt-PT")
    expect(negotiateLocale(["en-US"])).toBe("en")
  })

  it("takes the first preferred language Ballast speaks", () => {
    expect(negotiateLocale(["fr", "pt-BR", "en"])).toBe("pt-PT")
    expect(negotiateLocale(["de", "en-GB", "pt"])).toBe("en")
  })

  it("finds nothing when Ballast speaks none of them", () => {
    expect(negotiateLocale(["fr", "de"])).toBeUndefined()
  })
})
