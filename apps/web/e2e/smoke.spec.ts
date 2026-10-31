import { expect, test } from "@playwright/test"

test("the Owner opens an Account and sees it listed", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Accounts", level: 1 })).toBeVisible()

  await page.getByLabel("Name").fill("Santander Current")
  await page.getByLabel("Account Role").selectOption({ label: "Operating Cash" })
  await page.getByRole("button", { name: "Open Account" }).click()

  const accounts = page.getByRole("region", { name: "Your Accounts" })
  await expect(accounts.getByText("Santander Current")).toBeVisible()
  await expect(accounts.getByText("Operating Cash · EUR")).toBeVisible()
})

test("the Owner is told what to fix when the details are incomplete", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Open Account" }).click()

  await expect(page.getByText("Name is required")).toBeVisible()
  await expect(page.getByText("Choose an Account Role")).toBeVisible()
})
