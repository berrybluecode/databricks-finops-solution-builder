# Databricks FinOps Solution Builder

Interactive static application for designing a Databricks FinOps implementation
blueprint and finding relevant public, community, and internal solution assets.

## Live site

[Open the Databricks FinOps Solution Builder](https://berrybluecode.github.io/databricks-finops-solution-builder/)

## Capabilities

- Product area and detailed product category selection
- FinOps goals: tracking, allocation, optimization, guardrails, forecasting, and unit economics
- Architecture, tagging, system-table SQL, and implementation guidance
- Ranked solution matches based on category, product area, FinOps action, and readiness
- Source-scope filters for internal, Databricks public, and community assets
- Copyable blueprint and SQL starter query
- Responsive static UI with no backend or build step

Internal Databricks solution URLs are intentionally excluded from the published
source. Contact your Databricks Account team for access or more information.

## Run locally

```bash
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765).

## Files

- `index.html` — application shell
- `styles.css` — responsive visual design
- `app.js` — blueprint logic, solution metadata, ranking, and rendering

## Disclaimer

Solution matching indicates functional fit, not vendor certification. Validate
permissions, product availability, calculations, and production readiness before use.
