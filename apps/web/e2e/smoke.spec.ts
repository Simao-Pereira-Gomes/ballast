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

test("the Owner adds, edits and deletes manual Transactions and sees the balance follow", async ({
  page,
}) => {
  await page.goto("/")
  const accounts = page.getByRole("region", { name: "Your Accounts" })
  await expect(accounts.getByRole("link", { name: /Santander Current/ })).toContainText("€0.00")
  await accounts.getByRole("link", { name: /Santander Current/ }).click()

  await expect(page.getByRole("heading", { name: "Santander Current", level: 1 })).toBeVisible()
  const balance = page.getByRole("region", { name: "Balance" })
  await expect(balance).toContainText("€0.00")
  await expect(page.getByText("No Transactions yet")).toBeVisible()

  const addButton = page.getByRole("button", { name: "Add Transaction" })
  const dialog = page.getByRole("dialog", { name: "Add a Transaction" })

  await addButton.click()
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(dialog.getByText("Enter an amount")).toBeVisible()
  await expect(dialog.getByText("Description is required")).toBeVisible()
  await expect(dialog.getByLabel("Amount")).toBeFocused()

  await dialog.getByLabel("Amount").fill("12.34")
  await dialog.getByLabel("Date").fill("2026-10-30")
  await dialog.getByLabel("Description").fill("Market, paid in cash")
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(dialog).toBeHidden()
  await expect(addButton).toBeFocused()
  await expect(balance).toContainText("-€12.34")

  await addButton.click()
  await dialog.getByRole("radio", { name: "Money in" }).check()
  await dialog.getByLabel("Amount").fill("100")
  await dialog.getByLabel("Date").fill("2026-10-31")
  await dialog.getByLabel("Description").fill("Birthday gift")
  await dialog.getByRole("button", { name: "Save" }).click()
  await expect(dialog).toBeHidden()
  await expect(balance).toContainText("€87.66")

  const ledger = page.getByRole("region", { name: "Transactions on this Account" })
  const market = ledger.getByRole("button", { name: /Market, paid in cash/ })
  await expect(market).toContainText("30 Oct 2026")
  await expect(market).toContainText("Manual")
  await expect(ledger.getByRole("listitem").first()).toContainText("Birthday gift")

  await market.click()
  const editDialog = page.getByRole("dialog", { name: "Edit Transaction" })
  await expect(editDialog.getByLabel("Amount")).toHaveValue("12.34")
  await editDialog.getByLabel("Amount").fill("2.50")
  await editDialog.getByRole("button", { name: "Save" }).click()
  await expect(editDialog).toBeHidden()
  await expect(balance).toContainText("€97.50")

  await ledger.getByRole("button", { name: /Birthday gift/ }).click()
  await editDialog.getByRole("button", { name: "Delete" }).click()
  await editDialog.getByRole("button", { name: "Delete for good" }).click()
  await expect(editDialog).toBeHidden()
  await expect(balance).toContainText("-€2.50")
  await expect(ledger.getByText("Birthday gift")).toBeHidden()

  await page.getByRole("link", { name: "Accounts", exact: true }).first().click()
  await expect(accounts.getByRole("link", { name: /Santander Current/ })).toContainText("-€2.50")
})

test("the Owner is told when a Transaction was already deleted in another tab", async ({
  page,
  context,
}) => {
  await page.goto("/")
  await page
    .getByRole("region", { name: "Your Accounts" })
    .getByRole("link", { name: /Santander Current/ })
    .click()
  const ledger = page.getByRole("region", { name: "Transactions on this Account" })
  const market = ledger.getByRole("button", { name: /Market, paid in cash/ })

  const otherTab = await context.newPage()
  await otherTab.goto(page.url())
  await otherTab.getByRole("button", { name: /Market, paid in cash/ }).click()
  await otherTab.getByRole("button", { name: "Delete" }).click()
  await otherTab.getByRole("button", { name: "Delete for good" }).click()
  await expect(otherTab.getByRole("button", { name: /Market, paid in cash/ })).toBeHidden()

  await market.click()
  const dialog = page.getByRole("dialog", { name: "Edit Transaction" })
  await dialog.getByLabel("Amount").fill("4")
  await dialog.getByRole("button", { name: "Save" }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole("status")).toHaveText(
    "This Transaction had already been deleted, so there was nothing to change.",
  )
  await expect(market).toBeHidden()
  await expect(page.getByRole("region", { name: "Balance" })).toContainText("€0.00")
})
