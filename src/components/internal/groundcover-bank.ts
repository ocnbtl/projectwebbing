// Bounded replacement of the old source-sheet groundcover beside the near-bank rail.
export const GROUNDCOVER_BANK = {minX: 250, maxX: 430, minZ: -745, maxZ: -575} as const;

export function inGroundcoverBank(x: number, z: number) {
  return x >= GROUNDCOVER_BANK.minX && x <= GROUNDCOVER_BANK.maxX
    && z >= GROUNDCOVER_BANK.minZ && z <= GROUNDCOVER_BANK.maxZ;
}
