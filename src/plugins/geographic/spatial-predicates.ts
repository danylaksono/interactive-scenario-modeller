import { registerPredicate } from "../../registry";
import { Entity, SimulationContext } from "../../types";

/**
 * Calculates the Haversine distance between two points in km.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Registers basic spatial predicates for use in interventions.
 * 
 * Includes:
 * - `distanceTo`: Calculates km distance to a target {lat, lon}
 * - `within`: Checks if entity is within radius km of {lat, lon}
 */
export function registerSpatialPredicates() {
  registerPredicate('geo:distanceTo', (entity: Entity, target: { lat: number, lon: number }) => {
    const geom = entity.geometry;
    if (!geom) return Infinity;
    
    // Support GeoJSON Point
    if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
      return haversineDistance(geom.coordinates[1], geom.coordinates[0], target.lat, target.lon);
    }
    
    // Support simple lat/lon properties if geometry is missing or different
    const lat = entity.lat ?? entity.latitude;
    const lon = entity.lon ?? entity.longitude;
    if (lat !== undefined && lon !== undefined) {
      return haversineDistance(Number(lat), Number(lon), target.lat, target.lon);
    }
    
    return Infinity;
  });

  registerPredicate('geo:within', (entity: Entity, context: SimulationContext, options: { lat: number, lon: number, radius: number }) => {
    const distanceTo = context.resolvePredicate('geo:distanceTo');
    if (!distanceTo) return false;
    const dist = distanceTo(entity, options);
    return dist <= options.radius;
  });
}
