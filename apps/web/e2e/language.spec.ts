import { expect, test } from "@playwright/test"

test("the server renders Portuguese for a Portuguese browser, Brazilian included", async ({
  request,
}) => {
  const response = await request.get("/", { headers: { "Accept-Language": "pt-BR,pt;q=0.9" } })
  const html = await response.text()
  expect(html).toContain('<html lang="pt-PT"')
  expect(html).toContain(">Contas</h1>")
})

test.describe("in a pt-PT browser", () => {
  test.use({ locale: "pt-PT" })

  test("Ballast opens in Portuguese", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT")
    await expect(page.getByRole("heading", { name: "Contas", level: 1 })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Secções" })).toBeVisible()
  })

  test("the Owner is told what to fix in Portuguese", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Abrir conta" }).click()
    const dialog = page.getByRole("dialog", { name: "Abrir uma conta" })
    await dialog.getByRole("button", { name: "Abrir conta" }).click()

    await expect(dialog.getByText("O nome é obrigatório")).toBeVisible()
    await expect(dialog.getByText("Escolha a função da conta")).toBeVisible()
  })
})

test("the Owner switches language and the choice is remembered", async ({ page }) => {
  await page.goto("/settings")
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()

  await page
    .getByRole("group", { name: "Language" })
    .getByRole("radio", { name: "Português" })
    .click()
  await expect(page.getByRole("heading", { name: "Preferências", level: 1 })).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-PT")

  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Contas", level: 1 })).toBeVisible()

  await page.getByRole("link", { name: "Preferências" }).click()
  const language = page.getByRole("group", { name: "Idioma" })
  await expect(language.getByRole("radio", { name: "Português" })).toBeChecked()
  await language.getByRole("radio", { name: "English" }).click()
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
})

test("the chosen language wins over the browser's on the server too", async ({ request }) => {
  const html = await (
    await request.get("/", {
      headers: { "Accept-Language": "en-US,en;q=0.9", Cookie: "PARAGLIDE_LOCALE=pt-PT" },
    })
  ).text()
  expect(html).toContain('<html lang="pt-PT"')
  expect(html).toContain(">Contas</h1>")
})

test("switching language keeps the theme and hydrates cleanly", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/settings")
  await page.getByRole("group", { name: "Theme" }).getByRole("radio", { name: "Dark" }).check()

  await page
    .getByRole("group", { name: "Language" })
    .getByRole("radio", { name: "Português" })
    .click()
  await expect(page.getByRole("heading", { name: "Preferências", level: 1 })).toBeVisible()

  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(
    page.getByRole("group", { name: "Tema" }).getByRole("radio", { name: "Escuro" }),
  ).toBeChecked()
  expect(errors).toEqual([])
})

test("the chosen language wins over the browser's on the server too", async ({ request }) => {
  const html = await (
    await request.get("/", {
      headers: { "Accept-Language": "en-US,en;q=0.9", Cookie: "PARAGLIDE_LOCALE=pt-PT" },
    })
  ).text()
  expect(html).toContain('<html lang="pt-PT"')
  expect(html).toContain(">Contas</h1>")
})

test("switching language keeps the theme and hydrates cleanly", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  await page.getByRole("group", { name: "Theme" }).getByRole("radio", { name: "Dark" }).check()

  await page
    .getByRole("group", { name: "Language" })
    .getByRole("radio", { name: "Português" })
    .click()
  await expect(page.getByRole("heading", { name: "Contas", level: 1 })).toBeVisible()

  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(
    page.getByRole("group", { name: "Tema" }).getByRole("radio", { name: "Escuro" }),
  ).toBeChecked()
  expect(errors).toEqual([])
})
