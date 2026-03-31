import { test, expect } from '@playwright/test'

test('register flow shows server response message', async ({ page }) => {
  const email = `pwdiag_${Date.now()}@yandex.ru`
  const password = '12345678'

  await page.goto('/')
  await page.getByRole('button', { name: 'Войти' }).first().click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Регистрация' }).click()

  // On success UI shows "check your mail". On rate-limit/failure it shows backend error.
  await expect(
    page.getByText(/Проверьте почту|email rate limit exceeded|over_email_send_rate_limit|Не удалось зарегистрироваться/i),
  ).toBeVisible()
})
