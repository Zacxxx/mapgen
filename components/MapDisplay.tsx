
import React, { useEffect, useRef, useMemo } from 'react';
import { 
    MapFeature, MapBiome, AltitudeCategory, MapViewMode, BorderSegment, MapRegion, 
    TemperatureCategory, BiomeType, WaterCellsMap, BeachCellsMap, FeatureType,
    MapCountry, MapAlliance, MapZone, OccupiedCellMap
} from '../types';
import { 
    MAP_WIDTH, MAP_HEIGHT, 
    GRID_ROWS, GRID_COLS, POLAR_ZONE_ROWS,
    LOGICAL_CELL_WIDTH, LOGICAL_CELL_HEIGHT, LOGICAL_MAP_WIDTH, LOGICAL_MAP_HEIGHT,
    GRID_BACKGROUND_COLOR, GRID_LINE_COLOR, GRID_LINE_WIDTH,
    HOVER_BORDER_COLOR, SELECTED_BORDER_COLOR, GENERIC_HIGHLIGHT_BORDER_WIDTH,
    POLITICAL_VIEW_DESATURATION_FACTOR, POLITICAL_VIEW_BACKGROUND_TINT_COLOR,
    COUNTRY_FILL_OPACITY, COUNTRY_SELECTED_FILL_OPACITY, COUNTRY_HOVER_FILL_OPACITY, COUNTRY_NON_SELECTED_ADJACENT_FILL_OPACITY, 
    COUNTRY_BORDER_COLOR, COUNTRY_HOVER_BORDER_COLOR, COUNTRY_SELECTED_BORDER_COLOR, COUNTRY_BORDER_WIDTH, COUNTRY_SVG_BORDER_OUTLINE_COLOR, COUNTRY_SVG_BORDER_OUTLINE_WIDTH_FACTOR,
    ALLIANCE_FILL_OPACITY, ALLIANCE_SELECTED_FILL_OPACITY, ALLIANCE_HOVER_FILL_OPACITY, ALLIANCE_NON_SELECTED_ADJACENT_FILL_OPACITY, 
    ALLIANCE_BORDER_COLOR, ALLIANCE_HOVER_BORDER_COLOR, ALLIANCE_SELECTED_BORDER_COLOR, ALLIANCE_BORDER_WIDTH, ALLIANCE_SVG_BORDER_OUTLINE_COLOR, ALLIANCE_SVG_BORDER_OUTLINE_WIDTH_FACTOR,
    ELEVATION_COLORS, BIOME_TYPE_STYLES, FEATURE_TYPE_STYLES, CONTOUR_LINE_COLOR_DARKER_FACTOR, CONTOUR_LINE_WIDTH,
    REALISTIC_VIEW_TEXTURE_NOISE_SCALE, HILLSHADING_STRENGTH, 
    SNOW_CAP_TEMP_THRESHOLD, SNOW_CAP_BASE_COLOR, SNOW_CAP_HIGHLIGHT_COLOR, SNOW_NOISE_SCALE_SMALL, SNOW_NOISE_SCALE_LARGE, SNOW_NOISE_INTENSITY,
    REALISTIC_OCEAN_DEEP_COLOR, REALISTIC_OCEAN_SHALLOW_COLOR, REALISTIC_RIVER_COLOR, REALISTIC_BEACH_COLOR,
    REALISTIC_SEA_ICE_COLOR, OCEAN_SURFACE_NOISE_SCALE, OCEAN_SURFACE_NOISE_INTENSITY,
    REALISTIC_LAND_TEMPERATE_DEFAULT_COLOR, REALISTIC_LAND_HOT_DEFAULT_COLOR,
    REALISTIC_LAND_COLD_DEFAULT_COLOR, REALISTIC_ROCK_COLOR_HIGH_ALT,
    FOREST_TEXTURE_COLOR, FOREST_TEXTURE_NOISE_SCALE, JUNGLE_TEXTURE_COLOR, JUNGLE_TEXTURE_NOISE_SCALE,
    ATMOSPHERIC_HAZE_COLOR, ATMOSPHERIC_HAZE_START_ROW_FACTOR, ATMOSPHERIC_HAZE_MAX_INTENSITY,
    BORDER_NOISE_SCALE, BORDER_BLEND_THRESHOLD,
    FEATURE_LABEL_FONT_SIZE_BASE, FEATURE_LABEL_MIN_VISIBLE_SIZE_ZOOMED,
    FEATURE_LABEL_STROKE_COLOR, FEATURE_LABEL_STROKE_WIDTH_BASE, FEATURE_LABEL_FILL_COLOR
} from '../constants';
import { SimplexNoise } from '../utils/noise'; 

const getWrappedRowLocal = (r: number): number => (r % GRID_ROWS + GRID_ROWS) % GRID_ROWS;
const getWrappedColLocal = (c: number): number => (c % GRID_COLS + GRID_COLS) % GRID_COLS;


interface RgbaColor { r: number; g: number; b: number; a: number; }

const parseRgba = (colorString?: string): RgbaColor | null => {
  if (!colorString) return null;
  const match = colorString.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/);
  if (!match) {
    if (colorString.startsWith('rgb(')) { 
        const simplerMatch = colorString.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/);
        if (simplerMatch) {
             return { r: parseInt(simplerMatch[1]), g: parseInt(simplerMatch[2]), b: parseInt(simplerMatch[3]), a: 1 };
        }
    }
    if (colorString.startsWith('#')) {
        let hex = colorString.substring(1);
        if (hex.length === 3) hex = hex.split('').map(char => char + char).join('');
        if (hex.length === 6) {
            return {
                r: parseInt(hex.substring(0, 2), 16),
                g: parseInt(hex.substring(2, 4), 16),
                b: parseInt(hex.substring(4, 6), 16),
                a: 1
            };
        }
    }
    console.warn("Could not parse color string:", colorString);
    return null;
  }
  return {
    r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]),
    a: match[4] ? parseFloat(match[4]) : 1,
  };
};

const rgbaToString = (color: RgbaColor): string => `rgba(${color.r},${color.g},${color.b},${color.a})`;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const desaturateAndTintRgba = (
    baseColor: RgbaColor, 
    desaturationFactor: number, 
    tintColor?: RgbaColor | null, 
    tintAlphaFactor: number = 1 
    ): RgbaColor => {
    
    let r = baseColor.r; let g = baseColor.g; let b = baseColor.b;
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    r = Math.round(gray + (r - gray) * desaturationFactor);
    g = Math.round(gray + (g - gray) * desaturationFactor);
    b = Math.round(gray + (b - gray) * desaturationFactor);

    if (tintColor) {
        const tintR = tintColor.r; const tintG = tintColor.g; const tintB = tintColor.b;
        const effectiveTintAlpha = tintColor.a * tintAlphaFactor;
        r = Math.round(r * (1 - effectiveTintAlpha) + tintR * effectiveTintAlpha);
        g = Math.round(g * (1 - effectiveTintAlpha) + tintG * effectiveTintAlpha);
        b = Math.round(b * (1 - effectiveTintAlpha) + tintB * effectiveTintAlpha);
    }
    return { r: clamp(r,0,255), g: clamp(g,0,255), b: clamp(b,0,255), a: baseColor.a };
};


interface MapDisplayProps {
  biomeGrid: (string | null)[][]; 
  mapBiomes: MapBiome[]; 
  mapRegions: MapRegion[];
  mapCountries: MapCountry[];
  mapAlliances: MapAlliance[];
  mapZones: MapZone[];
  altitudeMap: AltitudeCategory[][]; 
  waterCellsMap: WaterCellsMap; 
  beachCellsMap: BeachCellsMap;
  temperatureMap: TemperatureCategory[][]; 
  features: MapFeature[];
  occupiedCellMap: OccupiedCellMap; 
  selectedFeatureId: string | null;
  selectedBiomeId: string | null;
  hoveredBiomeId: string | null;
  selectedRegionId: string | null; 
  hoveredRegionId: string | null;
  selectedCountryId: string | null;
  hoveredCountryId: string | null;
  selectedAllianceId: string | null;
  hoveredAllianceId: string | null;
  mapViewMode: MapViewMode;
  viewportOffset: { x: number, y: number };
  zoomLevel: number;
  onFeatureClick: (featureId: string, event: React.MouseEvent<SVGElement | HTMLDivElement>) => void;
  onFeatureHover: (feature: MapFeature | null, event?: React.MouseEvent<SVGElement | HTMLDivElement>) => void;
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasMouseLeave: () => void;
  onMapPanStart: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMapPanEnd: (event: React.MouseEvent<HTMLDivElement>) => void;
  showGridOverlay: boolean;
  isPanning: boolean;
  isWorldPopulated: boolean; 
}

// Pre-parse constant colors
const PARSED_GRID_BACKGROUND_COLOR = parseRgba(GRID_BACKGROUND_COLOR)!;
const PARSED_POLITICAL_VIEW_BACKGROUND_TINT_COLOR = parseRgba(POLITICAL_VIEW_BACKGROUND_TINT_COLOR);
const PARSED_ELEVATION_COLORS = Object.fromEntries(
  Object.entries(ELEVATION_COLORS).map(([key, value]) => [key, parseRgba(value)!])
) as Record<number, RgbaColor>;
const PARSED_BIOME_COLORS = Object.fromEntries(
    Object.entries(BIOME_TYPE_STYLES).map(([key, style]) => [key as BiomeType, parseRgba(style.color)!])
) as Record<BiomeType, RgbaColor>;

const PARSED_REALISTIC_OCEAN_DEEP_COLOR = parseRgba(REALISTIC_OCEAN_DEEP_COLOR)!;
const PARSED_REALISTIC_OCEAN_SHALLOW_COLOR = parseRgba(REALISTIC_OCEAN_SHALLOW_COLOR)!;
const PARSED_REALISTIC_RIVER_COLOR = parseRgba(REALISTIC_RIVER_COLOR)!;
const PARSED_REALISTIC_BEACH_COLOR = parseRgba(REALISTIC_BEACH_COLOR)!;
const PARSED_REALISTIC_SEA_ICE_COLOR = parseRgba(REALISTIC_SEA_ICE_COLOR)!;
const PARSED_REALISTIC_ROCK_COLOR_HIGH_ALT = parseRgba(REALISTIC_ROCK_COLOR_HIGH_ALT)!;
const PARSED_SNOW_CAP_BASE_COLOR = parseRgba(SNOW_CAP_BASE_COLOR)!;
const PARSED_SNOW_CAP_HIGHLIGHT_COLOR = parseRgba(SNOW_CAP_HIGHLIGHT_COLOR)!;
const PARSED_FOREST_TEXTURE_COLOR = parseRgba(FOREST_TEXTURE_COLOR)!;
const PARSED_JUNGLE_TEXTURE_COLOR = parseRgba(JUNGLE_TEXTURE_COLOR)!;
const PARSED_ATMOSPHERIC_HAZE_COLOR = parseRgba(ATMOSPHERIC_HAZE_COLOR)!;


const calculateSingleBiomeBorderSegments = (
    biomeId: string | null, 
    grid: (string | null)[][],
): BorderSegment[] => {
    if (!biomeId || grid.length === 0 || grid[0].length === 0) return [];
    const segments: BorderSegment[] = [];
    
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (grid[r][c] === biomeId) {
                const currentLogicalX = c * LOGICAL_CELL_WIDTH;
                const currentLogicalY = r * LOGICAL_CELL_HEIGHT;
                if (grid[getWrappedRowLocal(r - 1)][c] !== biomeId) {
                    segments.push({ x1: currentLogicalX, y1: currentLogicalY, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY });
                }
                if (grid[getWrappedRowLocal(r + 1)][c] !== biomeId) {
                    segments.push({ x1: currentLogicalX, y1: currentLogicalY + LOGICAL_CELL_HEIGHT, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY + LOGICAL_CELL_HEIGHT });
                }
                if (grid[r][getWrappedColLocal(c - 1)] !== biomeId) {
                    segments.push({ x1: currentLogicalX, y1: currentLogicalY, x2: currentLogicalX, y2: currentLogicalY + LOGICAL_CELL_HEIGHT });
                }
                if (grid[r][getWrappedColLocal(c + 1)] !== biomeId) {
                    segments.push({ x1: currentLogicalX + LOGICAL_CELL_WIDTH, y1: currentLogicalY, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY + LOGICAL_CELL_HEIGHT });
                }
            }
        }
    }
    return segments;
};

const calculateRegionBorderSegments = (
    targetRegionId: string | null, grid: (string | null)[][], biomes: MapBiome[]
): BorderSegment[] => { 
    if (!targetRegionId || grid.length === 0 || grid[0].length === 0 || biomes.length === 0) return [];
    const segments: BorderSegment[] = [];
    const getRegionIdForCell = (r_logical: number, c_logical: number): string | undefined => {
        const biomeId = grid[r_logical]?.[c_logical]; if (!biomeId) return undefined;
        const biome = biomes.find(b => b.id === biomeId); return biome?.regionId;
    };
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++) {
        const cellRegionId = getRegionIdForCell(r, c); const currentLogicalX = c * LOGICAL_CELL_WIDTH; const currentLogicalY = r * LOGICAL_CELL_HEIGHT;
        if (cellRegionId === targetRegionId) {
            if (getRegionIdForCell(r, getWrappedColLocal(c + 1)) !== targetRegionId) segments.push({ x1: currentLogicalX + LOGICAL_CELL_WIDTH, y1: currentLogicalY, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY + LOGICAL_CELL_HEIGHT });
            if (getRegionIdForCell(getWrappedRowLocal(r + 1), c) !== targetRegionId) segments.push({ x1: currentLogicalX, y1: currentLogicalY + LOGICAL_CELL_HEIGHT, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY + LOGICAL_CELL_HEIGHT });
            if (getRegionIdForCell(getWrappedRowLocal(r - 1), c) !== targetRegionId) segments.push({ x1: currentLogicalX, y1: currentLogicalY, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY });
            if (getRegionIdForCell(r, getWrappedColLocal(c - 1)) !== targetRegionId) segments.push({ x1: currentLogicalX, y1: currentLogicalY, x2: currentLogicalX, y2: currentLogicalY + LOGICAL_CELL_HEIGHT });
        }
    }
    const uniqueSegments: BorderSegment[] = []; const segmentSet = new Set<string>();
    for (const seg of segments) { const key1 = `${seg.x1},${seg.y1}-${seg.x2},${seg.y2}`; const key2 = `${seg.x2},${seg.y2}-${seg.x1},${seg.y1}`; if (!segmentSet.has(key1) && !segmentSet.has(key2)) { uniqueSegments.push(seg); segmentSet.add(key1);}}
    return uniqueSegments;
};

const calculatePoliticalEntityBorders = (
    targetEntityId: string | null,
    grid: (string | null)[][], 
    biomes: MapBiome[],
    regions: MapRegion[],
    countries: MapCountry[],
    entityType: 'country' | 'alliance'
): BorderSegment[] => {
    if (!targetEntityId || grid.length === 0 || biomes.length === 0) return [];
    const segments: BorderSegment[] = [];

    const getEntityIdForCell = (r_logical: number, c_logical: number): string | undefined => {
        const biomeId = grid[r_logical]?.[c_logical];
        if (!biomeId) return undefined;
        const biome = biomes.find(b => b.id === biomeId);
        if (!biome?.regionId) return undefined;
        const region = regions.find(reg => reg.id === biome.regionId);
        if (!region?.countryId) return undefined;
        if (entityType === 'country') return region.countryId;
        const country = countries.find(cntry => cntry.id === region.countryId);
        return country?.allianceId;
    };

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cellEntityId = getEntityIdForCell(r, c);
            const currentLogicalX = c * LOGICAL_CELL_WIDTH;
            const currentLogicalY = r * LOGICAL_CELL_HEIGHT;

            if (cellEntityId === targetEntityId) {
                if (getEntityIdForCell(r, getWrappedColLocal(c + 1)) !== targetEntityId) { segments.push({ x1: currentLogicalX + LOGICAL_CELL_WIDTH, y1: currentLogicalY, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY + LOGICAL_CELL_HEIGHT }); }
                if (getEntityIdForCell(getWrappedRowLocal(r + 1), c) !== targetEntityId) { segments.push({ x1: currentLogicalX, y1: currentLogicalY + LOGICAL_CELL_HEIGHT, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY + LOGICAL_CELL_HEIGHT }); }
                if (getEntityIdForCell(getWrappedRowLocal(r - 1), c) !== targetEntityId) { segments.push({ x1: currentLogicalX, y1: currentLogicalY, x2: currentLogicalX + LOGICAL_CELL_WIDTH, y2: currentLogicalY }); }
                if (getEntityIdForCell(r, getWrappedColLocal(c - 1)) !== targetEntityId) { segments.push({ x1: currentLogicalX, y1: currentLogicalY, x2: currentLogicalX, y2: currentLogicalY + LOGICAL_CELL_HEIGHT }); }
            }
        }
    }
    const uniqueSegments: BorderSegment[] = []; const segmentSet = new Set<string>();
    for (const seg of segments) { const key1 = `${seg.x1},${seg.y1}-${seg.x2},${seg.y2}`; const key2 = `${seg.x2},${seg.y2}-${seg.x1},${seg.y1}`; if (!segmentSet.has(key1) && !segmentSet.has(key2)) { uniqueSegments.push(seg); segmentSet.add(key1);}}
    return uniqueSegments;
};


const MapDisplay: React.FC<MapDisplayProps> = ({ 
  biomeGrid, mapBiomes, mapRegions, mapCountries, mapAlliances, mapZones,
  altitudeMap, waterCellsMap, beachCellsMap, temperatureMap, features, occupiedCellMap,
  selectedFeatureId, selectedBiomeId, hoveredBiomeId, selectedRegionId, hoveredRegionId,
  selectedCountryId, hoveredCountryId, selectedAllianceId, hoveredAllianceId,
  mapViewMode, viewportOffset, zoomLevel,
  onFeatureClick, onFeatureHover,
  onCanvasClick, onCanvasMouseMove, onCanvasMouseLeave,
  onMapPanStart, onMapPanEnd,
  showGridOverlay, isPanning, isWorldPopulated
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const borderNoiseGen = useMemo(() => new SimplexNoise('border_blend_seed_v1.3'), []);
  const textureNoiseGen = useMemo(() => new SimplexNoise('map_texture_seed_v1.2'), []);
  const snowNoiseSmall = useMemo(() => new SimplexNoise('snow_detail_v1.1'), []);
  const snowNoiseLarge = useMemo(() => new SimplexNoise('snow_drift_v1.1'), []);
  const oceanSurfaceNoise = useMemo(() => new SimplexNoise('ocean_surface_v1.1'), []);


  const selectedBiomeBorders = useMemo(() => isWorldPopulated ? calculateSingleBiomeBorderSegments(selectedBiomeId, biomeGrid) : [], [selectedBiomeId, biomeGrid, isWorldPopulated]);
  const hoveredBiomeBorders = useMemo(() => isWorldPopulated ? calculateSingleBiomeBorderSegments(hoveredBiomeId, biomeGrid) : [], [hoveredBiomeId, biomeGrid, isWorldPopulated]);
  const selectedRegionBorders = useMemo(() => isWorldPopulated ? calculateRegionBorderSegments(selectedRegionId, biomeGrid, mapBiomes) : [], [selectedRegionId, biomeGrid, mapBiomes, isWorldPopulated]);
  const hoveredRegionBorders = useMemo(() => isWorldPopulated ? calculateRegionBorderSegments(hoveredRegionId, biomeGrid, mapBiomes) : [], [hoveredRegionId, biomeGrid, mapBiomes, isWorldPopulated]);
  const selectedCountryBorders = useMemo(() => isWorldPopulated ? calculatePoliticalEntityBorders(selectedCountryId, biomeGrid, mapBiomes, mapRegions, mapCountries, 'country') : [], [selectedCountryId, biomeGrid, mapBiomes, mapRegions, mapCountries, isWorldPopulated]);
  const hoveredCountryBorders = useMemo(() => isWorldPopulated ? calculatePoliticalEntityBorders(hoveredCountryId, biomeGrid, mapBiomes, mapRegions, mapCountries, 'country') : [], [hoveredCountryId, biomeGrid, mapBiomes, mapRegions, mapCountries, isWorldPopulated]);
  const selectedAllianceBorders = useMemo(() => isWorldPopulated ? calculatePoliticalEntityBorders(selectedAllianceId, biomeGrid, mapBiomes, mapRegions, mapCountries, 'alliance') : [], [selectedAllianceId, biomeGrid, mapBiomes, mapRegions, mapCountries, isWorldPopulated]);
  const hoveredAllianceBorders = useMemo(() => isWorldPopulated ? calculatePoliticalEntityBorders(hoveredAllianceId, biomeGrid, mapBiomes, mapRegions, mapCountries, 'alliance') : [], [hoveredAllianceId, biomeGrid, mapBiomes, mapRegions, mapCountries, isWorldPopulated]);

  const getRealisticCellColor = ( 
        logicalR: number, logicalC: number,
        altCat: AltitudeCategory, tempCat: TemperatureCategory,
        isWaterCell: boolean, isBeachCell: boolean,
        biome: MapBiome | null | undefined,
        isPolarZone: boolean
    ): RgbaColor => {
        let rCell=0, gCell=0, bCell=0;

        if (isWaterCell) {
            let parsedWater = (altCat === -2) ? PARSED_REALISTIC_OCEAN_DEEP_COLOR : PARSED_REALISTIC_OCEAN_SHALLOW_COLOR;
            const surfaceNoise = oceanSurfaceNoise.noise2D(logicalC * OCEAN_SURFACE_NOISE_SCALE, logicalR * OCEAN_SURFACE_NOISE_SCALE);
            const brightnessFactor = 1.0 + surfaceNoise * OCEAN_SURFACE_NOISE_INTENSITY;
            rCell = clamp(Math.round(parsedWater.r * brightnessFactor), 0, 255);
            gCell = clamp(Math.round(parsedWater.g * brightnessFactor), 0, 255);
            bCell = clamp(Math.round(parsedWater.b * brightnessFactor), 0, 255);

            if (isPolarZone && tempCat === TemperatureCategory.Freezing && altCat === -1) { 
                rCell = PARSED_REALISTIC_SEA_ICE_COLOR.r; gCell = PARSED_REALISTIC_SEA_ICE_COLOR.g; bCell = PARSED_REALISTIC_SEA_ICE_COLOR.b;
            }
        } else { 
            let parsedLandBase: RgbaColor; let baseColorIsFlatIce = false;
            if (isWorldPopulated && biome && biome.type !== BiomeType.River) {
                 parsedLandBase = PARSED_BIOME_COLORS[biome.type] || PARSED_BIOME_COLORS[BiomeType.Other];
                 if (biome.type === BiomeType.Ice) baseColorIsFlatIce = true;
            } else {
                if (isPolarZone) {
                  if (tempCat === TemperatureCategory.Freezing) { parsedLandBase = PARSED_BIOME_COLORS[BiomeType.Ice]; baseColorIsFlatIce = true; }
                  else parsedLandBase = PARSED_BIOME_COLORS[BiomeType.Tundra];
                } else if (altCat === 2) { parsedLandBase = PARSED_REALISTIC_ROCK_COLOR_HIGH_ALT;
                } else {
                    switch (tempCat) {
                        case TemperatureCategory.Hot: parsedLandBase = altCat === 0 ? PARSED_BIOME_COLORS[BiomeType.Desert] : parseRgba(REALISTIC_LAND_HOT_DEFAULT_COLOR)!; break;
                        case TemperatureCategory.Warm: parsedLandBase = altCat === 0 ? PARSED_BIOME_COLORS[BiomeType.Grassland] : parseRgba(REALISTIC_LAND_TEMPERATE_DEFAULT_COLOR)!; break;
                        case TemperatureCategory.Temperate: parsedLandBase = altCat === 0 ? PARSED_BIOME_COLORS[BiomeType.Plains] : PARSED_BIOME_COLORS[BiomeType.Forest]; break;
                        case TemperatureCategory.Cold: parsedLandBase = altCat === 0 ? PARSED_BIOME_COLORS[BiomeType.Taiga] : parseRgba(REALISTIC_LAND_COLD_DEFAULT_COLOR)!; break;
                        case TemperatureCategory.Freezing: parsedLandBase = PARSED_BIOME_COLORS[BiomeType.Tundra]; break;
                        default: parsedLandBase = parseRgba(REALISTIC_LAND_TEMPERATE_DEFAULT_COLOR)!;
                    }
                }
            }
            rCell = parsedLandBase.r; gCell = parsedLandBase.g; bCell = parsedLandBase.b;
            if (!baseColorIsFlatIce) {
                let elevTintFactor = 1.0; if (altCat === 0) elevTintFactor = 0.90; else if (altCat === 2) elevTintFactor = 1.15; 
                rCell = clamp(Math.round(rCell*elevTintFactor),0,255); gCell = clamp(Math.round(gCell*elevTintFactor),0,255); bCell = clamp(Math.round(bCell*elevTintFactor),0,255);
                const southAlt = altitudeMap[getWrappedRowLocal(logicalR + 1)][logicalC]; let hillshadeFactor = 1.0;
                if (!isWaterCell && !waterCellsMap[getWrappedRowLocal(logicalR + 1)][logicalC]) { const altDiff = altCat - southAlt; const normalizedSlopeEffect = clamp(altDiff / 2.0, -1.0, 1.0); hillshadeFactor = 1.0 + normalizedSlopeEffect * (HILLSHADING_STRENGTH / 100.0); }
                hillshadeFactor = clamp(hillshadeFactor, 1.0 - (HILLSHADING_STRENGTH/100.0), 1.0 + (HILLSHADING_STRENGTH/100.0));
                rCell = clamp(Math.round(rCell * hillshadeFactor), 0, 255); gCell = clamp(Math.round(gCell * hillshadeFactor), 0, 255); bCell = clamp(Math.round(bCell * hillshadeFactor), 0, 255);
                const textureNoiseVal = textureNoiseGen.noise2D(logicalC * REALISTIC_VIEW_TEXTURE_NOISE_SCALE, logicalR * REALISTIC_VIEW_TEXTURE_NOISE_SCALE);
                const textureTintFactor = 1.0 + textureNoiseVal * 0.07; 
                rCell = clamp(Math.round(rCell * textureTintFactor), 0, 255); gCell = clamp(Math.round(gCell * textureTintFactor), 0, 255); bCell = clamp(Math.round(bCell * textureTintFactor), 0, 255);
                if (isWorldPopulated && biome) {
                    let vegNoise = 0; let vegColor: RgbaColor | null = null;
                    if (biome.type === BiomeType.Forest) { vegNoise = textureNoiseGen.noise2D(logicalC * FOREST_TEXTURE_NOISE_SCALE, logicalR * FOREST_TEXTURE_NOISE_SCALE); vegColor = PARSED_FOREST_TEXTURE_COLOR; } 
                    else if (biome.type === BiomeType.Jungle) { vegNoise = textureNoiseGen.noise2D(logicalC * JUNGLE_TEXTURE_NOISE_SCALE, logicalR * JUNGLE_TEXTURE_NOISE_SCALE); vegColor = PARSED_JUNGLE_TEXTURE_COLOR; }
                    if (vegColor && vegNoise > 0.1) { const factor = vegNoise * vegColor.a; rCell = clamp(Math.round(rCell * (1 - factor) + vegColor.r * factor), 0, 255); gCell = clamp(Math.round(gCell * (1 - factor) + vegColor.g * factor), 0, 255); bCell = clamp(Math.round(bCell * (1 - factor) + vegColor.b * factor), 0, 255); }
                }
            }
            if (isWorldPopulated && biome && biome.type === BiomeType.Ice) { rCell = PARSED_BIOME_COLORS[BiomeType.Ice].r; gCell = PARSED_BIOME_COLORS[BiomeType.Ice].g; bCell = PARSED_BIOME_COLORS[BiomeType.Ice].b; baseColorIsFlatIce = true; } 
            else if (isPolarZone && tempCat === TemperatureCategory.Freezing && !baseColorIsFlatIce) { rCell = PARSED_BIOME_COLORS[BiomeType.Ice].r; gCell = PARSED_BIOME_COLORS[BiomeType.Ice].g; bCell = PARSED_BIOME_COLORS[BiomeType.Ice].b; baseColorIsFlatIce = true; }
            if (isWorldPopulated && biome && biome.type === BiomeType.River && !isBeachCell && !baseColorIsFlatIce) { rCell=PARSED_REALISTIC_RIVER_COLOR.r; gCell=PARSED_REALISTIC_RIVER_COLOR.g; bCell=PARSED_REALISTIC_RIVER_COLOR.b; }
            if (isBeachCell) { rCell=PARSED_REALISTIC_BEACH_COLOR.r; gCell=PARSED_REALISTIC_BEACH_COLOR.g; bCell=PARSED_REALISTIC_BEACH_COLOR.b; }
            const isCurrentlyRiver = () => rCell === PARSED_REALISTIC_RIVER_COLOR.r && gCell === PARSED_REALISTIC_RIVER_COLOR.g && bCell === PARSED_REALISTIC_RIVER_COLOR.b;
            const isCurrentlyBeach = () => rCell === PARSED_REALISTIC_BEACH_COLOR.r && gCell === PARSED_REALISTIC_BEACH_COLOR.g && bCell === PARSED_REALISTIC_BEACH_COLOR.b;

            if (altCat === 2 && tempCat <= SNOW_CAP_TEMP_THRESHOLD && !baseColorIsFlatIce && !isCurrentlyBeach() && !isCurrentlyRiver()) {
                const noiseS = snowNoiseSmall.noise2D(logicalC * SNOW_NOISE_SCALE_SMALL, logicalR * SNOW_NOISE_SCALE_SMALL);
                const noiseL = snowNoiseLarge.noise2D(logicalC * SNOW_NOISE_SCALE_LARGE, logicalR * SNOW_NOISE_SCALE_LARGE);
                const combinedNoise = (noiseS * 0.6 + noiseL * 0.4 + 1) / 2; 
                const snowIntensity = SNOW_NOISE_INTENSITY + Math.abs(textureNoiseGen.noise2D(logicalC * 0.1, logicalR*0.1)) * 0.1; 
                rCell = clamp(Math.round(PARSED_SNOW_CAP_BASE_COLOR.r * (1 - combinedNoise * snowIntensity) + PARSED_SNOW_CAP_HIGHLIGHT_COLOR.r * combinedNoise * snowIntensity), 0, 255);
                gCell = clamp(Math.round(PARSED_SNOW_CAP_BASE_COLOR.g * (1 - combinedNoise * snowIntensity) + PARSED_SNOW_CAP_HIGHLIGHT_COLOR.g * combinedNoise * snowIntensity), 0, 255);
                bCell = clamp(Math.round(PARSED_SNOW_CAP_BASE_COLOR.b * (1 - combinedNoise * snowIntensity) + PARSED_SNOW_CAP_HIGHLIGHT_COLOR.b * combinedNoise * snowIntensity), 0, 255);
            }
        }
        if (!isWaterCell) {
            const hazeStartRow = GRID_ROWS * ATMOSPHERIC_HAZE_START_ROW_FACTOR;
            if (logicalR > hazeStartRow) {
                const hazeFactor = Math.min(1, (logicalR - hazeStartRow) / (GRID_ROWS - hazeStartRow)) * ATMOSPHERIC_HAZE_MAX_INTENSITY;
                rCell = clamp(Math.round(rCell * (1 - hazeFactor) + PARSED_ATMOSPHERIC_HAZE_COLOR.r * hazeFactor), 0, 255);
                gCell = clamp(Math.round(gCell * (1 - hazeFactor) + PARSED_ATMOSPHERIC_HAZE_COLOR.g * hazeFactor), 0, 255);
                bCell = clamp(Math.round(bCell * (1 - hazeFactor) + PARSED_ATMOSPHERIC_HAZE_COLOR.b * hazeFactor), 0, 255);
            }
        }
        return {r: rCell, g: gCell, b: bCell, a: 1.0};
  };


  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = MAP_WIDTH; canvas.height = MAP_HEIGHT;
    ctx.imageSmoothingEnabled = false; 
    ctx.clearRect(0,0, MAP_WIDTH, MAP_HEIGHT);
    ctx.fillStyle = rgbaToString(PARSED_GRID_BACKGROUND_COLOR);
    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    if (altitudeMap.length === 0 || temperatureMap.length === 0) return; 

    const displayCellWidth = LOGICAL_CELL_WIDTH * zoomLevel;
    const displayCellHeight = LOGICAL_CELL_HEIGHT * zoomLevel;
    const numColsToDraw = Math.ceil(MAP_WIDTH / displayCellWidth) + 2; 
    const numRowsToDraw = Math.ceil(MAP_HEIGHT / displayCellHeight) + 2;
    const firstLogicalColBase = Math.floor(viewportOffset.x / LOGICAL_CELL_WIDTH);
    const firstLogicalRowBase = Math.floor(viewportOffset.y / LOGICAL_CELL_HEIGHT);
    const offsetXForScreen = -(viewportOffset.x * zoomLevel % displayCellWidth);
    const offsetYForScreen = -(viewportOffset.y * zoomLevel % displayCellHeight);

    const imageData = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
    const data = imageData.data;

    for (let r_offset_draw = 0; r_offset_draw < numRowsToDraw; r_offset_draw++) {
      const screenY = Math.floor(r_offset_draw * displayCellHeight + offsetYForScreen);
      for (let c_offset_draw = 0; c_offset_draw < numColsToDraw; c_offset_draw++) {
        const screenX = Math.floor(c_offset_draw * displayCellWidth + offsetXForScreen);
        const logicalR = getWrappedRowLocal(firstLogicalRowBase + r_offset_draw);
        const logicalC = getWrappedColLocal(firstLogicalColBase + c_offset_draw);
        
        let cellColorRgba: RgbaColor;
        const altCat = altitudeMap[logicalR]?.[logicalC]; const tempCat = temperatureMap[logicalR]?.[logicalC];
        const isWaterCell = waterCellsMap[logicalR]?.[logicalC]; const isBeachCell = beachCellsMap[logicalR]?.[logicalC];
        const biomeIdAtCell = isWorldPopulated ? biomeGrid[logicalR]?.[logicalC] : null;
        const biome = biomeIdAtCell ? mapBiomes.find(b => b.id === biomeIdAtCell) : null;
        const isPolarZone = logicalR < POLAR_ZONE_ROWS || logicalR >= GRID_ROWS - POLAR_ZONE_ROWS;

        const featureIdInCell = isWorldPopulated ? occupiedCellMap[logicalR]?.[logicalC] : null;
        let featureInCell: MapFeature | null = null;
        if (featureIdInCell) {
            featureInCell = features.find(f => f.id === featureIdInCell && f.type !== FeatureType.Road) || null;
        }

        if (featureInCell) {
            cellColorRgba = parseRgba(featureInCell.fillColor) || PARSED_BIOME_COLORS[BiomeType.Other];
        } else {
            if (mapViewMode === 'elevation') {
                cellColorRgba = PARSED_ELEVATION_COLORS[altCat] || PARSED_GRID_BACKGROUND_COLOR;
            } else if (mapViewMode === 'biomes' && isWorldPopulated) {
                let colorToUseRgba = PARSED_GRID_BACKGROUND_COLOR;
                 if (biome) {
                    colorToUseRgba = PARSED_BIOME_COLORS[biome.type] || PARSED_BIOME_COLORS[BiomeType.Other];
                    const ownBiomeId = biome.id; const ownBiomeType = biome.type; const isCurrentBiomeLand = ownBiomeType !== BiomeType.Ocean && ownBiomeType !== BiomeType.River && ownBiomeType !== BiomeType.Ice; 
                    const neighborCoords = [ { r: getWrappedRowLocal(logicalR - 1), c: logicalC }, { r: getWrappedRowLocal(logicalR + 1), c: logicalC }, { r: logicalR, c: getWrappedColLocal(logicalC - 1) }, { r: logicalR, c: getWrappedColLocal(logicalC + 1) }, ];
                    const neighborBiomeCounts: Record<string, { count: number, biome?: MapBiome }> = {}; let distinctNeighboringLandBiomesCount = 0;
                    for (const n_coord of neighborCoords) {
                        const neighborGridBiomeId = biomeGrid[n_coord.r]?.[n_coord.c];
                        if (neighborGridBiomeId && neighborGridBiomeId !== ownBiomeId) {
                            const neighborMapBiome = mapBiomes.find(b => b.id === neighborGridBiomeId);
                            if (neighborMapBiome) { const isNeighborBiomeLand = neighborMapBiome.type !== BiomeType.Ocean && neighborMapBiome.type !== BiomeType.River && neighborMapBiome.type !== BiomeType.Ice; if (isCurrentBiomeLand && isNeighborBiomeLand) { if (!neighborBiomeCounts[neighborGridBiomeId]) { neighborBiomeCounts[neighborGridBiomeId] = { count: 0, biome: neighborMapBiome }; distinctNeighboringLandBiomesCount++; } neighborBiomeCounts[neighborGridBiomeId].count++; } }
                        }
                    }
                    if (distinctNeighboringLandBiomesCount > 0) {
                        let dominantDifferentNeighbor: MapBiome | undefined = undefined; let maxCount = 0;
                        for (const id_b in neighborBiomeCounts) { if (neighborBiomeCounts[id_b].count > maxCount) { maxCount = neighborBiomeCounts[id_b].count; dominantDifferentNeighbor = neighborBiomeCounts[id_b].biome; } }
                        if (dominantDifferentNeighbor) {
                            const noiseVal = borderNoiseGen.noise2D(logicalC * BORDER_NOISE_SCALE, logicalR * BORDER_NOISE_SCALE); const normalizedNoise = (noiseVal + 1) / 2; 
                            let currentThreshold = BORDER_BLEND_THRESHOLD; if (maxCount === 1) currentThreshold += 0.15; else if (maxCount === 2) currentThreshold += 0.05; else if (maxCount === 3) currentThreshold -= 0.1;  else if (maxCount >= 4) currentThreshold -= 0.2; currentThreshold = clamp(currentThreshold, 0.1, 0.9); 
                            if (normalizedNoise > currentThreshold) colorToUseRgba = PARSED_BIOME_COLORS[dominantDifferentNeighbor.type] || PARSED_BIOME_COLORS[BiomeType.Other];
                        }
                    }
                } else if (isWaterCell) { colorToUseRgba = PARSED_BIOME_COLORS[BiomeType.Ocean];  }
                cellColorRgba = colorToUseRgba;
            } else if (mapViewMode === 'realistic' || (mapViewMode === 'biomes' && !isWorldPopulated) ) { 
                cellColorRgba = getRealisticCellColor(logicalR, logicalC, altCat, tempCat, isWaterCell, isBeachCell, biome, isPolarZone);
            } else if ((mapViewMode === 'countries' || mapViewMode === 'alliances') && isWorldPopulated) {
                let baseRealisticColor = getRealisticCellColor(logicalR, logicalC, altCat, tempCat, isWaterCell, isBeachCell, biome, isPolarZone);
                let desaturatedBase = desaturateAndTintRgba(baseRealisticColor, POLITICAL_VIEW_DESATURATION_FACTOR, PARSED_POLITICAL_VIEW_BACKGROUND_TINT_COLOR, PARSED_POLITICAL_VIEW_BACKGROUND_TINT_COLOR ? PARSED_POLITICAL_VIEW_BACKGROUND_TINT_COLOR.a : 0);
                cellColorRgba = desaturatedBase; 
                
                let politicalColorOverlay: RgbaColor | null = null; let fillOpacity = 0;
                const region = biome?.regionId ? mapRegions.find(r => r.id === biome.regionId) : null;
                const country = region?.countryId ? mapCountries.find(c => c.id === region.countryId) : null;
                
                if (mapViewMode === 'countries' && country) {
                    politicalColorOverlay = parseRgba(country.color || BIOME_TYPE_STYLES[BiomeType.Other].color);
                    fillOpacity = country.id === selectedCountryId ? COUNTRY_SELECTED_FILL_OPACITY : country.id === hoveredCountryId ? COUNTRY_HOVER_FILL_OPACITY : selectedCountryId ? COUNTRY_NON_SELECTED_ADJACENT_FILL_OPACITY : COUNTRY_FILL_OPACITY;
                } else if (mapViewMode === 'alliances' && country?.allianceId) {
                    const alliance = mapAlliances.find(a => a.id === country.allianceId);
                    if (alliance) {
                        politicalColorOverlay = parseRgba(alliance.color || BIOME_TYPE_STYLES[BiomeType.Other].color);
                        fillOpacity = alliance.id === selectedAllianceId ? ALLIANCE_SELECTED_FILL_OPACITY : alliance.id === hoveredAllianceId ? ALLIANCE_HOVER_FILL_OPACITY : selectedAllianceId ? ALLIANCE_NON_SELECTED_ADJACENT_FILL_OPACITY : ALLIANCE_FILL_OPACITY;
                    }
                }
                if (politicalColorOverlay) {
                    cellColorRgba = {
                        r: Math.round(desaturatedBase.r * (1 - fillOpacity) + politicalColorOverlay.r * fillOpacity),
                        g: Math.round(desaturatedBase.g * (1 - fillOpacity) + politicalColorOverlay.g * fillOpacity),
                        b: Math.round(desaturatedBase.b * (1 - fillOpacity) + politicalColorOverlay.b * fillOpacity),
                        a: desaturatedBase.a 
                    };
                }
            } else { 
                cellColorRgba = PARSED_GRID_BACKGROUND_COLOR;
            }
        }
        for (let y_px = 0; y_px < Math.ceil(displayCellHeight); y_px++) {
            for (let x_px = 0; x_px < Math.ceil(displayCellWidth); x_px++) {
                const canvasX = screenX + x_px;
                const canvasY = screenY + y_px;
                if (canvasX >= 0 && canvasX < MAP_WIDTH && canvasY >= 0 && canvasY < MAP_HEIGHT) {
                    const index = (Math.floor(canvasY) * MAP_WIDTH + Math.floor(canvasX)) * 4;
                    data[index] = cellColorRgba.r;
                    data[index + 1] = cellColorRgba.g;
                    data[index + 2] = cellColorRgba.b;
                    data[index + 3] = Math.round(cellColorRgba.a * 255);
                }
            }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);

    if (mapViewMode === 'elevation' && zoomLevel > 0.25) { 
        ctx.lineWidth = CONTOUR_LINE_WIDTH / zoomLevel;
        for (let r_draw_offset = 0; r_draw_offset < numRowsToDraw; r_draw_offset++) {
            for (let c_draw_offset = 0; c_draw_offset < numColsToDraw; c_draw_offset++) {
                const logicalR = getWrappedRowLocal(firstLogicalRowBase + r_draw_offset);
                const logicalC = getWrappedColLocal(firstLogicalColBase + c_draw_offset);
                const currentAltCat = altitudeMap[logicalR]?.[logicalC];
                if (currentAltCat === undefined) continue;
                const baseColorRgba = PARSED_ELEVATION_COLORS[currentAltCat];
                if (!baseColorRgba) continue;
                const contourColorRgba: RgbaColor = {
                    r: Math.max(0, Math.round(baseColorRgba.r * CONTOUR_LINE_COLOR_DARKER_FACTOR)),
                    g: Math.max(0, Math.round(baseColorRgba.g * CONTOUR_LINE_COLOR_DARKER_FACTOR)),
                    b: Math.max(0, Math.round(baseColorRgba.b * CONTOUR_LINE_COLOR_DARKER_FACTOR)),
                    a: 0.8 
                };
                ctx.strokeStyle = rgbaToString(contourColorRgba);
                const screenXBase = Math.floor(c_draw_offset * displayCellWidth + offsetXForScreen);
                const screenYBase = Math.floor(r_draw_offset * displayCellHeight + offsetYForScreen);
                const logicalC_right = getWrappedColLocal(logicalC + 1);
                const rightAltCat = altitudeMap[logicalR]?.[logicalC_right];
                if (rightAltCat !== undefined && rightAltCat !== currentAltCat) {
                    const x = screenXBase + displayCellWidth;
                    if (x >= -ctx.lineWidth && x <= MAP_WIDTH + ctx.lineWidth && screenYBase + displayCellHeight >= -ctx.lineWidth && screenYBase <= MAP_HEIGHT + ctx.lineWidth) {
                        ctx.beginPath(); ctx.moveTo(x, screenYBase); ctx.lineTo(x, screenYBase + displayCellHeight); ctx.stroke();
                    }
                }
                const logicalR_bottom = getWrappedRowLocal(logicalR + 1);
                const bottomAltCat = altitudeMap[logicalR_bottom]?.[logicalC];
                if (bottomAltCat !== undefined && bottomAltCat !== currentAltCat) {
                    const y = screenYBase + displayCellHeight;
                     if (y >= -ctx.lineWidth && y <= MAP_HEIGHT + ctx.lineWidth && screenXBase + displayCellWidth >= -ctx.lineWidth && screenXBase <= MAP_WIDTH + ctx.lineWidth) {
                        ctx.beginPath(); ctx.moveTo(screenXBase, y); ctx.lineTo(screenXBase + displayCellWidth, y); ctx.stroke();
                    }
                }
            }
        }
    }

    if (showGridOverlay && zoomLevel > 0.3) { 
      ctx.strokeStyle = GRID_LINE_COLOR; ctx.lineWidth = Math.max(0.1, GRID_LINE_WIDTH / zoomLevel); 
      for (let rOffset = 0; rOffset <= numRowsToDraw; rOffset++) { const y = Math.floor(rOffset * displayCellHeight + offsetYForScreen); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_WIDTH, y); ctx.stroke(); }
      for (let cOffset = 0; cOffset <= numColsToDraw; cOffset++) { const x = Math.floor(cOffset * displayCellWidth + offsetXForScreen); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_HEIGHT); ctx.stroke(); }
    }
    
  }, [
    biomeGrid, mapBiomes, altitudeMap, waterCellsMap, beachCellsMap, temperatureMap, mapViewMode, showGridOverlay, 
    viewportOffset, zoomLevel, mapRegions, mapCountries, mapAlliances, isWorldPopulated, borderNoiseGen, textureNoiseGen,
    selectedCountryId, hoveredCountryId, selectedAllianceId, hoveredAllianceId, features, occupiedCellMap,
    snowNoiseLarge, snowNoiseSmall, oceanSurfaceNoise 
  ]);

  const bordersToPath = (borders: BorderSegment[]): string => {
    return borders.map(s => `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`).join(' ');
  };

  const svgViewBox = `${viewportOffset.x} ${viewportOffset.y} ${LOGICAL_MAP_WIDTH / zoomLevel} ${LOGICAL_MAP_HEIGHT / zoomLevel}`;

  const renderPoliticalBorders = ( 
        entityType: 'country' | 'alliance',
        selectedId: string | null,
        hoveredId: string | null,
        bordersSelected: BorderSegment[],
        bordersHovered: BorderSegment[]
    ) => {
        const config = entityType === 'country' ?
            { color: COUNTRY_BORDER_COLOR, hoverColor: COUNTRY_HOVER_BORDER_COLOR, selectedColor: COUNTRY_SELECTED_BORDER_COLOR, width: COUNTRY_BORDER_WIDTH, outlineColor: COUNTRY_SVG_BORDER_OUTLINE_COLOR, outlineFactor: COUNTRY_SVG_BORDER_OUTLINE_WIDTH_FACTOR } :
            { color: ALLIANCE_BORDER_COLOR, hoverColor: ALLIANCE_HOVER_BORDER_COLOR, selectedColor: ALLIANCE_SELECTED_BORDER_COLOR, width: ALLIANCE_BORDER_WIDTH, outlineColor: ALLIANCE_SVG_BORDER_OUTLINE_COLOR, outlineFactor: ALLIANCE_SVG_BORDER_OUTLINE_WIDTH_FACTOR };
        const allEntities = entityType === 'country' ? mapCountries : mapAlliances;
        const baseStrokeWidth = config.width / zoomLevel; const outlineStrokeWidth = baseStrokeWidth * config.outlineFactor;
        return (<>
                {isWorldPopulated && allEntities.map(entity => { if (entity.id === selectedId || entity.id === hoveredId) return null; const borders = calculatePoliticalEntityBorders(entity.id, biomeGrid, mapBiomes, mapRegions, mapCountries, entityType); if (borders.length === 0) return null; return ( <g key={`${entityType}-border-${entity.id}`}> <path d={bordersToPath(borders)} stroke={config.outlineColor} strokeWidth={outlineStrokeWidth} fill="none" vectorEffect="non-scaling-stroke"/> <path d={bordersToPath(borders)} stroke={entity.color || config.color} strokeWidth={baseStrokeWidth} fill="none" vectorEffect="non-scaling-stroke"/> </g> ); })}
                {hoveredId && hoveredId !== selectedId && bordersHovered.length > 0 && ( <g key={`${entityType}-border-hover-${hoveredId}`}> <path d={bordersToPath(bordersHovered)} stroke={config.outlineColor} strokeWidth={outlineStrokeWidth * 1.1} fill="none" vectorEffect="non-scaling-stroke"/> <path d={bordersToPath(bordersHovered)} stroke={config.hoverColor} strokeWidth={baseStrokeWidth * 1.1} fill="none" vectorEffect="non-scaling-stroke"/> </g> )}
                {selectedId && bordersSelected.length > 0 && ( <g key={`${entityType}-border-selected-${selectedId}`}> <path d={bordersToPath(bordersSelected)} stroke={config.outlineColor} strokeWidth={outlineStrokeWidth * 1.2} fill="none" vectorEffect="non-scaling-stroke"/> <path d={bordersToPath(bordersSelected)} stroke={config.selectedColor} strokeWidth={baseStrokeWidth * 1.2} fill="none" vectorEffect="non-scaling-stroke"/> </g> )}
            </>);
    };


  return (
    <div 
      className={`w-full h-full rounded-lg shadow-xl overflow-hidden border-2 border-gray-700 relative ${isPanning ? 'grabbing' : 'grabbable'}`}
      style={{ width: MAP_WIDTH, height: MAP_HEIGHT, cursor: isPanning ? 'grabbing' : 'grab' }} 
      onClick={(e: React.MouseEvent<HTMLDivElement>) => { if (!isPanning) onCanvasClick(e); }}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => onMapPanStart(e)}
      onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => onCanvasMouseMove(e)} // Keep for hover effects
      onMouseUp={(e: React.MouseEvent<HTMLDivElement>) => onMapPanEnd(e)} // Calls panEndCleanup from App
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { onCanvasMouseLeave(); onMapPanEnd(e);}} // Calls panEndCleanup
      role="application"
      aria-label="Interactive world map, pannable"
    >
      <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" aria-hidden="true" />
      <svg 
        viewBox={svgViewBox} 
        className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none" 
        preserveAspectRatio="xMidYMid meet"
      >
        <desc>Interactive map features, labels, and borders. More details available in the side panel.</desc>
        
        {isWorldPopulated && features.filter(f => f.type === FeatureType.Road && f.points && f.points.length > 1).map(road => {
            const roadStyle = FEATURE_TYPE_STYLES[FeatureType.Road];
            const d = road.points!.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return ( <path key={`road-${road.id}`} d={d} stroke={roadStyle.stroke} strokeWidth={(roadStyle.strokeWidth || 2) / Math.sqrt(zoomLevel)} fill="none" vectorEffect="non-scaling-stroke"/> );
        })}
        
        {isWorldPopulated && mapViewMode === 'countries' && renderPoliticalBorders('country', selectedCountryId, hoveredCountryId, selectedCountryBorders, hoveredCountryBorders)}
        {isWorldPopulated && mapViewMode === 'alliances' && renderPoliticalBorders('alliance', selectedAllianceId, hoveredAllianceId, selectedAllianceBorders, hoveredAllianceBorders)}

        {isWorldPopulated && (mapViewMode === 'biomes' || mapViewMode === 'regions' || mapViewMode === 'realistic' || mapViewMode === 'elevation') && ( 
            <>
                {hoveredRegionId && hoveredRegionId !== selectedRegionId && hoveredRegionBorders.length > 0 && (
                    <path d={bordersToPath(hoveredRegionBorders)} stroke={HOVER_BORDER_COLOR} strokeWidth={(GENERIC_HIGHLIGHT_BORDER_WIDTH * 1.1) / zoomLevel} fill="none" vectorEffect="non-scaling-stroke"/>
                )}
                {selectedRegionId && selectedRegionBorders.length > 0 && (
                    <path d={bordersToPath(selectedRegionBorders)} stroke={SELECTED_BORDER_COLOR} strokeWidth={(GENERIC_HIGHLIGHT_BORDER_WIDTH * 1.2) / zoomLevel} fill="none" vectorEffect="non-scaling-stroke"/>
                )}
                {hoveredBiomeId && hoveredBiomeId !== selectedBiomeId && hoveredBiomeBorders.length > 0 &&
                    (!selectedRegionId || mapBiomes.find(b => b.id === hoveredBiomeId)?.regionId !== selectedRegionId) && (
                    <path d={bordersToPath(hoveredBiomeBorders)} stroke={HOVER_BORDER_COLOR} strokeWidth={(GENERIC_HIGHLIGHT_BORDER_WIDTH * 1.1) / zoomLevel} fill="none" vectorEffect="non-scaling-stroke"/>
                )}
                {selectedBiomeId && selectedBiomeBorders.length > 0 &&
                    (!selectedRegionId || mapBiomes.find(b => b.id === selectedBiomeId)?.regionId !== selectedRegionId) && (
                    <path d={bordersToPath(selectedBiomeBorders)} stroke={SELECTED_BORDER_COLOR} strokeWidth={(GENERIC_HIGHLIGHT_BORDER_WIDTH * 1.2) / zoomLevel} fill="none" vectorEffect="non-scaling-stroke"/>
                )}
            </>
        )}

        {isWorldPopulated && features.filter(f => f.type !== FeatureType.Road && f.size * LOGICAL_CELL_WIDTH * zoomLevel > FEATURE_LABEL_MIN_VISIBLE_SIZE_ZOOMED ).map(feature => {
            const featureCenterX = feature.c * LOGICAL_CELL_WIDTH + (feature.size * LOGICAL_CELL_WIDTH / 2);
            const featureCenterY = feature.r * LOGICAL_CELL_HEIGHT + (feature.size * LOGICAL_CELL_HEIGHT / 2);
            return (
             <text 
                key={`label-${feature.id}`}
                x={featureCenterX}
                y={featureCenterY + (feature.size * LOGICAL_CELL_HEIGHT / 2 + FEATURE_LABEL_FONT_SIZE_BASE / zoomLevel / 1.5) } 
                textAnchor="middle"
                dominantBaseline="hanging"
                style={{
                    fill: FEATURE_LABEL_FILL_COLOR, paintOrder: "stroke", 
                    stroke: FEATURE_LABEL_STROKE_COLOR, strokeWidth:`${FEATURE_LABEL_STROKE_WIDTH_BASE/zoomLevel}px`, 
                    strokeLinecap:"butt", strokeLinejoin:"miter", 
                    fontSize: `${FEATURE_LABEL_FONT_SIZE_BASE/zoomLevel}px`, pointerEvents: 'none'
                }} 
                aria-hidden="true"
            >
                {feature.name}
            </text>
        )})}
      </svg>
    </div>
  );
};

export default MapDisplay;
