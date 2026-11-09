import type { Assignment, Branch, Order } from "./types.ts";
import { distanceKm } from "./geo.ts";

// fullBranchIds — list of branch IDs that have exceeded their limit today
export function assignBranch(
  order: Order,
  branches: Branch[],
  fullBranchIds: string[] = [],
): Assignment {
  // 0. We only accept active branches of this store.
  const own: Branch[] = [];
  for (const branch of branches) {
    if (branch.storeId === order.storeId && branch.active) {
      own.push(branch);
    }
  }

  // 1. MANUAL — the manager selected the branch himself. The limit is not checked.s
  if (order.manualBranchId !== null) {
    for (const branch of own) {
      if (branch.id === order.manualBranchId) {
        return { orderId: order.id, branchId: branch.id, rule: "manual" };
      }
    }
  }

  // We select a branch according to the remaining rules
  let chosen: Branch | null = null;
  let rule: Assignment["rule"] = "unassigned";

  // 2. SINGLE — the store has only one active branch
  if (own.length === 1) {
    chosen = own[0];
    rule = "single";
  }

  // 3. PICKUP_POINT — which branch owns the order pickup point
  if (chosen === null && order.pickupPointId !== null) {
    for (const branch of own) {
      if (branch.pickupPointIds.includes(order.pickupPointId)) {
        chosen = branch;
        rule = "pickup_point";
        break;
      }
    }
  }

  // Branches in Tashsyryss
  const inCity: Branch[] = [];
  for (const branch of own) {
    if (branch.city === order.city) {
      inCity.push(branch);
    }
  }

  // 4. CITY — the store has only one branch in the city
  if (chosen === null && inCity.length === 1) {
    chosen = inCity[0];
    rule = "city";
  }

  // 5. GEO — nearest branch
  if (chosen === null) {
    let nearest: Branch | null = null;
    if (inCity.length > 1) {
      // There are several branches in the city — the closest one is
      nearest = findNearest(order, inCity);
    } else {
      // There is no branch in the city — the closest one of alls
      nearest = findNearest(order, own);
    }
    if (nearest !== null) {
      chosen = nearest;
      rule = "geo";
    }
  }

  // 6. UNASSIGNED — nothing found
  if (chosen === null) {
    return { orderId: order.id, branchId: null, rule: "unassigned" };
  }

  // 7. LIMIT — if the selected branch is full, we will look for the nearest branch that is not full
  if (fullBranchIds.includes(chosen.id)) {
    const notFull: Branch[] = [];
    for (const branch of own) {
      if (!fullBranchIds.includes(branch.id)) {
        notFull.push(branch);
      }
    }

    const nearestFree = findNearest(order, notFull);
    if (nearestFree === null) {
      return { orderId: order.id, branchId: null, rule: "unassigned" };
    }
    return { orderId: order.id, branchId: nearestFree.id, rule: "geo" };
  }

  return { orderId: order.id, branchId: chosen.id, rule: rule };
}

// The closest branch in the list. If there is no coordinate, then null.
function findNearest(order: Order, branches: Branch[]): Branch | null {
  if (order.lat === null || order.lon === null) {
    return null;
  }

  let best: Branch | null = null;
  let bestDistance = Infinity;

  for (const branch of branches) {
    // HE GARDEN WAS HERE: previously written as b.lon, b.lat
    const distance = distanceKm(order.lat, order.lon, branch.lat, branch.lon);
    if (distance < bestDistance) {
      best = branch;
      bestDistance = distance;
    }
  }

  return best;
}
