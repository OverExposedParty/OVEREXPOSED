(function () {
  function createOlingLabFurnitureArtAndPlacement({
    furnitureGridSize,
    getLabImageAssetUrl
  }) {
    const placementSvg = window.OlingLabPlacementSvg;

    function createImage(src, alt) {
      const image = document.createElement('img');
      image.src = getLabImageAssetUrl(src);
      image.alt = alt;
      image.loading = 'lazy';
      return image;
    }

    function getGridPlacementUrl(imageUrl) {
      return getLabImageAssetUrl(imageUrl).replace(
        /\/[^/?#]+\.svg(?=([?#].*)?$)/i,
        '/grid-placement.svg'
      );
    }

    function parseGridPlacement(svgText) {
      return placementSvg?.parseRectPlacement(svgText, furnitureGridSize) || null;
    }

    function parseStorageGridPlacement(svgText) {
      return (
        placementSvg?.parseRectCenterPlacements(svgText, furnitureGridSize) || []
      );
    }

    function applyStorageGridPlacement(item, slots) {
      if (!slots.length) return item;
      return {
        ...item,
        inventorySlots: slots.map((position, index) => ({
          ...(item.inventorySlots?.[index] || {}),
          slotId:
            item.inventorySlots?.[index]?.slotId || `storage-${index + 1}`,
          slotType: item.inventorySlots?.[index]?.slotType || 'storage',
          label:
            item.inventorySlots?.[index]?.label || `Storage slot ${index + 1}`,
          maxStack: item.inventorySlots?.[index]?.maxStack || 8,
          ...position
        }))
      };
    }

    async function parseRestGridPlacement(svgText) {
      return placementSvg?.parseMaskPlacement(svgText, furnitureGridSize) || null;
    }

    function getFurniturePlacement(item) {
      if (item?.usesFullGridArtboard) {
        return {
          x: 0,
          y: 0,
          width: furnitureGridSize,
          height: furnitureGridSize
        };
      }

      return (
        item?.gridPlacement || {
          x: 0,
          y: 0,
          width: furnitureGridSize,
          height: furnitureGridSize
        }
      );
    }

    function createFurnitureArt(item) {
      const placement = getFurniturePlacement(item);
      const art = document.createElement('div');
      art.className = 'oling-lab-furniture-art';
      art.style.setProperty('--furniture-grid-x', placement.x);
      art.style.setProperty('--furniture-grid-y', placement.y);
      art.style.setProperty('--furniture-grid-width', placement.width);
      art.style.setProperty('--furniture-grid-height', placement.height);
      art.appendChild(createImage(item.image, item.name));
      return art;
    }

    function loadFurnitureGridPlacements(catalog) {
      return Promise.all(
        catalog.map(async (item) => {
          const placementUrl = getGridPlacementUrl(item.image);
          if (!placementUrl) return item;

          try {
            const [
              placementResponse,
              artResponse,
              storageResponse,
              restResponse,
              exitResponse
            ] = await Promise.all([
              fetch(placementUrl, { headers: { Accept: 'image/svg+xml' } }),
              fetch(getLabImageAssetUrl(item.image), {
                headers: { Accept: 'image/svg+xml' }
              }),
              item.storageGridPlacement
                ? fetch(getLabImageAssetUrl(item.storageGridPlacement), {
                    headers: { Accept: 'image/svg+xml' }
                  })
                : null,
              item.restGridPlacement
                ? fetch(getLabImageAssetUrl(item.restGridPlacement), {
                    headers: { Accept: 'image/svg+xml' }
                  })
                : null,
              item.exitGridPlacement
                ? fetch(getLabImageAssetUrl(item.exitGridPlacement), {
                    headers: { Accept: 'image/svg+xml' }
                  })
                : null
            ]);
            if (!placementResponse.ok || !artResponse.ok) return item;

            const [gridText, artText, storageText, restText, exitText] =
              await Promise.all([
                placementResponse.text(),
                artResponse.text(),
                storageResponse?.ok
                  ? storageResponse.text()
                  : Promise.resolve(''),
                restResponse?.ok ? restResponse.text() : Promise.resolve(''),
                exitResponse?.ok ? exitResponse.text() : Promise.resolve('')
              ]);
            const gridPlacement = parseGridPlacement(gridText);
            const artboard = placementSvg?.getSvgViewBox(artText);
            if (!gridPlacement) return item;

            const mappedItem = {
              ...item,
              gridPlacement,
              // A 512 x 512 SVG already contains the same grid offsets as its
              // placement file. Scaling it into the rectangle would shrink it twice.
              usesFullGridArtboard:
                typeof item.usesFullGridArtboard === 'boolean'
                  ? item.usesFullGridArtboard
                  : artboard?.width === furnitureGridSize &&
                    artboard?.height === furnitureGridSize
            };
            const restPlacement = restText
              ? await parseRestGridPlacement(restText)
              : null;
            const itemWithRestPlacement = restPlacement
              ? { ...mappedItem, restPlacement }
              : mappedItem;
            const exitPlacement = exitText
              ? await parseRestGridPlacement(exitText)
              : null;
            const itemWithPlacementMasks = exitPlacement
              ? { ...itemWithRestPlacement, exitPlacement }
              : itemWithRestPlacement;
            return storageText
              ? applyStorageGridPlacement(
                  itemWithPlacementMasks,
                  parseStorageGridPlacement(storageText)
                )
              : itemWithPlacementMasks;
          } catch (error) {
            console.warn(
              `Could not load furniture placement grid for ${item.id}.`,
              error
            );
            return item;
          }
        })
      );
    }

    return {
      createImage,
      getFurniturePlacement,
      createFurnitureArt,
      loadFurnitureGridPlacements
    };
  }

  window.createOlingLabFurnitureArtAndPlacement =
    createOlingLabFurnitureArtAndPlacement;
})();
