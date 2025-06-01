
import React from 'react';
import { MapFeature, FeatureType, MapBiome, BiomeType, MapRegion, MapCountry, MapAlliance, MapZone, MapViewMode } from '../types';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { FEATURE_TYPE_STYLES, BIOME_TYPE_STYLES, DEFAULT_COUNTRY_FILL_COLOR, DEFAULT_ALLIANCE_FILL_COLOR } from '../constants';

interface DetailsPanelProps {
  feature: MapFeature | null;
  selectedBiome: MapBiome | null;
  hoveredBiome: MapBiome | null;
  selectedRegion: MapRegion | null; 
  hoveredRegion: MapRegion | null;  
  selectedCountry: MapCountry | null;
  hoveredCountry: MapCountry | null;
  selectedAlliance: MapAlliance | null;
  hoveredAlliance: MapAlliance | null;
  allBiomes: MapBiome[];
  allRegions: MapRegion[]; 
  allCountries: MapCountry[];
  allAlliances: MapAlliance[]; // Prop definition
  allZones: MapZone[]; 
  onElaborate: (feature: MapFeature) => void;
  isLoadingElaboration: boolean;
  hoveredFeature: MapFeature | null;
  currentView: MapViewMode;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ 
    feature, 
    selectedBiome, hoveredBiome, 
    selectedRegion, hoveredRegion,
    selectedCountry, hoveredCountry,
    selectedAlliance, hoveredAlliance,
    allBiomes, allRegions, allCountries, allAlliances, allZones, // Prop 'allAlliances' is destructured here
    onElaborate, isLoadingElaboration, hoveredFeature, currentView
}) => {
  const displayFeature = feature || hoveredFeature;

  if (displayFeature) {
    const currentFeature = displayFeature as MapFeature;
    const styleInfo = FEATURE_TYPE_STYLES[currentFeature.type] || FEATURE_TYPE_STYLES[FeatureType.Other];
    const featureBiome = currentFeature.biomeId ? allBiomes.find(b => b.id === currentFeature.biomeId) : null;
    const featureRegion = featureBiome?.regionId ? allRegions.find(r => r.id === featureBiome.regionId) : null;
    const featureCountry = featureRegion?.countryId ? allCountries.find(c => c.id === featureRegion.countryId) : null;

    return (
      <div className="p-4 bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
        <div className="flex items-center mb-3">
          <div className={`w-5 h-5 rounded-sm mr-2 ${styleInfo.fill} ${styleInfo.stroke} border-2`}></div>
          <h2 className="text-xl font-bold text-yellow-400 truncate" title={currentFeature.name}>{currentFeature.name}</h2>
        </div>
        <p className="text-xs text-gray-400 mb-1 italic">{currentFeature.type}</p>
        {featureBiome && (
          <p className="text-xs text-cyan-400 mb-0.5">Biome: <span className="font-semibold">{featureBiome.name}</span> ({featureBiome.type})</p>
        )}
        {featureRegion && (
          <p className="text-xs text-purple-400 mb-0.5">Region: <span className="font-semibold">{featureRegion.name}</span></p>
        )}
        {featureCountry && (
          <p className="text-xs text-red-400 mb-2">Country: <span className="font-semibold">{featureCountry.name}</span></p>
        )}
        
        <div className="text-gray-300 text-sm leading-relaxed mb-4 overflow-y-auto flex-grow pr-1" style={{maxHeight: 'calc(100% - 170px)'}}>
          <p>{currentFeature.description}</p>
        </div>

        {feature && ( 
          <Button onClick={() => onElaborate(feature)} isLoading={isLoadingElaboration} className="w-full mt-auto text-sm py-1.5" aria-label={`Elaborate on ${feature.name} with AI`}>
            {isLoadingElaboration ? 'Elaborating...' : 'Elaborate with AI'}
          </Button>
        )}
         {!feature && hoveredFeature && ( <p className="text-xs text-gray-500 mt-auto text-center">Click feature for more actions.</p> )}
      </div>
    );
  }

  const displayAlliance = selectedAlliance || hoveredAlliance;
   if (displayAlliance && (currentView === 'alliances' || (!selectedBiome && !selectedRegion && !selectedCountry)) ) {
    const currentAlliance = displayAlliance;
    const allianceColor = currentAlliance.color || DEFAULT_ALLIANCE_FILL_COLOR;
    const memberCountries = allCountries.filter(c => c.allianceId === currentAlliance.id);
    return (
      <div className="p-4 bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
        <div className="flex items-center mb-3">
           <div className="w-5 h-5 rounded-sm mr-2 border-2 border-green-500" style={{backgroundColor: allianceColor.replace('0.15', '0.4')}}></div>
           <h2 className="text-xl font-bold text-green-400 truncate" title={currentAlliance.name}>{currentAlliance.name}</h2>
        </div>
        <p className="text-xs text-gray-400 mb-2 italic">Alliance</p>
        <div className="text-gray-300 text-sm leading-relaxed mb-2 overflow-y-auto flex-grow pr-1" style={{maxHeight: 'calc(100% - 120px)'}}>
          <p className="mb-2">{currentAlliance.description}</p>
          {memberCountries.length > 0 && <>
            <h4 className="text-xs font-semibold text-gray-200 mb-1">Member Countries:</h4>
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">{memberCountries.map(c => <li key={c.id}>{c.name}</li>)}</ul>
          </>}
        </div>
         <p className="text-xs text-gray-500 mt-auto text-center">
          {selectedAlliance ? "Alliance selected." : "Hovering over alliance."}
        </p>
      </div>
    );
  }


  const displayCountry = selectedCountry || hoveredCountry;
  if (displayCountry && (currentView === 'countries' || (!selectedBiome && !selectedRegion && !selectedAlliance)) ) {
    const currentCountry = displayCountry;
    const countryColor = currentCountry.color || DEFAULT_COUNTRY_FILL_COLOR;
    // 'allAlliances' is destructured from props and should be available here.
    const parentAlliance = currentCountry.allianceId && allAlliances ? allAlliances.find(a => a.id === currentCountry.allianceId) : null;
    const memberRegions = allRegions.filter(r => r.countryId === currentCountry.id);
     return (
      <div className="p-4 bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
        <div className="flex items-center mb-3">
           <div className="w-5 h-5 rounded-sm mr-2 border-2 border-red-500" style={{backgroundColor: countryColor.replace('0.15', '0.4')}}></div>
           <h2 className="text-xl font-bold text-red-400 truncate" title={currentCountry.name}>{currentCountry.name}</h2>
        </div>
        <p className="text-xs text-gray-400 mb-1 italic">Country</p>
        {parentAlliance && (<p className="text-xs text-green-400 mb-1">Part of: <span className="font-semibold">{parentAlliance.name}</span></p>)}
        <div className="text-gray-300 text-sm leading-relaxed mb-2 overflow-y-auto flex-grow pr-1" style={{maxHeight: 'calc(100% - 130px)'}}>
          <p className="mb-2">{currentCountry.description}</p>
          {memberRegions.length > 0 && <>
            <h4 className="text-xs font-semibold text-gray-200 mb-1">Regions within:</h4>
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">{memberRegions.map(r => <li key={r.id}>{r.name}</li>)}</ul>
          </>}
        </div>
        <p className="text-xs text-gray-500 mt-auto text-center">
          {selectedCountry ? "Country selected." : "Hovering over country."}
        </p>
      </div>
    );
  }

  const displayRegion = selectedRegion || hoveredRegion;
  if (displayRegion && (currentView === 'regions' || (!selectedBiome && !selectedCountry && !selectedAlliance)) ) {
    const currentRegion = displayRegion as MapRegion;
    const biomesInRegion = allBiomes.filter(b => b.regionId === currentRegion.id);
    const parentCountry = currentRegion.countryId ? allCountries.find(c => c.id === currentRegion.countryId) : null;
    const regionZones = allZones.filter(z => z.regionId === currentRegion.id); // Get zones for this region
    return (
      <div className="p-4 bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
        <div className="flex items-center mb-3">
           <div className="w-5 h-5 rounded-sm mr-2 border-2 border-purple-500 bg-purple-700 opacity-70"></div>
           <h2 className="text-xl font-bold text-purple-400 truncate" title={currentRegion.name}>{currentRegion.name}</h2>
        </div>
        <p className="text-xs text-gray-400 mb-1 italic">Region</p>
        {parentCountry && (<p className="text-xs text-red-400 mb-1">Part of: <span className="font-semibold">{parentCountry.name}</span></p>)}
        <div className="text-gray-300 text-sm leading-relaxed mb-2 overflow-y-auto flex-grow pr-1" style={{maxHeight: 'calc(100% - 130px)'}}>
          <p className="mb-2">{currentRegion.description}</p>
          {biomesInRegion.length > 0 && <>
            <h4 className="text-xs font-semibold text-gray-200 mb-1">Biomes:</h4>
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">{biomesInRegion.map(b => <li key={b.id}>{b.name} ({b.type})</li>)}</ul>
          </>}
          {regionZones.length > 0 && <>
            <h4 className="text-xs font-semibold text-gray-200 mt-2 mb-1">Sub-Zones:</h4>
            <ul className="list-disc list-inside text-xs text-gray-300 space-y-0.5">{regionZones.map(z => <li key={z.id} title={z.description}>{z.name}</li>)}</ul>
          </>}
        </div>
        <p className="text-xs text-gray-500 mt-auto text-center">
          {selectedRegion ? "Region selected." : "Hovering over region."}
        </p>
      </div>
    );
  }

  const displayBiome = selectedBiome || hoveredBiome;
  if (displayBiome && (currentView === 'biomes' || (!selectedRegion && !selectedCountry && !selectedAlliance)) ) {
    const currentBiome = displayBiome as MapBiome;
    const biomeStyle = BIOME_TYPE_STYLES[currentBiome.type] || BIOME_TYPE_STYLES[BiomeType.Other];
    const biomeBaseColorMatch = biomeStyle.color.match(/rgba?\((\d+,\s*\d+,\s*\d+),/);
    const colorIndicatorStyle = biomeBaseColorMatch ? `rgb(${biomeBaseColorMatch[1]})` : 'gray';
    const parentRegion = currentBiome.regionId ? allRegions.find(r => r.id === currentBiome.regionId) : null;
    return (
      <div className="p-4 bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
        <div className="flex items-center mb-3">
           <div className="w-5 h-5 rounded-sm mr-2 border-2 border-gray-500" style={{backgroundColor: colorIndicatorStyle}}></div>
          <h2 className="text-xl font-bold text-green-400 truncate" title={currentBiome.name}>{currentBiome.name}</h2>
        </div>
        <p className="text-xs text-gray-400 mb-0.5 italic">{currentBiome.type} Biome</p>
        {parentRegion && (<p className="text-xs text-purple-400 mb-1">Region: <span className="font-semibold">{parentRegion.name}</span></p>)}
        <p className="text-xs text-sky-400 mb-2"> Alt: {currentBiome.altitudePreference}, Moist: {currentBiome.moisturePreference}, Temp: {Array.isArray(currentBiome.temperaturePreference) ? currentBiome.temperaturePreference.join('/') : currentBiome.temperaturePreference} </p>
        <div className="text-gray-300 text-sm leading-relaxed mb-2 overflow-y-auto flex-grow pr-1" style={{maxHeight: 'calc(100% - 150px)'}}>
          <p>{currentBiome.description}</p>
        </div>
        <p className="text-xs text-gray-500 mt-auto text-center">
          {selectedBiome ? "Biome selected." : "Hovering over biome."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg h-full flex flex-col justify-center items-center text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-.553-.894L15 2m-6 5l6-3m0 0l6 3m-6-3V2" />
      </svg>
      <h3 className="text-lg font-semibold text-gray-300 mb-1">World Awaits Exploration</h3>
      <p className="text-xs text-gray-400">Click or hover over map elements to see details, or use the controls to generate a world.</p>
    </div>
  );
};

export default DetailsPanel;
