
QSAFE Nepal — Proposal-Grounded Structure Overview

Source: QSAFE_Nepal_Proposal.pdf (Tribhuvan University, Sagarmatha Engineering College, June 2026) Scope: This document describes what the proposal proposes. It makes no claim about what any codebase currently implements. Every claim below is tagged:

[Explicit] — the proposal states this directly.
[Derived] — not stated in these exact words, but follows unambiguously from multiple proposal sections.
[Ambiguous] — the proposal is internally inconsistent or unclear; both readings are given, unresolved.
[Not specified] — the proposal does not provide enough information; no invention is offered.

1. Project Identity
   Title [Explicit]: "QSAFE Nepal: A Multilingual Earthquake Response Assistant using Retrieval-Augmented Generation."
   Institution [Explicit]: Department of Electronics and Computer Engineering, Sagarmatha Engineering College, Tribhuvan University, Institute of Engineering.
   Type [Explicit]: Undergraduate minor project, 4-person team, submitted June 2026, scoped to an 8-week timeframe (per Gantt chart, June–August 2026).
   Delivery form [Explicit]: A "mobile-friendly Progressive Web Application (PWA)."
2. Problem and Purpose

Core problem [Explicit], three parts:

Language and literacy barriers — official disaster materials are in English or formal Nepali; ~44.6% of Nepal's population speaks Nepali as a first language, the remainder speak 120+ other languages/dialects; no deployed app offers intent-based query support in simplified Nepali for low-literacy users.
Unverified AI responses in safety-critical contexts — general LLM assistants can hallucinate; a response contradicting NDRRMA protocol could cause harm.
Internet connectivity dependency — Nepal's telecom infrastructure can fail during/after major seismic events; cloud-dependent apps become unavailable exactly when needed.

Purpose [Explicit]: Combine document-grounded retrieval, bilingual query support, and partial offline functionality into one system for Nepal's seismic and linguistic context.

3. Project Objectives

[Explicit], verbatim scope, two objectives stated:

"To develop an adaptive, offline-first assistant that provides cross-lingual, multilingual support when online, while guaranteeing a robust bilingual (English/Nepali) fallback system when completely offline."
"To develop an offline-first PWA for emergency contacts, safety guidelines, and damage reporting, while integrating live USGS API telemetry to verify real-time seismic events when online."

[Ambiguous] — "multilingual" vs "bilingual": The title and Objective 1 use "multilingual" / "cross-lingual" for the online mode, but every concretely specified component elsewhere in the proposal (the NLP section, the Localized Intent Dataset, the functional requirements, the abstract) defines exactly two languages: English and Nepali. The proposal does not name any third language or provide any mechanism for a language beyond English/Nepali. Treat "multilingual" as the document's aspirational/title-level framing; treat "bilingual English/Nepali" as the only concretely scoped language pair.

4. Target Users

[Derived]: Nepali citizens seeking earthquake safety information and reporting tools, including rural/low-literacy users and users with intermittent or no connectivity (drawn from the Problem Statement and Objectives). The proposal also defines a second user class:

[Explicit]: An "ADMIN" actor (Use Case Diagram, §4.8) responsible for uploading safety documents, training/updating the NLP model, deploying model updates, and generating reports.

5. Proposed Functional Features

[Explicit], from §1.4, five named features:

A Bilingual Safety Bot — chat interface answering safety queries in English and Nepali, using only verified NDRRMA manual data.
Damage Reporter — a form for structural damage reports (e.g., cracks, gas leaks), stored locally and synced when online.
Offline Emergency Directory — preloaded emergency contacts (100, 102, 16666) and shelter locations, accessible without internet.
User-Friendly Interface — for inputting emergency queries and receiving verified safety responses.
Live Earthquake Verifier — real-time tracking via the USGS API to detect active tremors, verify ongoing emergencies, and "spot local crises based on sudden spikes in user searches."

[Ambiguous] — "spot local crises based on sudden spikes in user searches": This phrase in the Live Earthquake Verifier feature implies some analysis of query-volume patterns to detect crises. No mechanism, threshold, or algorithm for this is defined anywhere else in the proposal (not in the NLP section, not in Methodology, not in the ER diagram). Not specified beyond this one sentence.

6. High-Level System Structure

[Explicit]: The proposal explicitly structures the system into three top-level sections (§4.1): Input Section, Processing Section, Output Section. This tripartite structure is the proposal's own stated architecture and is used as the organizing structure below rather than an invented alternative.

QSAFE Nepal
│
├── Input Section
│   ├── Multilingual Query Input
│   ├── Structured Damage Report Form
│   ├── Unstructured Text and Metadata
│   └── Pre-loaded Emergency Contacts
│
├── Processing Section
│   ├── Network Gate Routing (Navigator.onLine)
│   ├── Local NLP and Storage (offline path)
│   ├── Background Syncing
│   ├── Backend API Gateway
│   ├── Vector Search Indexing
│   ├── External Telemetry Gathering (USGS)
│   └── Context Assembly and Inference
│
└── Output Section
    ├── Verified Safety Response
    ├── Visual Confidence Indicators
    ├── Traceability and Transparency
    ├── Damage Report Confirmation
    └── Offline Emergency Directory (output/access side)
7. Component-by-Component Overview
7.1 Multilingual Query Input
Purpose [Explicit]: Entry point accepting user queries in English or "local scripts," including "fragmented, distressed input."
Inputs: Free-text user input.
Processing [Explicit]: Described only as accepting/accommodating ambiguous, fast-typed, or stressed input; no specific processing algorithm given here (that is covered under NLP, §9 below).
Outputs: Raw query text passed downstream.
Dependencies [Derived]: Feeds into Text Preprocessing / Language Detection / Intent Classification.
Online/Offline status [Explicit]: Not connectivity-restricted at the input stage itself; downstream processing differs by connectivity state (see §8).
Evidence: §4.1.1.
Confidence: Explicit (existence and purpose); Not specified (exact input validation logic).
7.2 Structured Damage Report Form
Purpose [Explicit]: Captures damage data: location (district or GPS), damage type (e.g., cracks, collapse), severity level, optional descriptions, "optimized for rapid mobile entry."
Inputs: User-entered structured fields.
Processing [Explicit]: "Intelligent validation to guide users in providing precise details" — no further detail on what this validation logic is.
Outputs: A structured damage report record.
Dependencies [Derived]: Feeds Local Device SQLite Logging (offline write path) and, per the ER diagram, the DAMAGE_REPORT entity.
Online/Offline status [Explicit]: Explicitly functions offline — "captured... stored locally and synced when online" (§1.4).
Evidence: §1.4, §4.1.1, Table 4.4.
Confidence: Explicit (existence, stored fields); [Ambiguous] on severity labeling — §4.1.1 describes "severity level (minor to severe)" while Table 4.4 defines the field as "Low / Medium / High." The proposal does not reconcile these two phrasings of the same field.
7.3 Unstructured Text and Metadata
Purpose [Explicit]: Collects emergency reports, location names, contextual details, plus automatic metadata (timestamps, available location data) "to support accurate incident tracking."
Processing [Explicit]: Proposal states this supports "indexing free-text reports for later analysis" alongside using metadata "for real-time geospatial mapping of disaster zones" — no indexing method or mapping mechanism is defined.
Evidence: §4.1.1.
Confidence: Explicit (existence/purpose); Not specified (indexing/mapping mechanism).
7.4 Pre-loaded Emergency Contacts
Purpose [Explicit]: Embeds critical helpline numbers (Police, Ambulance, Disaster Management) and shelter locations directly into the app for offline access.
Online/Offline status [Explicit]: Offline — "instant access even when offline," cached locally.
Evidence: §1.4, §4.1.1, §4.1.3 (Offline Emergency Directory helplines: Police 100, Ambulance 102, NDRRMA 16666).
7.5 Network Gate Routing (Navigator.onLine)
Purpose [Explicit]: At the front of the client application, checks internet status and routes user actions into one of: direct online path, offline read path, or offline write path.
Evidence [Explicit]: §4.1.2, Figure 4.1 (labeled "Navigator.onLine Network Gate," "Client-Side (Browser)").
Confidence: Explicit.
7.6 Local NLP and Storage
Purpose [Explicit]: When offline, the offline read path routes queries to a "local NLP intent classifier" for language detection and intent categorization on-device; the offline write path stores submitted forms in a local WebAssembly SQLite database (sql.js).
Evidence: §4.1.2, Figure 4.1.
Online/Offline status [Explicit]: Offline (this is explicitly the offline path's processing).
[Ambiguous] — where NLP.js actually executes: Figure 4.1 places "Local NLP Intent Classifier" inside a box explicitly labeled "Client-Side (Browser)." Separately, §1.5.1 (Technical Feasibility) describes NLP.js as something that "runs within Node.js without requiring GPU resources," which more naturally implies server-side/Node execution. §3.9.1 states NLP.js "is compiled to run directly within the browser cache," which supports the client-side reading. The proposal does not clearly reconcile whether NLP.js executes as a Node.js backend service or as an in-browser/client compiled module — both framings appear across different sections. This is treated here as a genuine, unresolved ambiguity, not decided either way.
7.7 Background Syncing
Purpose [Explicit]: When connectivity returns, an "async uplink sync" process reads pending records from the local client database and pushes them to backend servers.
Evidence: §4.1.2, Figure 4.1.
Online/Offline status [Explicit]: Triggered by transition to online.
7.8 Backend API Gateway
Purpose [Explicit]: Server-side ingestion point handling incoming real-time traffic from connected clients and batch uploads from offline synchronization.
[Ambiguous] — Express.js vs FastAPI: Figure 4.1 and §4.1.2 both label this gateway generically as "Express.js / FastAPI Gateway" — the proposal itself presents these as an either/or without resolving which framework performs this role. Separately, §3.9.2 describes Node.js + Express.js as the backend that "manages the routing matrix of the hybrid cloud pipeline, handling inbound API requests, executing document retrieval sequences, and communicating with the vector search database" — i.e., it assigns Express.js the same retrieval/vector-DB responsibilities that §3.9.3 assigns to FastAPI ("deployed on the cloud-hybrid tier to expose the heavy linguistic components of the... RAG pipeline... orchestrating vector similarity computations and managing the prompt injection layer"). The proposal does not specify a clear division of responsibility between these two frameworks; both are described handling retrieval/vector-DB/RAG-adjacent duties. Requires project-team clarification — not resolved here.
Evidence: §3.9.2, §3.9.3, §4.1.2, Figure 4.1.
7.9 Vector Search Indexing
Purpose [Explicit]: For incoming knowledge queries, the gateway sends text to the "embedding and vector search engine," which converts text to vectors and executes semantic search against ChromaDB.
Evidence: §4.1.2, §3.2.2, §3.4.
Online/Offline status [Explicit]: Online only — this is part of the RAG pipeline, which §3.5.2 states is unavailable in Degraded and Offline modes.
7.10 External Telemetry Gathering (USGS)
Purpose [Explicit]: A "dedicated REST API client" regularly polls the USGS real-time API to pull the latest earthquake data and coordinates, in parallel to the text search pipeline.
Evidence: §4.1.2, §3.8, §3.9.4.
Processing [Explicit]: Node-cron triggers Axios on a schedule; Axios fetches live GeoJSON data from earthquake.usgs.gov; the backend "applies the geographic boundaries to see if a tremor hit Nepal" (i.e., filters to Nepal).
[Explicit, and notable]: §3.6 explicitly states this USGS data path "skips the AI embedding process entirely and is checked directly using geographic coordinates" — i.e., USGS data does not go through the embedding/ChromaDB pipeline; it is a separate, parallel data path.
7.11 Context Assembly and Inference
Purpose [Explicit]: A "context assembler" merges semantic document fragments retrieved from ChromaDB with live USGS telemetry; this bundle is sent to the Gemini 2.0 API to generate a response.
Evidence: §4.1.2, Figure 4.1.
[Not specified]: No detail is given on how USGS telemetry is actually incorporated into a safety-query response's text (as opposed to being available as raw data) — the merging logic itself is not described beyond "merges."
7.12 Verified Safety Response
Purpose [Explicit]: Output derived exclusively from NDRRMA documents, with explicit attribution (Document Section, Page, Topic) for independent verification.
Evidence: §4.1.3, §1.6.4(b), §1.6.4(g).
7.13 Visual Confidence Indicators
Purpose [Explicit]: Responses scoring ≥0.70 display a green checkmark labeled "Verified Response"; below that, a yellow warning labeled "Information Not Verified - Contact Authorities."
Evidence: §4.1.3.
[Ambiguous] — relationship to other thresholds: See §9's threshold discussion; the proposal uses the number 0.70 in two places (this display threshold and the NLP.js classifier's Ct in §3.11.5) without explicitly stating they are the same threshold applied at the same pipeline stage, or two independent thresholds that happen to share a value.
7.14 Traceability and Transparency
Purpose [Explicit]: Responses include hyperlinks to source NDRRMA sections "where available," clarifying the system provides official government guidance rather than independent recommendation.
Evidence: §4.1.3.
7.15 Damage Report Confirmation
Purpose [Explicit]: Users receive a confirmation: "Your report is saved locally. ID: [ID]. Syncs automatically when online," with reports carrying unique IDs, timestamps, and location data.
Evidence: §4.1.3.
7.16 Offline Emergency Directory (output/access)
Purpose [Explicit]: Pre-cached, searchable access to helplines (Police: 100, Ambulance: 102, NDRRMA: 16666), district agency contacts, and shelter locations.
Evidence: §4.1.3, §1.4.
8. End-to-End Data Flow
8.1 General flow (Algorithm, §4.4) — [Explicit]
Accept natural language text input or incident report.
Preprocess the input string (remove noise, normalize character sets across both supported language frameworks).
Pass cleaned text to the NLP engine to classify intent.
Evaluate whether the intent requires a real-time safety informational response or local emergency logging.
If emergency report: route to client-side datastore to log location coordinates and structural damage parameters on-device.
If safety query: query the localized vector repository for the most relevant reference chunks from the safety manual.
Forward retrieved safety context plus the original query to the response generation layer.
Display the final verified safety answer, or output the database sync status.
8.2 Safety Query flow — [Explicit, from §3.2 + Figure 4.3]
User Query
→ Text Preprocessing & Script Normalization
→ Conversational Intent Mapping + Language Tracking/Script Extraction
→ Unified Core Request Categorization
→ System Request Routing Layer
→ RAG Retrieval & Context Grounding
    (query embedded via text-embedding-004 → cosine-similarity search against ChromaDB)
→ [if similarity score ≥ threshold] retrieved chunks passed to Gemini 2.0 as context
→ Hallucination Validation Module
→ Final Verified Answer (with source attribution)
→ [if similarity score < threshold] fallback message, no LLM generation

[Not specified]: The exact numeric similarity threshold for retrieval (§1.6.4(c) calls it "a defined threshold" without stating the value). The proposal's only explicit numeric threshold values (0.70) appear attached to the NLP.js intent classifier (§3.11.5) and the output confidence display (§4.1.3), not explicitly to this retrieval-similarity step.

8.3 Emergency/Damage Report flow — [Explicit, from Algorithm + Figure 4.3]
User Input (Damage Report Form / distress message)
→ Text Preprocessing & Script Normalization
→ Intent Classification (routed as Emergency/Damage Request)
→ Local Device SQLite Logging (sql.js) — coordinates, damage type, severity, timestamp, report ID
→ Confirmation shown to user ("saved locally, ID: [ID]")
→ [when connectivity returns] Background Sync (async uplink) pushes pending records to backend
8.4 What the proposal does NOT specify about these flows
No JSON/schema for the message passed between NLP and the routing layer.
No specific conflict-resolution behavior if a synced report collides with existing backend data.
No specification of retry/backoff behavior for failed syncs beyond Axios "strict timeouts to trigger the local offline fallback if communication towers fail" (§3.10.3) — a general statement, not a protocol.
9. Online / Degraded / Offline Architecture

[Explicit] — the proposal explicitly defines exactly three connectivity states (§3.5.2):

State	What's available [Explicit]
Online	"Full RAG pipeline is available; both modules are fully active."
Degraded	"Emergency directory and cached safety rules are available; the RAG pipeline is unavailable."
Offline	"Emergency directory and damage report storage are accessible; no server communication takes place."

[Not specified]: The proposal does not define the technical trigger distinguishing "Degraded" from "Offline" (e.g., is Degraded a slow/partial connection vs. Offline being no connection at all?), nor does it specify what "cached safety rules" contains as distinct from the full RAG pipeline's document set.

[Derived]: Since USGS telemetry (§3.6, §4.1.2) is explicitly part of the online backend path (fetched server-side via Node-cron/Axios) and is not mentioned in the Degraded or Offline state descriptions, it is reasonable to infer USGS/Live Earthquake Verifier functionality is Online-only — but the proposal does not state this explicitly for the Degraded/Offline states, so this is marked Derived, not Explicit.

10. NLP and Intent Classification

[Explicit], §3.3, three stated functions of NLP.js:

Language Detection — determines English vs. Nepali using character n-gram frequency profiles; Devanagari script range (U+0900–U+097F) as "an additional reliable signal."
Intent Classification — assigns queries to one of a predefined set of intent categories using "a combination of a Naïve Bayes classifier and pattern matching," trained on domain-specific example sentences. Two primary intents are explicitly named: Safety Query and Emergency/Damage Request.
Entity Extraction — identifies named entities (location, damage type, e.g. "structural crack") used to route damage reports.

[Explicit] — why NLP.js was chosen (§3.3): No GPU required; runs within Node.js without a separate microservice; sufficient for a two-intent classification task; chosen over transformer alternatives (mBERT, XLM-R).

[Ambiguous] — intent label naming: The proposal uses several slightly different labels for the same two intents across sections: "Safety Query" / "Emergency/Damage Request" (§1.4, §3.3); "SAFETY_QUERY" / "EMERGENCY_REPORT" (§4.3(c), underscored form); "Emergency Report" (Table 4.5). These appear to refer to the same two concepts, but the proposal does not declare one canonical label set.

Confidence threshold [Explicit, §3.11.5]: Ct = 0.7 (70%), explicitly described as belonging to "the bilingual NLP.js classifier." Formally:

Final Intent = argmax_k P(I_k | X),  if max_k P(I_k | X) ≥ 0.7
             = "Unknown / Fallback", if max_k P(I_k | X) < 0.7

Confidence: Explicit — this is the only intent-classification threshold value given anywhere in the proposal.

Relationship to offline functionality [Explicit, Figure 4.1]: The local NLP intent classifier operates on the offline read path, i.e., it is available for on-device intent categorization without connectivity.

[Not specified]: No dataset size split (train/val/test) for the 200-phrase Localized Intent Dataset beyond the class-count table in §4.3.1 (see §11 below); no confusion-matrix or per-intent performance figures; no description of what happens after a fallback beyond "route to fallback."

11. RAG / Safety Information Flow

[Explicit] — Data Ingestion Phase (§3.2.1):

NDRRMA Earthquake Safety Manual is loaded; text is extracted.
Extracted text is divided into overlapping chunks (to avoid losing context at section boundaries).
Each chunk is converted into a dense vector embedding using Google's text-embedding-004 model via the Gemini API.
Embeddings and associated text chunks are stored in ChromaDB, along with metadata recording source document, page number, and section title.

[Explicit] — Query-Time Retrieval and Generation Phase (§3.2.2):

User query is converted to a vector embedding using the same model.
A similarity search is performed against the ChromaDB index (cosine similarity, §3.4, Eq. 3.1) to find the most semantically similar chunks.
If the similarity score of the top result meets "a defined confidence threshold," retrieved chunks are passed as context to the LLM (Gemini 2.0 Flash), which generates a response "using only the provided context."
If the score falls below the threshold, a fallback message is returned without LLM generation — no unverified answer is produced.
Every response is linked to a specific retrieved document chunk ("traceability"), verifiable against the source.

[Ambiguous] — embedding method: §3.6 states embeddings are generated via Google's text-embedding-004 API for both document chunks and queries, and describes this as the sole embedding mechanism for the NDRRMA manual search path. However, §3.10.2 (library list) separately describes the Transformers library as the component that "converts raw user text into high-dimensional numerical vectors during the semantic similarity analysis step of the RAG pipeline" — which implies a local/open-source transformer-based embedding step, distinct from (and not reconciled with) the Gemini API embedding described in §3.6. The proposal does not clarify whether Transformers is a redundant/alternative embedding path, a mislabeling, or performs some other unstated role. Requires project-team clarification.

[Not specified]: The exact numeric similarity threshold value for retrieval (distinct from the NLP.js Ct=0.7 discussed in §10); the chunk size/overlap parameters; the number of chunks retrieved per query (top-k value).

12. Offline-First Architecture

[Explicit], §3.5, two stated mechanisms:

Service Workers — a background browser script intercepting outgoing network requests; static assets and pre-loaded emergency data are cached on first load and served from cache on subsequent visits "regardless of connectivity status." (Library: Workbox, §3.10.1.)
Local Data Persistence — user-generated damage reports stored in a SQLite database running in-browser via WebAssembly (sql.js); when connectivity is detected, the app attempts to sync pending reports to the server.

[Explicit] — PWA definition (§3.5.2): "A web application that can be installed on a user's device from a browser without using an app store, and that supports service worker-based offline caching."

[Explicit] — LocalForage (§3.10.1): An asynchronous browser storage library wrapping IndexedDB/localStorage, used to "persist large application state files and offline database blobs" on-device.

[Not specified]: How Workbox, sql.js, and LocalForage divide responsibility from each other in practice (e.g., which specific data goes into sql.js's relational tables vs. LocalForage's blob storage) — both are named as offline-storage-adjacent libraries without an explicit boundary between them.

13. Emergency Directory

[Explicit]: A preloaded, offline-accessible list of emergency contacts — Police (100), Ambulance/Red Cross (102), NDRRMA (16666) — and shelter locations, embedded directly into the app (§1.4, §4.1.1, §4.1.3). ER diagram entity: EMERGENCY_DIRECTORY (directory_id PK, service_name, shelter_location, district) (§4.7).

Online/Offline status [Explicit]: Available in all three connectivity states (Online, Degraded, Offline) per §3.5.2.

14. USGS / External Data Integration

[Explicit]:

The USGS API is described as "the primary real-time data streaming layer, providing live seismic telemetry" (§1.1).
Live GeoJSON earthquake data (magnitude, timestamps, coordinates) is fetched via a REST API client (Node-cron scheduling + Axios requests, §3.9.4).
The backend "automatically reads this live stream and filters it so we only track tremors happening within Nepal" (§3.8).
USGS data explicitly bypasses the embedding/ChromaDB pipeline and is checked directly via geographic coordinates (§3.6).
ER diagram entity: USGS_EARTHQUAKE with fields for event ID, magnitude, place, latitude/longitude, depth, event time, tsunami flag, alert level, significance score, status, source URL, last updated (§4.7).

[Ambiguous / significant] — "predictive machine learning" claim: The Abstract states the system "includes a predictive machine learning script that hooks into live... USGS seismic data to simulate and map out real-time aftershock patterns across major Nepali cities as they happen." No section in the Related Theory (Ch. 3) or Methodology (Ch. 4) describes any predictive model, forecasting algorithm, simulation method, or aftershock-pattern logic. Section 3.9.4 (the only place the USGS-polling mechanism is technically described) covers only scheduled polling, GeoJSON fetching, and geographic filtering — not prediction or simulation. The USGS_EARTHQUAKE ER entity stores only raw/observed fields, no predicted or simulated fields. This is a proposal-internal gap: the Abstract makes a predictive-ML claim that the rest of the document does not define, describe, or provide a methodology for. Treated here as an unresolved ambiguity/gap, not as a confirmed system capability.

15. Data and Dataset Structure

[Explicit], §4.2 — exactly three data spaces are defined; no others are proposed:

15.1 NDRRMA Earthquake Safety Manual
Source: Official NDRRMA web portal (government of Nepal).
Purpose: Primary knowledge base for the RAG pipeline.
Format/type: Textual, bilingual (English/Nepali) corpus, split into discrete chunks.
Fields (Table 4.2): chunk_id, text_content, chapter_ref.
Static/dynamic: Static (a fixed manual, chunked and embedded once during ingestion).
Online/offline: Used online (queried via ChromaDB during the RAG pipeline, which is Online-only per §3.5.2).
Used for: Retrieval.
Volume (Table 4.6): English 120 chunks, Nepali 150 chunks — total 270 chunks.
15.2 Localized Intent Dataset
Source: Custom-curated by the project team.
Purpose: Training/evaluation corpus for the NLP.js intent classifier.
Format/type: Textual; utterance + intent label pairs (Table 4.3: utterance, intent).
Language: English and Nepali (Devanagari), roughly equal split.
Static/dynamic: Static.
Online/offline: Used to train the classifier; the trained classifier itself runs on the offline read path (§4.1.2) — see the NLP.js execution-environment ambiguity noted in §7.6/§10.
Used for: Training.
Volume (Table 4.5): Safety Query EN 50 / NE 50; Emergency Report EN 50 / NE 50 — total 200.
15.3 User-Generated Dynamic Dataset
Source: Generated at runtime by users (damage reports).
Purpose: Local, offline-first storage of field-submitted incident data.
Format/type: Relational, stored client-side via sql.js (WebAssembly SQLite).
Language: UTF-8 text.
Fields (Table 4.4): report_id (PK), coordinates, severity (Low/Medium/High — see §7.2 ambiguity re: wording), is_synced (0=pending offline, 1=synced).
Static/dynamic: Dynamic (grows as users submit reports).
Online/offline: Written offline; synced when connectivity returns.
Used for: Storage.

[Not specified]: Any dataset beyond these three (e.g., no separate "romanized Nepali" dataset, no separate code-mixed dataset, no seismicity/historical-earthquake CSV dataset is described as part of the proposed system's data architecture in Chapter 4, despite a Nepal seismicity CSV appearing as a figure/citation source in §4.2.1, Figure 4.2 — that figure illustrates general seismicity data provenance/context and is not defined in Chapter 4's dataset architecture as one of the three system data spaces the application itself ingests or serves from).

16. Storage Architecture

[Explicit]:

Client-side relational storage: sql.js (SQLite compiled to WebAssembly), running inside the browser.
Client-side blob/state storage: LocalForage (wraps IndexedDB/localStorage).
Server-side vector storage: ChromaDB, persisting on local disk (per §3.4: "persists on local disk without a cloud subscription").
Configuration/secrets storage: Dotenv, for backend credentials, API keys, and vector DB connection parameters (§3.10.3).

[Not specified]: Any conventional relational or document database on the backend/server side beyond ChromaDB (i.e., the proposal does not describe a separate backend SQL/NoSQL database distinct from the vector store) — this is not stated to exist, so it is not assumed to exist.

17. Frontend / PWA

[Explicit]:

Built with React.js + Vite (Table 1.2, §1.5.1).
Delivered as a Progressive Web Application, installable from a browser without an app store, using service-worker-based offline caching (§3.5.2).
Interface supports both free-text input and "pre-set query buttons... to accommodate users with limited typing experience" (§1.5.2).
Target end-user devices: any smartphone with Chrome 90+ (minimum), Android 8+ or iOS 13+ (recommended) — Table 1.3.

[Not specified]: Specific UI component names, page/route structure, or component hierarchy — none of these are defined in the proposal.

18. Backend / Processing Layer

[Explicit]:

Node.js + Express.js — described as managing "the routing matrix of the hybrid cloud pipeline," handling inbound API requests, document retrieval, and vector-DB communication (§3.9.2).
FastAPI (Python) — described as deployed "on the cloud-hybrid tier to expose the heavy linguistic components" of the RAG pipeline, interfacing with Python ML libraries, orchestrating vector-similarity computation and "managing the prompt injection layer" for the LLM (§3.9.3).
See §7.8 above for the unresolved ambiguity regarding how these two backend frameworks' responsibilities are actually divided — the proposal names both as performing overlapping RAG/vector-DB-adjacent duties without a clear boundary.

[Not specified]: Specific API route names, HTTP methods, or request/response JSON schemas — none of these are defined anywhere in the proposal.

19. External Services

[Explicit]:

Google text-embedding-004 — embedding model, accessed via the Gemini API, free-tier (§1.5.1, §3.6).
Google Gemini 2.0 Flash — the LLM used for grounded response generation, accessed via free-tier API (§1.5.1, §3.2.2, §4.1.2).
USGS API (earthquake.usgs.gov) — external REST API providing live GeoJSON seismic data (§3.8, §3.9.4).

[Not specified]: Any authentication/API-key management workflow beyond the general statement that Dotenv "safeguards... API keys... across development and deployment environments" (§3.10.3) — no specifics on key rotation, rate-limit handling, or provider fallback.

20. Component Relationships (Interfaces)

[Explicit and Derived, consolidated from §3.8, §4.1, Figure 4.1, and the ER diagram §4.7]:

Source	Destination	Purpose	Data exchanged (if specified)	Online/offline	Explicitness
User / PWA	Network Gate (Navigator.onLine)	Route request by connectivity	Raw query/report	Both	Explicit
Network Gate	Local NLP Intent Classifier	Offline intent classification	Query text	Offline	Explicit
Network Gate	Local SQLite (sql.js)	Offline damage-report write	Structured report	Offline	Explicit
Local SQLite	Backend (via sync)	Push pending records	Report records	Online (on reconnect)	Explicit
Frontend (React PWA)	Backend API Gateway	Submit online query/report	Query text / report data	Online	Explicit
Backend Gateway	Embedding & Vector Search Engine	Convert + search query	Query text → vector	Online	Explicit
Vector Search Engine	ChromaDB	Similarity search	Query vector	Online	Explicit
ChromaDB	Context Assembler	Return matched chunks	Chunk text + metadata + similarity score	Online	Explicit
Backend	USGS API	Poll live seismic data	REST/GeoJSON request-response	Online	Explicit
Context Assembler	Gemini 2.0 API	Generate grounded response	Assembled context + query	Online	Explicit
Gemini 2.0 API	User / PWA (Output Section)	Deliver verified response	Response text + attribution + confidence indicator	Online	Explicit

[Not specified]: Exact function signatures, endpoint paths/URLs (other than the named external USGS endpoint), or message payload schemas for any of the above interfaces.

21. Technology Stack

[Explicit] technologies named in the proposal, with the context each appears in:

Layer	Technology	Purpose (as stated)	Explicitly stated?
Frontend	React.js + Vite	UI framework/build tool	Yes (§1.5.1, §1.6.1)
Backend runtime	Node.js	JavaScript runtime for backend	Yes (§1.6.1, §3.9.2)
Backend framework	Express.js	Web framework / API routing	Yes (§3.9.2) — but see §7.8/§18 ambiguity vs. FastAPI
Backend framework (alt./parallel)	FastAPI (Python)	RAG-pipeline linguistic component exposure	Yes (§3.9.3) — see same ambiguity
NLP	NLP.js (node-nlp)	Language detection, intent classification, entity extraction	Yes (§1.5.1, §1.6.1, §3.3, §3.9.1)
Vector database	ChromaDB	Stores/searches document-chunk embeddings	Yes (§1.5.1, §1.6.1, §3.4)
Embedding model	Google text-embedding-004	Generates dense vector embeddings	Yes (§1.6.1, §3.6)
LLM	Google Gemini 2.0 Flash	Grounded response generation	Yes (§1.6.1, §3.2.2)
Local database	SQLite via sql.js	In-browser structured storage for damage reports	Yes (§1.6.1, §3.5.2, §3.10.1)
Offline storage	LocalForage	Wraps IndexedDB/localStorage for app state/blobs	Yes (§3.10.1)
Offline caching	Workbox	Service-worker caching/routing for PWA	Yes (§3.10.1)
RAG orchestration	LangChain	Automates NDRRMA document ingestion/chunking	Yes (§3.10.2)
Embedding (possible alt.)	Transformers (library)	"Converts raw user text into... vectors during semantic similarity analysis"	Yes, but see §11 ambiguity vs. text-embedding-004
HTTP client	Axios	Online API calls; USGS polling; timeout-based offline fallback trigger	Yes (§3.10.3, §3.9.4)
Scheduling	Node-cron	Periodic USGS polling trigger	Yes (§3.9.4)
Config/secrets	Dotenv	Environment variable / credential management	Yes (§3.10.2)
Version control	Git + GitHub	Source control	Yes (§1.6.1)
IDE	Visual Studio Code	Development environment	Yes (§1.6.1)

Note on theory-section technologies: All of the above appear in both the Feasibility/Requirements tables (Ch. 1) and the Related Theory / Methodology chapters (Ch. 3–4), i.e., they are named consistently across sections that describe intended architecture, not only in background/theory discussion. None of them are flagged here as "theoretical only," but the Express.js/FastAPI and text-embedding-004/Transformers overlaps noted above mean their exact runtime division of labor is not fully specified.

22. Expected Outputs

[Explicit], Chapter 5, verbatim list of expected outcomes:

Accurate classification/routing of user requests into informational or emergency tracks via localized NLP intent-mapping.
Seamless processing/normalization of text across English and native Devanagari scripts, preserving Unicode integrity.
Reliable local data logging of location coordinates and incident parameters into an offline, client-side database.
Grounded, hallucination-free responses to safety queries via NDRRMA-manual context extraction.
Effective performance in request routing and information retrieval, evaluated via classification accuracy, query latency, and database-synchronization success rate.
A user-friendly interface for inputting queries and visualizing safety guidelines alongside local report sync status.
23. Evaluation Metrics

[Explicit], §3.11: Accuracy, Precision, Recall, F1-Score (standard formulas, §3.11.1–3.11.4), applied to intent classification. Confidence Threshold Ct = 0.7 for the NLP.js classifier (§3.11.5, see §10). Usability is to be evaluated via the System Usability Scale (SUS) questionnaire with a small group of test participants (§1.6.5(c)).

[Not specified]: Any target/passing numeric value for accuracy, precision, recall, or F1 (no "must exceed X%" requirement is stated); any specific evaluation metric for the RAG pipeline's retrieval quality (e.g., no retrieval-precision or answer-faithfulness metric is defined, only the general "traceability" property).

24. Proposal-Level Ambiguities and Inconsistencies (Consolidated)
    Topic	Statement A	Statement B	Conflict	Treatment
    Backend framework	§3.9.2: Express.js handles routing, document retrieval, vector-DB communication	§3.9.3: FastAPI exposes "heavy linguistic components" of RAG, orchestrates vector similarity, manages LLM prompt injection	Both frameworks are assigned overlapping RAG/vector-DB responsibilities; §4.1.2 labels the gateway "Express.js or FastAPI" without choosing	Requires project-team clarification
    NLP.js execution environment	§1.5.1: "runs within Node.js"	§3.9.1 + Figure 4.1: "compiled to run directly within the browser cache" / placed in "Client-Side (Browser)" box	Unclear whether NLP.js is a server-side Node service or a client-compiled in-browser module	Requires project-team clarification
    Embedding mechanism	§3.6: embeddings generated only via Google text-embedding-004 (Gemini API)	§3.10.2: "Transformers" library "converts raw user text into... vectors during the semantic similarity analysis step"	Two different embedding mechanisms described for the same pipeline stage	Requires project-team clarification
    Multilingual vs. bilingual	Title + Objective 1: "multilingual," "cross-lingual"	NLP section, dataset, functional requirements: strictly English + Nepali only	Title-level framing implies more than two languages; every concrete component defines exactly two	Use the more explicitly/concretely defined statement (bilingual English/Nepali) for scoped features; retain "multilingual" only as title/aspirational framing
    Confidence threshold(s)	§1.6.4(c): unspecified "defined threshold" for RAG retrieval similarity	§3.11.5: Ct = 0.7 explicitly for the NLP.js intent classifier; §4.1.3: 0.70 also used for the output "Verified Response" display	Proposal never states whether these are the same 0.7 value reused across three pipeline stages, or three independent thresholds	Retain both readings with ambiguity noted
    Damage severity labeling	§4.1.1: "severity level (minor to severe)"	Table 4.4: "severity: Low / Medium / High"	Different wording for the same field, not reconciled	Retain both, note as the same field described two ways
    Intent label naming	§1.4/§3.3: "Safety Query," "Emergency/Damage Request"	§4.3(c): "SAFETY_QUERY," "EMERGENCY_REPORT" (underscored); Table 4.5: "Emergency Report"	Cosmetic naming variation across sections for the same two intents	Use the more explicitly defined statement (§1.4/§3.3 prose names) as the primary reference label
    Predictive aftershock claim	Abstract: "predictive machine learning script... to simulate and map out real-time aftershock patterns"	Ch. 3–4: no predictive/forecasting model, algorithm, or methodology described anywhere; §3.9.4 describes only polling + geographic filtering	The Abstract makes a capability claim the rest of the document does not support with any methodology	Requires project-team clarification — treat as an unresolved gap, not a confirmed feature
    §3.7 introductory paragraph	"Web technologies are used to enable interaction between users and the fake news detection system."	Rest of document is about an earthquake-response assistant, not fake-news detection	Appears to be a drafting/copy-paste artifact from an unrelated document template	Flagged as a proposal document error; not treated as a real system requirement
25. Explicitly Unspecified Architecture

The following are not defined anywhere in the proposal. Do not treat any of these as implied requirements:

Exact API routes, HTTP methods, or endpoint naming conventions.
Exact JSON request/response schemas for any interface.
Exact folder/module/file structure for frontend or backend code.
Exact database implementation details for any component beyond the named technologies (e.g., no ChromaDB collection schema beyond "text chunk + embedding + metadata: source doc, page number, section title").
Exact synchronization protocol (retry policy, conflict resolution, batching strategy) beyond "Axios... strict timeouts to trigger the local offline fallback."
Exact UI component structure or page/route layout.
Exact deployment configuration (hosting provider, containerization, CI/CD) — none is mentioned.
Exact model artifact structure/format for the trained NLP.js model.
Exact numeric similarity threshold for RAG retrieval (§1.6.4(c) only says "a defined threshold").
Any authentication or user-account system (the proposal explicitly states "No mandatory login shall be required for damage report submission," §1.6.5(d) — so an absence of login is stated, but no admin-authentication mechanism is specified either, despite an ADMIN actor being defined in §4.8).
Any specific algorithm or methodology for the Abstract's "predictive machine learning... aftershock" claim (see §24).
Any target numeric performance thresholds (e.g., minimum required accuracy).
26. Final Proposal-Grounded Architecture Diagram
                                   USER
                                    │
                          ┌─────────┴─────────┐
                          │   PWA / Browser    │
                          │ (React.js + Vite)  │
                          └─────────┬─────────┘
                                    │
                     ┌──────────────┴───────────────┐
                     │   Navigator.onLine Network    │
                     │            Gate                │
                     └──────┬──────────────┬─────────┘
                    Offline │              │ Online
                            ▼              ▼
          ┌─────────────────────────┐  ┌───────────────────────────┐
          │  Local NLP Intent        │  │   Backend API Gateway      │
          │  Classifier (NLP.js)     │  │   (Express.js / FastAPI —  │
          │  [execution environment  │  │    division of duties not  │
          │   ambiguous — see §24]   │  │    specified, see §24)     │
          └───────────┬──────────────┘  └──────────────┬─────────────┘
                       │                                 │
          ┌────────────┴───────────┐         ┌───────────┴────────────┐
          │  Local SQLite (sql.js) │         │ Embedding & Vector      │
          │  — damage reports,     │         │ Search Engine           │
          │  emergency directory   │         │ (text-embedding-004 /   │
          │  cache, LocalForage    │         │  Transformers — see     │
          │  app state             │         │  §24 ambiguity)         │
          └────────────┬───────────┘         └───────────┬────────────┘
                       │                                 │
              (sync when online)                         ▼
                       │                        ┌────────────────┐
                       │                        │    ChromaDB     │
                       │                        │ (NDRRMA manual  │
                       │                        │  chunks +       │
                       │                        │  embeddings)    │
                       │                        └────────┬────────┘
                       │                                 │
                       │                        ┌────────┴─────────┐
                       │                        │ Context Assembler │
                       │                        └────────┬─────────┘
                       │                                 │
                       │                        ┌────────┴─────────┐
                       │                        │ Gemini 2.0 Flash  │
                       │                        │  (grounded LLM    │
                       │                        │   generation)     │
                       │                        └────────┬─────────┘
                       │                                 │
                       ▼                                 ▼
             ┌───────────────────┐           ┌────────────────────────┐
             │ Damage Report      │           │ Verified Safety         │
             │ Confirmation /     │           │ Response + Confidence   │
             │ Offline Emergency  │           │ Indicator + Source      │
             │ Directory          │           │ Attribution             │
             └───────────────────┘           └────────────────────────┘

   Parallel, separate path (does not go through embeddings/ChromaDB — §3.6):

        USGS API ──(Node-cron + Axios polling)──▶ Nepal Geographic Filter
                                                          │
                                                          ▼
                                          Context Assembler (merged with
                                          RAG output during Online mode)

Diagram notes:

This diagram reflects only what §3–4 and Figure 4.1/4.3/4.5 of the proposal describe. Ambiguous framework/embedding assignments are labeled in-place rather than resolved.
No predictive/aftershock-simulation node is included, because no methodology for it is specified (see §14, §24).
27. Proposed vs. Not Confirmed as Implemented

Every component, feature, and technology in this document is described using "PROPOSED BY DOCUMENT" language. This document makes no claim, anywhere, that any part of this architecture currently exists in a codebase. Any future comparison against an actual codebase must independently verify implementation status — the proposal alone is not evidence of implementation.

28. Source Traceability Summary
    Section of this overview	Proposal section(s) used
    1–4 (Identity, Problem, Objectives, Users)	Abstract, §1.1–§1.3, §4.8
    5 (Features)	§1.4
    6–7 (Structure, Components)	§4.1, Figure 4.1
    8 (Data Flow)	§4.4, §4.5, Figure 4.3, §3.2
    9 (Connectivity states)	§3.5.2
    10 (NLP)	§3.3, §3.11.5
    11 (RAG)	§3.2, §3.4, §3.6, §3.10.2
    12 (Offline-first)	§3.5, §3.10.1
    13 (Emergency Directory)	§1.4, §4.1.1, §4.1.3, §4.7
    14 (USGS)	§1.1, §3.6, §3.8, §3.9.4, §4.7
    15 (Datasets)	§4.2, §4.2.1, §4.2.2, §4.3, §4.3.1
    16 (Storage)	§3.5.2, §3.4, §3.10.1, §3.10.3
    17 (Frontend)	§1.5.1, §1.5.2, §1.6.1, §1.6.2
    18 (Backend)	§3.9.2, §3.9.3
    19 (External services)	§1.5.1, §3.2.1, §3.2.2, §3.8, §3.9.4
    20 (Interfaces)	§3.8, §4.1, Figure 4.1, §4.7
    21 (Tech stack)	§1.5.1, §1.6.1, §3.9, §3.10
    22–23 (Outputs, Metrics)	Chapter 5, §3.11, §1.6.5(c)
    24 (Ambiguities)	Cross-referenced above
    25 (Unspecified)	Cross-referenced above
    26 (Diagram)	Figure 4.1, Figure 4.3, §3.2, §3.5.2, §3.6
29. Final Validation
    Every major claim above traces to a specific proposal section, cited inline.
    No proposed functionality is described as currently implemented (see §27).
    No API endpoints, JSON schemas, module names, or folder structures were invented (see §25 for the explicit list of what's absent).
    No contradiction (Express.js/FastAPI, NLP.js execution environment, embedding mechanism, predictive-aftershock claim, multilingual/bilingual framing) was silently resolved — all are listed in §24 with "Requires project-team clarification" or "retain both readings."
    Theoretical/library-list technologies (e.g., Transformers, LangChain) are presented with the same evidentiary weight as feasibility-table technologies, and their overlaps/conflicts are flagged rather than smoothed over.
    Online/Degraded/Offline behavior is stated exactly as the proposal defines it (§3.5.2), with no added connectivity states.
    Only the two proposal-named intents (Safety Query, Emergency/Damage Request) appear — no additional intents were introduced.
    RAG description matches §3.2 exactly, including the "no LLM generation on fallback" behavior.
    USGS functionality matches §3.6/§3.8/§3.9.4, including the explicit statement that USGS data bypasses embeddings.
