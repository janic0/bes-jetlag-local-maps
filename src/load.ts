interface GeoBoundaryCountry {
  boundaryID: string;
  boundaryName: string;
  boundaryISO: string;
  boundaryYearRepresented: string;
  boundaryType: string;
  boundaryCanonical: string;
  boundarySource: string;
  boundaryLicense: string;
  licenseDetail: string;
  licenseSource: string;
  boundarySourceURL: string;
  sourceDataUpdateDate: string;
  buildDate: string;
  Continent: string;
  "UNSDG-region": string;
  "UNSDG-subregion": string;
  worldBankIncomeGroup: string;
  admUnitCount: string;
  meanVertices: string;
  minVertices: string;
  maxVertices: string;
  meanPerimeterLengthKM: string;
  minPerimeterLengthKM: string;
  maxPerimeterLengthKM: string;
  meanAreaSqKM: string;
  minAreaSqKM: string;
  maxAreaSqKM: string;
  staticDownloadLink: string;
  gjDownloadURL: string;
  tjDownloadURL: string;
  imagePreview: string;
  simplifiedGeometryGeoJSON: string;
}

function area(poly) {
  let s = 0.0;
  const ring = poly[0];
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return 0.5 * s;
}

function centroid(poly: [number, number][]) {
  const c = [0, 0] as [number, number];
  const ring = poly[0];
  for (let i = 0; i < ring.length - 1; i++) {
    c[0] +=
      (ring[i][0] + ring[i + 1][0]) *
      (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]);
    c[1] +=
      (ring[i][1] + ring[i + 1][1]) *
      (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]);
  }
  var a = area(poly);
  c[0] /= a * 6;
  c[1] /= a * 6;
  return c;
}

const countries: GeoBoundaryCountry[] = await fetch(
  "https://www.geoboundaries.org/api/current/gbOpen/ALL/ADM1/"
).then((resp) => resp.json());

const finalObj = {};

await Promise.all(
  countries.map(async (country) => {
    const geoJsonData = await fetch(country.simplifiedGeometryGeoJSON, {}).then(
      (data) => data.json()
    );

    geoJsonData.features.forEach((feature) => {
      let center: null | [number, number] = null;
      if (feature.geometry.type == "MultiPolygon") {
        console.log(country.boundaryName);
        let maxArea = 0;

        for (const polygon of feature.geometry.coordinates) {
          const newArea = area(polygon);
          if (newArea > maxArea) {
            maxArea = newArea;
            center = centroid(polygon);
          }
        }
      } else if (feature.geometry.type == "Polygon") {
        center = centroid(feature.geometry.coordinates);
      } else {
        throw "unknown type " + feature.geometry.type;
      }

      let shapeISO = feature.properties.shapeISO;
      if (shapeISO == null) {
        if (feature.shapeID == "17685810B50760377364469") shapeISO = "IR-23";
        // if (feature.shapeID == "11314189B98727282609866") shapeISO = "BJ-KO";
        console.log(
          country.boundaryName,
          country.boundaryISO,
          feature.properties
        );
        return;
      }

      finalObj[feature.properties.shapeISO.replace("_", "-").toUpperCase()] =
        center;
      //   console.log(
      //     country.boundaryName,
      //     country.boundaryISO,
      //     feature.properties.shapeISO.replace("_", "-"),
      //     center
      //   );
    });
  })
);

await Deno.writeTextFile(
  "generated-states.ts",
  "export const states = " + JSON.stringify(finalObj)
);
