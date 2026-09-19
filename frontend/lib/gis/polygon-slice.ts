/**
 * GIS Polygon Slicing and Centroid Utilities for FarmOps AI
 * Divides arbitrary convex / simple farm boundary polygons into proportional sub-zones.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Clips a polygon against a half-plane using the Sutherland-Hodgman algorithm.
 */
function clipPolygon(
  polygon: Point[],
  isInside: (p: Point) => boolean,
  intersection: (a: Point, b: Point) => Point
): Point[] {
  const output: Point[] = [];
  if (polygon.length === 0) return output;

  let prev = polygon[polygon.length - 1];
  for (const curr of polygon) {
    if (isInside(curr)) {
      if (!isInside(prev)) {
        output.push(intersection(prev, curr));
      }
      output.push(curr);
    } else if (isInside(prev)) {
      output.push(intersection(prev, curr));
    }
    prev = curr;
  }
  return output;
}

/**
 * Divides a boundary polygon into K proportional zone sub-polygons.
 * Slices along the major axis (horizontal or vertical) according to given ratios.
 */
export function slicePolygonIntoZones(points: Point[], ratios: number[]): Point[][] {
  if (points.length < 3) return [];
  const count = ratios.length || 1;
  if (count === 1) return [points];

  // Normalize ratios
  const sumRatios = ratios.reduce((a, b) => a + b, 0) || count;
  const normalized = ratios.map((r) => r / sumRatios);

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  // Slice along the wider axis
  const isHorizontal = width >= height;

  const resultZones: Point[][] = [];
  let cumulativeRatio = 0;

  for (let i = 0; i < count; i++) {
    const t0 = cumulativeRatio;
    cumulativeRatio += normalized[i];
    const t1 = i === count - 1 ? 1.0 : cumulativeRatio;

    if (isHorizontal) {
      const x0 = minX + width * t0;
      const x1 = minX + width * t1;

      let poly = clipPolygon(
        points,
        (p) => p.x >= x0,
        (a, b) => ({
          x: x0,
          y: a.y + ((x0 - a.x) * (b.y - a.y)) / ((b.x - a.x) || 0.0001),
        })
      );

      poly = clipPolygon(
        poly,
        (p) => p.x <= x1,
        (a, b) => ({
          x: x1,
          y: a.y + ((x1 - a.x) * (b.y - a.y)) / ((b.x - a.x) || 0.0001),
        })
      );

      resultZones.push(poly.length >= 3 ? poly : points);
    } else {
      const y0 = minY + height * t0;
      const y1 = minY + height * t1;

      let poly = clipPolygon(
        points,
        (p) => p.y >= y0,
        (a, b) => ({
          x: a.x + ((y0 - a.y) * (b.x - a.x)) / ((b.y - a.y) || 0.0001),
          y: y0,
        })
      );

      poly = clipPolygon(
        poly,
        (p) => p.y <= y1,
        (a, b) => ({
          x: a.x + ((y1 - a.y) * (b.x - a.x)) / ((b.y - a.y) || 0.0001),
          y: y1,
        })
      );

      resultZones.push(poly.length >= 3 ? poly : points);
    }
  }

  return resultZones;
}

/**
 * Calculates centroid of a polygon.
 */
export function getPolygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 400, y: 250 };
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return {
    x: Math.round(cx / points.length),
    y: Math.round(cy / points.length),
  };
}

/**
 * Converts Point array to SVG points string "x1,y1 x2,y2 ..."
 */
export function pointsToSvgString(points: Point[]): string {
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(" ");
}
