import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true })

test("at phone width the tab bar, floating button and sheet are usable", async ({ page }) => {
  await page.goto("/")

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalScroll).toBe(false)

  const tabs = page.getByRole("navigation", { name: "Sections" })
  await expect(tabs.getByRole("link", { name: "Accounts" })).toHaveAttribute("aria-current", "page")
  await Promise.all(
    ["Activity", "Review", "Forecast", "Allocation"].map((label) =>
      expect(tabs.getByText(label, { exact: true })).toBeVisible(),
    ),
  )
  await expect(tabs.getByRole("link")).toHaveCount(1)

  const openButton = page.getByRole("button", { name: "Open Account" })
  await openButton.click()
  const sheet = page.getByRole("dialog", { name: "Open an Account" })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel("Name")).toBeFocused()

  // A bottom sheet: full width, along the bottom edge (once it has slid in).
  await sheet.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
  const box = await sheet.boundingBox()
  expect(box?.width).toBe(375)
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(812)

  // Focus stays inside while it's open: Tab round it more times than it has controls.
  const tabStaysInside = async (pressesLeft: number): Promise<void> => {
    if (pressesLeft === 0) return
    await page.keyboard.press("Tab")
    expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    return tabStaysInside(pressesLeft - 1)
  }
  await tabStaysInside(12)

  await page.keyboard.press("Escape")
  await expect(sheet).toBeHidden()
  await expect(openButton).toBeFocused()
})

test("at phone width Settings opens from the top bar and fits", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("link", { name: "Settings" }).click()
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible()

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasHorizontalScroll).toBe(false)
  await expect(page.getByRole("radio", { name: "Dark" })).toBeVisible()
  await expect(page.getByRole("radio", { name: "Português" })).toBeVisible()
})
