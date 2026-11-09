type DiscountCode = {
    codeText: string;
    type: "PERCENT" | "FIXED";
    value: number;
    expiresAt: Date;
    minimumSpendMinorUnits: number;
    maxUsesPerCustomer: number;
};

type PastRedemption = {
    customerId: string;
    codeText: string;
};

type DiscountResult =
    | { success: true; discountAmountMinorUnits: number; finalTotalMinorUnits: number }
    | { success: false; reason: "INVALID_SUBTOTAL" | "EXPIRED" | "BELOW_MINIMUM_SPEND" | "USAGE_LIMIT_REACHED" };

function applyDiscountCode(
    orderSubtotalMinorUnits: number,
    code: DiscountCode,
    customerId: string,
    now: Date,
    pastRedemptions: PastRedemption[]
): DiscountResult {
    if (orderSubtotalMinorUnits <= 0) {
        return { success: false, reason: "INVALID_SUBTOTAL" };
    }
    if (now > code.expiresAt) {
        return { success: false, reason: "EXPIRED" };
    } if (orderSubtotalMinorUnits < code.minimumSpendMinorUnits) {
        return { success: false, reason: "BELOW_MINIMUM_SPEND" };
    }

    const pastUseCount = pastRedemptions.filter(
        (r) => r.customerId === customerId && r.codeText === code.codeText
    ).length;

    if (pastUseCount >= code.maxUsesPerCustomer) {
        return { success: false, reason: "USAGE_LIMIT_REACHED" };
    }

    let discountAmountMinorUnits: number;

    if (code.type === "PERCENT") {
        discountAmountMinorUnits = Math.floor(orderSubtotalMinorUnits * (code.value / 100));
    } else {
        discountAmountMinorUnits = code.value;
    }

    if (discountAmountMinorUnits > orderSubtotalMinorUnits) {
        discountAmountMinorUnits = orderSubtotalMinorUnits;
    }

    const finalTotalMinorUnits = orderSubtotalMinorUnits - discountAmountMinorUnits;

    return { success: true, discountAmountMinorUnits, finalTotalMinorUnits };
}

console.log("Trace 1 (percent success):", applyDiscountCode(
  10000,
  { codeText: "SAVE10", type: "PERCENT", value: 10, expiresAt: new Date(Date.now() + 86400000), minimumSpendMinorUnits: 5000, maxUsesPerCustomer: 1 },
  "cust1",
  new Date(),
  []
));

console.log("Trace 2 (fixed success):", applyDiscountCode(
  5000,
  { codeText: "FLAT20", type: "FIXED", value: 2000, expiresAt: new Date(Date.now() + 86400000), minimumSpendMinorUnits: 1000, maxUsesPerCustomer: 3 },
  "cust1",
  new Date(),
  []
));

console.log("Trace 3 (expired):", applyDiscountCode(
  10000,
  { codeText: "OLD", type: "PERCENT", value: 10, expiresAt: new Date(Date.now() - 86400000), minimumSpendMinorUnits: 0, maxUsesPerCustomer: 1 },
  "cust1",
  new Date(),
  []
));

console.log("Trace 4 (usage limit reached):", applyDiscountCode(
  10000,
  { codeText: "ONEUSE", type: "PERCENT", value: 10, expiresAt: new Date(Date.now() + 86400000), minimumSpendMinorUnits: 0, maxUsesPerCustomer: 1 },
  "cust1",
  new Date(),
  [{ customerId: "cust1", codeText: "ONEUSE" }]
));

console.log("Trace 5 (negative subtotal):", applyDiscountCode(
  -500,
  { codeText: "ANY", type: "PERCENT", value: 10, expiresAt: new Date(Date.now() + 86400000), minimumSpendMinorUnits: 0, maxUsesPerCustomer: 1 },
  "cust1",
  new Date(),
  []
));
