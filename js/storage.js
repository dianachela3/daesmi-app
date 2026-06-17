const KEYS = {
    TRANSACTIONS: 'daesmi_transactions',
    PRODUCTS: 'daesmi_products'
};

export function initDB() {
    if (!localStorage.getItem(KEYS.TRANSACTIONS)) {
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(KEYS.PRODUCTS)) {
        localStorage.setItem(KEYS.PRODUCTS, JSON.stringify([]));
    }
}

export function getTransactions() {
    initDB();
    const data = localStorage.getItem(KEYS.TRANSACTIONS);
    return JSON.parse(data).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function saveTransaction(transaction) {
    const transactions = getTransactions();
    
    const newTransaction = {
        id: 'tx_' + Date.now() + Math.random().toString(36).substr(2, 5),
        date: new Date().toISOString(),
        ...transaction
    };

    transactions.push(newTransaction);
    localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
    return newTransaction;
}

export function getFinancialTotals() {
    const transactions = getTransactions();
    
    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
        if (tx.type === 'income') {
            income += parseFloat(tx.amount) || 0;
        } else if (tx.type === 'expense') {
            expense += parseFloat(tx.amount) || 0;
        }
    });

    return {
        income,
        expense,
        balance: income - expense
    };
}