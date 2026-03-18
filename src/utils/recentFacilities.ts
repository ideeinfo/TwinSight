import type { FacilitySummary } from '@/types/facility';

interface RecentFacilityEntry {
  facilityId: number;
  visitedAt: string;
}

const STORAGE_KEY_PREFIX = 'twinsight.recentFacilities';
const MAX_RECENT_FACILITIES = 12;

function getStorageKey(userScope?: string | number | null) {
  return `${STORAGE_KEY_PREFIX}:${userScope || 'anonymous'}`;
}

export function loadRecentFacilityEntries(userScope?: string | number | null): RecentFacilityEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userScope));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is RecentFacilityEntry => (
      Number.isInteger(entry?.facilityId) &&
      typeof entry?.visitedAt === 'string'
    ));
  } catch (error) {
    console.warn('Failed to load recent facilities:', error);
    return [];
  }
}

export function recordRecentFacilityVisit(facilityId: number, userScope?: string | number | null) {
  if (typeof window === 'undefined' || !Number.isInteger(facilityId) || facilityId <= 0) {
    return [];
  }

  const nextEntries = [
    { facilityId, visitedAt: new Date().toISOString() },
    ...loadRecentFacilityEntries(userScope).filter((entry) => entry.facilityId !== facilityId),
  ].slice(0, MAX_RECENT_FACILITIES);

  try {
    window.localStorage.setItem(getStorageKey(userScope), JSON.stringify(nextEntries));
  } catch (error) {
    console.warn('Failed to persist recent facilities:', error);
  }

  return nextEntries;
}

export function sortFacilitiesByRecentVisits(
  facilities: FacilitySummary[],
  entries: RecentFacilityEntry[],
) {
  if (!entries.length) {
    return facilities;
  }

  const orderMap = new Map<number, number>();
  entries.forEach((entry, index) => {
    if (!orderMap.has(entry.facilityId)) {
      orderMap.set(entry.facilityId, index);
    }
  });

  return [...facilities].sort((left, right) => {
    const leftOrder = orderMap.get(left.id);
    const rightOrder = orderMap.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) {
      return -1;
    }
    if (rightOrder !== undefined) {
      return 1;
    }
    return 0;
  });
}
