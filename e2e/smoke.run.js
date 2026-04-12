async (page) => {
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded' });

  await page.getByPlaceholder('testuser or your@company.com').fill('testuser');
  await page.getByPlaceholder('Enter your password').fill('password123');
  await Promise.all([
    page.waitForURL('http://localhost:3000/', { timeout: 30_000 }),
    page.getByRole('button', { name: 'Sign In to Orbisporté' }).click(),
  ]);

  await page.getByRole('heading', { name: 'Control Tower' }).waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Logout' }).waitFor();

  const api = await page.context().newPage();
  await api.goto('http://127.0.0.1:8000/docs', { waitUntil: 'domcontentloaded' });
  const title = await api.title();
  if (!title.includes('Swagger UI')) throw new Error(`Expected Swagger UI, got: ${title}`);
  await api.close();

  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(/\/auth\/(login|signup)/, { timeout: 30_000 });
}
