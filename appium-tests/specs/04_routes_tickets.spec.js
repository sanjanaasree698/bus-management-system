describe('Stops, Routes & Ticket Booking E2E Tests', () => {
  it('TC_BOOK_001: Should list all available bus stops', async () => {
    const stopsList = await $$('~stop-list-item');
    expect(stopsList.length).toBeGreaterThan(0);
  });

  it('TC_BOOK_002: Should select source and destination stops', async () => {
    const sourceDropdown = await $('~source-stop-picker');
    await sourceDropdown.click();
    const sourceOption = await $('~stop-option-central-station');
    await sourceOption.click();

    const destDropdown = await $('~dest-stop-picker');
    await destDropdown.click();
    const destOption = await $('~stop-option-university-campus');
    await destOption.click();
  });

  it('TC_BOOK_003: Should calculate ticket price dynamically', async () => {
    const priceText = await $('~ticket-price-display');
    expect(await priceText.getText()).toMatch(/\$\d+\.\d{2}/);
  });

  it('TC_BOOK_004: Should complete ticket purchase flow', async () => {
    const bookNowBtn = await $('~book-now-button');
    await bookNowBtn.click();

    const confirmModal = await $('~booking-confirm-modal');
    await confirmModal.waitForDisplayed({ timeout: 5000 });
    expect(await confirmModal.isDisplayed()).toBe(true);

    const confirmBtn = await $('~confirm-payment-button');
    await confirmBtn.click();

    const ticketQR = await $('~ticket-qr-code');
    await ticketQR.waitForDisplayed({ timeout: 10000 });
    expect(await ticketQR.isDisplayed()).toBe(true);
  });
});
