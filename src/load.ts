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

// const countrySubdivisions = await fetch("https://iso3166-2-api.vercel.app/api/all").then((resp) => resp.json());

const tabularData: {
  countryCode: string;
  originalISOCode: string;
  improvedExpectedCode: string;
  shapeName: string;
  detectionSource: string | null;
  newISOCode: string;
}[] = [];

await Promise.all(
  countries.map(async (country) => {
    const geoJsonData = await fetch(country.simplifiedGeometryGeoJSON, {}).then(
      (data) => data.json()
    );

    let expectedSubdivisions:
      | {
          flag: string;
          localOtherName: string;
          name: string;
          isoCode: string;
        }[]
      | null = null;

    Promise.all(
      geoJsonData.features.map(async (feature) => {
        let center: null | [number, number] = null;
        if (feature.geometry.type == "MultiPolygon") {
          // console.log(country.boundaryName);
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

        let combinedISOCode = feature.properties.shapeISO;

        if (!combinedISOCode || combinedISOCode.split("-")[0].length != 2) {
          const improvedExpectedCode = combinedISOCode
            ? combinedISOCode.toUpperCase().replace("=", "-").replace("_", "-")
            : null;

          const originalISOCode = combinedISOCode;

          const improvedShapeName = feature.properties.shapeName
            .replace(/Ã³/g, "ó")
            .replace(/Ã¡/g, "á")
            .replace(/Ã©/g, "é")
            .replace(/Ã­/g, "í")
            .replace(/Ã±/g, "ñ")
            .replace(/Ã\x91/g, "Ñ");

          if (expectedSubdivisions == null)
            expectedSubdivisions = await fetch(
              "https://iso3166-2-api.vercel.app/api/alpha/" +
                country.boundaryISO
            )
              .then((res) => res.json())
              .then((data) => {
                return Object.entries(data).map(
                  ([key, value]: [key: string, value: any]) => ({
                    isoCode: key,
                    ...value,
                  })
                );
              });

          let detectionSource: string | null = null;

          if (expectedSubdivisions != null) {
            if (improvedExpectedCode && !detectionSource) {
              const countryRegex = /([A-Z]{1,3})[^\w]*([A-Z0-9]*)/;
              const matches = improvedExpectedCode.match(countryRegex);

              const expectedAlpha2CountryCode =
                expectedSubdivisions[0].isoCode.split("-")[0];

              const substitutedISORegionCode =
                expectedAlpha2CountryCode + "-" + matches[2];

              const appendedISORegionCode =
                expectedAlpha2CountryCode + "-" + improvedExpectedCode;

              combinedISOCode = substitutedISORegionCode;

              for (const subdivision of expectedSubdivisions) {
                if (subdivision.isoCode === substitutedISORegionCode) {
                  combinedISOCode = subdivision.isoCode;
                  detectionSource = "S1-alpha-2-iso";
                  break;
                }

                if (subdivision.isoCode === appendedISORegionCode) {
                  combinedISOCode = subdivision.isoCode;
                  detectionSource = "S0-appended-code";
                  break;
                }
              }
            }

            if (!detectionSource) {
              for (const subdivision of expectedSubdivisions) {
                if (subdivision.isoCode === improvedExpectedCode) {
                  combinedISOCode = subdivision.isoCode;
                  detectionSource = "S2-improved-iso";
                  break;
                }
              }
            }

            if (!detectionSource) {
              for (const subdivision of expectedSubdivisions) {
                if (
                  subdivision.name.toLowerCase() ===
                  improvedShapeName.toLowerCase()
                ) {
                  combinedISOCode = subdivision.isoCode;
                  detectionSource = "S3-shape-name";
                  break;
                }
              }
            }
            if (!detectionSource) {
              for (const subdivision of expectedSubdivisions) {
                if (!subdivision.localOtherName) continue;
                if (
                  subdivision.localOtherName
                    .toLowerCase()
                    .includes(feature.properties.shapeName.toLowerCase())
                ) {
                  combinedISOCode = subdivision.isoCode;
                  detectionSource = "S4-local-other-name";
                  break;
                }
              }
            }

            if (!detectionSource) {
              let bestMatch: string | null = null;
              let bestMatchWordCount = 0;

              let bestNameMatch: string | null = null;
              let bestNameMatchWordCount = 0;

              const words = improvedShapeName
                .split(" ")
                .map((word) => word.toLowerCase());

              for (const subdivision of expectedSubdivisions) {
                const divisionNameMatchCount = subdivision.name
                  .split(" ")
                  .filter((word) => words.includes(word.toLowerCase())).length;

                if (bestNameMatchWordCount < divisionNameMatchCount) {
                  bestNameMatchWordCount = divisionNameMatchCount;
                  bestNameMatch = subdivision.isoCode;
                }

                if (subdivision.localOtherName) {
                  const matchCount = subdivision.localOtherName
                    .split(" ")
                    .filter((word) =>
                      words.includes(word.toLowerCase())
                    ).length;

                  if (bestMatchWordCount < matchCount) {
                    bestMatchWordCount = matchCount;
                    bestMatch = subdivision.isoCode;
                  }
                }
              }

              if (bestNameMatch != null) {
                combinedISOCode = bestNameMatch;
                detectionSource =
                  "S5-partial-name-word-match-" +
                  bestNameMatchWordCount.toString();
              } else if (bestMatch != null) {
                combinedISOCode = bestMatch;
                detectionSource =
                  "S5-partial-other-name-word-match-" +
                  bestMatchWordCount.toString();
              }
            }
          }

          tabularData.push({
            originalISOCode,
            improvedExpectedCode,
            countryCode: country.boundaryISO,
            detectionSource: detectionSource,
            shapeName: improvedShapeName,
            newISOCode: combinedISOCode,
          });

          // console.log(
          //   originalISOCode,
          //   improvedExpectedCode,
          //   feature.properties.shapeName,
          //   detectionSource,
          //   combinedISOCode
          // );
        }

        const shapeISO = combinedISOCode;
        if (shapeISO == null || shapeISO.length === 0) {
          // if (feature.shapeID == "17685810B50760377364469") shapeISO = "IR-23";
          // if (feature.shapeID == "11314189B98727282609866") shapeISO = "BJ-KO";

          // console.log(
          //   country.boundaryName,
          //   country.boundaryISO,
          //   feature.properties
          // );
          return;
        }

        finalObj[shapeISO.replace("_", "-").toUpperCase()] = center;
        //   console.log(
        //     country.boundaryName,
        //     country.boundaryISO,
        //     feature.properties.shapeISO.replace("_", "-"),
        //     center
        //   );
      })
    );
  })
);

console.table(tabularData);

await Deno.writeTextFile(
  "generated-states.ts",
  "export const states = " + JSON.stringify(finalObj)
);
