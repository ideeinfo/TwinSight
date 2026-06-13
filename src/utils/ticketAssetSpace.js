const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export function matchesAssetToSpace(asset, space) {
  if (!asset || !space) return false;

  const roomValue = normalizeText(asset.room);
  const spaceName = normalizeText(space.name);
  const spaceCode = normalizeText(space.code);
  const assetCode = normalizeText(asset.mcCode);

  const roomMatchesSpace = roomValue && (
    roomValue === spaceName
    || roomValue === spaceCode
    || (spaceName && spaceCode && roomValue === `${spaceName} ${spaceCode}`)
    || (spaceName && spaceCode && roomValue === `${spaceCode} ${spaceName}`)
    || (spaceName && spaceCode && roomValue.includes(spaceName) && roomValue.includes(spaceCode))
  );

  return roomMatchesSpace
    || (spaceCode && assetCode.includes(spaceCode))
    || Number(asset.dbId) === Number(space.dbId);
}

export function resolveAssetSpace(asset, spaces = []) {
  return spaces.find((space) => matchesAssetToSpace(asset, space)) || null;
}
