import { test, expect } from '@playwright/test'

test('register flow shows server response message', async ({ page }) => {
  const email = `pwdiag_${Date.now()}@yandex.ru`
  const password = '12345678'

  await page.goto('/')
  await page.getByRole('button', { name: 'Войти' }).first().click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  await page.getByRole('button', { name: 'Регистрация' }).click()

  // Успех: почта / «Выйти» при autoconfirm. Ошибка: сеть, лимит, CORS, или «function not found», если Edge ещё не задеплоен.
  await expect(
    page
      .getByRole('button', { name: 'Выйти' })
      .or(
        page.getByText(
          /Проверьте почту|Не удалось зарегистрироваться|email rate limit|over_email_send|Доступ с этого источника|Ошибка регистрации|Failed to fetch|NetworkError|Requested function was not found|function was not found/i,
        ),
      ),
  ).toBeVisible({ timeout: 25000 })
})
