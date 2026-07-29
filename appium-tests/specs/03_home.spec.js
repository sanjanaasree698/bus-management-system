describe('Home Screen Navigation & UI E2E Tests', () => {
  it('TC_HOME_001: Should display live bus map component', async () => {
    const mapComponent = await $('~live-map-view');
    await mapComponent.waitForDisplayed({ timeout: 10000 });
    expect(await mapComponent.isDisplayed()).toBe(true);
  });

  it('TC_HOME_002: Should display active bus list cards', async () => {
    const busCards = await $$('~bus-card-item');
    expect(busCards.length).toBeGreaterThan(0);
  });

  it('TC_HOME_003: Should filter buses when typing in search bar', async () => {
    const searchInput = await $('~bus-search-input');
    await searchInput.setValue('Route 101');
    const filteredCard = await $('~bus-card-Route-101');
    expect(await filteredCard.isDisplayed()).toBe(true);
  });

  it('TC_HOME_004: Should navigate to Stops Screen from bottom navigation', async () => {
    const stopsTab = await $('~nav-tab-stops');
    await stopsTab.click();
    const stopsHeader = await $('~stops-screen-title');
    await stopsHeader.waitForDisplayed({ timeout: 5000 });
    expect(await stopsHeader.isDisplayed()).toBe(true);
  });
});
