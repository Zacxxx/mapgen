
export enum FeatureType {
  City = 'City',
  Town = 'Town',
  Village = 'Village',
  Forest = 'Forest', // Can also be a biome type
  Mountain = 'Mountain', // Can also be a biome type
  River = 'River',
  Lake = 'Lake',
  Ocean = 'Ocean', // Can also be a biome type
  Desert = 'Desert', // Can also be a biome type
  Island = 'Island',
  Cave = 'Cave',
  Ruin = 'Ruin',
  Tower = 'Tower',
  Castle = 'Castle',
  Mine = 'Mine',
  Port = 'Port',
  Bridge = 'Bridge',
  Road = 'Road', 
  Temple = 'Temple',
  Monastery = 'Monastery',
  Oasis = 'Oasis',
  Volcano = 'Volcano', // Can also be a biome type
  Swamp = 'Swamp', // Can also be a biome type
  Plain = 'Plain', // Can also be a biome type
  MinorLandmark = 'Minor Landmark', // For smaller, procedurally placed flavor points
  Other = 'Other',
}

export enum GenericFeatureSiteType { // For procedural placement before AI assigns specific FeatureType
  MajorSettlement = 'Major Settlement Site', // Could become City, Large Town
  MediumSettlement = 'Medium Settlement Site', // Could become Town, Large Village
  SmallSettlement = 'Small Settlement Site', // Could become Village
  CoastalSettlement = 'Coastal Settlement Site', // Could become Port, Coastal Village
  Fortification = 'Fortification Site', // Could become Castle, Tower
  SacredSite = 'Sacred Site', // Could become Temple, Monastery, Ruin
  ResourceNode = 'Resource Node Site', // Could become Mine, Oasis (if desert)
  PointOfInterest = 'Point of Interest Site', // Could become Ruin, Cave, Tower, Minor Landmark
  RiverCrossing = 'River Crossing Site', // Could become Bridge
  VolcanicVent = 'Volcanic Vent Site', // Specifically for Volcano feature type
}


export enum BiomeType {
  Forest = 'Forest',
  Desert = 'Desert',
  Plains = 'Plains',
  Mountains = 'Mountains',
  Ocean = 'Ocean', // Procedurally generated based on elevation
  Swamp = 'Swamp',
  Tundra = 'Tundra',
  Volcanic = 'Volcanic',
  Jungle = 'Jungle',
  Grassland = 'Grassland',
  Hills = 'Hills',
  Badlands = 'Badlands',
  Coastal = 'Coastal', // Special biome type for coastal areas
  River = 'River', // Procedurally generated path
  Ice = 'Ice', // New for polar regions
  Taiga = 'Taiga', // New for cold coniferous forests
  Beach = 'Beach', // For realistic view, transition zone
  Other = 'Other',
}

export enum AltitudePreference {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Any = "Any"
}

export enum MoisturePreference {
  Dry = "Dry",
  Moderate = "Moderate",
  Wet = "Wet",
  Any = "Any"
}

export enum TemperatureCategory { // New
  Freezing = 'Freezing',
  Cold = 'Cold',
  Temperate = 'Temperate',
  Warm = 'Warm',
  Hot = 'Hot',
}

export interface MapZone {
  id: string;
  name: string;
  description: string;
  regionId: string;
  // Potentially add geometry or cell list if zones have distinct visual borders
}

export interface MapRegion { 
  id: string;
  name: string;
  description: string; // Civilization focused
  countryId?: string;
  zoneIds?: string[];
}

export interface MapCountry {
  id: string;
  name: string;
  description: string;
  allianceId?: string;
  color?: string; // For map display
  // regionIds will be implicit by regions linking to countryId
}

export interface MapAlliance {
  id: string;
  name: string;
  description: string;
  color?: string; // For map display
  // countryIds will be implicit by countries linking to allianceId
}


export interface MapBiome {
  id: string;
  name: string;
  type: BiomeType;
  description: string;
  color: string; 
  seedPoints?: { r: number; c: number }[];
  altitudePreference: AltitudePreference;
  moisturePreference: MoisturePreference;
  temperaturePreference?: TemperatureCategory | TemperatureCategory[]; 
  regionId?: string; 
}

export interface MapFeature {
  id: string;
  name: string;
  type: FeatureType;
  description: string;
  c: number; // Logical grid column (replaces x for non-road features)
  r: number; // Logical grid row (replaces y for non-road features)
  size: number; // Size in logical cells (e.g., 1 for 1x1, 2 for 2x2)
  fillColor: string; // For pixel rendering directly on canvas
  strokeColor: string; // Potentially for borders if needed, or for icon in panel
  biomeId?: string; 
  points?: {x: number, y: number}[]; // For roads (uses logical map coordinates)
  placeholderType?: GenericFeatureSiteType; // Original type if it was a placeholder
}

export interface PlaceholderFeature { // For procedural placement before AI
  id: string;
  genericSiteType: GenericFeatureSiteType;
  r: number; // logical grid row
  c: number; // logical grid column
  size: number; // in cells (e.g. 1 for 1x1, 2 for 2x2)
  context?: { // Information to help AI
    altitudeCategory?: AltitudeCategory;
    temperatureCategory?: TemperatureCategory;
    moistureCategory?: MoistureCategory;
    isInWater?: boolean;
    isCoastal?: boolean;
    potentialBiomeTypeName?: string; // Guessed biome type from procedural data
  }
}

export interface RawZone {
  name: string;
  description: string;
  suggested_region_name: string;
}

export interface RawRegion { 
  name: string;
  description: string; // Civilization/culture focused
  suggested_country_name?: string; // New
}

export interface RawCountry {
  name: string;
  description: string;
  suggested_alliance_name?: string; // New
}

export interface RawAlliance {
  name: string;
  description: string;
}


export interface RawBiome {
  name: string;
  type: string; 
  description: string;
  altitude_preference: string; 
  moisture_preference: string; 
  temperature_preference?: string; 
  suggested_region_name?: string; 
}

export interface RawMapFeature { // AI defines this for a given placeholder
  placeholder_id: string; // ID of the PlaceholderFeature this details
  name: string;
  type: string; // Specific FeatureType string
  short_description: string;
  // AI does not suggest biome/location anymore, it's derived from placeholder context
}

export interface AiGeneratedComposition {
  regions: RawRegion[]; 
  biomes: RawBiome[];
  defined_features: RawMapFeature[]; // AI defines features based on provided placeholders
  zones?: RawZone[];
  countries?: RawCountry[];
  alliances?: RawAlliance[];
}


export interface GridCellState {
  biomeId: string | null;
  distance: number;
  row: number;
  col: number;
}

export type AltitudeCategory = -2 | -1 | 0 | 1 | 2; 
export type MoistureCategory = 0 | 1 | 2; // Dry, Moderate, Wet

export type MapViewMode = 'biomes' | 'elevation' | 'realistic' | 'regions' | 'countries' | 'alliances'; // Added new views

export interface BorderSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface AStarNode {
  r: number; 
  c: number; 
  g: number; 
  h: number; 
  f: number; 
  parent: AStarNode | null;
}

export type NoiseMap = number[][];
export type WaterCellsMap = boolean[][];
export type BeachCellsMap = boolean[][]; // New for beach rendering
export type OccupiedCellMap = (string | null)[][]; // To track cells occupied by pixel features
