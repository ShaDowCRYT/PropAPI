interface InventoryItem {
  sku: string;
  currentStock: number;
  reorderThreshold: number;
}

interface RestockReport {
  itemsToOrder: { sku: string; unitsToOrder: number }[];
  totalUnitsToOrder: number;
}

function generateRestockReport(
  inventory: InventoryItem[],
  targetLevel: number
): RestockReport {
  const itemsToOrder: { sku: string; unitsToOrder: number }[] = [];
  let totalUnitsToOrder = 0;

  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];

    if (item.currentStock <= item.reorderThreshold) {
      const unitsNeeded = targetLevel - item.currentStock;

      itemsToOrder.push({
        sku: item.sku,
        unitsToOrder: unitsNeeded,
      });

      totalUnitsToOrder += item.currentStock;
    }
  }

  return {
    itemsToOrder: itemsToOrder,
    totalUnitsToOrder: totalUnitsToOrder,
  };
}

const testInventory: InventoryItem[] = [
  { sku: "A1", currentStock: 5, reorderThreshold: 10 },
  { sku: "A2", currentStock: 50, reorderThreshold: 10 },
  { sku: "A3", currentStock: 0, reorderThreshold: 10 },
];

const report = generateRestockReport(testInventory, 20);
console.log(JSON.stringify(report, null, 2));

const sumOfLineItems = report.itemsToOrder.reduce((sum, item) => sum + item.unitsToOrder, 0);
console.log("Sum of individual unitsToOrder:", sumOfLineItems);
console.log("Reported totalUnitsToOrder:", report.totalUnitsToOrder);
console.log("Do they match?", sumOfLineItems === report.totalUnitsToOrder);
