
import React, { useState, useEffect, useCallback, MouseEvent as ReactMouseEvent, useRef } from 'react';
import { 
    MapFeature, FeatureType, MapBiome, BiomeType, MapRegion, MapCountry, MapAlliance, MapZone,
    AiGeneratedComposition, GridCellState, AltitudePreference, MoisturePreference, TemperatureCategory,
    AltitudeCategory, MoistureCategory, MapViewMode, AStarNode,
    NoiseMap, WaterCellsMap, BeachCellsMap, RawCountry, RawAlliance, RawZone,
    PlaceholderFeature, GenericFeatureSiteType, OccupiedCellMap
} from './types';
import { generateMapCompositionFromGemini, elaborateFeatureDescription, isApiKeySet } from './services/geminiService';
import MapDisplay from './components/MapDisplay';
import DetailsPanel from './components/DetailsPanel';
import Button from './components/Button';
import LoadingSpinner from './components/LoadingSpinner';
import { SimplexNoise } from './utils/noise';
import { 
  MAP_WIDTH, MAP_HEIGHT, FEATURE_TYPE_STYLES, 
  ALL_FEATURE_TYPES_ARRAY, BIOME_TYPE_STYLES, ALL_BIOME_TYPES_ARRAY,
  GRID_ROWS, GRID_COLS, LOGICAL_CELL_WIDTH, LOGICAL_CELL_HEIGHT, LOGICAL_MAP_WIDTH, LOGICAL_MAP_HEIGHT,
  ALTITUDE_LEVELS, MOISTURE_LEVELS, ENVIRONMENTAL_MISMATCH_PENALTY, TEMPERATURE_MISMATCH_PENALTY,
  ALTITUDE_STRING_TO_ENUM, MOISTURE_STRING_TO_ENUM, TEMPERATURE_STRING_TO_ENUM, ELEVATION_LEGEND,
  NUM_RIVERS_TO_GENERATE, RIVER_MAX_PATH_LENGTH, RIVER_A_STAR_COSTS,
  PROCEDURAL_RIVER_BIOME_NAME, LAKE_BIOME_TYPES,
  LARGE_NOISE_SCALE, MEDIUM_NOISE_SCALE, DETAIL_NOISE_SCALE, COASTAL_DETAIL_NOISE_SCALE,
  NOISE_OCTAVES, NOISE_PERSISTENCE, NOISE_LACUNARITY, NOISE_SEED_PREFIX,
  WATER_LEVEL_DEEP_THRESHOLD, WATER_LEVEL_SHALLOW_THRESHOLD, BEACH_SLOPE_THRESHOLD,
  LAND_LOW_THRESHOLD_NORMALIZED, LAND_MEDIUM_THRESHOLD_NORMALIZED,
  MOISTURE_NOISE_SCALE, LATITUDE_EFFECT_STRENGTH, COASTAL_EFFECT_STRENGTH, COASTAL_EFFECT_RADIUS,
  PROCEDURAL_OCEAN_BIOME_ID, PROCEDURAL_OCEAN_BIOME_NAME,
  NUM_TEMPERATURE_CATEGORIES, POLAR_ZONE_ROWS, EQUATORIAL_ZONE_ROWS,
  SNOW_CAP_TEMP_THRESHOLD,
  NUM_ROADS_TO_GENERATE, ROAD_MAX_PATH_LENGTH, ROAD_A_STAR_COSTS, ROAD_PREFERRED_FEATURE_TYPES,
  DEFAULT_NUM_REGIONS, DEFAULT_NUM_LAND_BIOMES, DEFAULT_NUM_FEATURES_TO_DEFINE_AI, DEFAULT_NUM_FEATURES_TO_PLACEHOLD,
  DEFAULT_NUM_COUNTRIES, DEFAULT_NUM_ALLIANCES, MIN_ZOOM, MAX_ZOOM, ZOOM_INCREMENT,
  FEATURE_COLLISION_MULTIPLIER, MIN_FEATURE_SIZE_CELLS, MAX_FEATURE_SIZE_CELLS, PLACEHOLDER_SIZES
} from './constants';

const APP_VERSION = "1.3.1";

const generateId = (prefix: string = ''): string => prefix + Math.random().toString(36).substr(2, 9);

const getWrappedRow = (r: number): number => (r % GRID_ROWS + GRID_ROWS) % GRID_ROWS;
const getWrappedCol = (c: number): number => (c % GRID_COLS + GRID_COLS) % GRID_COLS;

// MinHeap Class for A* and Voronoi optimizations
class MinHeap<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn: (a: T, b: T) => number) {
    this.compareFn = compareFn;
  }

  push(value: T): void {
    this.heap.push(value);
    this.siftUp();
  }

  pop(): T | undefined {
    if (this.size() === 0) return undefined;
    const poppedValue = this.heap[0];
    if (this.size() === 1) {
        this.heap.pop();
    } else {
        this.heap[0] = this.heap.pop()!;
        this.siftDown();
    }
    return poppedValue;
  }

  size(): number {
    return this.heap.length;
  }

  private siftUp(): void {
    let nodeIdx = this.size() - 1;
    while (nodeIdx > 0 && this.compare(nodeIdx, this.getParentIdx(nodeIdx)) < 0) {
      this.swap(nodeIdx, this.getParentIdx(nodeIdx));
      nodeIdx = this.getParentIdx(nodeIdx);
    }
  }

  private siftDown(): void {
    let nodeIdx = 0;
    while (true) {
      const leftChildIdx = this.getLeftChildIdx(nodeIdx);
      const rightChildIdx = this.getRightChildIdx(nodeIdx);
      let smallestChildIdx = -1;

      if (leftChildIdx < this.size()) {
        smallestChildIdx = leftChildIdx;
      }
      
      if (rightChildIdx < this.size() && this.compare(rightChildIdx, leftChildIdx) < 0) {
        smallestChildIdx = rightChildIdx;
      }

      if (smallestChildIdx !== -1 && this.compare(smallestChildIdx, nodeIdx) < 0) {
        this.swap(smallestChildIdx, nodeIdx);
        nodeIdx = smallestChildIdx;
      } else {
        break;
      }
    }
  }
  
  private getParentIdx(idx: number): number { return Math.floor((idx - 1) / 2); }
  private getLeftChildIdx(idx: number): number { return idx * 2 + 1; }
  private getRightChildIdx(idx: number): number { return idx * 2 + 2; }
  private swap(i: number, j: number): void { [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]; }
  private compare(i: number, j: number): number { return this.compareFn(this.heap[i], this.heap[j]); }
}


const normalizeNoiseMap = (noiseMap: NoiseMap): NoiseMap => {
    let minVal = Infinity; let maxVal = -Infinity;
    for (const row of noiseMap) for (const val of row) { if (val < minVal) minVal = val; if (val > maxVal) maxVal = val; }
    const range = maxVal - minVal; if (range === 0) return noiseMap.map(row => row.map(() => 0.5)); 
    return noiseMap.map(row => row.map(val => (val - minVal) / range));
};

const generateWorldElevationNoiseMap = (seed: string): { 
    baseAltitudeMap: NoiseMap, 
    waterCellsMap: WaterCellsMap, 
    categorizedAltitudeMap: AltitudeCategory[][],
    beachCellsMap: BeachCellsMap 
} => {
    const noiseGenLarge = new SimplexNoise(seed + "_L_tile_hr_v2"); 
    const noiseGenMedium = new SimplexNoise(seed + "_M_tile_hr_v2"); 
    const noiseGenDetail = new SimplexNoise(seed + "_D_tile_hr_v2");
    const noiseGenCoastal = new SimplexNoise(seed + "_C_tile_hr_v2");
    const mountainChainNoise = new SimplexNoise(seed + "_MC_tile_hr_v2"); 

    let baseMap: NoiseMap = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
    const PI2 = Math.PI * 2; const radiusX = GRID_COLS / PI2; const radiusY = GRID_ROWS / PI2;

    for (let r_idx = 0; r_idx < GRID_ROWS; r_idx++) {
        for (let c_idx = 0; c_idx < GRID_COLS; c_idx++) {
            const u = c_idx / GRID_COLS; const v = r_idx / GRID_ROWS;
            const nx1 = radiusX * Math.cos(PI2 * u); const ny1 = radiusX * Math.sin(PI2 * u);
            const nz1 = radiusY * Math.cos(PI2 * v); const nw1 = radiusY * Math.sin(PI2 * v);
            
            let totalNoise = 0; 
            let ampL = 1, freqL = 1;
            for (let o = 0; o < NOISE_OCTAVES - 2; o++) { totalNoise += noiseGenLarge.noise4D(nx1*freqL*LARGE_NOISE_SCALE, ny1*freqL*LARGE_NOISE_SCALE, nz1*freqL*LARGE_NOISE_SCALE, nw1*freqL*LARGE_NOISE_SCALE) * ampL; ampL *= NOISE_PERSISTENCE; freqL *= NOISE_LACUNARITY; }
            
            let ampM = 0.6; let freqM = 1; 
            for (let o = 0; o < NOISE_OCTAVES - 1; o++) { totalNoise += noiseGenMedium.noise4D(nx1*freqM*MEDIUM_NOISE_SCALE, ny1*freqM*MEDIUM_NOISE_SCALE, nz1*freqM*MEDIUM_NOISE_SCALE, nw1*freqM*MEDIUM_NOISE_SCALE) * ampM; ampM *= NOISE_PERSISTENCE; freqM *= NOISE_LACUNARITY; }
            
            let ampD = 0.3; let freqD = 1; 
            for (let o = 0; o < NOISE_OCTAVES; o++) { totalNoise += noiseGenDetail.noise4D(nx1*freqD*DETAIL_NOISE_SCALE, ny1*freqD*DETAIL_NOISE_SCALE, nz1*freqD*DETAIL_NOISE_SCALE, nw1*freqD*DETAIL_NOISE_SCALE) * ampD; ampD *= NOISE_PERSISTENCE; freqD *= NOISE_LACUNARITY; }

            totalNoise += noiseGenCoastal.noise4D(nx1*COASTAL_DETAIL_NOISE_SCALE, ny1*COASTAL_DETAIL_NOISE_SCALE, nz1*COASTAL_DETAIL_NOISE_SCALE, nw1*COASTAL_DETAIL_NOISE_SCALE) * 0.15;

            const mountainInfluence = mountainChainNoise.noise4D(nx1*0.005, ny1*0.005, nz1*0.005, nw1*0.005);
            if (mountainInfluence > 0.3) { totalNoise += (mountainInfluence - 0.3) * 1.5; }

            baseMap[r_idx][c_idx] = totalNoise;
        }
    }
    const normalizedAltitudeMap = normalizeNoiseMap(baseMap);
    const waterCellsMapResult: WaterCellsMap = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
    const categorizedAltitudeMapResult: AltitudeCategory[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0 as AltitudeCategory));
    const beachCellsMapResult: BeachCellsMap = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const normVal = normalizedAltitudeMap[r][c];
            if (normVal < WATER_LEVEL_DEEP_THRESHOLD) { categorizedAltitudeMapResult[r][c] = -2; waterCellsMapResult[r][c] = true; } 
            else if (normVal < WATER_LEVEL_SHALLOW_THRESHOLD) { categorizedAltitudeMapResult[r][c] = -1; waterCellsMapResult[r][c] = true; } 
            else if (normVal < LAND_LOW_THRESHOLD_NORMALIZED) categorizedAltitudeMapResult[r][c] = 0; 
            else if (normVal < LAND_MEDIUM_THRESHOLD_NORMALIZED) categorizedAltitudeMapResult[r][c] = 1; 
            else categorizedAltitudeMapResult[r][c] = 2; 
        }
    }
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            if (!waterCellsMapResult[r][c] && categorizedAltitudeMapResult[r][c] === 0) { 
                let isCoastal = false; let minSlope = Infinity;
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0) continue;
                        const nr = getWrappedRow(r + dr); const nc = getWrappedCol(c + dc);
                        if (waterCellsMapResult[nr][nc] && categorizedAltitudeMapResult[nr][nc] === -1) { isCoastal = true; const slope = Math.abs(normalizedAltitudeMap[r][c] - normalizedAltitudeMap[nr][nc]); minSlope = Math.min(minSlope, slope); }
                    }
                if (isCoastal && minSlope < BEACH_SLOPE_THRESHOLD) beachCellsMapResult[r][c] = true;
            }
        }
    }
    return { baseAltitudeMap: normalizedAltitudeMap, waterCellsMap: waterCellsMapResult, categorizedAltitudeMap: categorizedAltitudeMapResult, beachCellsMap: beachCellsMapResult };
};


const generateCategorizedMoistureMap = (seed: string, waterCellsMapInput: WaterCellsMap, categorizedAltitudeMapInput: AltitudeCategory[][]): MoistureCategory[][] => { 
    const noiseGen = new SimplexNoise(seed + "_moisture_tile_hr_v2"); 
    const baseMoistureMap: NoiseMap = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
    const PI2 = Math.PI * 2; const radiusX = GRID_COLS / PI2; const radiusY = GRID_ROWS / PI2;
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++) { const u = c / GRID_COLS; const v = r / GRID_ROWS; const nx = radiusX*Math.cos(PI2*u); const ny = radiusX*Math.sin(PI2*u); const nz = radiusY*Math.cos(PI2*v); const nw = radiusY*Math.sin(PI2*v); baseMoistureMap[r][c] = noiseGen.noise4D(nx*MOISTURE_NOISE_SCALE, ny*MOISTURE_NOISE_SCALE, nz*MOISTURE_NOISE_SCALE, nw*MOISTURE_NOISE_SCALE); }
    const normalizedMoistureMap = normalizeNoiseMap(baseMoistureMap);
    const finalMoistureValues: NoiseMap = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++) {
        let moisture = normalizedMoistureMap[r][c];
        moisture -= (Math.abs(r - GRID_ROWS/2)/(GRID_ROWS/2)) * LATITUDE_EFFECT_STRENGTH;
        let minDistToWater = Infinity;
        if (!waterCellsMapInput[r][c]) { 
             for (let dr = -COASTAL_EFFECT_RADIUS; dr <= COASTAL_EFFECT_RADIUS; dr++) for (let dc = -COASTAL_EFFECT_RADIUS; dc <= COASTAL_EFFECT_RADIUS; dc++) { const nr = getWrappedRow(r + dr); const nc = getWrappedCol(c + dc); if (waterCellsMapInput[nr][nc]) { let actual_dx = Math.abs(r-nr); if (actual_dx > GRID_ROWS/2) actual_dx = GRID_ROWS - actual_dx; let actual_dy = Math.abs(c-nc); if (actual_dy > GRID_COLS/2) actual_dy = GRID_COLS - actual_dy; minDistToWater = Math.min(minDistToWater, Math.sqrt(actual_dx*actual_dx + actual_dy*actual_dy)); } }
            if (minDistToWater <= COASTAL_EFFECT_RADIUS) moisture += (1-(minDistToWater/COASTAL_EFFECT_RADIUS)) * COASTAL_EFFECT_STRENGTH;
        }
        if (categorizedAltitudeMapInput[r][c]<2) { let mountainWest=false, mountainEast=false; for(let scan=1;scan<=5;scan++){ if(categorizedAltitudeMapInput[r][getWrappedCol(c-scan)]===2) mountainWest=true; if(categorizedAltitudeMapInput[r][getWrappedCol(c+scan)]===2) mountainEast=true; } if(mountainWest && !mountainEast) moisture -= 0.35; else if (mountainEast && !mountainWest) moisture +=0.1; } 
        finalMoistureValues[r][c] = Math.max(0, Math.min(1, moisture)); 
    }
    const categorizedMoistureMapResult: MoistureCategory[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0 as MoistureCategory));
    for (let r=0; r<GRID_ROWS; r++) for (let c=0; c<GRID_COLS; c++) { const val = finalMoistureValues[r][c]; if (val < 0.33) categorizedMoistureMapResult[r][c] = 0;  else if (val < 0.66) categorizedMoistureMapResult[r][c] = 1; else categorizedMoistureMapResult[r][c] = 2; }
    return categorizedMoistureMapResult;
};

const generateTemperatureMap = (altMapInput: AltitudeCategory[][]): TemperatureCategory[][] => { 
    const tempMapResult: TemperatureCategory[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(TemperatureCategory.Temperate));
    const midRow = GRID_ROWS / 2;
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < GRID_COLS; c++) {
        let tempScore = 2.0; const distFromEquatorNormalized = Math.abs(r - midRow) / midRow; 
        if (distFromEquatorNormalized > 0.85) tempScore -= 2; else if (distFromEquatorNormalized > 0.6) tempScore -= 1; else if (distFromEquatorNormalized < 0.15) tempScore += 2; else if (distFromEquatorNormalized < 0.3) tempScore += 1; 
        const alt = altMapInput[r][c]; if (alt === 2) tempScore -= 1.5; else if (alt === 1) tempScore -= 0.5; 
        tempScore = Math.round(Math.max(0, Math.min(NUM_TEMPERATURE_CATEGORIES - 1, tempScore)));
        if (tempScore === 0) tempMapResult[r][c] = TemperatureCategory.Freezing; else if (tempScore === 1) tempMapResult[r][c] = TemperatureCategory.Cold; else if (tempScore === 2) tempMapResult[r][c] = TemperatureCategory.Temperate; else if (tempScore === 3) tempMapResult[r][c] = TemperatureCategory.Warm; else tempMapResult[r][c] = TemperatureCategory.Hot;
    } return tempMapResult;
};

const createProceduralOceanBiome = (): MapBiome => ({ id: PROCEDURAL_OCEAN_BIOME_ID, name: PROCEDURAL_OCEAN_BIOME_NAME, type: BiomeType.Ocean, description: "Vast and deep, the world's oceans connect all lands.", color: BIOME_TYPE_STYLES[BiomeType.Ocean].color, altitudePreference: AltitudePreference.Any, moisturePreference: MoisturePreference.Any, temperaturePreference: [TemperatureCategory.Cold, TemperatureCategory.Temperate, TemperatureCategory.Warm], seedPoints: [], });

const heuristicAStarPath = (node: Pick<AStarNode, 'r'|'c'>, goal: Pick<AStarNode, 'r'|'c'>): number => { let dr = Math.abs(node.r - goal.r); let dc = Math.abs(node.c - goal.c); if (dr > GRID_ROWS / 2) dr = GRID_ROWS - dr; if (dc > GRID_COLS / 2) dc = GRID_COLS - dc; return dr + dc; };

const heuristicAStarRiver = (node: Pick<AStarNode, 'r'|'c'>, altitudeMapGrid: AltitudeCategory[][], waterCellsMapGrid: WaterCellsMap): number => {
    let closestWaterDist=Infinity;
    for(let r_idx=0;r_idx<GRID_ROWS;r_idx+=3)for(let c_idx=0;c_idx<GRID_COLS;c_idx+=3){ 
        if(waterCellsMapGrid[r_idx][c_idx] && altitudeMapGrid[r_idx][c_idx] < 0){ 
            let dr=Math.abs(node.r-r_idx); if(dr>GRID_ROWS/2)dr=GRID_ROWS-dr;
            let dc=Math.abs(node.c-c_idx); if(dc>GRID_COLS/2)dc=GRID_COLS-dc;
            closestWaterDist=Math.min(closestWaterDist,dr+dc);
        }
    }
    const altitudeIncentive=(altitudeMapGrid[node.r][node.c]-(-2))*3; 
    return closestWaterDist + altitudeIncentive + (waterCellsMapGrid[node.r][node.c] ? -50 : 0); 
};

const generateAndPlaceRivers = async (currentMapBiomes: MapBiome[], initialBiomeGrid: (string|null)[][], altitudeMapGrid: AltitudeCategory[][], waterCellsMapGrid: WaterCellsMap): Promise<{ updatedBiomeGrid: (string|null)[][], updatedMapBiomes: MapBiome[] }> => {
    let updatedBiomeGridResult = initialBiomeGrid.map(row => [...row]); let updatedMapBiomesResult = [...currentMapBiomes];
    let riverBiome = updatedMapBiomesResult.find(b => b.name === PROCEDURAL_RIVER_BIOME_NAME && b.type === BiomeType.River);
    if (!riverBiome) { riverBiome = { id: generateId('proc-river-'), name: PROCEDURAL_RIVER_BIOME_NAME, type: BiomeType.River, description: "A river carved by the land's contours.", color: BIOME_TYPE_STYLES[BiomeType.River].color, altitudePreference: AltitudePreference.Any, moisturePreference: MoisturePreference.Any, temperaturePreference: TemperatureCategory.Temperate }; updatedMapBiomesResult.push(riverBiome); }
    const riverBiomeId = riverBiome.id;
    const potentialSources: {r:number,c:number,alt:AltitudeCategory}[] = [];
    for(let r=0;r<GRID_ROWS;r++)for(let c=0;c<GRID_COLS;c++){ const altCat=altitudeMapGrid[r][c]; if(altCat>=1 && !waterCellsMapGrid[r][c] && Math.random() < 0.03 + altCat*0.08) potentialSources.push({r,c,alt:altCat}); } 
    potentialSources.sort(()=>0.5-Math.random()); 
    let riversGenerated=0;
    for (const source of potentialSources.slice(0, NUM_RIVERS_TO_GENERATE * 6)) { 
        if(riversGenerated>=NUM_RIVERS_TO_GENERATE)break; if(altitudeMapGrid[source.r][source.c]<1 || updatedBiomeGridResult[source.r][source.c]===riverBiomeId || waterCellsMapGrid[source.r][source.c])continue;
        
        const openSet = new MinHeap<AStarNode>((a, b) => a.f - b.f);
        const closedSet=new Set<string>(); 
        const startNode:AStarNode={r:source.r,c:source.c,g:0,h:0,f:0,parent:null};
        startNode.h = heuristicAStarRiver(startNode, altitudeMapGrid, waterCellsMapGrid); startNode.f = startNode.g+startNode.h; openSet.push(startNode);
        let pathFoundNode:AStarNode|null=null; let pathLength=0;
        while(openSet.size()>0 && pathLength<=RIVER_MAX_PATH_LENGTH){
            const currentNode=openSet.pop()!; const cellKey=`${currentNode.r},${currentNode.c}`;
            if(closedSet.has(cellKey))continue; closedSet.add(cellKey); pathLength++;
            if(waterCellsMapGrid[currentNode.r][currentNode.c] && altitudeMapGrid[currentNode.r][currentNode.c]<0){pathFoundNode=currentNode;break;} 
            const neighbors=[{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1},{dr:-1,dc:-1},{dr:-1,dc:1},{dr:1,dc:-1},{dr:1,dc:1}];
            for(const move of neighbors){
                const nr=getWrappedRow(currentNode.r+move.dr); const nc=getWrappedCol(currentNode.c+move.dc);
                if(closedSet.has(`${nr},${nc}`))continue;
                let moveCost=RIVER_A_STAR_COSTS.BASE_MOVE_COST * ( (move.dr !==0 && move.dc !==0) ? 1.414 : 1);
                const currentAltVal=altitudeMapGrid[currentNode.r][currentNode.c]; const neighborAltVal=altitudeMapGrid[nr][nc];
                if(neighborAltVal>currentAltVal)moveCost+=RIVER_A_STAR_COSTS.UPHILL_PENALTY * (neighborAltVal - currentAltVal); 
                else if(neighborAltVal===currentAltVal)moveCost+=RIVER_A_STAR_COSTS.SAME_ALTITUDE_PENALTY; 
                else moveCost+=RIVER_A_STAR_COSTS.DOWNHILL_BONUS * (currentAltVal - neighborAltVal);
                if(waterCellsMapGrid[nr][nc] && neighborAltVal<0)moveCost=RIVER_A_STAR_COSTS.OCEAN_LAKE_SINK_COST; 
                if(updatedBiomeGridResult[nr][nc]===riverBiomeId)moveCost+=RIVER_A_STAR_COSTS.EXISTING_RIVER_PENALTY;
                const gScore=currentNode.g+moveCost;
                const hScore=heuristicAStarRiver({r:nr,c:nc} as AStarNode, altitudeMapGrid, waterCellsMapGrid);
                openSet.push({r:nr,c:nc,g:gScore,h:hScore,f:gScore+hScore,parent:currentNode});
            }
        }
        if(pathFoundNode){ let curr=pathFoundNode; let riverPathCells=0; while(curr!==null){ if(!waterCellsMapGrid[curr.r][curr.c] && updatedBiomeGridResult[curr.r][curr.c]!==riverBiomeId){updatedBiomeGridResult[curr.r][curr.c]=riverBiomeId;riverPathCells++;} else if(waterCellsMapGrid[curr.r][curr.c]){if(updatedBiomeGridResult[curr.r][curr.c]!==riverBiomeId)riverPathCells++;break;} curr=curr.parent;} if(riverPathCells > 4)riversGenerated++;}
    }
    console.log(`Finished river generation. Generated ${riversGenerated} rivers.`);
    return {updatedBiomeGrid: updatedBiomeGridResult, updatedMapBiomes: updatedMapBiomesResult};
};


const generateAndPlaceRoads = async (
    currentMapFeatures: MapFeature[], currentMapBiomes: MapBiome[], altitudeMapGrid: AltitudeCategory[][], waterCellsMapGrid: WaterCellsMap, biomeGridService: (string|null)[][]
): Promise<MapFeature[]> => {
    const newRoadFeatures: MapFeature[] = [];
    const majorSettlements = currentMapFeatures.filter(f => f.type !== FeatureType.Road && ROAD_PREFERRED_FEATURE_TYPES.includes(f.type)).sort((a,b) => b.size - a.size);
    if (majorSettlements.length < 2) return newRoadFeatures;
    const roadStyle = FEATURE_TYPE_STYLES[FeatureType.Road]; let roadsGenerated = 0;
    const isCellOccupiedByNonRoadFeature = (r_check: number, c_check: number, features: MapFeature[]): boolean => {
        for (const f of features) { if (f.type === FeatureType.Road) continue; if (f.r === r_check && f.c === c_check) return true; if (f.r <= r_check && r_check < f.r + f.size && f.c <= c_check && c_check < f.c + f.size) return true; } return false; };
    const cellHasBridge = (r_check: number, c_check: number, features: MapFeature[]): boolean => { for (const f of features) { if (f.type === FeatureType.Bridge) { if (f.r <= r_check && r_check < f.r + f.size && f.c <= c_check && c_check < f.c + f.size) return true; } } return false; };
    
    for (let i = 0; i < majorSettlements.length -1 && roadsGenerated < NUM_ROADS_TO_GENERATE; i++) {
        for (let j = i + 1; j < Math.min(i + 4, majorSettlements.length) && roadsGenerated < NUM_ROADS_TO_GENERATE; j++) {
            const startFeature = majorSettlements[i]; const endFeature = majorSettlements[j];
            const startR = startFeature.r; const startC = startFeature.c; const endR = endFeature.r; const endC = endFeature.c;
            
            const openSet = new MinHeap<AStarNode>((a, b) => a.f - b.f);
            const closedSet=new Set<string>();
            const startNode:AStarNode = { r: startR, c: startC, g:0, h:0, f:0, parent: null };
            startNode.h = heuristicAStarPath(startNode, {r: endR, c: endC}); startNode.f = startNode.g + startNode.h; openSet.push(startNode);
            let pathFoundNode: AStarNode | null = null; 
            let pathLength = 0;

            while(openSet.size() > 0 && pathLength < ROAD_MAX_PATH_LENGTH) {
                const currentNode = openSet.pop()!;
                const cellKey = `${currentNode.r},${currentNode.c}`;
                if(closedSet.has(cellKey)) continue;
                closedSet.add(cellKey);
                pathLength++;

                if (currentNode.r === endR && currentNode.c === endC) {
                    pathFoundNode = currentNode;
                    break;
                }

                const neighbors = [{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1},{dr:-1,dc:-1},{dr:-1,dc:1},{dr:1,dc:-1},{dr:1,dc:1}];
                for (const move of neighbors) {
                    const nr = getWrappedRow(currentNode.r + move.dr);
                    const nc = getWrappedCol(currentNode.c + move.dc);
                    if (closedSet.has(`${nr},${nc}`)) continue;

                    let moveCost = ROAD_A_STAR_COSTS.BASE_MOVE_COST * ((move.dr !== 0 && move.dc !== 0) ? 1.414 : 1);
                    const currentAlt = altitudeMapGrid[currentNode.r][currentNode.c];
                    const neighborAlt = altitudeMapGrid[nr][nc];
                    moveCost += Math.abs(currentAlt - neighborAlt) * ROAD_A_STAR_COSTS.ALTITUDE_CHANGE_PENALTY_FACTOR;
                    if (neighborAlt === 2) moveCost += ROAD_A_STAR_COSTS.HIGH_MOUNTAIN_PENALTY;
                    
                    const isWater = waterCellsMapGrid[nr][nc];
                    const biomeId = biomeGridService[nr]?.[nc];
                    const biome = biomeId ? currentMapBiomes.find(b => b.id === biomeId) : null;

                    if (isWater || biome?.type === BiomeType.River) {
                        if (!cellHasBridge(nr, nc, currentMapFeatures)) {
                             moveCost += (biome?.type === BiomeType.River ? ROAD_A_STAR_COSTS.RIVER_CROSSING_WITHOUT_BRIDGE_PENALTY : ROAD_A_STAR_COSTS.WATER_PENALTY);
                        }
                    }
                    if (isCellOccupiedByNonRoadFeature(nr, nc, currentMapFeatures)) {
                         moveCost += ROAD_A_STAR_COSTS.FEATURE_OBSTRUCTION_PENALTY;
                    }
                    if (biome && ROAD_A_STAR_COSTS.BIOME_PENALTIES[biome.type] !== undefined) {
                        moveCost += ROAD_A_STAR_COSTS.BIOME_PENALTIES[biome.type];
                    }
                    
                    const gScore = currentNode.g + moveCost;
                    const hScore = heuristicAStarPath({r: nr, c: nc}, {r: endR, c: endC});
                    openSet.push({ r: nr, c: nc, g: gScore, h: hScore, f: gScore + hScore, parent: currentNode });
                }
            }

            if (pathFoundNode) {
                const pathPoints: {x: number, y: number}[] = [];
                let curr = pathFoundNode;
                while(curr) {
                    pathPoints.unshift({ 
                        x: curr.c * LOGICAL_CELL_WIDTH + LOGICAL_CELL_WIDTH / 2, 
                        y: curr.r * LOGICAL_CELL_HEIGHT + LOGICAL_CELL_HEIGHT / 2 
                    });
                    curr = curr.parent;
                }
                if (pathPoints.length > 1) {
                    newRoadFeatures.push({
                        id: generateId('road-'),
                        name: `Road from ${startFeature.name} to ${endFeature.name}`,
                        type: FeatureType.Road,
                        description: `A trade route connecting ${startFeature.name} and ${endFeature.name}.`,
                        c: -1, r: -1, // Not applicable for roads with points
                        size: 1,
                        fillColor: roadStyle.fill,
                        strokeColor: roadStyle.stroke,
                        points: pathPoints
                    });
                    roadsGenerated++;
                }
            }
        }
    }
    console.log(`Finished road generation. Generated ${roadsGenerated} roads.`);
    return newRoadFeatures;
};

const mapFeatureType = (typeString: string): FeatureType => {
  const foundType = ALL_FEATURE_TYPES_ARRAY.find(ft => ft.toLowerCase() === typeString.toLowerCase().trim());
  if (foundType) return foundType;
  console.warn(`Unknown feature type string from AI: "${typeString}", defaulting to Other.`);
  return FeatureType.Other;
};

const initializeOccupiedCellMap = (): OccupiedCellMap => {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
};

const generatePlaceholderFeatures = (
    numToPlace: number,
    altMap: AltitudeCategory[][],
    waterMap: WaterCellsMap,
    tempMap: TemperatureCategory[][],
    potentialBiomeGrid?: (string|null)[][], // Optional: if biomes defined before placeholders
    existingMapBiomes?: MapBiome[]
): PlaceholderFeature[] => {
    const placeholders: PlaceholderFeature[] = [];
    const occupiedForPlaceholders: boolean[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
    let attempts = 0;
    const maxAttempts = numToPlace * 10; // Safety break

    const featureTypesToConsiderForPlacement: GenericFeatureSiteType[] = [
        GenericFeatureSiteType.MajorSettlement, GenericFeatureSiteType.MediumSettlement, GenericFeatureSiteType.SmallSettlement,
        GenericFeatureSiteType.CoastalSettlement, GenericFeatureSiteType.Fortification, GenericFeatureSiteType.SacredSite,
        GenericFeatureSiteType.ResourceNode, GenericFeatureSiteType.PointOfInterest, GenericFeatureSiteType.RiverCrossing,
        GenericFeatureSiteType.VolcanicVent
    ];


    while (placeholders.length < numToPlace && attempts < maxAttempts) {
        attempts++;
        const r = Math.floor(Math.random() * GRID_ROWS);
        const c = Math.floor(Math.random() * GRID_COLS);

        const genericSiteType = featureTypesToConsiderForPlacement[Math.floor(Math.random() * featureTypesToConsiderForPlacement.length)];
        
        // Determine size based on a simplified mapping or default
        let size = PLACEHOLDER_SIZES.default;
        if (genericSiteType === GenericFeatureSiteType.MajorSettlement) size = PLACEHOLDER_SIZES[FeatureType.City];
        else if (genericSiteType === GenericFeatureSiteType.MediumSettlement) size = PLACEHOLDER_SIZES[FeatureType.Town];
        else if (genericSiteType === GenericFeatureSiteType.CoastalSettlement) size = PLACEHOLDER_SIZES[FeatureType.Port];
        else if (genericSiteType === GenericFeatureSiteType.Fortification) size = PLACEHOLDER_SIZES[FeatureType.Castle];
        // ... other mappings as needed

        // Check suitability and collision
        let suitable = true;
        let isCoastalSite = false;
        let isInWaterSite = waterMap[r][c];

        if (genericSiteType === GenericFeatureSiteType.CoastalSettlement) {
            let foundCoast = false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (waterMap[getWrappedRow(r + dr)][getWrappedCol(c + dc)] && !waterMap[r][c]) {
                        foundCoast = true; break;
                    }
                }
                if (foundCoast) break;
            }
            if (!foundCoast) suitable = false;
            isCoastalSite = true;
        } else if (genericSiteType === GenericFeatureSiteType.VolcanicVent) {
            // Requires specific biome or high temp/alt, for now simplify
            if (tempMap[r][c] !== TemperatureCategory.Hot || altMap[r][c] < 1) suitable = false;
        } else { // Most other land features
            if (isInWaterSite) suitable = false; // Don't place general land features in water
        }
        
        if (!suitable) continue;

        // Collision check for the placeholder itself
        let collision = false;
        for (let rOffset = 0; rOffset < size; rOffset++) {
            for (let cOffset = 0; cOffset < size; cOffset++) {
                if (occupiedForPlaceholders[getWrappedRow(r + rOffset)][getWrappedCol(c + cOffset)]) {
                    collision = true; break;
                }
            }
            if (collision) break;
        }
        if (collision) continue;

        // Mark as occupied
        for (let rOffset = 0; rOffset < size; rOffset++) {
            for (let cOffset = 0; cOffset < size; cOffset++) {
                occupiedForPlaceholders[getWrappedRow(r + rOffset)][getWrappedCol(c + cOffset)] = true;
            }
        }
        
        let potentialBiomeName: string | undefined = undefined;
        if (potentialBiomeGrid && existingMapBiomes) {
            const biomeId = potentialBiomeGrid[r]?.[c];
            if (biomeId) {
                const biome = existingMapBiomes.find(b => b.id === biomeId);
                if (biome) potentialBiomeName = biome.name;
            }
        }


        placeholders.push({
            id: generateId('ph-'),
            genericSiteType,
            r, c, size,
            context: {
                altitudeCategory: altMap[r][c],
                temperatureCategory: tempMap[r][c],
                moistureCategory: undefined, // Moisture map not passed yet, can be added
                isInWater: isInWaterSite,
                isCoastal: isCoastalSite,
                potentialBiomeTypeName: potentialBiomeName,
            }
        });
    }
    console.log(`Generated ${placeholders.length} placeholder features.`);
    return placeholders;
};


// MAIN APP COMPONENT
const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapTheme, setMapTheme] = useState<string>("Classic Fantasy");
  const [worldLore, setWorldLore] = useState<string>("A world of ancient magic and emerging empires.");
  const [mapBiomes, setMapBiomes] = useState<MapBiome[]>([]);
  const [mapRegions, setMapRegions] = useState<MapRegion[]>([]);
  const [mapCountries, setMapCountries] = useState<MapCountry[]>([]);
  const [mapAlliances, setMapAlliances] = useState<MapAlliance[]>([]);
  const [mapZones, setMapZones] = useState<MapZone[]>([]);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [currentPlaceholderFeatures, setCurrentPlaceholderFeatures] = useState<PlaceholderFeature[]>([]);

  const [biomeGrid, setBiomeGrid] = useState<(string | null)[][]>([]);
  const [altitudeMap, setAltitudeMap] = useState<AltitudeCategory[][]>([]);
  const [waterCellsMap, setWaterCellsMap] = useState<WaterCellsMap>([]);
  const [beachCellsMap, setBeachCellsMap] = useState<BeachCellsMap>([]);
  const [temperatureMap, setTemperatureMap] = useState<TemperatureCategory[][]>([]);
  const [moistureMap, setMoistureMap] = useState<MoistureCategory[][]>([]);
  const [occupiedCellMap, setOccupiedCellMap] = useState<OccupiedCellMap>(initializeOccupiedCellMap());
  
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('biomes');
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [viewportOffset, setViewportOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<MapFeature | null>(null);
  const [selectedBiomeId, setSelectedBiomeId] = useState<string | null>(null);
  const [hoveredBiomeId, setHoveredBiomeId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
  const [selectedAllianceId, setSelectedAllianceId] = useState<string | null>(null);
  const [hoveredAllianceId, setHoveredAllianceId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartCoords, setPanStartCoords] = useState<{ x: number, y: number } | null>(null);
  const [isLoadingElaboration, setIsLoadingElaboration] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(!isApiKeySet());
  const [isWorldPopulated, setIsWorldPopulated] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [worldSeed, setWorldSeed] = useState<string>(generateId(NOISE_SEED_PREFIX));

  const generateProceduralTerrainInternal = useCallback(() => {
    console.log("Generating procedural terrain with seed:", worldSeed);
    const elevationData = generateWorldElevationNoiseMap(worldSeed);
    setAltitudeMap(elevationData.categorizedAltitudeMap);
    setWaterCellsMap(elevationData.waterCellsMap);
    setBeachCellsMap(elevationData.beachCellsMap);

    const tempMap = generateTemperatureMap(elevationData.categorizedAltitudeMap);
    setTemperatureMap(tempMap);

    const moistMap = generateCategorizedMoistureMap(worldSeed, elevationData.waterCellsMap, elevationData.categorizedAltitudeMap);
    setMoistureMap(moistMap);
    
    console.log("Procedural terrain generation complete.");
    return {
        altitudeMapData: elevationData.categorizedAltitudeMap,
        waterCellsMapData: elevationData.waterCellsMap,
        beachCellsMapData: elevationData.beachCellsMap,
        temperatureMapData: tempMap,
        moistureMapData: moistMap,
    };
  }, [worldSeed]);

  
  const populateWorldWithAiDetailsInternal = useCallback(async (
    placeholders: PlaceholderFeature[],
    currentAltMap: AltitudeCategory[][],
    currentTempMap: TemperatureCategory[][],
    currentWaterMap: WaterCellsMap
  ) => {
    console.log(`Requesting AI composition with ${placeholders.length} placeholders.`);
    const aiComposition = await generateMapCompositionFromGemini(
      mapTheme, worldLore, DEFAULT_NUM_REGIONS, DEFAULT_NUM_LAND_BIOMES,
      DEFAULT_NUM_FEATURES_TO_DEFINE_AI, DEFAULT_NUM_COUNTRIES, DEFAULT_NUM_ALLIANCES, placeholders
    );
    console.log("AI composition received:", aiComposition);

    const workingMapBiomes: MapBiome[] = [createProceduralOceanBiome()];
    const workingBiomeGrid: (string | null)[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    const workingOccupiedCellMap = initializeOccupiedCellMap();

    // Initialize biome grid with procedural ocean
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (currentWaterMap[r][c]) {
          workingBiomeGrid[r][c] = PROCEDURAL_OCEAN_BIOME_ID;
        }
      }
    }
    
    // Process AI Political Layers in order of dependency
    const rawAlliancesData = aiComposition.alliances || [];
    const rawCountriesData = aiComposition.countries || [];
    const rawRegionsData = aiComposition.regions || [];
    const rawZonesData = aiComposition.zones || [];

    const finalMapAlliances: MapAlliance[] = rawAlliancesData.map(ra => ({
        id: generateId('ally-'),
        name: ra.name,
        description: ra.description,
        color: `rgba(${Math.floor(Math.random()*150)+50}, ${Math.floor(Math.random()*150)+50}, ${Math.floor(Math.random()*150)+50}, 1)`
    }));
    setMapAlliances(finalMapAlliances);

    const finalMapCountries: MapCountry[] = rawCountriesData.map(rc => { // rc is RawCountry
        let allianceId_val: string | undefined = undefined;
        if (rc.suggested_alliance_name) {
            const alliance = finalMapAlliances.find(a => a.name === rc.suggested_alliance_name);
            if (alliance) allianceId_val = alliance.id;
        } else if (finalMapAlliances.length > 0 && rawCountriesData.length > 1) { 
             const allyIndex = rawCountriesData.indexOf(rc) % finalMapAlliances.length;
             allianceId_val = finalMapAlliances[allyIndex].id;
        }
        return {
            id: generateId('ctry-'),
            name: rc.name,
            description: rc.description,
            allianceId: allianceId_val, 
            color: `rgba(${Math.floor(Math.random()*150)+50}, ${Math.floor(Math.random()*150)+50}, ${Math.floor(Math.random()*150)+50}, 1)`
        };
    });
    setMapCountries(finalMapCountries);

    const finalMapRegions: MapRegion[] = rawRegionsData.map(rr => { // rr is RawRegion
        let countryId_val: string | undefined = undefined;
        if (rr.suggested_country_name) {
            const country = finalMapCountries.find(c => c.name === rr.suggested_country_name);
            if (country) countryId_val = country.id;
        } else if (finalMapCountries.length > 0 && rawRegionsData.length > 1) { 
            const countryIndex = rawRegionsData.indexOf(rr) % finalMapCountries.length;
            countryId_val = finalMapCountries[countryIndex].id;
        }
        return {
            id: generateId('reg-'),
            name: rr.name,
            description: rr.description,
            countryId: countryId_val 
        };
    });
    setMapRegions(finalMapRegions);
    
    // Process AI Biomes (linking to finalMapRegions)
    aiComposition.biomes.forEach(rb => {
      const region = finalMapRegions.find(pr => pr.name === rb.suggested_region_name); // Use finalMapRegions
      const newBiome: MapBiome = {
        id: generateId('bio-'), name: rb.name, type: mapFeatureType(rb.type) as unknown as BiomeType,
        description: rb.description, color: BIOME_TYPE_STYLES[mapFeatureType(rb.type) as unknown as BiomeType]?.color || BIOME_TYPE_STYLES[BiomeType.Other].color,
        altitudePreference: ALTITUDE_STRING_TO_ENUM[rb.altitude_preference.toLowerCase()] || AltitudePreference.Any,
        moisturePreference: MOISTURE_STRING_TO_ENUM[rb.moisture_preference.toLowerCase()] || MoisturePreference.Any,
        temperaturePreference: TEMPERATURE_STRING_TO_ENUM[rb.temperature_preference?.toLowerCase()] || TemperatureCategory.Temperate,
        regionId: region?.id, seedPoints: []
      };
      workingMapBiomes.push(newBiome);
    });

     // Basic Voronoi for biome grid (simplified)
    if (workingMapBiomes.filter(b => b.id !== PROCEDURAL_OCEAN_BIOME_ID).length > 0) {
        const landBiomes = workingMapBiomes.filter(b => b.id !== PROCEDURAL_OCEAN_BIOME_ID);
        const biomeSeedPoints = landBiomes.map(biome => {
            let r_seed, c_seed, attempts = 0;
            do { 
                r_seed = Math.floor(Math.random() * GRID_ROWS);
                c_seed = Math.floor(Math.random() * GRID_COLS);
                attempts++;
            } while (currentWaterMap[r_seed][c_seed] && attempts < 100);
            return { r: r_seed, c: c_seed, biomeId: biome.id, biomeType: biome.type, altPref: biome.altitudePreference, moistPref: biome.moisturePreference, tempPref: biome.temperaturePreference };
        });

        const priorityQueue = new MinHeap<GridCellState>((a,b) => a.distance - b.distance);
        biomeSeedPoints.forEach(sp => {
            if(!currentWaterMap[sp.r][sp.c]) { 
                workingBiomeGrid[sp.r][sp.c] = sp.biomeId;
                priorityQueue.push({row: sp.r, col: sp.c, biomeId: sp.biomeId, distance: 0});
            }
        });
        
        const visitedDistances: number[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(Infinity));
        biomeSeedPoints.forEach(sp => { if(!currentWaterMap[sp.r][sp.c]) visitedDistances[sp.r][sp.c] = 0; });


        while(priorityQueue.size() > 0){
            const currentCell = priorityQueue.pop()!;
            if (currentCell.distance > visitedDistances[currentCell.row][currentCell.col] && visitedDistances[currentCell.row][currentCell.col] !== Infinity) continue;

            const neighbors = [{dr:-1,dc:0},{dr:1,dc:0},{dr:0,dc:-1},{dr:0,dc:1}];
            for(const move of neighbors){
                const nr = getWrappedRow(currentCell.row + move.dr);
                const nc = getWrappedCol(currentCell.col + move.dc);
                if(currentWaterMap[nr][nc]) continue; 

                const seedBiomeInfo = biomeSeedPoints.find(s => s.biomeId === currentCell.biomeId);
                let cost = 1;
                if (seedBiomeInfo) {
                    const altCat = currentAltMap[nr][nc]; const moistCat = moistureMap[nr][nc]; const tempCat = currentTempMap[nr][nc];
                    if (seedBiomeInfo.altPref !== AltitudePreference.Any && ALTITUDE_LEVELS.indexOf(seedBiomeInfo.altPref) !== altCat +1 && altCat >=0) cost += ENVIRONMENTAL_MISMATCH_PENALTY;
                    if (seedBiomeInfo.moistPref !== MoisturePreference.Any && MOISTURE_LEVELS.indexOf(seedBiomeInfo.moistPref) !== moistCat) cost += ENVIRONMENTAL_MISMATCH_PENALTY;
                    const tempPrefArray = Array.isArray(seedBiomeInfo.tempPref) ? seedBiomeInfo.tempPref : [seedBiomeInfo.tempPref];
                    if (!tempPrefArray.includes(tempCat)) cost += TEMPERATURE_MISMATCH_PENALTY;
                }
                const newDist = currentCell.distance + cost;
                if(newDist < visitedDistances[nr][nc]){
                    visitedDistances[nr][nc] = newDist;
                    workingBiomeGrid[nr][nc] = currentCell.biomeId;
                    priorityQueue.push({row: nr, col: nc, biomeId: currentCell.biomeId, distance: newDist});
                }
            }
        }
    }
    setBiomeGrid(workingBiomeGrid);
    setMapBiomes(workingMapBiomes);

    // Process Zones and link to finalMapRegions
    const processedZones: MapZone[] = rawZonesData.map(rz => {
        const region = finalMapRegions.find(fr => fr.name === rz.suggested_region_name); // Use finalMapRegions
        return { id: generateId('zone-'), name: rz.name, description: rz.description, regionId: region?.id || (finalMapRegions[0]?.id || '') };
    });
    setMapZones(processedZones);


    // Process AI Defined Features
    const processedMapFeatures: MapFeature[] = [];
    console.log(`Processing ${aiComposition.defined_features.length} raw features from AI.`);
    aiComposition.defined_features.forEach(rawFeature => {
        const originalPlaceholder = placeholders.find(pf => pf.id === rawFeature.placeholder_id);
        if (!originalPlaceholder) {
            console.warn(`AI defined feature for non-existent or mismatched placeholder ID: ${rawFeature.placeholder_id}. Skipping.`);
            return;
        }

        const featureT = mapFeatureType(rawFeature.type);
        const style = FEATURE_TYPE_STYLES[featureT] || FEATURE_TYPE_STYLES[FeatureType.Other];

        const newMapFeature: MapFeature = {
            id: generateId('feat-'), 
            name: rawFeature.name,
            type: featureT,
            description: rawFeature.short_description,
            r: originalPlaceholder.r,
            c: originalPlaceholder.c,
            size: originalPlaceholder.size,
            fillColor: style.fill,
            strokeColor: style.stroke,
            biomeId: workingBiomeGrid[originalPlaceholder.r]?.[originalPlaceholder.c] || undefined,
            placeholderType: originalPlaceholder.genericSiteType,
        };
        processedMapFeatures.push(newMapFeature);

        for (let rOffset = 0; rOffset < newMapFeature.size; rOffset++) {
            for (let cOffset = 0; cOffset < newMapFeature.size; cOffset++) {
                const mapR = getWrappedRow(newMapFeature.r + rOffset);
                const mapC = getWrappedCol(newMapFeature.c + cOffset);
                if (workingOccupiedCellMap[mapR][mapC] === null) {
                    workingOccupiedCellMap[mapR][mapC] = newMapFeature.id;
                } else {
                    workingOccupiedCellMap[mapR][mapC] = newMapFeature.id; 
                }
            }
        }
    });
    console.log(`Successfully processed ${processedMapFeatures.length} features from AI into MapFeatures.`);
    
    setFeatures(prevExistingFeatures => [...prevExistingFeatures.filter(f => f.type === FeatureType.Road), ...processedMapFeatures]);
    setOccupiedCellMap(workingOccupiedCellMap); 

    setIsWorldPopulated(true);
    return { finalBiomeGrid: workingBiomeGrid, finalMapBiomes: workingMapBiomes, finalMapFeatures: processedMapFeatures };
  }, [mapTheme, worldLore, moistureMap]); 
  
  const handleGenerateWorld = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    const newSeed = generateId(NOISE_SEED_PREFIX);
    setWorldSeed(newSeed); 
    
    setMapBiomes([]); setMapRegions([]); setMapCountries([]); setMapAlliances([]); setMapZones([]);
    setFeatures([]); setBiomeGrid([]); 
    setOccupiedCellMap(initializeOccupiedCellMap()); 
    setCurrentPlaceholderFeatures([]);

    setSelectedFeatureId(null); setSelectedBiomeId(null); setSelectedRegionId(null);
    setSelectedCountryId(null); setSelectedAllianceId(null);
    setHoveredFeature(null); setHoveredBiomeId(null); setHoveredRegionId(null);
    setHoveredCountryId(null); setHoveredAllianceId(null);
    setIsWorldPopulated(false);
    
    try {
        const { altitudeMapData, waterCellsMapData, temperatureMapData, beachCellsMapData, moistureMapData } = generateProceduralTerrainInternal(); 
        
        const placeholders = generatePlaceholderFeatures(DEFAULT_NUM_FEATURES_TO_PLACEHOLD, altitudeMapData, waterCellsMapData, temperatureMapData);
        setCurrentPlaceholderFeatures(placeholders); 

        const aiResult = await populateWorldWithAiDetailsInternal(placeholders, altitudeMapData, temperatureMapData, waterCellsMapData);
        if (!aiResult) throw new Error("AI population failed to return results.");

        let currentBiomeGrid = aiResult.finalBiomeGrid;
        let currentMapBiomes = aiResult.finalMapBiomes;
        let currentFeatures = aiResult.finalMapFeatures;

        const riverData = await generateAndPlaceRivers(currentMapBiomes, currentBiomeGrid, altitudeMapData, waterCellsMapData);
        currentBiomeGrid = riverData.updatedBiomeGrid;
        currentMapBiomes = riverData.updatedMapBiomes;
        setBiomeGrid(currentBiomeGrid); 
        setMapBiomes(currentMapBiomes); 

        const roadFeatures = await generateAndPlaceRoads(currentFeatures, currentMapBiomes, altitudeMapData, waterCellsMapData, currentBiomeGrid);
        setFeatures(prevFeatures => [...prevFeatures.filter(f => f.type !== FeatureType.Road), ...roadFeatures]);

        setSuccessMessage("World generated successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);

    } catch (e) {
        console.error("World generation failed:", e);
        setError(e instanceof Error ? e.message : "An unknown error occurred during world generation.");
    } finally {
        setIsLoading(false);
    }
  }, [generateProceduralTerrainInternal, populateWorldWithAiDetailsInternal, worldSeed]);


  const handleFeatureClick = useCallback((featureId: string, event: ReactMouseEvent<SVGElement | HTMLDivElement>) => {
      event.stopPropagation();
      setSelectedFeatureId(prevId => prevId === featureId ? null : featureId);
      setSelectedBiomeId(null); setSelectedRegionId(null); setSelectedCountryId(null); setSelectedAllianceId(null);
  }, []);

  const handleFeatureHover = useCallback((feature: MapFeature | null) => {
      setHoveredFeature(feature);
  }, []);
  
  const panMouseMoveListener = useRef<(event: MouseEvent) => void>();
  const panMouseUpListener = useRef<(event: MouseEvent) => void>();

  const panEndCleanup = useCallback(() => {
    setIsPanning(false);
    setPanStartCoords(null);
    if (panMouseMoveListener.current) {
      window.removeEventListener('mousemove', panMouseMoveListener.current);
      panMouseMoveListener.current = undefined;
    }
    if (panMouseUpListener.current) {
      window.removeEventListener('mouseup', panMouseUpListener.current);
      panMouseUpListener.current = undefined;
    }
  }, []);


  const handleMapPanStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault(); 
    if (event.button !== 0) return; 
    setIsPanning(true);
    setPanStartCoords({ x: event.clientX, y: event.clientY });

    if (panMouseMoveListener.current) window.removeEventListener('mousemove', panMouseMoveListener.current);
    if (panMouseUpListener.current) window.removeEventListener('mouseup', panMouseUpListener.current);
    
    panMouseMoveListener.current = (globalEvent: MouseEvent) => {
        setPanStartCoords(prevCoords => {
            if (!prevCoords) return null; 
            const dx = globalEvent.clientX - prevCoords.x;
            const dy = globalEvent.clientY - prevCoords.y;
            setViewportOffset(prevOffset => ({
                x: Math.max(0, Math.min(prevOffset.x - dx / zoomLevel, LOGICAL_MAP_WIDTH - MAP_WIDTH / zoomLevel)),
                y: Math.max(0, Math.min(prevOffset.y - dy / zoomLevel, LOGICAL_MAP_HEIGHT - MAP_HEIGHT / zoomLevel))
            }));
            return { x: globalEvent.clientX, y: globalEvent.clientY }; 
        });
    };
    window.addEventListener('mousemove', panMouseMoveListener.current);

    panMouseUpListener.current = () => {
        panEndCleanup();
    };
    window.addEventListener('mouseup', panMouseUpListener.current);

  }, [zoomLevel, panEndCleanup]);


  const handleCanvasClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (isPanning) return; 
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const logicalClickedX = viewportOffset.x + clickX / zoomLevel;
    const logicalClickedY = viewportOffset.y + clickY / zoomLevel;

    const c = Math.floor(logicalClickedX / LOGICAL_CELL_WIDTH);
    const r = Math.floor(logicalClickedY / LOGICAL_CELL_HEIGHT);

    const wrappedR = getWrappedRow(r);
    const wrappedC = getWrappedCol(c);

    const featureIdInCell = occupiedCellMap[wrappedR]?.[wrappedC];
    if (featureIdInCell) {
        const clickedFeature = features.find(f => f.id === featureIdInCell && f.type !== FeatureType.Road);
        if (clickedFeature) {
            handleFeatureClick(clickedFeature.id, event);
            return; 
        }
    }
    
    const biomeId = biomeGrid[wrappedR]?.[wrappedC];
    const currentBiome = biomeId ? mapBiomes.find(b => b.id === biomeId) : null;
    const currentRegion = currentBiome?.regionId ? mapRegions.find(reg => reg.id === currentBiome.regionId) : null;
    const currentCountry = currentRegion?.countryId ? mapCountries.find(country => country.id === currentRegion.countryId) : null;
    const currentAlliance = currentCountry?.allianceId ? mapAlliances.find(alliance => alliance.id === currentCountry.allianceId) : null;
    
    setSelectedFeatureId(null); 

    if (mapViewMode === 'alliances' && currentAlliance) {
        setSelectedAllianceId(prev => prev === currentAlliance.id ? null : currentAlliance.id);
        setSelectedCountryId(null); setSelectedRegionId(null); setSelectedBiomeId(null);
    } else if (mapViewMode === 'countries' && currentCountry) {
        setSelectedCountryId(prev => prev === currentCountry.id ? null : currentCountry.id);
        setSelectedAllianceId(null); setSelectedRegionId(null); setSelectedBiomeId(null);
    } else if (mapViewMode === 'regions' && currentRegion) {
        setSelectedRegionId(prev => prev === currentRegion.id ? null : currentRegion.id);
        setSelectedAllianceId(null); setSelectedCountryId(null); setSelectedBiomeId(null);
    } else if ((mapViewMode === 'biomes' || mapViewMode === 'realistic' || mapViewMode === 'elevation') && currentBiome) {
        setSelectedBiomeId(prev => prev === currentBiome.id ? null : currentBiome.id);
        setSelectedAllianceId(null); setSelectedCountryId(null); setSelectedRegionId(null);
    } else { 
        setSelectedBiomeId(null); setSelectedRegionId(null); setSelectedCountryId(null); setSelectedAllianceId(null);
    }
  }, [isPanning, viewportOffset, zoomLevel, occupiedCellMap, features, biomeGrid, mapBiomes, mapRegions, mapCountries, mapAlliances, mapViewMode, handleFeatureClick]);

  const handleCanvasMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (isPanning) return; 
    const rect = event.currentTarget.getBoundingClientRect();
    const hoverX = event.clientX - rect.left;
    const hoverY = event.clientY - rect.top;

    const logicalHoverX = viewportOffset.x + hoverX / zoomLevel;
    const logicalHoverY = viewportOffset.y + hoverY / zoomLevel;

    const c = Math.floor(logicalHoverX / LOGICAL_CELL_WIDTH);
    const r = Math.floor(logicalHoverY / LOGICAL_CELL_HEIGHT);
    
    const wrappedR = getWrappedRow(r);
    const wrappedC = getWrappedCol(c);

    const featureIdInCell = occupiedCellMap[wrappedR]?.[wrappedC];
     if (featureIdInCell) {
        const hFeature = features.find(f => f.id === featureIdInCell && f.type !== FeatureType.Road);
        setHoveredFeature(hFeature || null);
        if (hFeature) { 
             setHoveredBiomeId(null); setHoveredRegionId(null); setHoveredCountryId(null); setHoveredAllianceId(null); return;
        }
    } else {
        setHoveredFeature(null);
    }

    const biomeId = biomeGrid[wrappedR]?.[wrappedC];
    const currentBiome = biomeId ? mapBiomes.find(b => b.id === biomeId) : null;
    setHoveredBiomeId(currentBiome ? currentBiome.id : null);

    const currentRegion = currentBiome?.regionId ? mapRegions.find(reg => reg.id === currentBiome.regionId) : null;
    setHoveredRegionId(currentRegion ? currentRegion.id : null);

    const currentCountry = currentRegion?.countryId ? mapCountries.find(country => country.id === currentRegion.countryId) : null;
    setHoveredCountryId(currentCountry ? currentCountry.id : null);

    const currentAlliance = currentCountry?.allianceId ? mapAlliances.find(alliance => alliance.id === currentCountry.allianceId) : null;
    setHoveredAllianceId(currentAlliance ? currentAlliance.id : null);

  }, [isPanning, viewportOffset, zoomLevel, occupiedCellMap, features, biomeGrid, mapBiomes, mapRegions, mapCountries, mapAlliances]);
  
  const handleCanvasMouseLeave = useCallback(() => {
    if (isPanning) { 
        panEndCleanup();
    }
    setHoveredFeature(null);
    setHoveredBiomeId(null);
    setHoveredRegionId(null);
    setHoveredCountryId(null);
    setHoveredAllianceId(null);
  }, [isPanning, panEndCleanup]);

  const handleZoomIn = useCallback((_event: ReactMouseEvent) => setZoomLevel(prev => Math.min(MAX_ZOOM, prev + ZOOM_INCREMENT)), []);
  const handleZoomOut = useCallback((_event: ReactMouseEvent) => setZoomLevel(prev => Math.max(MIN_ZOOM, prev - ZOOM_INCREMENT)), []);
  const handleResetZoom = useCallback((_event?: ReactMouseEvent) => setZoomLevel(1), []);

  const handleElaborateFeature = useCallback(async (featureToElaborate: MapFeature) => {
    if (!featureToElaborate) return;
    setIsLoadingElaboration(true);
    try {
      const biome = featureToElaborate.biomeId ? mapBiomes.find(b => b.id === featureToElaborate.biomeId) : null;
      const elaboratedDescription = await elaborateFeatureDescription(
        featureToElaborate.name,
        featureToElaborate.type,
        featureToElaborate.description,
        biome?.name,
        biome?.type
      );
      setFeatures(prevFeatures => 
        prevFeatures.map(f => 
          f.id === featureToElaborate.id ? { ...f, description: elaboratedDescription } : f
        )
      );
    } catch (err) {
      setError("Failed to elaborate feature description. " + (err instanceof Error ? err.message : String(err) ));
    } finally {
      setIsLoadingElaboration(false);
    }
  }, [mapBiomes]);

  useEffect(() => {
    if (apiKeyMissing) {
      setError("API Key is missing. Please set the API_KEY environment variable.");
    } else {
        generateProceduralTerrainInternal(); 
    }
  }, [apiKeyMissing, generateProceduralTerrainInternal]); 

  useEffect(() => {
    if (apiKeyMissing) {
        setError("API Key is missing. Please set the API_KEY environment variable.");
    } else if (error) {
        setSuccessMessage(null);
    } else if (successMessage) {
        setError(null);
    }
  }, [apiKeyMissing, error, successMessage]);


  const selectedFeature = features.find(f => f.id === selectedFeatureId) || null;
  
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-900 text-white p-4 gap-4 overflow-hidden">
      <div className="flex-grow flex items-center justify-center relative" style={{ minWidth: MAP_WIDTH, minHeight: MAP_HEIGHT }}>
        <MapDisplay
          biomeGrid={biomeGrid} mapBiomes={mapBiomes} mapRegions={mapRegions} mapCountries={mapCountries} mapAlliances={mapAlliances} mapZones={mapZones}
          altitudeMap={altitudeMap} waterCellsMap={waterCellsMap} beachCellsMap={beachCellsMap} temperatureMap={temperatureMap}
          features={features} occupiedCellMap={occupiedCellMap}
          selectedFeatureId={selectedFeatureId} selectedBiomeId={selectedBiomeId} hoveredBiomeId={hoveredBiomeId}
          selectedRegionId={selectedRegionId} hoveredRegionId={hoveredRegionId}
          selectedCountryId={selectedCountryId} hoveredCountryId={hoveredCountryId}
          selectedAllianceId={selectedAllianceId} hoveredAllianceId={hoveredAllianceId}
          mapViewMode={mapViewMode} viewportOffset={viewportOffset} zoomLevel={zoomLevel}
          onFeatureClick={handleFeatureClick} onFeatureHover={handleFeatureHover}
          onCanvasClick={handleCanvasClick} onCanvasMouseMove={handleCanvasMouseMove} onCanvasMouseLeave={handleCanvasMouseLeave}
          onMapPanStart={handleMapPanStart} onMapPanEnd={panEndCleanup} 
          showGridOverlay={showGridOverlay} isPanning={isPanning}
          isWorldPopulated={isWorldPopulated}
        />
      </div>

      <div className="w-full md:w-96 flex flex-col gap-3 flex-shrink-0">
        <div className="bg-gray-800 p-3 rounded-lg shadow-lg">
          <h1 className="text-xl font-bold text-center text-blue-400 mb-2">AI Fantasy Map Generator</h1>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Button onClick={handleGenerateWorld} isLoading={isLoading} disabled={apiKeyMissing || isLoading} className="w-full">
              Generate World
            </Button>
            <Button onClick={() => generateProceduralTerrainInternal()} isLoading={isLoading} disabled={isLoading} variant="secondary" className="w-full">
              Regen Terrain
            </Button>
          </div>
          
           <div className="mb-2">
            <label htmlFor="mapTheme" className="block text-xs font-medium text-gray-300 mb-0.5">Theme:</label>
            <input type="text" id="mapTheme" value={mapTheme} onChange={e => setMapTheme(e.target.value)} className="w-full p-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"/>
          </div>
          <div className="mb-2">
            <label htmlFor="worldLore" className="block text-xs font-medium text-gray-300 mb-0.5">Lore Snippet:</label>
            <textarea id="worldLore" value={worldLore} onChange={e => setWorldLore(e.target.value)} rows={2} className="w-full p-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"></textarea>
          </div>

          <div className="flex items-center justify-between mb-2 text-xs">
             <label htmlFor="mapViewMode" className="text-gray-300">View Mode:</label>
             <select id="mapViewMode" value={mapViewMode} onChange={e => setMapViewMode(e.target.value as MapViewMode)} className="p-1 bg-gray-700 border border-gray-600 rounded-md">
                <option value="biomes">Biomes</option><option value="elevation">Elevation</option>
                <option value="realistic">Realistic</option><option value="regions">Regions</option>
                <option value="countries">Countries</option><option value="alliances">Alliances</option>
            </select>
            <label className="flex items-center text-gray-300">
                <input type="checkbox" checked={showGridOverlay} onChange={() => setShowGridOverlay(s => !s)} className="mr-1.5 form-checkbox h-3.5 w-3.5 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"/>
                Grid
            </label>
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Button onClick={handleZoomOut} variant="secondary" className="text-xs px-2 py-1" aria-label="Zoom out">-</Button>
            <Button onClick={handleResetZoom} variant="secondary" className="text-xs px-2 py-1" aria-label="Reset zoom">Zoom Reset</Button>
            <Button onClick={handleZoomIn} variant="secondary" className="text-xs px-2 py-1" aria-label="Zoom in">+</Button>
          </div>
          <div className="text-center text-xs text-gray-400">Seed: {worldSeed.replace(NOISE_SEED_PREFIX, '')} <span className="text-gray-500">({APP_VERSION})</span></div>

          {apiKeyMissing && ( <div className="mt-2 p-2 bg-red-800 border border-red-700 rounded-md text-center text-xs text-red-100"> API Key missing. Set API_KEY env variable. </div> )}
          {error && !apiKeyMissing && ( <div className="mt-2 p-2 bg-red-800 border border-red-700 rounded-md text-center text-xs text-red-100">Error: {error}</div> )}
          {successMessage && !error && !apiKeyMissing && ( <div className="mt-2 p-2 bg-green-700 border border-green-600 rounded-md text-center text-xs text-green-100">{successMessage}</div> )}
          {isLoading && <div className="flex justify-center mt-2"><LoadingSpinner size={5} /></div>}
        </div>

        <div className="flex-grow bg-gray-800 rounded-lg shadow-lg min-h-[200px] md:min-h-0">
            <DetailsPanel 
                feature={selectedFeature}
                selectedBiome={mapBiomes.find(b => b.id === selectedBiomeId) || null}
                hoveredBiome={mapBiomes.find(b => b.id === hoveredBiomeId) || null}
                selectedRegion={mapRegions.find(r => r.id === selectedRegionId) || null}
                hoveredRegion={mapRegions.find(r => r.id === hoveredRegionId) || null}
                selectedCountry={mapCountries.find(c => c.id === selectedCountryId) || null}
                hoveredCountry={mapCountries.find(c => c.id === hoveredCountryId) || null}
                selectedAlliance={mapAlliances.find(a => a.id === selectedAllianceId) || null}
                hoveredAlliance={mapAlliances.find(a => a.id === hoveredAllianceId) || null}
                allBiomes={mapBiomes} allRegions={mapRegions} allCountries={mapCountries} allAlliances={mapAlliances} allZones={mapZones}
                onElaborate={handleElaborateFeature} isLoadingElaboration={isLoadingElaboration}
                hoveredFeature={hoveredFeature}
                currentView={mapViewMode}
            />
        </div>
      </div>
    </div>
  );
};

export default App;
