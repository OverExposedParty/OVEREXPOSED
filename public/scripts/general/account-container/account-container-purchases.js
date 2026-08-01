function formatAccountCurrency(value, currency = 'GBP') {
  if (currency === 'OPAL') {
    const amount = new Intl.NumberFormat().format(Number(value) || 0);
    return `${amount} Opals`;
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(Number(value) || 0);
}

function getAccountPurchases(account) {
  const orders = Array.isArray(account?.shop?.orderHistory)
    ? account.shop.orderHistory
    : [];
  const unlocks = Array.isArray(account?.gameData?.inGamePurchasesAndUnlocks)
    ? account.gameData.inGamePurchasesAndUnlocks
    : [];
  const opalTransactions = Array.isArray(account?.gameData?.opalTransactions)
    ? account.gameData.opalTransactions
    : [];

  return [
    ...orders.map((order) => ({
      id: order.orderNumber || order.orderId || 'Order',
      itemName: order.orderNumber ? `Order ${order.orderNumber}` : 'Shop order',
      itemType: 'orders',
      price: order.total?.amount || 0,
      currency: order.total?.currency || 'GBP',
      status: order.status || 'Unknown',
      purchasedAt: order.placedAt,
      paymentMethod: 'Saved payment method'
    })),
    ...unlocks.map((unlock) => ({
      id: unlock.key || unlock.productId || 'Unlock',
      itemName:
        unlock.metadata?.productName ||
        unlock.key ||
        unlock.type ||
        'Unlocked item',
      itemType: 'unlocks',
      price: unlock.source === 'opals' ? unlock.metadata?.opalPrice || 0 : 0,
      currency: unlock.source === 'opals' ? 'OPAL' : 'GBP',
      status: 'Unlocked',
      purchasedAt: unlock.unlockedAt || unlock.accessGrantedAt,
      paymentMethod:
        unlock.source === 'opals' ? 'Opals' : unlock.source || 'Account unlock'
    })),
    ...opalTransactions
      .filter(
        (transaction) =>
          transaction.type === 'spend' &&
          transaction.sourceType === 'shop_purchase' &&
          Array.isArray(transaction.metadata?.grants) &&
          transaction.metadata.grants.some(
            (grant) => grant.type === 'oling_egg'
          )
      )
      .map((transaction) => ({
        id: `${transaction.sourceId || 'opal'}-${transaction.createdAt || ''}`,
        itemName: transaction.metadata?.productName || 'Opal purchase',
        itemType: 'unlocks',
        price: Math.abs(Number(transaction.amount) || 0),
        currency: 'OPAL',
        status: 'Purchased',
        purchasedAt: transaction.createdAt,
        paymentMethod: 'Opals'
      }))
  ];
}

function findAccountPurchaseById(purchaseId) {
  return getAccountPurchases(getStoredAccount()).find(
    (purchase) => String(purchase.id) === String(purchaseId)
  );
}

function createAccountPurchaseTabs(activeTab) {
  const tabs = document.createElement('div');
  tabs.className = 'account-purchase-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Purchase filter');

  accountPurchaseTabs.forEach((tab) => {
    const button = document.createElement('button');
    button.className = 'account-purchase-tab';
    button.type = 'button';
    button.dataset.purchaseTab = tab.id;
    button.dataset.accountHint = `Show ${tab.label.toLowerCase()} purchases`;
    button.setAttribute('role', 'tab');
    button.setAttribute(
      'aria-selected',
      tab.id === activeTab ? 'true' : 'false'
    );
    button.textContent = tab.label;

    if (tab.id === activeTab) button.classList.add('is-active');

    tabs.appendChild(button);
  });

  return tabs;
}

function createAccountPurchaseCard(purchase) {
  const card = document.createElement('article');
  card.className = 'account-purchase-card';

  const summary = document.createElement('button');
  summary.className = 'account-purchase-summary';
  summary.type = 'button';
  summary.setAttribute('aria-expanded', 'false');
  summary.dataset.accountHint = `Show ${purchase.itemName} receipt details`;

  const identity = document.createElement('span');
  identity.className = 'account-purchase-identity';

  const name = document.createElement('span');
  name.className = 'account-purchase-name';
  name.textContent = purchase.itemName || 'Purchase';

  const meta = document.createElement('span');
  meta.className = 'account-purchase-meta';
  meta.textContent = `${formatAccountDate(purchase.purchasedAt)} / ${purchase.status || 'Unknown'}`;

  const price = document.createElement('span');
  price.className = 'account-purchase-price';
  price.textContent = formatAccountCurrency(purchase.price, purchase.currency);

  const arrow = document.createElement('span');
  arrow.className = 'account-purchase-dropdown-arrow';
  arrow.setAttribute('aria-hidden', 'true');

  identity.append(name, meta);
  summary.append(identity, price, arrow);

  const details = document.createElement('div');
  details.className = 'account-purchase-details';
  details.hidden = true;
  details.append(
    createAccountProfileRow('Order ID', purchase.id),
    createAccountProfileRow('Date', formatAccountDate(purchase.purchasedAt)),
    createAccountProfileRow('Status', purchase.status),
    createAccountProfileRow('Item type', purchase.itemType),
    createAccountProfileRow('Payment', purchase.paymentMethod),
    createAccountProfileRow(
      'Price',
      formatAccountCurrency(purchase.price, purchase.currency)
    )
  );

  const receiptButton = createAccountFriendAction(
    'Receipt',
    'receipt',
    {
      id: purchase.id
    },
    {
      hint: `View receipt for ${purchase.itemName}`
    }
  );
  receiptButton.dataset.purchaseAction = 'receipt';
  receiptButton.dataset.purchaseId = purchase.id || '';
  receiptButton.removeAttribute('data-friend-action');

  const actions = document.createElement('div');
  actions.className = 'account-purchase-actions';
  actions.appendChild(receiptButton);
  details.appendChild(actions);

  card.append(summary, details);
  return card;
}

function createAccountPurchaseEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'account-purchases-empty';
  emptyState.textContent = 'No purchases found';
  return emptyState;
}

function renderAccountPurchaseHistoryPanel(activeTab = 'all') {
  if (!accountExpandedContent) return;

  const purchases = getAccountPurchases(getStoredAccount()).filter(
    (purchase) => activeTab === 'all' || purchase.itemType === activeTab
  );
  const list = document.createElement('div');
  list.className = 'account-purchase-list';

  if (purchases.length) {
    list.append(...purchases.map(createAccountPurchaseCard));
  } else {
    list.appendChild(createAccountPurchaseEmptyState());
  }

  accountExpandedContent.replaceChildren(
    createAccountPurchaseTabs(activeTab),
    list
  );
}

function renderAccountReceiptPanel(purchaseId) {
  if (!accountExpandedContent) return;

  const purchase = findAccountPurchaseById(purchaseId);
  if (!purchase) {
    renderAccountPurchaseHistoryPanel();
    setAccountFooterHint('Receipt not found');
    return;
  }

  const receipt = createAccountProfileSection('Receipt');
  receipt.append(
    createAccountProfileRow('Order ID', purchase.id),
    createAccountProfileRow('Item', purchase.itemName),
    createAccountProfileRow('Item type', purchase.itemType),
    createAccountProfileRow('Date', formatAccountDate(purchase.purchasedAt)),
    createAccountProfileRow('Status', purchase.status),
    createAccountProfileRow('Payment', purchase.paymentMethod),
    createAccountProfileRow(
      'Total',
      formatAccountCurrency(purchase.price, purchase.currency)
    )
  );

  const actions = document.createElement('div');
  actions.className = 'account-receipt-actions';

  const backButton = document.createElement('button');
  backButton.className = 'account-receipt-action';
  backButton.type = 'button';
  backButton.dataset.receiptAction = 'back';
  backButton.dataset.accountHint = 'Back to purchase history';
  backButton.textContent = 'Back';

  const downloadButton = document.createElement('button');
  downloadButton.className = 'account-receipt-action disabled';
  downloadButton.type = 'button';
  downloadButton.dataset.receiptAction = 'download';
  downloadButton.dataset.accountHint = 'Receipt PDF downloads are coming soon';
  downloadButton.textContent = 'Download PDF';
  downloadButton.setAttribute('aria-disabled', 'true');

  const emailButton = document.createElement('button');
  emailButton.className = 'account-receipt-action disabled';
  emailButton.type = 'button';
  emailButton.dataset.receiptAction = 'email';
  emailButton.dataset.accountHint = 'Emailing receipts is coming soon';
  emailButton.textContent = 'Email receipt';
  emailButton.setAttribute('aria-disabled', 'true');

  actions.append(downloadButton, emailButton, backButton);
  accountExpandedContent.replaceChildren(receipt, actions);
}
