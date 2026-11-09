import type { Assignment, Branch, Order } from "./types.ts";
import { assignBranch } from "./router.ts";
import { getAlmatyDate } from "./time.ts";

// orderId -> split result (for duplicate request)
const assignments = new Map<string, Assignment>();

// "b-ala-1|2026-11-16" -> how many orders did the branch receive on that day?
const loads = new Map<string, number>();

function makeKey(branchId: string, date: string): string {
  return branchId + "|" + date;
}

// Branch load on a specific day
export function getLoad(branchId: string, date: string): number {
  const key = makeKey(branchId, date);
  const count = loads.get(key);
  if (count === undefined) {
    return 0;
  }
  return count;
}

// Allocate an order to a branch
export function assignOrder(order: Order, branches: Branch[]): Assignment {
  // 1. Has this order been allocated before? If yes, we return the same result,
  // we cannot reset the limit.
  const existing = assignments.get(order.id);
  if (existing !== undefined) {
    return existing;
  }

  // 2. What date was the order placed in Almaty?
  const date = getAlmatyDate(order.createdAt);

  // 3. We will collect the full branches on the same day.
  const fullBranchIds: string[] = [];
  for (const branch of branches) {
    if (getLoad(branch.id, date) >= branch.dailyLimit) {
      fullBranchIds.push(branch.id);
    }
  }

  // 4. We choose a branch according to the rules
  const result = assignBranch(order, branches, fullBranchIds);

  // 5. We save the result.
  assignments.set(order.id, result);

  // 6. If a branch is found, we increase its load by 1.
  if (result.branchId !== null) {
    const key = makeKey(result.branchId, date);
    const oldCount = getLoad(result.branchId, date);
    loads.set(key, oldCount + 1);
  }

  return result;
}

// For tests: clear everything
export function resetDispatch(): void {
  assignments.clear();
  loads.clear();
}
