describe('Welcome Screen E2E Tests', () => {
  it('TC_WEL_001: Should render welcome logo and title correctly', async () => {
    const welcomeTitle = await $('~welcome-title');
    await welcomeTitle.waitForDisplayed({ timeout: 10000 });
    expect(await welcomeTitle.isDisplayed()).toBe(true);
  });

  it('TC_WEL_002: Should display Get Started / Login button', async () => {
    const loginBtn = await $('~get-started-button');
    expect(await loginBtn.isDisplayed()).toBe(true);
  });

  it('TC_WEL_003: Should navigate to Login Screen on button tap', async () => {
    const loginBtn = await $('~get-started-button');
    await loginBtn.click();
    const emailInput = await $('~email-input');
    await emailInput.waitForDisplayed({ timeout: 5000 });
    expect(await emailInput.isDisplayed()).toBe(true);
  });
});
