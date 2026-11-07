import { describe, expect, it } from "vitest"
import { normaliseDescription } from "../src/index.ts"

describe("normaliseDescription", () => {
  it("folds case so a rule matches however the bank capitalised it", () => {
    expect(normaliseDescription("Compra CONTINENTE Lisboa")).toBe(
      normaliseDescription("compra continente lisboa"),
    )
  })

  it("collapses runs of whitespace and trims the ends", () => {
    expect(normaliseDescription("  Compra \t Padaria   Central ")).toBe("compra padaria central")
  })

  it("keeps accents, because they are part of the bank's words", () => {
    expect(normaliseDescription("Transferência de Ordenado")).toBe("transferência de ordenado")
  })

  it("treats composed and decomposed accents as the same text", () => {
    expect(normaliseDescription("Depo\u0301sito")).toBe(normaliseDescription("Dep\u00f3sito"))
  })

  it.each([
    ["Compra 4111 1111 1111 1111 Loja", "compra ****1111 loja"],
    ["Compra 5555-5555-5555-4444 Loja", "compra ****4444 loja"],
    ["Compra 4000056655665556 Loja", "compra ****5556 loja"],
    ["Compra 4111 **** **** 1234 Loja", "compra ****1234 loja"],
    ["Compra 411111******1234 Loja", "compra ****1234 loja"],
    ["Compra ****1234 Loja", "compra ****1234 loja"],
    ["Compra XXXX XXXX XXXX 1234 Loja", "compra ****1234 loja"],
  ])("masks the card number in %j down to its last four digits", (description, normalised) => {
    expect(normaliseDescription(description)).toBe(normalised)
  })

  it("makes the same card match whether the bank masked it or not", () => {
    expect(normaliseDescription("Compra 5555 5555 5555 4444")).toBe(
      normaliseDescription("Compra **** **** **** 4444"),
    )
  })

  it.each([
    "Depósito de Cheque 00012345",
    "Pagamento de Serviços 21 123 456 789",
    "Compra Gasolineira A12b345c6",
    "Referência 20260901",
    "Referência SEPA 1234567890123456",
  ])("leaves shorter references and codes in %j alone", (description) => {
    expect(normaliseDescription(description)).toBe(description.toLowerCase())
  })
})
