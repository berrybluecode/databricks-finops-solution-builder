const dimensions=[
  {key:'productArea',label:'Product area',hint:'Which part of the Databricks platform?',values:['Data Engineering','Analytics & BI','AI & ML','Platform & Shared Services']},
  {key:'productCategory',label:'Product category',hint:'Which cost domain should this blueprint prioritize?',values:['Compute','SQL & BI','Pipelines','Storage','AI tokens & models','Model serving','ML training','Vector / RAG','Network & egress','Commercial commitments','All cost domains']},
  {key:'goal',label:'FinOps goal',hint:'What should this blueprint help you do with cost?',values:['Track spend','Allocate','Optimize','Set guardrails','Forecast','Cost per outcome']}
];
const allocationDimension={key:'allocation',label:'Allocation level',hint:'At what level should cost ownership be assigned?',values:['Organization / business unit','Team / product','Workspace','Workload / resource','User']};
const defaults={productArea:'Data Engineering',productCategory:'Pipelines',goal:'Track spend',allocation:'Team / product'};
let state={...defaults};
const $=s=>document.querySelector(s);
const defaultCategoryByArea={
  'Data Engineering':'Pipelines',
  'Analytics & BI':'SQL & BI',
  'AI & ML':'AI tokens & models',
  'Platform & Shared Services':'All cost domains'
};
const productAreas={
  'Data Engineering':{tables:['system.billing.usage','system.billing.list_prices','system.lakeflow.jobs','system.lakeflow.job_run_timeline','system.compute.node_timeline'],filter:"u.billing_origin_product IN ('JOBS','DLT','LAKEFLOW_CONNECT','ALL_PURPOSE')",unit:'cost per successful job, pipeline run or data product',extra:'Join job and pipeline identifiers to run timelines; use node telemetry to explain utilization and reliability.',github:'cli',costs:['Compute','Pipelines']},
  'Analytics & BI':{tables:['system.billing.usage','system.billing.list_prices','system.query.history','system.compute.warehouse_events'],filter:"u.billing_origin_product IN ('SQL','DBSQL','GENIE')",unit:'cost per query, dashboard, Genie space or analytics product',extra:'Use query history and warehouse events to allocate shared capacity and explain start, scale and stop behavior.',github:'cli',costs:['SQL & BI']},
  'AI & ML':{tables:['system.billing.usage','system.billing.list_prices','system.serving.endpoint_usage','AI Gateway inference table','MLflow Tracing'],filter:"u.billing_origin_product IN ('MODEL_SERVING','FOUNDATION_MODEL_TRAINING','AI_GATEWAY','VECTOR_SEARCH','FEATURE_STORE')",unit:'cost per training run, prediction, token or successful AI task',extra:'Combine billing with endpoint usage, AI Gateway inference data and MLflow traces to attach quality and outcomes.',github:'sdk',costs:['AI tokens & models','Model serving','ML training','Vector / RAG']},
  'Platform & Shared Services':{tables:['system.billing.usage','system.billing.list_prices','system.access.workspaces_latest','system.information_schema.table_storage_metrics','cloud cost export'],filter:'1 = 1',unit:'fully allocated platform TCO and commitment coverage',extra:'Normalize Databricks, cloud infrastructure, storage, network, support and commitment adjustments in one governed cost mart.',github:'terraform',costs:['Storage','Network & egress','Commercial commitments','All cost domains','Compute']}
};
const goals={
  'Track spend':{headline:'Cost monitoring',description:'Show current spend, trends, anomalies and major cost drivers with an agreed refresh cadence.',logic:['Materialize a daily cost fact table','Track trends, anomalies and unattributed spend','Publish drill-down views for the selected product area'],controls:['SQL alerts for abnormal daily burn','Freshness checks on billing ingestion','Documented price and correction logic'],outputs:['Daily cost and unit-cost dashboard','Top changes versus prior period','Data-quality and attribution exceptions'],actions:['Visibility'],intents:['Current state','Hindsight']},
  Allocate:{headline:'Cost allocation',description:'Assign shared and direct spend to accountable organizational or workload units for showback or chargeback.',logic:['Define an allocation key and fallback hierarchy','Measure direct versus shared versus unallocated cost','Publish allocation quality and exception views'],controls:['Governed tag and identity contract','Allocation rule versioning','Owner review of unresolved spend'],outputs:['Showback or chargeback statement','Allocation coverage score','Unallocated-cost queue'],actions:['Visibility','Govern'],intents:['Current state','Hindsight','Value']},
  Optimize:{headline:'Closed-loop optimization',description:'Find a technical change, estimate savings, implement safely and verify realized results.',logic:['Rank high-cost workloads by savings potential','Join cost with utilization, runtime, scan or token evidence','Record baseline and post-change cost'],controls:['SLO-safe change window','Rollback criterion','Realized-savings validation'],outputs:['Prioritized optimization backlog','Before/after unit cost','Realized savings ledger'],actions:['Optimize'],intents:['Optimization','Hindsight']},
  'Set guardrails':{headline:'Preventive controls',description:'Use budgets, policies and deployment checks to prevent inefficient or unattributed spend.',logic:['Define budgets and approved configuration ranges','Validate ownership and policy before deployment','Audit drift, breaches and exceptions'],controls:['Databricks budgets and budget policies','Terraform or Asset Bundle CI checks','Time-bound exception workflow'],outputs:['Budget and policy compliance score','Threshold-breach notifications','Drift and exception report'],actions:['Control','Govern'],intents:['Prevention']},
  Forecast:{headline:'Scenario planning',description:'Forecast demand, price and architecture scenarios before budget or commitment decisions.',logic:['Build daily or weekly demand baselines','Model growth, price and workload scenarios','Show a forecast range rather than one point'],controls:['Approved assumption table','Scenario owner and review date','Variance feedback into the next forecast'],outputs:['Base, upside and downside forecast','Budget request with assumptions','Commitment coverage scenario'],actions:['Plan'],intents:['Foresight']},
  'Cost per outcome':{headline:'Unit economics',description:'Connect Databricks consumption to adoption, quality, reliability and business outcomes.',logic:['Choose a stable business or product unit','Join cost with outcome and quality metrics','Track marginal cost as adoption scales'],controls:['Governed metric definitions','Outcome-data freshness checks','Finance and product-owner sign-off'],outputs:['Cost per business outcome','Cost, quality and adoption scorecard','Investment or architecture decision'],actions:['Visibility','Plan'],intents:['Value']}
};
const goalData={
  'Track spend':{sources:['system.access.audit'],lookback:30,sql:'Trend daily spend and preserve billing corrections for anomaly and variance analysis.'},
  Allocate:{sources:['governed allocation reference table'],lookback:30,sql:'Use the selected allocation level and report unallocated spend as an exception.'},
  Optimize:{sources:['optimization baseline and savings ledger'],lookback:60,sql:'Use a longer baseline and persist expected versus realized savings after each change.'},
  'Set guardrails':{sources:['Databricks budget and policy configuration'],lookback:30,sql:'Join policy ownership and budget thresholds when evaluating breaches and exceptions.'},
  Forecast:{sources:['contract rate table','forecast assumption table'],lookback:365,sql:'Use a full-year baseline and replace list price with contracted-rate scenarios where available.'},
  'Cost per outcome':{sources:['business outcome metric table'],lookback:90,sql:'Join the allocation key to adoption, quality or business outcome metrics for unit economics.'}
};
const ownerByArea={
  'Data Engineering':['Data Engineering + FinOps','Engineering owns workload changes and reliability; FinOps supplies allocation rules and savings validation.'],
  'Analytics & BI':['Analytics Platform + FinOps','The analytics platform team owns warehouse and query efficiency; business owners validate service levels and allocation.'],
  'AI & ML':['AI product owner + ML Platform','Product owners set cost and quality targets; ML Platform supplies telemetry, routing and serving controls.'],
  'Platform & Shared Services':['Platform Engineering + FinOps','Platform Engineering owns the shared cost foundation and guardrails; FinOps owns allocation, planning and review cadence.']
};
const tagBase=[
  ['cost_center','cc-4201','Yes','Finance allocation and chargeback'],
  ['business_unit','ecommerce','Yes','Executive and BU roll-up'],
  ['product','recommendations','Yes','Stable product / use-case unit economics'],
  ['owner','team-growth-data','Yes','Alert and exception routing'],
  ['environment','prod','Yes','Separate production from experimentation'],
  ['criticality','tier-1','No','Optimization risk and SLO guardrail'],
  ['lifecycle','persistent','No','Identify temporary or expiring workloads'],
  ['budget_code','fy27-ai-04','No','Map consumption to an approved budget'],
  ['data_classification','internal','No','Governance and workload placement context']
];
const sources={
  billing:{type:'OFFICIAL DOCS',title:'Billable usage system table',url:'https://learn.microsoft.com/en-us/azure/databricks/admin/system-tables/billing',summary:'Schema, record corrections, metadata fields and sample queries for system.billing.usage.'},
  monitor:{type:'OFFICIAL DOCS',title:'Monitor costs using system tables',url:'https://learn.microsoft.com/en-us/azure/databricks/admin/usage/system-tables',summary:'Databricks guidance for cost dashboards, list-price joins and usage analysis.'},
  tags:{type:'OFFICIAL DOCS',title:'Usage detail tags',url:'https://learn.microsoft.com/en-us/azure/databricks/admin/account-settings/usage-detail-tags',summary:'How custom tags propagate to billable usage and where tagging coverage differs by resource.'},
  terraform:{type:'GITHUB · DATABRICKS',title:'Terraform Provider for Databricks',url:'https://github.com/databricks/terraform-provider-databricks',summary:'Manage policies, jobs, warehouses, serving endpoints, budgets and other controls as versioned infrastructure.'},
  examples:{type:'GITHUB · DATABRICKS',title:'Terraform Databricks examples',url:'https://github.com/databricks/terraform-databricks-examples',summary:'Reusable modules and CI/CD examples for multi-cloud Databricks workspace and resource deployment.'},
  cli:{type:'GITHUB · DATABRICKS',title:'Databricks CLI and Asset Bundles',url:'https://github.com/databricks/cli',summary:'Deploy jobs, pipelines and supporting resources consistently across environments using bundles and CI/CD.'},
  sdk:{type:'GITHUB · DATABRICKS',title:'Databricks SDK for Python',url:'https://github.com/databricks/databricks-sdk-py',summary:'Automate inventory, policies, alerts and remediation when declarative configuration is not enough.'}
};
const allLegacyStakeholders=['Platform team','FinOps team','Data engineer','AI product owner','CFO / Finance','CIO / CDO'];
const allLegacyIntents=['Current state','Hindsight','Foresight','Optimization','Prevention','Value'];
const allLegacyCosts=['Compute','SQL & BI','Pipelines','Storage','AI tokens & models','Model serving','ML training','Vector / RAG','Network & egress','Commercial commitments','All cost domains'];
const allLegacyAccountability=['Product / use case','Workspace / platform','Business unit','Team','Job / query / endpoint','Organization','User'];
const allLegacyContexts=['Production','Dev / test / prod','Multi-workspace','Region / cloud','Global / all'];
const solutionAssets=[
  {n:'CEMEA FinOps Recommendations App',scope:'Contact Databricks Team',ready:'Recommended',url:null,summary:'Logfood-backed recommendations for monthly waste and savings across compute, SQL, pipelines and serving.',updated:'Internal signal · Sep 2026',s:['Platform team','FinOps team','Data engineer','AI product owner'],i:['Current state','Hindsight','Optimization','Prevention','Value'],c:['Compute','SQL & BI','Pipelines','Model serving'],a:['Workspace / platform','Team','Job / query / endpoint','Organization'],e:['Production','Multi-workspace','Global / all'],x:['Visibility','Control','Optimize','Govern'],caveat:'Internal field asset; central home is still being finalized.'},
  {n:'FinLake — FinOps Lakehouse Demo',scope:'Contact Databricks Team',ready:'Preview / demo',url:null,summary:'Executive-facing FinOps lakehouse demo for consolidated cost visibility and planning.',updated:'Internal signal · May 2026',s:['FinOps team','CFO / Finance','CIO / CDO'],i:['Current state','Foresight','Value'],c:['All cost domains','Commercial commitments'],a:['Business unit','Organization'],e:['Multi-workspace','Region / cloud','Global / all'],x:['Visibility','Plan'],caveat:'Demo only; no reusable deployment repository surfaced.'},
  {n:'Genie Optimization FE Toolkit',scope:'Contact Databricks Team',ready:'Specialist',url:null,summary:'Field queries and playbook work for Genie performance, QPM analysis and cost optimization.',updated:'Internal signal · Feb 2026',s:['Platform team','Data engineer','AI product owner'],i:['Hindsight','Optimization','Prevention'],c:['SQL & BI','AI tokens & models'],a:['Product / use case','Workspace / platform','User'],e:['Production','Multi-workspace'],x:['Visibility','Optimize','Govern'],caveat:'Internal field repository and still evolving.'},
  {n:'Model Router FinOps Demo',scope:'Contact Databricks Team',ready:'Preview / demo',url:null,summary:'Cost and quality trade-offs between open and frontier models using AI Gateway and context routing.',updated:'Internal signal · Jul 2026',s:['AI product owner','CFO / Finance','CIO / CDO'],i:['Foresight','Optimization','Value'],c:['AI tokens & models','Model serving'],a:['Product / use case','Job / query / endpoint'],e:['Production','Region / cloud'],x:['Optimize','Plan'],caveat:'Concept demo; customize assumptions before customer use.'},
  {n:'Intelligent AI FinOps',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databricks-solutions/ai-governance/tree/main/intelligent-ai-finops',summary:'Customer-deployable App for model cost, quality, routing, budgets, rate limits and AI Gateway governance.',updated:'Repo pushed · Sep 2026',s:['Platform team','FinOps team','AI product owner','CFO / Finance','CIO / CDO'],i:['Current state','Foresight','Optimization','Prevention','Value'],c:['AI tokens & models','Model serving'],a:['Product / use case','Team','Job / query / endpoint','Organization','User'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Visibility','Control','Optimize','Govern','Plan']},
  {n:'Cloud Infra Costs',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databricks-solutions/cloud-infra-costs',summary:'AWS/Azure cloud-cost ingestion, medallion pipelines, Lakeview dashboards, Genie, FOCUS and Databricks TCO.',updated:'v1.2.1 · Jul 2026 · 50 stars',s:['Platform team','FinOps team','CFO / Finance','CIO / CDO'],i:['Current state','Hindsight','Foresight','Optimization','Value'],c:['Compute','SQL & BI','Pipelines','Storage','Network & egress','Commercial commitments','All cost domains'],a:['Product / use case','Workspace / platform','Business unit','Team','Job / query / endpoint','Organization'],e:['Multi-workspace','Region / cloud','Global / all'],x:['Visibility','Optimize','Govern','Plan']},
  {n:'Platform Observability & Cost Dashboard',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databricks-solutions/databricks-blogposts/tree/main/2026-02-platform-observability-dashboard',summary:'Materialized cost, reliability, hygiene, tags, attribution and savings-candidate dashboard.',updated:'Repo pushed · Sep 2026',s:['Platform team','FinOps team','Data engineer','CIO / CDO'],i:['Current state','Hindsight','Optimization','Prevention'],c:['Compute','SQL & BI','Pipelines','All cost domains'],a:['Workspace / platform','Team','Job / query / endpoint','Organization','User'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Visibility','Optimize','Govern']},
  {n:'Usage Dashboard 2.0',scope:'Databricks public',ready:'Recommended',url:'https://docs.databricks.com/aws/en/admin/account-settings/usage',summary:'Official importable AI/BI dashboard for product, SKU, tag, object-level and forecast analysis.',updated:'Official Preview · Sep 2026',s:['Platform team','FinOps team','CFO / Finance','CIO / CDO'],i:['Current state','Hindsight','Foresight'],c:['All cost domains'],a:['Product / use case','Workspace / platform','Business unit','Team','Job / query / endpoint','Organization'],e:['Production','Multi-workspace','Global / all'],x:['Visibility','Plan'],caveat:'List-price estimates are not final invoiced cost unless account pricing is available.'},
  {n:'AI/BI Adoption Dashboard',scope:'Community',ready:'Specialist',url:'https://github.com/Dynosphere/aibi-adoption-dashboard',summary:'Adoption and cost across dashboards, Genie, Apps, models, Vector Search, SQL and Genie tokens.',updated:'Active v3 · Sep 2026',s:['Platform team','AI product owner','FinOps team'],i:['Current state','Hindsight','Optimization','Value'],c:['SQL & BI','AI tokens & models','Model serving','Vector / RAG'],a:['Product / use case','Workspace / platform','Job / query / endpoint','User'],e:['Production','Multi-workspace'],x:['Visibility','Optimize','Govern'],caveat:'Breaking changes are noted; migration to Databricks Solutions is planned.'},
  {n:'Cost Reporting Genie',scope:'Community',ready:'Specialist',url:'https://github.com/numanali-db/Cost-Reporting-Genie',summary:'Genie spaces for historical cost questions and high-level AI_FORECAST by workspace, job and SKU.',updated:'Repo pushed · Feb 2026 · 7 stars',s:['Platform team','FinOps team','CFO / Finance'],i:['Current state','Hindsight','Foresight'],c:['All cost domains'],a:['Workspace / platform','Job / query / endpoint','Organization'],e:['Multi-workspace','Region / cloud'],x:['Visibility','Plan'],caveat:'No granular shared-compute allocation or optimization recommendations.'},
  {n:'FinOps Genie',scope:'Community',ready:'Specialist',url:'https://github.com/spsrana4594/finops-genie',summary:'AI/BI dashboard and Genie space for team-tagged cost observations and recommendations.',updated:'Repo pushed · Jun 2026 · 3 stars',s:['Platform team','FinOps team','Data engineer'],i:['Current state','Hindsight','Optimization'],c:['Compute','SQL & BI','Pipelines','All cost domains'],a:['Workspace / platform','Team','Job / query / endpoint'],e:['Production','Multi-workspace'],x:['Visibility','Optimize']},
  {n:'Databricks FinOps Accelerator',scope:'Community',ready:'Recommended',url:'https://github.com/rashad-ahmed-imtiaz/databricks-finops-accelerator',summary:'DAB-deployed facts and views for cost, utilization, reliability, tags, attribution and optimization.',updated:'Repo pushed · Jul 2026 · 3 stars',s:['Platform team','FinOps team','Data engineer','CFO / Finance'],i:['Current state','Hindsight','Optimization','Value'],c:['Compute','SQL & BI','Pipelines','All cost domains'],a:['Product / use case','Workspace / platform','Business unit','Team','Job / query / endpoint','Organization'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Visibility','Optimize','Govern']},
  {n:'Lakemeter OSS',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databrickslabs/lakemeter-oss',summary:'Workload sizing and cost estimates across jobs, SQL, serverless, Lakebase, FMAPI, clouds and regions.',updated:'Public snapshot · 181 stars',s:['Platform team','FinOps team','Data engineer','AI product owner','CFO / Finance'],i:['Foresight','Optimization','Value'],c:['Compute','SQL & BI','Pipelines','AI tokens & models','Model serving','ML training','Commercial commitments','All cost domains'],a:['Product / use case','Workspace / platform','Team','Job / query / endpoint'],e:['Dev / test / prod','Region / cloud','Global / all'],x:['Optimize','Plan'],caveat:'Estimator, not actual-spend observability or enforcement.'},
  {n:'Agent Control Plane',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databricks-solutions/agent-control-plane',summary:'Cross-workspace AI inventory, requests, tokens, cost, Vector Search, permissions, limits and guardrails.',updated:'v0.1.2 · Aug 2026',s:['Platform team','AI product owner','CIO / CDO'],i:['Current state','Hindsight','Optimization','Prevention'],c:['AI tokens & models','Model serving','Vector / RAG'],a:['Product / use case','Workspace / platform','Job / query / endpoint','Organization','User'],e:['Production','Multi-workspace','Region / cloud'],x:['Visibility','Control','Optimize','Govern']},
  {n:'Official Model Serving Cost Recipes',scope:'Databricks public',ready:'Recommended',url:'https://docs.databricks.com/aws/en/admin/system-tables/model-serving-cost',summary:'Official SQL for endpoint, batch-inference, custom-tag, workspace and AI Gateway spend attribution.',updated:'Current official documentation',s:['Platform team','FinOps team','AI product owner'],i:['Current state','Hindsight','Value'],c:['AI tokens & models','Model serving','ML training'],a:['Product / use case','Team','Job / query / endpoint','User'],e:['Production','Multi-workspace'],x:['Visibility','Govern']},
  {n:'Model Serving Cost Dashboard',scope:'Databricks public',ready:'Specialist',url:'https://github.com/databricks-demos/dbdemos-notebooks/blob/141d6f9addeae3a39898b0f810d50b7370d5090c/product_demos/Unity-Catalog/uc-04-system-tables/_resources/dashboards/model-serving-cost.lvdash.json',summary:'Importable Lakeview dashboard for model-serving billing attribution.',updated:'Public dashboard asset',s:['Platform team','FinOps team','AI product owner'],i:['Current state','Hindsight'],c:['Model serving','AI tokens & models'],a:['Workspace / platform','Job / query / endpoint'],e:['Production','Multi-workspace'],x:['Visibility']},
  {n:'AI Gateway Example Dashboard',scope:'Community',ready:'Specialist',url:'https://github.com/mingyu89/ai-gateway/blob/main/%5BExample%5D%20AI%20Gateway%20Dashboard.lvdash.json',summary:'Request, token, model, user and latency analysis from AI Gateway inference tables.',updated:'Public dashboard asset',s:['AI product owner','Platform team','FinOps team'],i:['Current state','Hindsight','Optimization'],c:['AI tokens & models','Model serving'],a:['Product / use case','Job / query / endpoint','User'],e:['Production'],x:['Visibility','Optimize','Govern']},
  {n:'DBSQL Cost per Query Dashboard',scope:'Databricks public',ready:'Specialist',url:'https://github.com/databrickslabs/sandbox/blob/main/dbsql/cost_per_query/PrPr/DBSQL%20Cost%20Dashboard%20(PrPr).lvdash.json',summary:'Attributes shared warehouse cost to users, statements, dashboards, tools and source objects.',updated:'Private Preview asset',s:['Platform team','FinOps team','Data engineer'],i:['Current state','Hindsight','Optimization','Value'],c:['SQL & BI'],a:['Business unit','Team','Job / query / endpoint','User'],e:['Production','Multi-workspace'],x:['Visibility','Optimize','Govern']},
  {n:'DBSQL Warehouse Advisor',scope:'Community',ready:'Specialist',url:'https://github.com/CodyAustinDavis/dbsql_sme/tree/main/Observability%20Dashboards%20and%20DBA%20Resources/Observability%20Lakeview%20Dashboard%20Templates/DBSQL%20Warehouse%20Advisor%20With%20Data%20Model',summary:'Warehouse utilization and configuration-improvement dashboard with a supporting data model.',updated:'Repo updated · Mar 2026',s:['Platform team','FinOps team','Data engineer'],i:['Current state','Hindsight','Optimization','Prevention'],c:['SQL & BI','Compute'],a:['Workspace / platform','Job / query / endpoint'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Visibility','Optimize','Govern']},
  {n:'Jobs & Lakeflow System Tables Dashboards',scope:'Databricks public',ready:'Specialist',url:'https://github.com/databricks/tmm/tree/main/System-Tables-Demo',summary:'Importable job and pipeline status, duration, reliability and cost dashboards.',updated:'Parent repo pushed · Sep 2026',s:['Platform team','FinOps team','Data engineer'],i:['Current state','Hindsight','Optimization'],c:['Compute','Pipelines'],a:['Workspace / platform','Team','Job / query / endpoint','User'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Visibility','Optimize']},
  {n:'Serverless Jobs & Notebooks Cost Dashboards',scope:'Databricks public',ready:'Specialist',url:'https://github.com/databricks/tmm/tree/main/System-Tables-Demo/Serverless-Jobs-Notebooks-PuPr',summary:'AWS- and Azure-specific serverless notebook and job usage/cost dashboards.',updated:'Parent repo pushed · Sep 2026',s:['Platform team','FinOps team','Data engineer'],i:['Current state','Hindsight','Optimization'],c:['Compute','Pipelines'],a:['Workspace / platform','Job / query / endpoint','User'],e:['Production','Region / cloud'],x:['Visibility','Optimize']},
  {n:'Genie Usage Dashboard',scope:'Databricks public',ready:'Specialist',url:'https://github.com/databricks/tmm/blob/main/System-Tables-Demo/Genie-Observability/Genie%20Usage%20Dashboard.lvdash.json',summary:'Genie adoption, usage and billing-system-table observability dashboard.',updated:'Parent repo pushed · Sep 2026',s:['AI product owner','Platform team','FinOps team'],i:['Current state','Hindsight','Value'],c:['AI tokens & models','SQL & BI'],a:['Product / use case','Workspace / platform','User'],e:['Production','Multi-workspace'],x:['Visibility','Govern']},
  {n:'Shared SQL Warehouse Cost Calculator',scope:'Community',ready:'Reference only',url:'https://github.com/mwojtyczka/databricks-shared-clusters-cost-calculator',summary:'Allocates shared SQL DBUs to users and business entities with budgets, alerts and row filters.',updated:'Last push · Oct 2024 · MIT',s:['Platform team','FinOps team','CFO / Finance'],i:['Current state','Hindsight','Prevention','Value'],c:['SQL & BI'],a:['Business unit','Team','Job / query / endpoint','User'],e:['Production','Multi-workspace'],x:['Visibility','Control','Govern','Plan'],caveat:'Stale and dependent on preview-era query-history assumptions.'},
  {n:'Terraform Budgets & Policies',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databricks/terraform-provider-databricks',summary:'Budgets, BLOCK_USAGE, serverless attribution, DBU/hour limits, node controls and enforced auto-termination.',updated:'v1.132.0 · Sep 2026 · 600 stars',s:['Platform team','FinOps team','Data engineer','AI product owner'],i:['Foresight','Prevention','Optimization'],c:['Compute','SQL & BI','Pipelines','AI tokens & models','Model serving','Commercial commitments','All cost domains'],a:['Workspace / platform','Business unit','Team','Organization','User'],e:['Production','Dev / test / prod','Multi-workspace','Global / all'],x:['Control','Govern','Plan'],caveat:'Verify BLOCK_USAGE support and semantics for the selected workload.'},
  {n:'Cluster Policy Solution Accelerator',scope:'Databricks public',ready:'Reference only',url:'https://github.com/databricks-industry-solutions/cluster-policy',summary:'Policy templates for t-shirt sizing, DBU/hour limits, tags, autoscaling and exceptions.',updated:'Last push · Oct 2023',s:['Platform team','FinOps team','Data engineer'],i:['Prevention','Optimization'],c:['Compute','ML training'],a:['Workspace / platform','Team','User'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Control','Optimize','Govern'],caveat:'Stale implementation; modernize with the current Terraform provider.'},
  {n:'Watchtower',scope:'Databricks public',ready:'Specialist',url:'https://github.com/databricks-industry-solutions/watchtower',summary:'Cluster-log pipeline and dashboard for Spark issues plus automatic raw-log retention.',updated:'Last push · Dec 2025 · 20 stars',s:['Platform team','Data engineer'],i:['Hindsight','Optimization','Prevention'],c:['Compute','Pipelines','Storage'],a:['Workspace / platform','Team','Job / query / endpoint'],e:['Production','Dev / test / prod','Multi-workspace'],x:['Visibility','Optimize','Govern']},
  {n:'Databricks Cost Observability App',scope:'Community',ready:'Specialist',url:'https://github.com/vijayakunuri1/databricks-cost-observability',summary:'Broad app for costs, anomaly detection, sizing, SQL, AI, jobs, storage and contract forecasts.',updated:'Repo pushed · Sep 2026 · 9 stars',s:allLegacyStakeholders,i:allLegacyIntents,c:allLegacyCosts,a:allLegacyAccountability,e:allLegacyContexts,x:['Visibility','Optimize','Govern','Plan'],caveat:'Validate calculations, permissions and production hardening.'},
  {n:'Databricks Dashboard Suite',scope:'Community',ready:'Specialist',url:'https://github.com/mohanab89/databricks-dashboard-suite',summary:'Lakeview dashboard collection for unified cost, jobs, SQL, model inference and lineage.',updated:'Repo pushed · Aug 2026 · 43 stars',s:['Platform team','FinOps team','Data engineer','CIO / CDO'],i:['Current state','Hindsight','Optimization'],c:['Compute','SQL & BI','Pipelines','Model serving','All cost domains'],a:['Workspace / platform','Team','Job / query / endpoint','Organization','User'],e:['Production','Multi-workspace'],x:['Visibility','Optimize']},
  {n:'FOCUS 1.4 Billing Mapping',scope:'Databricks public',ready:'Recommended',url:'https://github.com/databricks-solutions/cloud-infra-costs/tree/main/focus',summary:'Runnable SQL mapping Databricks billing into a 65-column FOCUS 1.4 dataset.',updated:'Cloud Infra Costs v1.2.1',s:['FinOps team','CFO / Finance','CIO / CDO'],i:['Current state','Hindsight','Value'],c:['Commercial commitments','All cost domains'],a:['Product / use case','Workspace / platform','Organization'],e:['Multi-workspace','Region / cloud','Global / all'],x:['Visibility','Govern','Plan'],caveat:'Not every credit, commitment or savings-plan detail is exposed by system tables.'},
  {n:'New Relic Databricks Integration',scope:'Community',ready:'Specialist',url:'https://github.com/newrelic/newrelic-databricks-integration',summary:'Billing, job/run, failure, repair, serving and Vector Search costs in New Relic.',updated:'v4.4.0 · Aug 2026',s:['Platform team','FinOps team','Data engineer'],i:['Current state','Hindsight','Optimization'],c:['Compute','Pipelines','Model serving','Vector / RAG'],a:['Workspace / platform','Job / query / endpoint'],e:['Production','Multi-workspace'],x:['Visibility','Optimize']},
  {n:'Databricks Apps Monitor',scope:'Community',ready:'Preview / demo',url:'https://github.com/Paldom/databricks-apps-monitor',summary:'Per-app compute and AI cost, budgets, burn alerts, forecasts, auto-stop and team chargeback.',updated:'Very new · Sep 2026 · MIT',s:['Platform team','FinOps team','AI product owner'],i:['Current state','Foresight','Optimization','Prevention'],c:['Compute','AI tokens & models'],a:['Product / use case','Team','User'],e:['Production','Multi-workspace'],x:['Visibility','Control','Optimize','Plan']},
  {n:'Databricks Cost Optimizer',scope:'Community',ready:'Specialist',url:'https://github.com/kylehuirevvision/databricks-cost-optimizer',summary:'Read-only audit for warehouse idle time, sizing, unused Apps, failed jobs and untagged spend.',updated:'Repo pushed · Aug 2026 · MIT',s:['Platform team','FinOps team','Data engineer'],i:['Hindsight','Optimization','Prevention'],c:['Compute','SQL & BI','Pipelines'],a:['Workspace / platform','Team','Job / query / endpoint','User'],e:['Production','Multi-workspace'],x:['Visibility','Control','Optimize']},
  {n:'Crosshire Databricks Admin Audit',scope:'Community',ready:'Preview / demo',url:'https://github.com/darshanmeel/crosshire-audit-databricks-admin',summary:'Audit library spanning billing, query performance, job waste, storage, serving and Vector Search.',updated:'Low adoption · Jul 2026',s:['Platform team','FinOps team','Data engineer','AI product owner'],i:['Current state','Hindsight','Optimization','Prevention'],c:allLegacyCosts,a:['Workspace / platform','Job / query / endpoint','User'],e:['Production','Multi-workspace'],x:['Visibility','Optimize','Govern']},
  {n:'Databricks Cost Monitoring Queries',scope:'Community',ready:'Reference only',url:'https://github.com/AllAboutAzure/Databricks-Cost-Monitoring-Queries',summary:'SQL for Apps, foundation models, serving, tokens, SQL warehouses and Vector Search.',updated:'Repo pushed · Nov 2025 · 1 star',s:['AI product owner','FinOps team','Platform team'],i:['Current state','Hindsight'],c:['SQL & BI','AI tokens & models','Model serving','Vector / RAG'],a:['Product / use case','Job / query / endpoint'],e:['Production'],x:['Visibility'],caveat:'Replace fixed prices with effective-time price-table joins.'},
  {n:'Contract Burndown SQL',scope:'Community',ready:'Reference only',url:'https://gist.github.com/LaurentPRAT-DB/8f118de8331c6613a945a3a0266d5e24',summary:'SQL comparing cumulative consumption with contract value and elapsed-time pace.',updated:'Unversioned gist · Feb 2026',s:['FinOps team','CFO / Finance','CIO / CDO'],i:['Current state','Foresight'],c:['Commercial commitments','All cost domains'],a:['Organization'],e:['Global / all'],x:['Visibility','Plan']}
];
let solutionScope='All';
const allocationTags={
  'Organization / business unit':['Organization','Business unit'],
  'Team / product':['Team','Product / use case'],
  Workspace:['Workspace / platform'],
  'Workload / resource':['Job / query / endpoint'],
  User:['User']
};
function scoreAsset(asset){
  const area=productAreas[state.productArea],goal=goals[state.goal];
  const exactArea=area.costs.some(cost=>asset.c.includes(cost)&&cost!=='All cost domains');
  const broadArea=asset.c.includes('All cost domains');
  const exactCategory=asset.c.includes(state.productCategory);
  const broadCategory=state.productCategory!=='All cost domains'&&broadArea;
  const actionMatch=goal.actions.some(action=>asset.x.includes(action));
  const intentMatch=goal.intents.some(intent=>asset.i.includes(intent));
  const allocationMatch=allocationTags[state.allocation].some(level=>asset.a.includes(level));
  let score=exactCategory?40:broadCategory?25:0;
  const matched=[];
  if(exactCategory||broadCategory)matched.push('Product category');
  if(exactArea){score+=15;matched.push('Product area')}
  else if(broadArea){score+=10;matched.push('Product area')}
  if(actionMatch){score+=20;matched.push('FinOps action')}
  if(intentMatch){score+=15;matched.push('Decision outcome')}
  if(state.goal==='Allocate'&&allocationMatch){score+=10;matched.push('Allocation level')}
  score+=asset.ready==='Recommended'?10:asset.ready==='Specialist'?6:asset.ready==='Preview / demo'?2:0;
  return {asset,score:Math.min(100,Math.round(score)),matched};
}
function selectionText(){
  return [state.productArea,state.productCategory,state.goal,...(state.goal==='Allocate'?[state.allocation]:[])].join(' × ');
}
function renderSolutionMatches(){
  const ranked=solutionAssets.filter(a=>solutionScope==='All'||a.scope===solutionScope).map(scoreAsset).sort((a,b)=>b.score-a.score||a.asset.n.localeCompare(b.asset.n));
  const high=ranked.filter(r=>r.score>=80).length;
  $('#matchCount').textContent=`${Math.min(12,ranked.length)} / ${high}`;
  $('#matchSelection').textContent=selectionText();
  $('#scopeFilters').innerHTML=['All','Contact Databricks Team','Databricks public','Community'].map(x=>`<button class="${solutionScope===x?'active':''}" data-scope="${x}">${x}</button>`).join('');
  document.querySelectorAll('#scopeFilters button').forEach(b=>b.onclick=()=>{solutionScope=b.dataset.scope;renderSolutionMatches()});
  $('#solutionMatches').innerHTML=ranked.slice(0,12).map((r,index)=>{
    const a=r.asset,costs=a.c.slice(0,4).map(x=>`<span>${x}</span>`).join(''),actions=a.x.map(x=>`<span class="${goals[state.goal].actions.includes(x)?'selected':''}">${x}</span>`).join('');
    return `<article class="match-card">
      <div class="match-card-head"><span class="rank">${String(index+1).padStart(2,'0')}</span><div><h4>${a.n}</h4><p>${a.scope} · ${a.ready}</p></div><strong>${r.score}%</strong></div>
      <p class="match-description">${a.summary}</p>
      <p class="match-reason">Matches ${r.matched.join(', ')||'adjacent capabilities'}</p>
      <div class="match-tags">${costs}${actions}</div>
      ${a.caveat?`<p class="match-caveat">${a.caveat}</p>`:''}
      <div class="match-foot"><span>${a.updated}</span>${a.scope==='Contact Databricks Team'?'<span class="internal-contact">Contact your Databricks Account team</span>':`<a href="${a.url}" target="_blank" rel="noopener">Open solution ↗</a>`}</div>
    </article>`;
  }).join('');
}
function renderSelectors(){
  const visible=state.goal==='Allocate'?[...dimensions,allocationDimension]:dimensions;
  $('#selectors').innerHTML=visible.map(d=>`<label class="selector ${d.key==='allocation'?'conditional-selector':''}"><span>${d.label}</span><select data-key="${d.key}">${d.values.map(v=>`<option ${state[d.key]===v?'selected':''}>${v}</option>`).join('')}</select><small>${d.hint}</small></label>`).join('');
  document.querySelectorAll('.selector select').forEach(el=>el.onchange=e=>{
    state[e.target.dataset.key]=e.target.value;
    if(e.target.dataset.key==='productArea')state.productCategory=defaultCategoryByArea[state.productArea];
    if(e.target.dataset.key==='goal')renderSelectors();
    if(e.target.dataset.key==='productArea')renderSelectors();
    render();
  });
}
function groupExpression(){
  return {
    'Organization / business unit':"COALESCE(u.custom_tags['business_unit'], CAST(u.account_id AS STRING), 'untagged')",
    'Team / product':"COALESCE(u.custom_tags['product'], u.custom_tags['owner'], 'untagged')",
    Workspace:"CAST(u.workspace_id AS STRING)",
    'Workload / resource':"COALESCE(u.usage_metadata.job_id, u.usage_metadata.endpoint_name, u.usage_metadata.warehouse_id, u.usage_metadata.cluster_id, 'unmapped')",
    User:"COALESCE(u.identity_metadata.run_as, 'unknown')"
  }[state.allocation];
}
function buildSql(){
  const area=productAreas[state.productArea],goal=goalData[state.goal],group=groupExpression(),label=state.allocation.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  return `-- Starter query: ${state.productArea} / ${state.productCategory} list-price cost by ${state.allocation}
-- FinOps goal: ${state.goal}
-- ${goal.sql}
-- Replace list price with contracted-rate logic for booked-cost reporting.
WITH priced_usage AS (
  SELECT
    u.usage_date,
    ${group} AS allocation_key,
    u.sku_name,
    u.usage_quantity,
    u.usage_unit,
    u.custom_tags,
    u.usage_metadata,
    u.usage_quantity * p.pricing.effective_list.default AS list_cost
  FROM system.billing.usage u
  LEFT JOIN system.billing.list_prices p
    ON u.cloud = p.cloud
   AND u.sku_name = p.sku_name
   AND u.usage_start_time >= p.price_start_time
   AND (u.usage_end_time <= p.price_end_time OR p.price_end_time IS NULL)
  WHERE u.usage_date >= current_date() - INTERVAL ${goal.lookback} DAYS
    AND u.record_type IN ('ORIGINAL', 'RETRACTION', 'RESTATEMENT')
    AND (${area.filter})
)
SELECT
  usage_date,
  allocation_key AS ${label},
  ROUND(SUM(list_cost), 2) AS list_cost,
  ROUND(SUM(CASE WHEN allocation_key IN ('untagged','unmapped')
                 THEN list_cost ELSE 0 END), 2) AS unallocated_cost,
  ROUND(SUM(list_cost) / NULLIF(SUM(usage_quantity), 0), 4) AS cost_per_usage_unit
FROM priced_usage
GROUP BY usage_date, allocation_key
ORDER BY usage_date DESC, list_cost DESC;`;
}
function solution(){
  const area=productAreas[state.productArea],goal=goals[state.goal];
  const allocation=state.goal==='Allocate'?` Allocate results at the ${state.allocation.toLowerCase()} level.`:'';
  return {title:`${state.goal} · ${state.productCategory}`,summary:`Build a ${goal.headline.toLowerCase()} capability for ${state.productCategory.toLowerCase()} within ${state.productArea}. Measure ${area.unit}. ${goal.description}${allocation}`,c:area,a:goal,intent:[goal.headline,goal.description]};
}
function list(id,items){$(id).innerHTML=items.map(x=>`<li>${x}</li>`).join('')}
function render(){
  const s=solution(),owner=ownerByArea[state.productArea];
  $('#blueprintTitle').textContent=s.title;
  $('#blueprintSummary').textContent=s.summary;
  $('#fitBadge').textContent=`${state.productCategory} · ${state.goal}`;
  $('#selectionText').textContent=selectionText();
  const flows=[['INGEST','Usage + prices',s.c.tables.slice(0,2).join(' + ')],['ENRICH','Context + telemetry','Ownership and workload evidence'],['DECIDE',s.intent[0],s.c.unit],['ACT',state.goal,s.a.outputs[0]]];
  $('#flow').innerHTML=flows.map(f=>`<div class="flow-item"><span>${f[0]}</span><strong>${f[1]}</strong><p>${f[2]}</p></div>`).join('');
  list('#dataFoundation',[...s.c.tables,`Gold fact table at daily + ${state.allocation.toLowerCase()} grain`]);
  list('#decisionLogic',[...s.a.logic,`Primary unit metric: ${s.c.unit}`]);
  list('#controls',s.a.controls);
  list('#outputs',s.a.outputs);
  const requiredFor={'Organization / business unit':'business_unit','Team / product':'product',Workspace:'environment','Workload / resource':'product',User:'owner'}[state.allocation];
  $('#tagTable').innerHTML=tagBase.map(t=>`<tr><td>${t[0]}</td><td>${t[1]}</td><td class="${t[2]==='Yes'||t[0]===requiredFor?'required':'optional'}">${t[2]==='Yes'||t[0]===requiredFor?'Required':'Optional'}</td><td>${t[3]}</td></tr>`).join('');
  $('#tagEnforcement').textContent='Define allowed values centrally. Require cost_center, business_unit, product, owner and environment in cluster policies, job/Asset Bundle templates, SQL warehouse conventions, serving endpoint configuration and serverless budget policies. Reject deployments with missing tags in CI; report runtime coverage from system.billing.usage.custom_tags.';
  $('#sqlIntro').textContent=`Starter SQL for ${s.c.unit}. It preserves billing corrections and uses effective list prices.`;
  $('#systemTables').innerHTML=[...s.c.tables,...goalData[state.goal].sources].map(x=>`<span>${x}</span>`).join('');
  $('#sqlCode').textContent=buildSql();
  $('#sqlNote').textContent=s.c.extra;
  const steps=[
    ['Create the governed cost schema',`Grant the FinOps service principal access to ${s.c.tables.slice(0,2).join(' and ')}; create bronze views and a curated gold cost fact.`],
    ['Publish and enforce the tag contract','Version allowed tag keys and values. Add policy defaults, CI validation and an explicit exception path.'],
    ['Add product-area telemetry',s.c.extra],
    ['Deliver the decision surface',`Create the ${state.goal.toLowerCase()} dashboard, workflow or policy with an owner and response action—not charts alone.`],
    ['Operate the feedback loop','Review allocation gaps and exceptions weekly; compare realized results with the original baseline and update rules.']
  ];
  $('#deliverySteps').innerHTML=steps.map(x=>`<li><strong>${x[0]}</strong><p>${x[1]}</p></li>`).join('');
  $('#ownerText').textContent=owner[0];$('#ownerReason').textContent=owner[1];
  const sourceKeys=['billing','monitor','tags',s.c.github,'examples'];
  $('#sourceCards').innerHTML=[...new Set(sourceKeys)].map(k=>{const x=sources[k];return `<a class="source-card" href="${x.url}" target="_blank" rel="noopener"><span class="source-type">${x.type}</span><h4>${x.title}</h4><p>${x.summary}</p><span class="url">${x.url}</span></a>`}).join('');
  renderSolutionMatches();
}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1500)}
async function copy(text,message){try{await navigator.clipboard.writeText(text);toast(message)}catch{window.prompt('Copy',text)}}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button,.tab-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
$('#copySql').onclick=()=>copy($('#sqlCode').textContent,'SQL copied');
document.querySelector('[data-copy="tagTable"]').onclick=()=>copy(tagBase.map(t=>t.join('\t')).join('\n'),'Tag contract copied');
$('#copyBtn').onclick=()=>{const s=solution(),owner=ownerByArea[state.productArea];copy(`DATABRICKS FINOPS BLUEPRINT

${s.title}
${s.summary}

Selection: ${selectionText()}

SYSTEM TABLES
${s.c.tables.join('\n')}

TAG CONTRACT
${tagBase.map(t=>t.join(' | ')).join('\n')}

STARTER SQL
${buildSql()}

OWNER
${owner[0]} — ${owner[1]}

SOURCES
${[sources.billing,sources.monitor,sources.tags,sources[s.c.github],sources.examples].map(x=>x.url).join('\n')}`,'Blueprint copied')};
$('#resetBtn').onclick=()=>{state={...defaults};solutionScope='All';renderSelectors();render()};
renderSelectors();render();
