import { test, expect } from '@playwright/test'

test('home page renders search and examples', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Поиск')).toBeVisible()
  await expect(page.getByText('Примеры маршрутов')).toBeVisible()
  await expect(page.locator('#from')).toBeVisible()
  await expect(page.locator('#to')).toBeVisible()
})

test('search navigates to results', async ({ page }) => {
  await page.goto('/')
  await page.locator('#from').fill('Москва')
  await page.locator('#to').fill('Гюмри')
  await page.getByRole('button', { name: 'Найти' }).first().click()

  await expect(page).toHaveURL(/\/results\?/)
  await expect(page.getByRole('heading', { name: 'Результаты' })).toBeVisible()
})

test('auth modal shows validation message for invalid email', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Войти' }).first().click()
  await page.getByLabel('Email').fill('invalid-email')
  await page.getByLabel('Пароль').fill('123456')
  await page.getByRole('button', { name: 'Войти' }).nth(1).click()
  await expect(page.getByText('Введите корректный email')).toBeVisible()
})

test('favorites page asks guest user to sign in', async ({ page }) => {
  await page.goto('/favorites')
  await expect(page.getByText('Войдите в аккаунт, чтобы увидеть избранные маршруты.')).toBeVisible()
})
