// Express's res.json() uses JSON.stringify, which cannot serialize BigInt by
// default. Prisma returns BigInt for priceMinorUnits, so we teach BigInt how
// to turn itself into a string when converted to JSON.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};