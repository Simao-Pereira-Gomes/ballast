import { expect, test } from "@playwright/test"

test("the Owner switches theme and the choice is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  await page.getByRole("link", { name: "Settings" }).click()
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()
  const html = page.locator("html")
  const theme = page.getByRole("group", { name: "Theme" })
  await expect(theme.getByRole("radio", { name: "System" })).toBeChecked()
  await expect(html).not.toHaveClass(/dark/)

  await theme.getByRole("radio", { name: "Dark" }).check()
  await expect(html).toHaveClass(/dark/)

  await page.reload()
  await expect(html).toHaveClass(/dark/)
  await expect(theme.getByRole("radio", { name: "Dark" })).toBeChecked()

  await theme.getByRole("radio", { name: "Light" }).check()
  await expect(html).not.toHaveClass(/dark/)

  // System follows the device again.
  await page.emulateMedia({ colorScheme: "dark" })
  await theme.getByRole("radio", { name: "System" }).check()
  await expect(html).toHaveClass(/dark/)
})
