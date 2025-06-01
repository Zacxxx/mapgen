
import { FeatureType, BiomeType, AltitudePreference, MoisturePreference, TemperatureCategory } from './types'; // Added TemperatureCategory

export const GEMINI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

// Viewport dimensions (fixed size of the canvas element)
export const MAP_WIDTH = 1000; 
export const MAP_HEIGHT = 750; 

export const MIN_FEATURE_SIZE_CELLS = 1; // Smallest feature is 1x1 cell
export const MAX_FEATURE_SIZE_CELLS = 5; // Largest feature is 5x5 cells (e.g. City)
export const FEATURE_COLLISION_MULTIPLIER = 1.0; // For cell-based collision, direct check is better

// Logical grid dimensions (higher resolution)
export const GRID_ROWS = 150; // Increased from 75
export const GRID_COLS = 200; // Increased from 100

// Cell dimensions for the logical grid
export const LOGICAL_CELL_WIDTH = 10; 
export const LOGICAL_CELL_HEIGHT = 10;

// Total dimensions of the logical map (for panning)
export const LOGICAL_MAP_WIDTH = GRID_COLS * LOGICAL_CELL_WIDTH; // 2000
export const LOGICAL_MAP_HEIGHT = GRID_ROWS * LOGICAL_CELL_HEIGHT; // 1500

// Fallback cell dimensions if needed (used for initial constants, but logical is preferred for calculations)
export const CELL_HEIGHT = MAP_HEIGHT / GRID_ROWS; // Now 5 (750 / 150) - for cases where logical cell size isn't directly used
export const CELL_WIDTH = MAP_WIDTH / GRID_COLS;   // Now 5 (1000 / 200)

export const ALTITUDE_LEVELS = [AltitudePreference.Low, AltitudePreference.Medium, AltitudePreference.High];
export const MOISTURE_LEVELS = [MoisturePreference.Dry, MoisturePreference.Moderate, MoisturePreference.Wet];
export const ENVIRONMENTAL_MISMATCH_PENALTY = 1; 
export const TEMPERATURE_MISMATCH_PENALTY = 1.5; // New for temperature

export const ALTITUDE_STRING_TO_ENUM: Record<string, AltitudePreference> = {
  "low": AltitudePreference.Low,
  "medium": AltitudePreference.Medium,
  "high": AltitudePreference.High,
  "any": AltitudePreference.Any,
};

export const MOISTURE_STRING_TO_ENUM: Record<string, MoisturePreference> = {
  "dry": MoisturePreference.Dry,
  "moderate": MoisturePreference.Moderate,
  "wet": MoisturePreference.Wet,
  "any": MoisturePreference.Any,
};

export const TEMPERATURE_STRING_TO_ENUM: Record<string, TemperatureCategory> = { // New
    "freezing": TemperatureCategory.Freezing,
    "cold": TemperatureCategory.Cold,
    "temperate": TemperatureCategory.Temperate,
    "warm": TemperatureCategory.Warm,
    "hot": TemperatureCategory.Hot,
    "any": TemperatureCategory.Temperate, // Default to temperate if "any"
};

// FEATURE_TYPE_STYLES now only define fill/stroke for direct cell coloring or panel icons
// Shape is removed as features are groups of cells.
export const FEATURE_TYPE_STYLES: Record<FeatureType, { fill: string; stroke: string; strokeWidth?: number }> = {
  [FeatureType.City]: { fill: 'rgba(239, 68, 68, 1)', stroke: 'rgba(185, 28, 28, 1)' }, // Tailwind red-500 / red-700
  [FeatureType.Town]: { fill: 'rgba(248, 113, 113, 1)', stroke: 'rgba(220, 38, 38, 1)' }, // Tailwind red-400 / red-600
  [FeatureType.Village]: { fill: 'rgba(251, 146, 60, 1)', stroke: 'rgba(234, 88, 12, 1)' }, // Tailwind orange-400 / orange-600
  [FeatureType.Forest]: { fill: 'rgba(22, 163, 74, 1)', stroke: 'rgba(21, 128, 61, 1)' }, // Tailwind green-600 / green-800 (as POI)
  [FeatureType.Mountain]: { fill: 'rgba(107, 114, 128, 1)', stroke: 'rgba(55, 65, 81, 1)' }, // Tailwind gray-500 / gray-700 (as POI)
  [FeatureType.River]: { fill: 'rgba(59, 130, 246, 1)', stroke: 'rgba(29, 78, 216, 1)' },  // Tailwind blue-500 / blue-700 (as POI, if ever used like that)
  [FeatureType.Lake]: { fill: 'rgba(96, 165, 250, 1)', stroke: 'rgba(37, 99, 235, 1)' }, // Tailwind blue-400 / blue-600 (as POI)
  [FeatureType.Ocean]: { fill: 'rgba(37, 99, 235, 1)', stroke: 'rgba(30, 64, 175, 1)' }, // Tailwind blue-600 / blue-800 (as POI)
  [FeatureType.Desert]: { fill: 'rgba(234, 179, 8, 1)', stroke: 'rgba(202, 138, 4, 1)' }, // Tailwind yellow-500 / yellow-700 (as POI)
  [FeatureType.Island]: { fill: 'rgba(16, 185, 129, 1)', stroke: 'rgba(5, 150, 105, 1)' }, // Tailwind emerald-500 / emerald-700 (as POI)
  [FeatureType.Cave]: { fill: 'rgba(64, 64, 64, 1)', stroke: 'rgba(23, 23, 23, 1)' }, // Tailwind neutral-700 / neutral-900
  [FeatureType.Ruin]: { fill: 'rgba(120, 113, 108, 1)', stroke: 'rgba(87, 83, 78, 1)' }, // Tailwind stone-500 / stone-700
  [FeatureType.Tower]: { fill: 'rgba(99, 102, 241, 1)', stroke: 'rgba(67, 56, 202, 1)' }, // Tailwind indigo-500 / indigo-700
  [FeatureType.Castle]: { fill: 'rgba(147, 51, 234, 1)', stroke: 'rgba(126, 34, 206, 1)' }, // Tailwind purple-600 / purple-800
  [FeatureType.Mine]: { fill: 'rgba(82, 82, 91, 1)', stroke: 'rgba(63, 63, 70, 1)' }, // Tailwind zinc-600 / zinc-800
  [FeatureType.Port]: { fill: 'rgba(14, 165, 233, 1)', stroke: 'rgba(2, 132, 199, 1)' }, // Tailwind sky-500 / sky-700
  [FeatureType.Bridge]: { fill: 'rgba(217, 119, 6, 1)', stroke: 'rgba(180, 83, 9, 1)' }, // Tailwind amber-600 / amber-800
  [FeatureType.Road]: { fill: 'rgba(0,0,0,0)', stroke: 'rgba(202, 138, 4, 0.6)', strokeWidth: 1.5 }, // Tailwind yellow-600 (semi-transparent for path)
  [FeatureType.Temple]: { fill: 'rgba(225, 29, 72, 1)', stroke: 'rgba(190, 18, 60, 1)' }, // Tailwind rose-500 / rose-700
  [FeatureType.Monastery]: { fill: 'rgba(124, 58, 237, 1)', stroke: 'rgba(109, 40, 217, 1)' }, // Tailwind violet-500 / violet-700
  [FeatureType.Oasis]: { fill: 'rgba(20, 184, 166, 1)', stroke: 'rgba(15, 118, 110, 1)' }, // Tailwind teal-400 / teal-600
  [FeatureType.Volcano]: { fill: 'rgba(234, 88, 12, 1)', stroke: 'rgba(153, 27, 27, 1)' }, // Tailwind orange-700 / red-900
  [FeatureType.Swamp]: { fill: 'rgba(101, 163, 13, 1)', stroke: 'rgba(77, 124, 15, 1)' }, // Tailwind lime-700 / lime-900 (as POI)
  [FeatureType.Plain]: { fill: 'rgba(190, 242, 100, 1)', stroke: 'rgba(163, 230, 53, 1)' }, // Tailwind lime-300 / lime-500 (as POI)
  [FeatureType.MinorLandmark]: { fill: 'rgba(156, 163, 175, 1)', stroke: 'rgba(75, 85, 99, 1)'}, // gray-400 / gray-600
  [FeatureType.Other]: { fill: 'rgba(156, 163, 175, 1)', stroke: 'rgba(75, 85, 99, 1)' }, // Tailwind gray-400 / gray-600
};

export const ALL_FEATURE_TYPES_ARRAY = Object.values(FeatureType);

export const BIOME_TYPE_STYLES: Record<BiomeType, { color: string; defaultFeatures?: FeatureType[], defaultTemp?: TemperatureCategory | TemperatureCategory[] }> = {
  [BiomeType.Forest]: { color: 'rgba(34, 139, 34, 0.75)', defaultFeatures: [FeatureType.Cave, FeatureType.Ruin, FeatureType.Village], defaultTemp: [TemperatureCategory.Temperate, TemperatureCategory.Cold] }, 
  [BiomeType.Desert]: { color: 'rgba(244, 164, 96, 0.75)', defaultFeatures: [FeatureType.Oasis, FeatureType.Ruin, FeatureType.Mine], defaultTemp: [TemperatureCategory.Hot, TemperatureCategory.Warm] }, 
  [BiomeType.Plains]: { color: 'rgba(144, 238, 144, 0.75)', defaultFeatures: [FeatureType.Village, FeatureType.Town], defaultTemp: TemperatureCategory.Temperate }, 
  [BiomeType.Mountains]: { color: 'rgba(100, 100, 100, 0.8)', defaultFeatures: [FeatureType.Mine, FeatureType.Cave, FeatureType.Tower, FeatureType.Monastery], defaultTemp: [TemperatureCategory.Cold, TemperatureCategory.Temperate] }, 
  [BiomeType.Ocean]: { color: 'rgba(70, 130, 180, 0.75)', defaultFeatures: [FeatureType.Island, FeatureType.Port] }, 
  [BiomeType.Swamp]: { color: 'rgba(85, 107, 47, 0.8)', defaultFeatures: [FeatureType.Ruin, FeatureType.Village, FeatureType.Cave], defaultTemp: [TemperatureCategory.Warm, TemperatureCategory.Temperate] },    
  [BiomeType.Tundra]: { color: 'rgb(140, 145, 150)', defaultFeatures: [FeatureType.Cave, FeatureType.Ruin], defaultTemp: TemperatureCategory.Cold },
  [BiomeType.Volcanic]: { color: 'rgba(255, 69, 0, 0.75)', defaultFeatures: [FeatureType.Mine, FeatureType.Cave, FeatureType.Tower], defaultTemp: [TemperatureCategory.Hot, TemperatureCategory.Warm] }, 
  [BiomeType.Jungle]: { color: 'rgba(0, 100, 0, 0.8)', defaultFeatures: [FeatureType.Temple, FeatureType.Ruin, FeatureType.Village], defaultTemp: [TemperatureCategory.Hot, TemperatureCategory.Warm] }, 
  [BiomeType.Grassland]: { color: 'rgba(124, 252, 0, 0.75)', defaultFeatures: [FeatureType.Town, FeatureType.Road], defaultTemp: TemperatureCategory.Temperate }, 
  [BiomeType.Hills]: { color: 'rgba(188, 143, 143, 0.75)', defaultFeatures: [FeatureType.Mine, FeatureType.Village, FeatureType.Tower], defaultTemp: TemperatureCategory.Temperate }, 
  [BiomeType.Badlands]: { color: 'rgba(210, 105, 30, 0.75)', defaultFeatures: [FeatureType.Ruin, FeatureType.Cave, FeatureType.Mine], defaultTemp: [TemperatureCategory.Warm, TemperatureCategory.Hot] }, 
  [BiomeType.Coastal]: { color: 'rgba(0, 191, 255, 0.75)', defaultFeatures: [FeatureType.Port, FeatureType.Village, FeatureType.Tower], defaultTemp: [TemperatureCategory.Temperate, TemperatureCategory.Warm] }, 
  [BiomeType.River]: { color: 'rgba(80, 120, 200, 0.9)', defaultFeatures: [FeatureType.Bridge, FeatureType.Port] }, // Darker, more opaque river for biomes view
  [BiomeType.Ice]: { color: 'rgb(220, 230, 240)', defaultFeatures: [FeatureType.Cave], defaultTemp: TemperatureCategory.Freezing },
  [BiomeType.Taiga]: { color: 'rgba(0, 80, 60, 0.8)', defaultFeatures: [FeatureType.Forest, FeatureType.Cave, FeatureType.Village], defaultTemp: TemperatureCategory.Cold },
  [BiomeType.Beach]: { color: 'rgb(238, 213, 183)', defaultFeatures: [FeatureType.Village, FeatureType.Port], defaultTemp: [TemperatureCategory.Warm, TemperatureCategory.Temperate]},
  [BiomeType.Other]: { color: 'rgba(128, 128, 128, 0.75)', defaultFeatures: [FeatureType.Other] }, 
};

export const ALL_BIOME_TYPES_ARRAY = Object.values(BiomeType);

export const GRID_BACKGROUND_COLOR = 'rgb(20, 30, 40)'; // Darker base background
export const GRID_LINE_COLOR = 'rgba(100, 116, 139, 0.3)'; // More subtle grid lines
export const GRID_LINE_WIDTH = 0.5;

// General Highlight Borders
export const HOVER_BORDER_COLOR = 'rgba(250, 204, 21, 0.9)'; 
export const SELECTED_BORDER_COLOR = 'rgba(234, 179, 8, 1)'; 
export const GENERIC_HIGHLIGHT_BORDER_WIDTH = 2.5; // Universal base width

// Political View Specifics
export const POLITICAL_VIEW_DESATURATION_FACTOR = 0.3; // How much to desaturate base map (0 = grayscale, 1 = original)
export const POLITICAL_VIEW_BACKGROUND_TINT_COLOR = 'rgba(20, 30, 40, 0.1)'; // Slight tint to desaturated background

export const COUNTRY_FILL_OPACITY = 0.35;
export const COUNTRY_SELECTED_FILL_OPACITY = 0.60;
export const COUNTRY_HOVER_FILL_OPACITY = 0.50;
export const COUNTRY_NON_SELECTED_ADJACENT_FILL_OPACITY = 0.25;
export const COUNTRY_BORDER_COLOR = 'rgba(255, 255, 255, 0.7)';
export const COUNTRY_HOVER_BORDER_COLOR = 'rgba(250, 100, 100, 0.9)';
export const COUNTRY_SELECTED_BORDER_COLOR = 'rgba(230, 50, 50, 1)';
export const COUNTRY_BORDER_WIDTH = 1.5; // Thicker base for political entities
export const COUNTRY_SVG_BORDER_OUTLINE_COLOR = 'rgba(0,0,0,0.5)'; // For contrast
export const COUNTRY_SVG_BORDER_OUTLINE_WIDTH_FACTOR = 1.5; // e.g. outline is 1.5x main border

export const ALLIANCE_FILL_OPACITY = 0.35;
export const ALLIANCE_SELECTED_FILL_OPACITY = 0.60;
export const ALLIANCE_HOVER_FILL_OPACITY = 0.50;
export const ALLIANCE_NON_SELECTED_ADJACENT_FILL_OPACITY = 0.25;
export const ALLIANCE_BORDER_COLOR = 'rgba(220, 220, 255, 0.7)';
export const ALLIANCE_HOVER_BORDER_COLOR = 'rgba(100, 250, 100, 0.9)';
export const ALLIANCE_SELECTED_BORDER_COLOR = 'rgba(50, 230, 50, 1)';
export const ALLIANCE_BORDER_WIDTH = 2.0; // Alliances borders even thicker
export const ALLIANCE_SVG_BORDER_OUTLINE_COLOR = 'rgba(0,0,0,0.6)';
export const ALLIANCE_SVG_BORDER_OUTLINE_WIDTH_FACTOR = 1.5;

// Default colors if not provided by AI (used in constants for panel, not direct map fill anymore for political)
export const DEFAULT_COUNTRY_FILL_COLOR = 'rgba(200, 0, 0, 0.15)'; // Kept for panel icon
export const DEFAULT_ALLIANCE_FILL_COLOR = 'rgba(0, 200, 0, 0.15)'; // Kept for panel icon


export const ELEVATION_COLORS: Record<number, string> = {
  [-2]: 'rgb(30, 60, 100)',   // Deep Ocean
  [-1]: 'rgb(50, 90, 130)',  // Shallow Ocean / Coastal
  0: 'rgb(70, 110, 80)',      // Low Land (greener)
  1: 'rgb(110, 130, 90)',      // Medium Land (browner green)
  2: 'rgb(140, 140, 140)',    // High Land (greyer)
};

export const ELEVATION_LEGEND = [
  { color: ELEVATION_COLORS[-2], label: 'Deep Ocean' },
  { color: ELEVATION_COLORS[-1], label: 'Shallow Ocean' },
  { color: ELEVATION_COLORS[0], label: 'Low Altitude Land' },
  { color: ELEVATION_COLORS[1], label: 'Medium Altitude Land' },
  { color: ELEVATION_COLORS[2], label: 'High Altitude Land' },
];
export const CONTOUR_LINE_COLOR_DARKER_FACTOR = 0.7; // e.g. 70% of base elevation color's brightness
export const CONTOUR_LINE_WIDTH = 0.75;


// Noise-based terrain generation constants
export const LARGE_NOISE_SCALE = 0.015; 
export const MEDIUM_NOISE_SCALE = 0.04;  
export const DETAIL_NOISE_SCALE = 0.08; 
export const COASTAL_DETAIL_NOISE_SCALE = 0.15; 
export const NOISE_OCTAVES = 5; 
export const NOISE_PERSISTENCE = 0.5; 
export const NOISE_LACUNARITY = 2.0; 
export const NOISE_SEED_PREFIX = "map_seed_"; 

export const WATER_LEVEL_DEEP_THRESHOLD = 0.32; 
export const WATER_LEVEL_SHALLOW_THRESHOLD = 0.42; 
export const LAND_LOW_THRESHOLD_NORMALIZED = 0.42 + (0.58 * 0.33); 
export const LAND_MEDIUM_THRESHOLD_NORMALIZED = 0.42 + (0.58 * 0.66); 
export const BEACH_SLOPE_THRESHOLD = 0.05; 

export const MOISTURE_NOISE_SCALE = 0.08; 
export const LATITUDE_EFFECT_STRENGTH = 0.6; 
export const COASTAL_EFFECT_STRENGTH = 0.4; 
export const COASTAL_EFFECT_RADIUS = Math.floor(8 * (GRID_ROWS / 75)); 

// Temperature generation constants
export const TEMPERATURE_CATEGORY_VALUES: Record<TemperatureCategory, number> = {
  [TemperatureCategory.Freezing]: 0,
  [TemperatureCategory.Cold]: 1,
  [TemperatureCategory.Temperate]: 2,
  [TemperatureCategory.Warm]: 3,
  [TemperatureCategory.Hot]: 4,
};
export const NUM_TEMPERATURE_CATEGORIES = Object.keys(TemperatureCategory).length;
export const POLAR_ZONE_ROWS = Math.floor(GRID_ROWS * 0.15); 
export const SUB_POLAR_TRANSITION_ROWS = Math.floor(GRID_ROWS * 0.10); 
export const EQUATORIAL_ZONE_ROWS = Math.floor(GRID_ROWS * 0.25); 

export const PROCEDURAL_OCEAN_BIOME_ID = "procedural_ocean_biome";
export const PROCEDURAL_OCEAN_BIOME_NAME = "The World Ocean";

// River generation constants
const OLD_GRID_CELLS = 75 * 100;
const NEW_GRID_CELLS = GRID_ROWS * GRID_COLS;
const SCALE_FACTOR_RIVERS_ROADS = NEW_GRID_CELLS / OLD_GRID_CELLS;
export const NUM_RIVERS_TO_GENERATE = Math.floor(SCALE_FACTOR_RIVERS_ROADS * 15 * 1.5); // Increased rivers
export const RIVER_MAX_PATH_LENGTH = Math.floor(GRID_ROWS * GRID_COLS / 8); // Slightly longer rivers
export const RIVER_A_STAR_COSTS = {
  UPHILL_PENALTY: 200, // More penalty for going up
  SAME_ALTITUDE_PENALTY: 10, // Slightly higher penalty for staying flat
  DOWNHILL_BONUS: -2, // Stronger bonus for downhill
  BASE_MOVE_COST: 1, OCEAN_LAKE_SINK_COST: 0, 
  EXISTING_RIVER_PENALTY: 25, // Penalty to avoid pathing over existing river cells unnecessarily
};
export const PROCEDURAL_RIVER_BIOME_NAME = "Procedural River";
export const LAKE_BIOME_TYPES = [BiomeType.Ocean]; 

// Road generation constants
export const NUM_ROADS_TO_GENERATE = Math.floor(SCALE_FACTOR_RIVERS_ROADS * 8); // Slightly more roads
export const ROAD_MAX_PATH_LENGTH = Math.floor(GRID_ROWS * GRID_COLS / 7);
export const ROAD_A_STAR_COSTS = {
    BASE_MOVE_COST: 1, ALTITUDE_CHANGE_PENALTY_FACTOR: 7, HIGH_MOUNTAIN_PENALTY: 60, 
    WATER_PENALTY: 1000, RIVER_CROSSING_WITHOUT_BRIDGE_PENALTY: 300, FEATURE_OBSTRUCTION_PENALTY: 200,
    BIOME_PENALTIES: { 
        [BiomeType.Swamp]: 30, [BiomeType.Forest]: 15, [BiomeType.Jungle]: 20, [BiomeType.Tundra]: 15,
        [BiomeType.Volcanic]: 40, [BiomeType.Badlands]: 15, [BiomeType.Mountains]: 25, [BiomeType.Ice]: 500,
        [BiomeType.Desert]: 5, [BiomeType.Plains]: 0, [BiomeType.Grassland]: 2, [BiomeType.Hills]: 8, [BiomeType.Taiga]: 18,
    } as Record<BiomeType, number>,
};
export const ROAD_PREFERRED_FEATURE_TYPES = [FeatureType.City, FeatureType.Town];

// Realistic View Constants
export const REALISTIC_VIEW_TEXTURE_NOISE_SCALE = 0.25; 
export const HILLSHADING_STRENGTH = 20; 

// SNOW
export const SNOW_CAP_TEMP_THRESHOLD = TemperatureCategory.Cold; 
export const SNOW_CAP_BASE_COLOR = 'rgb(240, 245, 250)'; // Slightly off-white
export const SNOW_CAP_HIGHLIGHT_COLOR = 'rgb(250, 255, 255)';
export const SNOW_NOISE_SCALE_SMALL = 0.3;
export const SNOW_NOISE_SCALE_LARGE = 0.1;
export const SNOW_NOISE_INTENSITY = 0.08; // How much noise affects base color

// WATER
export const REALISTIC_OCEAN_DEEP_COLOR = 'rgb(25, 50, 90)';
export const REALISTIC_OCEAN_SHALLOW_COLOR = 'rgb(45, 80, 120)';
export const REALISTIC_RIVER_COLOR = 'rgb(60, 110, 160)'; // Slightly different from biome view river
export const REALISTIC_BEACH_COLOR = 'rgb(238, 213, 183)';
export const REALISTIC_SEA_ICE_COLOR = 'rgb(200, 210, 220)';
export const OCEAN_SURFACE_NOISE_SCALE = 0.03;
export const OCEAN_SURFACE_NOISE_INTENSITY = 0.03; // Max +/- brightness change

// LAND
export const REALISTIC_LAND_TEMPERATE_DEFAULT_COLOR = 'rgb(110, 130, 70)'; 
export const REALISTIC_LAND_HOT_DEFAULT_COLOR = 'rgb(190, 170, 120)';   
export const REALISTIC_LAND_COLD_DEFAULT_COLOR = 'rgb(130, 120, 100)';  
export const REALISTIC_ROCK_COLOR_HIGH_ALT = 'rgb(135, 135, 145)';     

// VEGETATION TEXTURES (Realistic View)
export const FOREST_TEXTURE_COLOR = 'rgba(0, 20, 0, 0.08)'; // Dark green, very transparent
export const FOREST_TEXTURE_NOISE_SCALE = 0.2;
export const JUNGLE_TEXTURE_COLOR = 'rgba(0, 25, 5, 0.1)';
export const JUNGLE_TEXTURE_NOISE_SCALE = 0.22;

// ATMOSPHERIC PERSPECTIVE (Realistic View)
export const ATMOSPHERIC_HAZE_COLOR = 'rgb(170, 190, 220)'; // Light sky blue/grey
export const ATMOSPHERIC_HAZE_START_ROW_FACTOR = 0.5; // Starts affecting cells from 50% down the map
export const ATMOSPHERIC_HAZE_MAX_INTENSITY = 0.25; // Max 25% blend with haze color at farthest distance

// Border Blending Constants (Biomes View)
export const BORDER_NOISE_SCALE = 0.15;
export const BORDER_BLEND_THRESHOLD = 0.55; 

// AI Generation Counts
export const DEFAULT_NUM_REGIONS = 12;
export const DEFAULT_NUM_LAND_BIOMES = 15; // AI defines these, not directly placed
export const DEFAULT_NUM_FEATURES_TO_DEFINE_AI = 75; // How many placeholders AI should try to define.
export const DEFAULT_NUM_FEATURES_TO_PLACEHOLD = 200; // Number of placeholder sites to generate procedurally.
export const DEFAULT_NUM_COUNTRIES = 5;
export const DEFAULT_NUM_ALLIANCES = 2;
export const DEFAULT_NUM_ZONES_PER_REGION = 2; 

// Zoom constants
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.0;
export const ZOOM_INCREMENT = 0.25;

// Feature Label Styling (SVG for Roads, potentially panel icons)
export const FEATURE_LABEL_FONT_SIZE_BASE = 10; // Base font size at zoom 1.0
export const FEATURE_LABEL_MIN_VISIBLE_SIZE_ZOOMED = 15; // Feature size * zoom must be > this to show label
export const FEATURE_LABEL_STROKE_COLOR = 'rgba(20, 30, 40, 0.8)'; // Dark, semi-transparent for halo
export const FEATURE_LABEL_STROKE_WIDTH_BASE = 3; // Base stroke width at zoom 1.0
export const FEATURE_LABEL_FILL_COLOR = 'rgb(245, 245, 245)';

// Placeholder site sizes (in cells)
export const PLACEHOLDER_SIZES = {
    [FeatureType.City]: 3, // e.g. 3x3 cells
    [FeatureType.Town]: 2,
    [FeatureType.Village]: 1,
    [FeatureType.Castle]: 2,
    [FeatureType.Tower]: 1,
    [FeatureType.Mine]: 1,
    [FeatureType.Port]: 2,
    [FeatureType.Temple]: 2,
    [FeatureType.Monastery]: 2,
    [FeatureType.Ruin]: 1,
    [FeatureType.Cave]: 1,
    [FeatureType.Bridge]: 1, // Bridge is usually 1 cell wide, path makes it seem longer
    [FeatureType.MinorLandmark]: 1,
    [FeatureType.Volcano]: 3, // Volcanoes can be larger
    [FeatureType.Oasis]: 1,
    // Default for other types / generic sites
    default: 1,
};
