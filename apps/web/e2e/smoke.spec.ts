import { expect, test } from "@playwright/test"

test("the Owner opens their first Account from the empty state", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Start with your current account" })).toBeVisible()

  await page.getByRole("button", { name: "Open your first Account" }).click()
  const dialog = page.getByRole("dialog", { name: "Open an Account" })
  await dialog.getByLabel("Name").fill("Santander Current")
  await dialog.getByRole("radio", { name: /Operating Cash/ }).check()
  await dialog.getByRole("button", { name: "Open Account" }).click()

  await expect(dialog).toBeHidden()
  const accounts = page.getByRole("region", { name: "Your Accounts" })
  await expect(accounts.getByText("Santander Current")).toBeVisible()
  await expect(accounts.getByText("Operating Cash · EUR")).toBeVisible()
})

test("the Owner filters Accounts by role", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Open Account" }).click()
  const dialog = page.getByRole("dialog", { name: "Open an Account" })
  await dialog.getByLabel("Name").fill("Santander Savings")
  await dialog.getByRole("radio", { name: /Reserve/ }).check()
  await dialog.getByRole("button", { name: "Open Account" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole("button", { name: "Open Account" })).toBeFocused()

  const accounts = page.getByRole("region", { name: "Your Accounts" })
  const filters = accounts.getByRole("group", { name: "Filter by Account Role" })
  await expect(filters.getByRole("button", { name: "All · 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  await filters.getByRole("button", { name: "Reserve · 1" }).click()
  await expect(accounts.getByText("Santander Savings")).toBeVisible()
  await expect(accounts.getByText("Santander Current")).toBeHidden()
})

test("the Owner is told what to fix when the details are incomplete", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Open Account" }).click()
  const dialog = page.getByRole("dialog", { name: "Open an Account" })
  await dialog.getByRole("button", { name: "Open Account" }).click()

  await expect(dialog.getByText("Name is required")).toBeVisible()
  await expect(dialog.getByText("Choose an Account Role")).toBeVisible()
  await expect(dialog.getByLabel("Name")).toBeFocused()
  await expect(dialog.getByLabel("Name")).toHaveAttribute("aria-invalid", "true")
})

test("the rail links only the sections that are built", async ({ page }) => {
  await page.goto("/")
  const sections = page.getByRole("navigation", { name: "Sections" })
  await expect(sections.getByRole("link", { name: "Accounts" })).toHaveAttribute(
    "aria-current",
    "page",
  )
  await expect(sections.getByText("Forecast")).toBeVisible()
  await expect(sections.getByRole("link")).toHaveCount(1)
})
