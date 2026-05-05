"use client";

import { useMemo, useState } from "react";
import {
  area,
  extent,
  geoMercator,
  geoPath,
  interpolateBuGn,
  interpolateYlOrRd,
  line,
  max,
  scaleBand,
  scaleLinear,
  scaleSequential
} from "d3";

const MONTH_OPTIONS = [
  { value: 0, label: "All months" },
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

const STATUS_FIELD = {
  all: "allCount",
  arrest: "arrestCount",
  domestic: "domesticCount"
};

function getCount(row, statusMode) {
  return row[STATUS_FIELD[statusMode]] || 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function monthLabel(monthValue, labels) {
  if (monthValue === 0) {
    return "All months";
  }
  return labels[monthValue - 1];
}

function computeDistrictCounts(cube, crimeType, month, statusMode) {
  const totals = {};

  for (const row of cube) {
    if (crimeType !== "ALL" && row.crimeType !== crimeType) {
      continue;
    }
    if (month !== 0 && row.month !== month) {
      continue;
    }
    totals[row.district] = (totals[row.district] || 0) + getCount(row, statusMode);
  }

  return totals;
}

function computeMapData(cube, centroids, crimeType, month, statusMode) {
  const totals = computeDistrictCounts(cube, crimeType, month, statusMode);

  return centroids
    .map((centroid) => ({
      district: centroid.district,
      pointCount: centroid.pointCount,
      count: totals[centroid.district] || 0
    }))
    .sort((a, b) => b.count - a.count);
}

function computeTimelineData(cube, district, crimeType, statusMode) {
  const monthly = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    count: 0
  }));

  for (const row of cube) {
    if (district && row.district !== district) {
      continue;
    }
    if (crimeType !== "ALL" && row.crimeType !== crimeType) {
      continue;
    }
    monthly[row.month - 1].count += getCount(row, statusMode);
  }

  return monthly;
}

function computeHeatmapData(cube, districts, crimeTypes, month, statusMode) {
  const cells = [];
  let maxValue = 0;

  for (const crimeType of crimeTypes) {
    for (const district of districts) {
      let total = 0;

      for (const row of cube) {
        if (row.district !== district || row.crimeType !== crimeType) {
          continue;
        }
        if (month !== 0 && row.month !== month) {
          continue;
        }
        total += getCount(row, statusMode);
      }

      maxValue = Math.max(maxValue, total);
      cells.push({ district, crimeType, count: total });
    }
  }

  return { cells, maxValue };
}

function getCrimeTypeOptions(cube) {
  const totals = {};

  for (const row of cube) {
    totals[row.crimeType] = (totals[row.crimeType] || 0) + row.allCount;
  }

  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([crimeType]) => crimeType);
}

function buildHighlights(meta) {
  const topCrime = meta.topCrimeTypes[0];
  const topDistrict = [...meta.districtSummary].sort((a, b) => b.count - a.count)[0];
  const peakMonth = [...meta.monthlySeries].sort((a, b) => b.count - a.count)[0];

  return [
    {
      label: "Top offense",
      title: topCrime.crimeType,
      note: `${formatNumber(topCrime.count)} reports citywide`
    },
    {
      label: "Peak month",
      title: MONTH_OPTIONS[peakMonth.month].label,
      note: `${formatNumber(peakMonth.count)} reports in the full-year series`
    },
    {
      label: "Highest district total",
      title: `District ${topDistrict.district}`,
      note: `${formatNumber(topDistrict.count)} reports in the district summary`
    }
  ];
}

function Tooltip({ tooltip }) {
  if (!tooltip) {
    return null;
  }

  return (
    <div
      className="tooltip"
      style={{
        left: tooltip.x + 16,
        top: tooltip.y + 16
      }}
    >
      <p className="tooltip-title">{tooltip.title}</p>
      {tooltip.lines.map((lineItem) => (
        <p key={lineItem}>{lineItem}</p>
      ))}
    </div>
  );
}

function ControlPanel({
  crimeTypes,
  crimeType,
  setCrimeType,
  month,
  setMonth,
  statusMode,
  setStatusMode,
  selectedDistrict,
  clearSelection,
  months
}) {
  return (
    <aside className="control-panel">
      <div className="panel-heading">
        <p className="eyebrow">Controls</p>
        <h2>Filter the views</h2>
      </div>

      <label className="control-block">
        <span>Crime type</span>
        <select value={crimeType} onChange={(event) => setCrimeType(event.target.value)}>
          <option value="ALL">All crime types</option>
          {crimeTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="control-block">
        <span>Month</span>
        <input
          type="range"
          min="0"
          max="12"
          step="1"
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
        />
        <div className="range-labels">
          <strong>{monthLabel(month, months)}</strong>
          <button type="button" onClick={() => setMonth(0)}>
            Reset
          </button>
        </div>
      </div>

      <fieldset className="control-block">
        <legend>Mode</legend>
        <label>
          <input
            type="radio"
            name="statusMode"
            checked={statusMode === "all"}
            onChange={() => setStatusMode("all")}
          />
          <span>All incidents</span>
        </label>
        <label>
          <input
            type="radio"
            name="statusMode"
            checked={statusMode === "arrest"}
            onChange={() => setStatusMode("arrest")}
          />
          <span>Arrest-related</span>
        </label>
        <label>
          <input
            type="radio"
            name="statusMode"
            checked={statusMode === "domestic"}
            onChange={() => setStatusMode("domestic")}
          />
          <span>Domestic</span>
        </label>
      </fieldset>

      <div className="selection-summary">
        <p className="eyebrow">Selection</p>
        <h3>{selectedDistrict ? `District ${selectedDistrict}` : "Citywide"}</h3>
        <p>Click a district on the map or a cell in the heatmap to focus the other views.</p>
        <button type="button" onClick={clearSelection}>
          Clear selection
        </button>
      </div>
    </aside>
  );
}

function OverviewStats({ meta, mapData, selectedDistrict, statusMode }) {
  const visibleTotal = mapData.reduce((sum, item) => sum + item.count, 0);
  const activeDistrict = selectedDistrict
    ? mapData.find((item) => item.district === selectedDistrict)
    : null;
  const arrestRate = ((meta.arrestRecords / meta.totalRecords) * 100).toFixed(1);
  const domesticRate = ((meta.domesticRecords / meta.totalRecords) * 100).toFixed(1);

  return (
    <section className="stats-grid">
      <article>
        <p className="eyebrow">Visible</p>
        <h3>{formatNumber(visibleTotal)}</h3>
        <p>Reports matching the current filters.</p>
      </article>
      <article>
        <p className="eyebrow">Mapped</p>
        <h3>{formatNumber(meta.mappedRecords)}</h3>
        <p>Rows with coordinates in the source file.</p>
      </article>
      <article>
        <p className="eyebrow">Arrest share</p>
        <h3>{arrestRate}%</h3>
        <p>Share of citywide reports flagged with an arrest.</p>
      </article>
      <article>
        <p className="eyebrow">Domestic share</p>
        <h3>{domesticRate}%</h3>
        <p>Share of citywide reports flagged as domestic.</p>
      </article>
      <article className="wide">
        <p className="eyebrow">Focus</p>
        <h3>
          {selectedDistrict
            ? `District ${selectedDistrict}`
            : statusMode === "all"
              ? "All incidents"
              : statusMode === "arrest"
                ? "Arrest-related incidents"
                : "Domestic incidents"}
        </h3>
        <p>
          {activeDistrict
            ? `${formatNumber(activeDistrict.count)} reports match the current filters in the selected district.`
            : "Use the controls to compare district patterns across offense type and season."}
        </p>
      </article>
    </section>
  );
}

function HighlightStrip({ items }) {
  return (
    <section className="highlight-strip">
      {items.map((item) => (
        <article key={item.label} className="highlight-card">
          <p className="eyebrow">{item.label}</p>
          <h3>{item.title}</h3>
          <p>{item.note}</p>
        </article>
      ))}
    </section>
  );
}

function MapView({
  districtGeo,
  countsByDistrict,
  selectedDistrict,
  setSelectedDistrict,
  setTooltip,
  clearTooltip
}) {
  const width = 900;
  const height = 640;
  const features = useMemo(
    () =>
      districtGeo.features
        .filter((feature) => feature.geometry && feature.properties?.dist_num)
        .map((feature) => ({
          ...feature,
          properties: {
            ...feature.properties,
            district: String(feature.properties.dist_num).padStart(3, "0")
          }
        })),
    [districtGeo]
  );

  const projection = useMemo(() => {
    const nextProjection = geoMercator();
    nextProjection.fitExtent(
      [
        [44, 28],
        [width - 34, height - 28]
      ],
      { type: "FeatureCollection", features }
    );
    return nextProjection;
  }, [features]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const maxCount = max(features, (feature) => countsByDistrict[feature.properties.district] || 0) || 1;
  const colorScale = scaleSequential(interpolateYlOrRd).domain([0, maxCount]);

  const labelFeatures = features.filter((feature) => {
    const [x, y] = path.centroid(feature);
    return Number.isFinite(x) && Number.isFinite(y);
  });

  return (
    <div className="chart-card chart-card-map">
      <div className="chart-header chart-header-map">
        <div>
          <p className="eyebrow">View 1</p>
          <h2>District map</h2>
        </div>
        <p>Color encodes the number of reports matching the current filters.</p>
      </div>
      <div className="legend-bar">
        <span>Lower</span>
        <div className="legend-ramp crime-ramp" />
        <span>Higher</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="viz-svg map-svg">
        <rect x="0" y="0" width={width} height={height} rx="28" className="map-panel-bg" />
        {features.map((feature) => {
          const district = feature.properties.district;
          const value = countsByDistrict[district] || 0;
          const active = district === selectedDistrict;
          return (
            <path
              key={district}
              d={path(feature) || ""}
              fill={colorScale(value)}
              className={active ? "district-shape active" : "district-shape"}
              onClick={() => setSelectedDistrict((current) => (current === district ? null : district))}
              onMouseMove={(event) =>
                setTooltip({
                  x: event.clientX,
                  y: event.clientY,
                  title: `District ${district}`,
                  lines: [`${formatNumber(value)} reports in the current selection`]
                })
              }
              onMouseLeave={clearTooltip}
            />
          );
        })}
        {labelFeatures.map((feature) => {
          const district = feature.properties.district;
          const [x, y] = path.centroid(feature);
          return (
            <text key={`label-${district}`} x={x} y={y} textAnchor="middle" className="map-label">
              {district}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TimelineView({ data, selectedMonth, setMonth, title, months, setTooltip, clearTooltip }) {
  const width = 760;
  const height = 320;
  const padding = { top: 18, right: 24, bottom: 42, left: 48 };
  const xScale = scaleLinear().domain([1, 12]).range([padding.left, width - padding.right]);
  const yScale = scaleLinear()
    .domain([0, max(data, (d) => d.count) || 1])
    .nice()
    .range([height - padding.bottom, padding.top]);
  const areaPath = area()
    .x((d) => xScale(d.month))
    .y0(height - padding.bottom)
    .y1((d) => yScale(d.count))(data);
  const linePath = line()
    .x((d) => xScale(d.month))
    .y((d) => yScale(d.count))(data);

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <p className="eyebrow">View 2</p>
          <h2>Monthly timeline</h2>
        </div>
        <p>{title}</p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="viz-svg">
        <defs>
          <linearGradient id="timelineFill" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 107, 53, 0.32)" />
            <stop offset="100%" stopColor="rgba(255, 107, 53, 0.02)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padding.top + step * (height - padding.top - padding.bottom);
          return <line key={step} x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="grid-line" />;
        })}
        {selectedMonth !== 0 ? (
          <rect x={xScale(selectedMonth) - 26} y={padding.top} width="52" height={height - padding.top - padding.bottom} className="timeline-band" />
        ) : null}
        <path d={areaPath || ""} className="timeline-area" />
        <path d={linePath || ""} className="timeline-line" />
        {data.map((item) => {
          const active = item.month === selectedMonth;
          return (
            <g key={item.month}>
              <circle
                cx={xScale(item.month)}
                cy={yScale(item.count)}
                r={active ? 6.5 : 5}
                className={active ? "timeline-dot active" : "timeline-dot"}
                onClick={() => setMonth(item.month)}
                onMouseMove={(event) =>
                  setTooltip({
                    x: event.clientX,
                    y: event.clientY,
                    title: months[item.month - 1],
                    lines: [`${formatNumber(item.count)} reports`]
                  })
                }
                onMouseLeave={clearTooltip}
              />
              <text x={xScale(item.month)} y={height - 16} textAnchor="middle" className="axis-label">
                {months[item.month - 1]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HeatmapView({
  districts,
  crimeTypes,
  heatmap,
  selectedDistrict,
  selectedCrimeType,
  setSelectedDistrict,
  setCrimeType,
  setTooltip,
  clearTooltip
}) {
  const width = 900;
  const height = 420;
  const margin = { top: 18, right: 20, bottom: 42, left: 164 };
  const xScale = scaleBand().domain(districts).range([margin.left, width - margin.right]).padding(0.08);
  const yScale = scaleBand().domain(crimeTypes).range([margin.top, height - margin.bottom]).padding(0.08);
  const colorScale = scaleSequential(interpolateBuGn).domain([0, heatmap.maxValue || 1]);

  return (
    <div className="chart-card heatmap-card">
      <div className="chart-header">
        <div>
          <p className="eyebrow">View 3</p>
          <h2>Crime type by district</h2>
        </div>
        <p>Click a cell to select both a district and a crime type.</p>
      </div>
      <div className="legend-bar legend-bar-heat">
        <span>Lower</span>
        <div className="legend-ramp heat-ramp" />
        <span>Higher</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="viz-svg">
        {heatmap.cells.map((cell) => {
          const x = xScale(cell.district);
          const y = yScale(cell.crimeType);
          const isActiveDistrict = cell.district === selectedDistrict;
          const isActiveCrime = cell.crimeType === selectedCrimeType;
          return (
            <rect
              key={`${cell.crimeType}-${cell.district}`}
              x={x}
              y={y}
              width={xScale.bandwidth()}
              height={yScale.bandwidth()}
              rx="7"
              fill={colorScale(cell.count)}
              className={isActiveDistrict || isActiveCrime ? "heatmap-cell active" : "heatmap-cell"}
              onClick={() => {
                setSelectedDistrict(cell.district);
                setCrimeType(cell.crimeType);
              }}
              onMouseMove={(event) =>
                setTooltip({
                  x: event.clientX,
                  y: event.clientY,
                  title: `${cell.crimeType} in District ${cell.district}`,
                  lines: [`${formatNumber(cell.count)} reports`]
                })
              }
              onMouseLeave={clearTooltip}
            />
          );
        })}
        {districts.map((district) => (
          <text
            key={district}
            x={(xScale(district) || 0) + xScale.bandwidth() / 2}
            y={height - 16}
            textAnchor="middle"
            className="axis-label"
          >
            {district}
          </text>
        ))}
        {crimeTypes.map((rowCrimeType) => (
          <text
            key={rowCrimeType}
            x={margin.left - 12}
            y={(yScale(rowCrimeType) || 0) + yScale.bandwidth() / 2 + 4}
            textAnchor="end"
            className="axis-label axis-label-row"
          >
            {rowCrimeType}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function CrimeStoryApp({ cube, meta, districtGeo }) {
  const [crimeType, setCrimeType] = useState("ALL");
  const [month, setMonth] = useState(0);
  const [statusMode, setStatusMode] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const clearTooltip = () => setTooltip(null);
  const crimeTypes = getCrimeTypeOptions(cube);
  const highlightItems = buildHighlights(meta);
  const heatmapCrimeTypes = meta.topCrimeTypes.map((item) => item.crimeType);
  const districts = [...meta.districtSummary].sort((a, b) => b.count - a.count).map((item) => item.district);
  const mapData = computeMapData(cube, meta.centroids, crimeType, month, statusMode);
  const countsByDistrict = useMemo(
    () => Object.fromEntries(mapData.map((item) => [item.district, item.count])),
    [mapData]
  );
  const timelineData = computeTimelineData(cube, selectedDistrict, crimeType, statusMode);
  const heatmap = computeHeatmapData(cube, districts, heatmapCrimeTypes, month, statusMode);
  const selectedCrimeLabel = crimeType === "ALL" ? "all crime types" : crimeType.toLowerCase();

  return (
    <main className="page-shell">
      <section className="hero hero-compact">
        <div className="hero-copy hero-copy-compact">
          <p className="eyebrow">Chicago crime 2025</p>
          <h1><span className="hero-title-line">Mapping the Rhythm</span><span className="hero-title-line">of Crime in Chicago</span></h1>
          <p className="hero-subtitle">A Storytelling Visualization of Space, Time, and Offense Patterns in 2025</p>
          <p className="hero-text">
            Interactive map, timeline, and heatmap built from the City of Chicago crime dataset.
          </p>
          <div className="hero-tags">
            <span>{formatNumber(meta.totalRecords)} reports</span>
            <span>22 police districts</span>
            <span>12 months</span>
          </div>
        </div>
        <div className="hero-panel hero-panel-compact">
          <p className="eyebrow">Use</p>
          <ul className="hero-steps">
            <li>Choose a crime type or incident mode.</li>
            <li>Use the month slider to narrow the time window.</li>
            <li>Click a district to update the timeline and heatmap.</li>
          </ul>
          <a
            href="https://data.cityofchicago.org/Public-Safety/Crimes-2025/t7ek-mgzi/about_data"
            target="_blank"
            rel="noreferrer"
            className="source-link"
          >
            Source dataset
          </a>
        </div>
      </section>

      <OverviewStats meta={meta} mapData={mapData} selectedDistrict={selectedDistrict} statusMode={statusMode} />
      <HighlightStrip items={highlightItems} />

      <section className="workspace">
        <ControlPanel
          crimeTypes={crimeTypes}
          crimeType={crimeType}
          setCrimeType={setCrimeType}
          month={month}
          setMonth={setMonth}
          statusMode={statusMode}
          setStatusMode={setStatusMode}
          selectedDistrict={selectedDistrict}
          clearSelection={() => {
            setSelectedDistrict(null);
            setCrimeType("ALL");
            setMonth(0);
          }}
          months={meta.months}
        />

        <div className="viz-column">
          <MapView
            districtGeo={districtGeo}
            countsByDistrict={countsByDistrict}
            selectedDistrict={selectedDistrict}
            setSelectedDistrict={setSelectedDistrict}
            setTooltip={setTooltip}
            clearTooltip={clearTooltip}
          />
          <TimelineView
            data={timelineData}
            selectedMonth={month}
            setMonth={setMonth}
            months={meta.months}
            title={selectedDistrict ? `Monthly pattern for District ${selectedDistrict} with ${selectedCrimeLabel}.` : `Citywide monthly pattern for ${selectedCrimeLabel}.`}
            setTooltip={setTooltip}
            clearTooltip={clearTooltip}
          />
          <HeatmapView
            districts={districts}
            crimeTypes={heatmapCrimeTypes}
            heatmap={heatmap}
            selectedDistrict={selectedDistrict}
            selectedCrimeType={crimeType}
            setSelectedDistrict={setSelectedDistrict}
            setCrimeType={setCrimeType}
            setTooltip={setTooltip}
            clearTooltip={clearTooltip}
          />
        </div>
      </section>

      <Tooltip tooltip={tooltip} />
    </main>
  );
}



