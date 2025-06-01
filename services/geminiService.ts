
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import {
    GEMINI_MODEL_NAME, ALL_FEATURE_TYPES_ARRAY, ALL_BIOME_TYPES_ARRAY,
    ALTITUDE_STRING_TO_ENUM, MOISTURE_STRING_TO_ENUM, TEMPERATURE_STRING_TO_ENUM,
    DEFAULT_NUM_FEATURES_TO_DEFINE_AI
} from '../constants';
import {
    RawMapFeature, FeatureType, RawBiome, AiGeneratedComposition,
    MapBiome, BiomeType, AltitudePreference, MoisturePreference, RawRegion, TemperatureCategory,
    RawCountry, RawAlliance, RawZone, PlaceholderFeature, GenericFeatureSiteType // Added new raw types
} from "../types";

const apiKey = process.env.API_KEY;

let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const isApiKeySet = (): boolean => !!apiKey;

const parseJsonFromText = <T,>(text: string, expectArray: boolean = false, context?: string): T | null => {
  let originalTrimmedText = text.trim();
  let jsonStrToParseAfterFenceStrip = originalTrimmedText;

  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const fenceMatch = jsonStrToParseAfterFenceStrip.match(fenceRegex);
  if (fenceMatch && fenceMatch[2]) {
    jsonStrToParseAfterFenceStrip = fenceMatch[2].trim(); 
  } else {
    // If no fence, ensure it's trimmed. It might already be if originalTrimmedText was used.
    jsonStrToParseAfterFenceStrip = jsonStrToParseAfterFenceStrip.trim(); 
  }

  // Attempt 1: Parse the content after fence stripping.
  // Also try to be clever about trailing non-JSON junk after a valid JSON object/array.
  let stringForFirstAttempt = jsonStrToParseAfterFenceStrip;
  const firstChar = stringForFirstAttempt.charAt(0);
  
  if (firstChar === '{') {
    const lastBrace = stringForFirstAttempt.lastIndexOf('}');
    if (lastBrace !== -1) { 
      // Check if there's anything after the last brace that isn't whitespace
      if (lastBrace < stringForFirstAttempt.length - 1) { 
        const trailingChars = stringForFirstAttempt.substring(lastBrace + 1);
        if (trailingChars.trim() !== "") { // If there's non-whitespace junk
          // console.warn(`Stripping trailing characters after last '}' for ${context}: "${trailingChars}"`);
          stringForFirstAttempt = stringForFirstAttempt.substring(0, lastBrace + 1);
        }
      }
    }
  } else if (firstChar === '[') {
    const lastBracket = stringForFirstAttempt.lastIndexOf(']');
    if (lastBracket !== -1) { 
      if (lastBracket < stringForFirstAttempt.length - 1) {
        const trailingChars = stringForFirstAttempt.substring(lastBracket + 1);
        if (trailingChars.trim() !== "") {
            // console.warn(`Stripping trailing characters after last ']' for ${context}: "${trailingChars}"`);
            stringForFirstAttempt = stringForFirstAttempt.substring(0, lastBracket + 1);
        }
      }
    }
  }

  if (stringForFirstAttempt) { // Ensure string is not empty
    try {
      return JSON.parse(stringForFirstAttempt) as T;
    } catch (e1) {
      console.warn(`First JSON.parse attempt (after fence and smart trailing junk removal) failed for ${context || 'unknown context'}. Error:`, e1, "Attempted string (first 300 chars):", stringForFirstAttempt.substring(0,300));
    }
  }

  // Attempt 2: Clean up multi-line junk within strings (e.g., unescaped newlines)
  // This regex tries to find strings like "description": "Something something \n still description"
  // and removes the junk between the valid string content and the next comma/brace.
  let stringForMultilineJunkClean = jsonStrToParseAfterFenceStrip; // Start from the fence-stripped version again
  const NL_PATTERN = '(?:\\r\\n|\\r|\\n)';
  const NOT_NL_CHAR_DOT = '(?:(?!' + NL_PATTERN + ').)';
  const multiLineJunkRegex = new RegExp(
    '(:"\\s*[^"]*?")' + // Group 1: The valid part of the string up to the last quote
    '(\\s*(?:' + NL_PATTERN + '\\s*)?[^",\\s{}\\[\\]:]' + NOT_NL_CHAR_DOT + '*)' + // Group 2: The junk: whitespace, then a newline (optional), then non-delimiter chars
    '(\\s*' + NL_PATTERN + ')?' + // Group 3: Optional newline after junk
    '(\\s*[,{}\\[\\]])', // Group 4: The closing delimiter (comma, brace, bracket)
    'g'
  );

  let previousStr;
  if (stringForMultilineJunkClean && stringForMultilineJunkClean.length > 0) { // Check if string is not empty
    do {
      previousStr = stringForMultilineJunkClean;
      stringForMultilineJunkClean = stringForMultilineJunkClean.replace(multiLineJunkRegex, '$1$3$4');
    } while (previousStr !== stringForMultilineJunkClean && stringForMultilineJunkClean.length > 0); // Ensure progress and non-empty string
  }

  try {
    return JSON.parse(stringForMultilineJunkClean) as T;
  } catch (e2) {
    console.warn(`JSON.parse after multiline junk cleanup failed for ${context || 'unknown context'}. Error:`, e2, "Cleaned string (first 300 chars):", stringForMultilineJunkClean.substring(0,300));
  }
  
  // Attempt 3: Try fixing trailing commas
  if (stringForMultilineJunkClean && stringForMultilineJunkClean.length > 0) {
    try {
        // Remove trailing commas before closing braces/brackets and at the very end of the string
        const fixedStr = stringForMultilineJunkClean
            .replace(/,\s*([}\]])/g, '$1') // Comma before } or ]
            .replace(/,\s*$/g, '');      // Comma at the very end
        return JSON.parse(fixedStr) as T;
    } catch (eCommaFixed) {
      console.error(`Failed to parse JSON response for ${context || 'unknown context'} after all attempts. Last error:`, eCommaFixed);
      console.error("Original text (trimmed, first 500 chars):", originalTrimmedText.substring(0, 500) + (originalTrimmedText.length > 500 ? "..." : ""));
      console.error("After fence strip (jsonStrToParseAfterFenceStrip, first 500 chars):", jsonStrToParseAfterFenceStrip.substring(0, 500) + (jsonStrToParseAfterFenceStrip.length > 500 ? "..." : ""));
      if (stringForFirstAttempt !== jsonStrToParseAfterFenceStrip) {
        console.error("Smart trim attempt (stringForFirstAttempt, first 500 chars):", stringForFirstAttempt.substring(0, 500) + (stringForFirstAttempt.length > 500 ? "..." : ""));
      }
      console.error("After multiline junk cleanup (stringForMultilineJunkClean, first 500 chars):", stringForMultilineJunkClean.substring(0, 500) + (stringForMultilineJunkClean.length > 500 ? "..." : ""));
      console.error("String that caused final failure (stringForMultilineJunkClean, first 500 chars):", stringForMultilineJunkClean.substring(0, 500) + (stringForMultilineJunkClean.length > 500 ? "..." : ""))
      return null;
    }
  }

  console.error(`Failed to parse JSON response for ${context || 'unknown context'} - unexpected fallthrough. Original text (first 500): ${originalTrimmedText.substring(0,500)}`);
  return null;
};


export const generateMapCompositionFromGemini = async (
  theme: string,
  lore: string,
  numberOfRegions: number,
  numberOfLandBiomes: number,
  numberOfFeaturesToDefine: number, // How many of the provided placeholders to define
  numberOfCountries: number,
  numberOfAlliances: number,
  placeholderFeatures: PlaceholderFeature[] // Procedurally placed sites
): Promise<AiGeneratedComposition> => {
  if (!ai) {
    console.error("Gemini API key not configured.");
    throw new Error("Gemini API key not configured.");
  }

  const landBiomeTypes = ALL_BIOME_TYPES_ARRAY.filter(b => b !== BiomeType.Ocean && b !== BiomeType.River && b !== BiomeType.Ice && b !== BiomeType.Beach).join(', ');
  const featureTypesString = ALL_FEATURE_TYPES_ARRAY.filter(f => f !== FeatureType.Road).join(', '); // AI doesn't define roads
  const altitudePreferencesString = Object.keys(ALTITUDE_STRING_TO_ENUM).join(', ');
  const moisturePreferencesString = Object.keys(MOISTURE_STRING_TO_ENUM).join(', ');
  const temperaturePreferencesString = Object.keys(TEMPERATURE_STRING_TO_ENUM).filter(k => k !== "any").join(', '); 

  // Prepare placeholder features for the prompt
  const placeholderFeaturesPromptList = placeholderFeatures.slice(0, Math.min(placeholderFeatures.length, DEFAULT_NUM_FEATURES_TO_DEFINE_AI * 2)).map(pf => {
    let contextString = `ID: ${pf.id}, Generic Site Type: ${pf.genericSiteType}, Size: ${pf.size}x${pf.size} cells.`;
    if (pf.context) {
        if (pf.context.altitudeCategory !== undefined) contextString += ` Altitude: ${['Deep Ocean', 'Shallow Ocean', 'Low Land', 'Mid Land', 'High Land'][pf.context.altitudeCategory + 2]}.`;
        if (pf.context.temperatureCategory !== undefined) contextString += ` Temperature: ${pf.context.temperatureCategory}.`;
        if (pf.context.moistureCategory !== undefined) contextString += ` Moisture: ${['Dry', 'Moderate', 'Wet'][pf.context.moistureCategory]}.`;
        if (pf.context.isInWater) contextString += ` In Water.`;
        if (pf.context.isCoastal) contextString += ` Coastal.`;
        if (pf.context.potentialBiomeTypeName) contextString += ` Potential Biome Context: ${pf.context.potentialBiomeTypeName}.`;
    }
    return `{ "placeholder_id": "${pf.id}", "context_summary": "${contextString.replace(/"/g, "'")}" }`;
  }).join(',\n    ');


  const prompt = `
    Generate a fantasy map composition based on the theme "${theme}" and world lore: "${lore}".
    The world's physical terrain, climate zones, and a set of potential feature sites are already procedurally generated.
    Your task is to define the cultural, ecological, and specific feature details:

    1.  DEFINE CULTURAL & POLITICAL LAYERS:
        - Approximately ${numberOfAlliances} ALLIANCES.
        - Approximately ${numberOfCountries} COUNTRIES, possibly linked to alliances.
        - Approximately ${numberOfRegions} large-scale REGIONS, defined by dominant cultures/civilizations, possibly linked to countries.
        - Optionally, 1-2 ZONES (sub-areas of interest) within each region.

    2.  DEFINE LAND BIOMES:
        - Approximately ${numberOfLandBiomes} unique LAND-BASED BIOMES. These should be logically distributed by you into the regions defined above. Avoid 'Ocean', 'River', 'Ice', 'Beach' as these are often procedural.
        - For each biome, specify its 'name', 'type', 'description', environmental preferences ('altitude_preference', 'moisture_preference', 'temperature_preference'), and a 'suggested_region_name' it belongs to.

    3.  DEFINE SPECIFIC FEATURES FOR PRE-PLACED SITES:
        - Below is a list of ${placeholderFeatures.length} potential feature sites that have been procedurally placed on the map. Their general type and context are provided.
        - Your task is to select up to ${numberOfFeaturesToDefine} of these sites and give each:
            - A unique 'name'.
            - A specific 'type' (MUST be one of: ${featureTypesString}). Choose a type that fits the site's generic type and context.
            - A 'short_description' (1-2 sentences).
        - You MUST use the 'placeholder_id' provided for each site you define.

    PLACEHOLDER SITES PROVIDED:
    [
    ${placeholderFeaturesPromptList}
    ]

    RETURN THE RESPONSE STRICTLY AS A SINGLE JSON OBJECT.
    The JSON object must have keys: "alliances", "countries", "regions", "zones", "biomes", "defined_features". Each key maps to an array.
    If a layer is empty (e.g., no alliances), provide an empty array for that key.

    JSON STRUCTURE DETAILS:
    - ALLIANCES: { "name": string, "description": string }
    - COUNTRIES: { "name": string, "description": string, "suggested_alliance_name"?: string }
    - REGIONS: { "name": string, "description": string, "suggested_country_name"?: string }
    - ZONES: { "name": string, "description": string, "suggested_region_name": string }
    - BIOMES: { "name": string, "type": string (from ${landBiomeTypes}), "description": string, "altitude_preference": string (from ${altitudePreferencesString}), "moisture_preference": string (from ${moisturePreferencesString}), "temperature_preference": string (from ${temperaturePreferencesString}, avoid 'Any'), "suggested_region_name": string }
    - DEFINED_FEATURES: { "placeholder_id": string (MUST match one from input), "name": string, "type": string (from ${featureTypesString}), "short_description": string }

    Ensure all names are unique within their category. Ensure suggested names for linking (e.g. suggested_region_name) match names defined in the respective category.
    If a placeholder site's context suggests it's in water (e.g., for a Port), ensure the chosen FeatureType is appropriate (e.g., Port, Island, not City).
    Prioritize defining a diverse set of features from the provided placeholders.
  `;

  try {
    console.log("Generating map composition with prompt (first 300 chars of placeholder list):", placeholderFeaturesPromptList.substring(0,300) + "...");
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.8, // Slightly higher temp for more creative naming/descriptions
      },
    });

    const parsedResult = parseJsonFromText<AiGeneratedComposition>(response.text, false, "map composition");

    if (!parsedResult || !parsedResult.regions || !parsedResult.biomes || !parsedResult.defined_features || 
        !Array.isArray(parsedResult.regions) || !Array.isArray(parsedResult.biomes) || !Array.isArray(parsedResult.defined_features) ) {
        console.error("Gemini response for map composition was not valid or incomplete for core elements. Parsed:", parsedResult, "Original response text (first 500):", response.text.substring(0, 500));
        const fallbackRegionName = "Default Region";
        return { 
            regions: [{ name: fallbackRegionName, description: "A generic region."}],
            biomes: [{
                name: "Default Land Biome", type: BiomeType.Plains.toString(), description: "Generic land.",
                altitude_preference: AltitudePreference.Any.toString(), moisture_preference: MoisturePreference.Any.toString(),
                temperature_preference: TemperatureCategory.Temperate.toString(), suggested_region_name: fallbackRegionName
            }],
            defined_features: [], // No features if core structure is bad
            countries: [], alliances: [], zones: []
        };
    }

    // Validate and process core elements first
    const validRegions = parsedResult.regions.filter(r => r && r.name && r.description);
    if (validRegions.length === 0 && numberOfRegions > 0) {
        validRegions.push({ name: "Fallback Region", description: "A vast, undefined region." });
    }
    
    const landBiomeTypesArray = ALL_BIOME_TYPES_ARRAY.filter(b => b !== BiomeType.Ocean && b !== BiomeType.River && b !== BiomeType.Ice && b !== BiomeType.Beach);

    const validBiomes = parsedResult.biomes.filter(b =>
        b && b.name && b.type && 
        (landBiomeTypesArray.includes(b.type as BiomeType)) &&
        b.altitude_preference && ALTITUDE_STRING_TO_ENUM[b.altitude_preference.toLowerCase()] &&
        b.moisture_preference && MOISTURE_STRING_TO_ENUM[b.moisture_preference.toLowerCase()] &&
        b.temperature_preference && TEMPERATURE_STRING_TO_ENUM[b.temperature_preference.toLowerCase()] &&
        b.suggested_region_name && validRegions.some(r => r.name === b.suggested_region_name) 
    ).map(b => ({...b, type: b.type as BiomeType, temperature_preference: b.temperature_preference as TemperatureCategory})); 

    if(validBiomes.length === 0 && numberOfLandBiomes > 0 && validRegions.length > 0) { 
        validBiomes.push({
            name: "Fallback Plains", type: BiomeType.Plains, description: "A vast stretch of plains.",
            altitude_preference: AltitudePreference.Any.toString(), moisture_preference: MoisturePreference.Any.toString(),
            temperature_preference: TemperatureCategory.Temperate, suggested_region_name: validRegions[0].name 
        });
    }
    
    const finalBiomes = validBiomes.map(b => { 
        if (!validRegions.find(r => r.name === b.suggested_region_name) && validRegions.length > 0) {
            return {...b, suggested_region_name: validRegions[0].name}; 
        }
        return b;
    });

    const biomesToReturn: RawBiome[] = finalBiomes.map(b => ({
        ...b, type: b.type.toString(), temperature_preference: b.temperature_preference.toString(),
        suggested_region_name: b.suggested_region_name || (validRegions[0]?.name) 
    }));

    // Process defined features
    const validDefinedFeatures = parsedResult.defined_features.filter(df => 
        df && df.placeholder_id && placeholderFeatures.some(pf => pf.id === df.placeholder_id) &&
        df.name && df.type && ALL_FEATURE_TYPES_ARRAY.includes(df.type as FeatureType) && 
        df.short_description
      ).map(df => ({...df, type: df.type as FeatureType}));


    // Process new political layers (with fallbacks if not provided or invalid)
    const validCountries: RawCountry[] = (parsedResult.countries || []).filter(c => c && c.name && c.description);
    const validAlliances: RawAlliance[] = (parsedResult.alliances || []).filter(a => a && a.name && a.description);
    const validZones: RawZone[] = (parsedResult.zones || []).filter(z => z && z.name && z.description && z.suggested_region_name && validRegions.some(r => r.name === z.suggested_region_name));


    return { 
        regions: validRegions.slice(0, numberOfRegions), 
        biomes: biomesToReturn.slice(0, numberOfLandBiomes), 
        defined_features: validDefinedFeatures.slice(0, numberOfFeaturesToDefine),
        countries: validCountries.slice(0, numberOfCountries),
        alliances: validAlliances.slice(0, numberOfAlliances),
        zones: validZones 
    };

  } catch (error) {
    console.error("Error generating map composition with Gemini:", error);
    const fallbackRegionName = "Error Region";
    return { 
        regions: [{ name: fallbackRegionName, description: "An error occurred during region generation."}],
        biomes: [{
            name: "Error Land Biome", type: BiomeType.Other.toString(), description: "Error biome.",
            altitude_preference: AltitudePreference.Any.toString(), moisture_preference: MoisturePreference.Any.toString(),
            temperature_preference: TemperatureCategory.Temperate.toString(), suggested_region_name: fallbackRegionName
        }],
        defined_features: [], countries: [], alliances: [], zones: []
    };
  }
};

export const elaborateFeatureDescription = async (featureName: string, featureType: string, currentDescription: string, biomeName?: string, biomeType?: string): Promise<string> => {
  if (!ai) {
    console.error("Gemini API key not configured.");
    throw new Error("Gemini API key not configured.");
  }

  let prompt = `
    Elaborate on the following fantasy map feature:
    Name: ${featureName}
    Type: ${featureType}`;

  if (biomeName && biomeType) {
    prompt += `
    Located in Biome: ${biomeName} (${biomeType})`;
  }

  prompt += `
    Current Description: ${currentDescription}

    Provide a more detailed and engaging description for this feature. Aim for 2-3 rich paragraphs.
    Focus on aspects like its history, unique characteristics, potential inhabitants or creatures, hidden secrets, or any legends associated with it, considering its biome context if provided.
    Make the description immersive and evocative for a fantasy setting.
    Return ONLY the plain text description. Do not include any introductory phrases like "Here's an elaborated description:" or markdown.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.75,
      }
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error elaborating feature description with Gemini:", error);
    throw error; 
  }
};
