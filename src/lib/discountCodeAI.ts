type DiscountCodeAI = {
    codeText: string;
    type: "PERCENT" | "FIXED";
    value: number;
    expiresAt: Date;
    minimumSpendMinorUnits: number;
    maxUsesPerCustomer: number;
};

type PastRedemptionAI = {
    customerId: string;
    codeText: string;
};

type DiscountResultAI =
    | { success: true; discountAmountMinorUnits: number; finalTotalMinorUnits: number }
    | { success: false; reason: "INVALID_SUBTOTAL" | "EXPIRED" | "BELOW_MINIMUM_SPEND" | "USAGE_LIMIT_REACHED" };

export function applyDiscountCode(
    orderSubtotalMinorUnits: number,
    code: DiscountCodeAI,
    customerId: string,
    now: Date,
    pastRedemptions: PastRedemptionAI[]
): DiscountResultAI {
    if (orderSubtotalMinorUnits <= 0) {
        return { success: false, reason: "INVALID_SUBTOTAL" };
    }

    if (now > code.expiresAt) {
        return { success: false, reason: "EXPIRED" };
    }

    if (orderSubtotalMinorUnits < code.minimumSpendMinorUnits) {
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
