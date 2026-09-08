# 🏥 PillSync: Master Production Hardening & Enterprise Architectural Specification (RC1 $\rightarrow$ v1.0.0 Production GA)

**Document Type:** Enterprise Engineering Hardening Specification & Systems Blueprint  
**Authors:** Principal Healthcare Systems Engineer, Enterprise Software Architect, Lead Clinical AI Scientist  
**Target Release:** v1.0.0 General Availability (GA)  
**Scope:** Elimination of the 11.7% Delta without Source Code Disruption (Architecture, Protocols, State Machines, Mathematical Formulations, Schemas & Multi-Agent Specifications)

---

## 1. REVERSE ARCHITECTURE & CONTRACT SPECIFICATION

### 1.1 Idempotency & Distributed Concurrency Strategy

#### A. The Concurrency Hazard Under Real-World Network Jitter
In chronic illness demographics, users frequently interact with mobile touch targets in low-connectivity environments (2G/3G edge cells, unstable Wi-Fi). This introduces two primary concurrency vectors:
1. **Client-Side Rapid Multi-Tap:** An anxious user taps the "Taken" button multiple times within a 200–500ms window before the button disables or optimistic UI transitions complete.
2. **Webhook Transport Retries:** When upstream SMS gateways (Twilio, Gupshup) dispatch inbound SMS replies (`1 = Taken`) to the webhook gateway, transient network packet loss can delay the HTTP `200 OK` acknowledgement, triggering automated exponential backoff retries that arrive at the server concurrently.

Without deterministic locking and idempotency barriers, concurrent transaction workers will execute overlapping `SELECT current_stock` statements, calculate identical decrements, and commit multiple updates, causing inventory leakage (e.g., deducting 3 pills for 1 actual intake event).

#### B. Architectural Mitigation Flow (Dual-Layered Defense)
The system employs a layered defense combining database-level structural invariants and serializing row-level pessimistic locks:

```
[Inbound Intake Request (API / Webhook)]
                    │
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Deterministic Idempotency Key Validation                      │
│ - Natural Composite Key: (user_id, schedule_id, scheduled_date)        │
│ - Evaluates presence in DoseLog table before acquiring row locks       │
└───────────────────┬────────────────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
[Intake Exists & Taken]   [New Intake / State Change]
         │                     │
         ▼                     ▼
[Short-Circuit 200 OK]    ┌──────────────────────────────────────────────┐
(Zero DB Stock Mutation)  │ Layer 2: Pessimistic Row Lock Serialization  │
                          │ - Transaction Boundary Opens (ACID)          │
                          │ - SELECT * FROM medicines WHERE id = :id     │
                          │   FOR UPDATE;                                │
                          │ - Blocks concurrent threads for same med_id  │
                          │ - Recalculates stock = max(0, stock - qty)   │
                          │ - Inserts DoseLog & Commits Transaction      │
                          └──────────────────────────────────────────────┘
```

#### C. Relational Transaction Isolation Guarantees
- **Isolation Level:** `READ COMMITTED` with explicit `FOR UPDATE` row locking. This avoids the high serialization failure retry overhead of `SERIALIZABLE` isolation while providing absolute atomicity on target inventory records.
- **Lock Acquisition Ordering:** To prevent circular deadlocks in polypharmacy scenarios where multiple medications are processed, transactions acquire locks strictly sorted by canonical UUID order:
  $$\text{Lock Order: } \text{UUID}_{\text{med}_1} < \text{UUID}_{\text{med}_2} < \dots < \text{UUID}_{\text{med}_N}$$

---

### 1.2 Schema & State Invariants

#### A. Relational Data Model Specifications

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                   ENTITY RELATIONSHIPS                                │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  ┌───────────────────────┐             ┌───────────────────────┐                      │
│  │         User          │ 1         * │       Medicine        │                      │
│  │───────────────────────│────────────▶│───────────────────────│                      │
│  │ id: UUID (PK)         │             │ id: UUID (PK)         │                      │
│  │ role: Enum            │             │ user_id: UUID (FK)    │                      │
│  └───────────────────────┘             │ current_stock: Int    │                      │
│             │ 1                        │ quantity_per_dose: Int│                      │
│             │                          │ daily_frequency: Int  │                      │
│             │ *                        └───────────────────────┘                      │
│             ▼                                      │ 1                                │
│  ┌───────────────────────┐                         │                                  │
│  │       Schedule        │                         │ *                                │
│  │───────────────────────│◀────────────────────────┘                                  │
│  │ id: UUID (PK)         │                                                            │
│  │ user_id: UUID (FK)    │                                                            │
│  │ medicine_id: UUID(FK) │                                                            │
│  │ scheduled_time: Time  │                                                            │
│  │ frequency_pattern: Str│                                                            │
│  └───────────────────────┘                                                            │
│             │ 1                                                                       │
│             │                                                                         │
│             │ *                                                                       │
│             ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐                      │
│  │                           DoseLog                           │                      │
│  │─────────────────────────────────────────────────────────────│                      │
│  │ id: UUID (PK)                                               │                      │
│  │ user_id: UUID (FK)                                          │                      │
│  │ medicine_id: UUID (FK)                                      │                      │
│  │ schedule_id: UUID (FK)                                      │                      │
│  │ scheduled_date: Date                                        │                      │
│  │ action: Enum ('Taken', 'Missed', 'Snooze')                  │                      │
│  │ action_time: DateTime (UTC)                                 │                      │
│  │ CONSTRAINT: UNIQUE (user_id, schedule_id, scheduled_date)   │                      │
│  └─────────────────────────────────────────────────────────────┘                      │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

#### B. Invariant Rules Table

| Entity | Constraint / Invariant | Enforcement Mechanism | Failure Action |
| :--- | :--- | :--- | :--- |
| `Medicine` | $\text{current\_stock} \ge 0$ | PostgreSQL `CHECK (current_stock >= 0)` | Rejects negative stocks; clamps to zero in application layer before flush. |
| `Medicine` | $\text{quantity\_per\_dose} \ge 1$ | Schema validation + DB Check | Disallows zero or negative dosage quantities. |
| `DoseLog` | Exactly one status per scheduled slot per day | Unique composite index on `(user_id, schedule_id, scheduled_date)` | Enforces idempotency; second concurrent write fails or updates state cleanly without re-decrementing stock. |
| `Schedule` | $\text{scheduled\_time}$ strictly timezone-aware | Stored as UTC offset or wall-clock normalized time | Prevents shift errors during Daylight Savings or inter-state travel. |

---

### 1.3 Probabilistic Quantile Refill Schema Design

The deterministic formula ($\text{days} = \text{stock} / \text{daily\_dose}$) fails to capture behavioral variance (e.g., weekend delays, systematic missed doses, or compensatory double doses). The system standardizes on a **3-Quantile Output Topology**:

```
                              PROBABILISTIC DEPLETION CURVE
       Probability
         Density
            │
            │                  P50 (Median)
            │                     │
            │       P10           │             P90
            │    (Pessimistic)    │          (Optimistic)
            │         │           │               │
            │         ▼           ▼               ▼
            └─────────┬───────────┬───────────────┬───────────────▶ Time (Days)
                      │           │               │
                      │◄─────────IQR─────────────►│
                 Safe Trigger    Expected       Buffer
                  Threshold       Runout        Limit
```

#### Field-by-Field Specification for Data Model:

1. `medicine_id`: `UUID` (RFC 4122 v4). Mandatory. Primary identifier linking inventory item.
2. `medicine_name`: `String(128)`. Clinical brand and dosage label (e.g., "Metformin 500mg ER").
3. `current_stock`: `Integer`, $\ge 0$. Verified physical remaining units.
4. `p10_runout_days`: `Float32`, $\ge 0.0$.
   - *Definition:* The 10th percentile conservative estimate. 90% confidence that the patient will **not** run out before this day. Accounts for accelerated consumption patterns (e.g., taking extra doses for symptoms).
5. `p50_runout_days`: `Float32`, $\ge 0.0$.
   - *Definition:* Expected median depletion point where cumulative probability $F(t) = 0.5$. Serves as the primary display metric on consumer interfaces.
6. `p90_runout_days`: `Float32`, $\ge p_{50}$.
   - *Definition:* Optimistic 90th percentile depletion boundary under frequent skipped/delayed doses.
7. `estimated_runout_date_p50`: `Date` (ISO 8601 `YYYY-MM-DD`). Calendar projection computed as:
   $$\text{Date}_{\text{runout}} = \text{Date}_{\text{current}} + \lceil P_{50} \rceil$$
8. `critical_refill_date_p10`: `Date` (ISO 8601 `YYYY-MM-DD`). Clinical reorder deadline computed as:
   $$\text{Date}_{\text{order}} = \text{Date}_{\text{current}} + \lceil P_{10} \rceil$$
9. `is_low_stock`: `Boolean`. Evaluates to `True` if $\text{current\_stock} \le 5$ OR $P_{10} \le 3.0\text{ days}$.
10. `requires_immediate_reorder`: `Boolean`. Evaluates to `True` if $P_{10} \le 2.0\text{ days}$ OR $\text{current\_stock} \le 2$. Triggers automated SMS/WhatsApp warning.
11. `confidence_score`: `Float32`, $[0.0, 1.0]$. Reliability index calculated from historical adherence stability (sample size of logs, entropy of intake timings).

---

## 2. STEP-BY-STEP SUBSYSTEM HARDENING ROADMAP

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SUBSYSTEM INTEGRATION MATRIX                                   │
├──────────────────────┬───────────────────────────────┬───────────────────────────────────────────┤
│ SUBSYSTEM            │ PRIMARY TARGET FILE           │ CORE RESPONSIBILITY                       │
├──────────────────────┼───────────────────────────────┼───────────────────────────────────────────┤
│ Track 1 Vision AI    │ backend/.../ocr_service.py    │ Preprocessing -> ONNX -> Fuzzy Match      │
│ High-Concurrency DB  │ backend/.../adherence_service │ Atomic Locking & Inventory Mutation       │
│ Predictive Refill ML │ backend/.../refill_service.py │ 11-Feature Vector -> Quantile Tree Output │
│ Client Localization  │ frontend/.../LanguageContext  │ Dynamic EN/HI Hydration & Zero-State UI   │
│ Android Native OS    │ frontend/android/.../Manifest │ AlarmClock & Doze-Bypass Receivers        │
└──────────────────────┴───────────────────────────────┴───────────────────────────────────────────┘
```

---

### 2.1 Track 1 Vision Perception (`ocr_service.py`)

#### A. High-Level Vision Pipeline Architecture

```
[Raw Prescription Image] ──▶ [OpenCV Preprocessor] ──▶ [Horizontal Line Segmenter]
                                     │                               │
                      CLAHE, Deskew, Contrast           Line Bounding Box Crops
                                                                     │
                                                                     ▼
[Fuzzy Matcher 253k Catalog] ◀── [Vocabulary Decoder] ◀── [TrOCR INT8 ONNX Session]
```

#### B. Detailed Execution Steps:
1. **Singleton Session Lifecycle Management:**
   - Implement `TrOCRONNXSessionManager` as a thread-safe singleton.
   - Configure session options: Set `intra_op_num_threads = 4`, `execution_mode = ORT_SEQUENTIAL`, and `graph_optimization_level = ORT_ENABLE_ALL`.
   - Utilize `CPUExecutionProvider` for consistent sub-300ms execution on standard multi-core application nodes without requiring local CUDA hardware.
2. **Tensor Dimension Transformations:**
   - Ingest raw image crop from line segmenter (grayscale or BGR).
   - Convert color space to RGB.
   - Resize via bilinear interpolation to fixed square dimension: $(384, 384)$.
   - Normalize pixel intensity values to the range $[-1.0, 1.0]$ using standard ImageNet ViT statistics:
     $$\text{Tensor}_{c, h, w} = \frac{\frac{\text{Pixel}_{c, h, w}}{255.0} - 0.5}{0.5}$$
   - Transpose memory layout from HWC (Height, Width, Channels) to CHW, then prepend batch dimension to yield shape $(1, 3, 384, 384)$ as `float32`.
3. **Autoregressive Decoding Strategy:**
   - Execute forward pass through the ONNX graph.
   - Extract predicted logits of shape $(1, \text{seq\_len}, \text{vocab\_size})$.
   - Apply greedy decoding: $\hat{y}_t = \arg\max_k (\text{logits}_{t, k})$.
   - Filter special tokens (`pad_token_id = 1`, `eos_token_id = 2`, `bos_token_id = 0`).
   - Reconstruct character sequences from token byte offsets.
4. **Fallback & Graceful Degradation Hierarchy:**
   - *Primary Pass:* TrOCR ONNX inference on segmented line crops.
   - *Secondary Pass (if line confidence $< 0.40$ or length $< 3$):* Tesseract OCR in single-line mode (`--psm 7`).
   - *Tertiary Pass (if line segmentation produces zero crops):* Enhanced grayscale full-image Tesseract (`--psm 6`).
   - *Clinical Catalog Matching:* Extracted text strings are queried against the 253,973 Indian Medicine Catalog using trigram indexing. Matches with similarity score $\ge 0.78$ are flagged as clinically verified.

---

### 2.2 High-Concurrency Inventory Engine (`adherence_service.py`)

#### A. Intake Action State Machine Transition Rules

```
┌──────────────┐     Record Action: "Taken"     ┌──────────────┐
│              │───────────────────────────────▶│    TAKEN     │ (Stock decremented by qty)
│              │                                └──────────────┘
│              │     Record Action: "Missed"    ┌──────────────┐
│  SCHEDULED   │───────────────────────────────▶│    MISSED    │ (Stock untouched)
│   (Pending)  │                                └──────────────┘
│              │     Record Action: "Snooze"    ┌──────────────┐
│              │───────────────────────────────▶│   SNOOZED    │ (Stock untouched, timer reset)
└──────────────┘                                └──────────────┘
       ▲                                               │
       └───────────────────────────────────────────────┘
                     Snooze Duration Expires (15m)
```

#### B. State Transition Integrity Table

| Current State | Inbound Action | Target State | Stock Mutation | Notification Trigger |
| :--- | :--- | :--- | :--- | :--- |
| `None` (Unlogged) | `Taken` | `Taken` | $\text{Stock} \leftarrow \max(0, \text{Stock} - \text{Qty})$ | Enqueue `LOW_STOCK` if remaining $\le 5$. |
| `None` (Unlogged) | `Missed` | `Missed` | None ($\Delta = 0$) | Enqueue `MISSED_DOSE_ALERT` to Caregiver if delay $> 45\text{m}$. |
| `None` (Unlogged) | `Snooze` | `Snooze` | None ($\Delta = 0$) | Schedule local re-alert at $t + 15\text{m}$. |
| `Taken` | `Taken` (Duplicate) | `Taken` | **None ($\Delta = 0$)** | Return existing `DoseLog` record (Idempotent response). |
| `Missed` | `Taken` (Correction) | `Taken` | $\text{Stock} \leftarrow \max(0, \text{Stock} - \text{Qty})$ | Update log; apply delayed stock decrement. |
| `Taken` | `Missed` (Rollback) | `Missed` | $\text{Stock} \leftarrow \text{Stock} + \text{Qty}$ | Restore deducted inventory units. |

#### C. Transaction Boundary Execution Layout:
1. Open atomic database transaction boundary (`async with db.begin()`).
2. Resolve target schedule and date.
3. Query `DoseLog` with matching `(schedule_id, scheduled_date)`:
   - If match found and action is identical $\rightarrow$ short-circuit and return.
4. Acquire exclusive row lock: `SELECT * FROM medicines WHERE id = :med_id FOR UPDATE`.
5. Read locked `current_stock` and `quantity_per_dose`.
6. Compute new stock; execute update statement.
7. If updated stock $\le 5$, construct and insert a `Notification` entity within the same transaction.
8. Commit transaction. On any unexpected runtime exception or DB disconnect, perform immediate rollback, ensuring stock and logs remain strictly synchronized.

---

### 2.3 Behavioral ML Refill Engine (`refill_service.py`)

#### A. 11-Dimensional Feature Assembly Pipeline
The predictive engine constructs an 11-element feature vector $X \in \mathbb{R}^{11}$ from the patient's relational medication history over a rolling 14-day observation window:

1. $X_0$ (`current_stock`): Integer count of verified units in inventory.
2. $X_1$ (`daily_prescribed_frequency`): Number of scheduled doses per 24-hour cycle.
3. $X_2$ (`quantity_per_dose`): Number of pills per intake event.
4. $X_3$ (`adherence_rate_7d`): Ratio of taken doses over scheduled doses over the trailing 7 days:
   $$\text{Adherence}_{7d} = \frac{N_{\text{taken}}}{N_{\text{scheduled}}}$$
5. $X_4$ (`missed_dose_frequency_weekly`): Normalized weekly count of missed dose logs:
   $$\text{Missed}_{\text{weekly}} = \frac{N_{\text{missed}}}{14} \times 7$$
6. $X_5$ (`snooze_frequency_index`): Proportion of doses requiring one or more snooze cycles:
   $$\text{Snooze Index} = \frac{N_{\text{snoozed}}}{N_{\text{total logs}}}$$
7. $X_6$ (`weekday_weekend_variance`): Variance in adherence between Monday–Friday vs. Saturday–Sunday.
8. $X_7$ (`avg_delay_minutes`): Mean latency between scheduled time and actual confirmation timestamp:
   $$\text{Delay}_{\text{avg}} = \frac{1}{N} \sum_{i=1}^N |t_{\text{action}, i} - t_{\text{scheduled}, i}|$$
9. $X_8$ (`streak_length`): Current consecutive days with 100% adherence (capped at 14).
10. $X_9$ (`effective_daily_consumption`): Adjusted consumption rate factoring behavioral compliance:
    $$\text{Rate}_{\text{effective}} = (X_1 \times X_2) \times (0.5 + 0.5 \times X_3)$$
11. $X_{10}$ (`days_remaining_naive`): Baseline deterministic quotient:
    $$\text{Days}_{\text{naive}} = \frac{X_0}{X_1 \times X_2}$$

#### B. Ensemble Forward-Pass Execution:
- The pre-trained model artifact `refill_forecaster_v1.json` consists of 80 decision stumps optimized with learning rate $\eta = 0.08$.
- For each stump $j \in \{1, \dots, 80\}$:
  - Read split feature index $f_j$, threshold $\theta_j$, left leaf value $L_j$, right leaf value $R_j$.
  - Evaluate conditional branch:
    $$\Delta_j = \begin{cases} L_j & \text{if } X_{f_j} \le \theta_j \\ R_j & \text{if } X_{f_j} > \theta_j \end{cases}$$
  - Accumulate score: $\hat{y} = \text{base\_prediction} + \eta \sum_{j=1}^{80} \Delta_j$.
- **Cold-Start Handling:** For patients with $< 3$ historical dose logs, feature derivation skips regression and defaults to $P_{50} = X_{10}$, applying a default conservative variance of $\pm 20\%$ for $P_{10}$ and $P_{90}$.

---

### 2.4 Multilingual & Patient Experience Architecture (`LanguageContext.jsx` & `patient/page.jsx`)

#### A. Reactive State Provider Architecture
- Create `LanguageProvider` as a client-side React Context (`"use client"`).
- Implement bi-directional dictionary lookups for standard medical lexicons.
- Store selected locale in `localStorage` under key `pillsync_lang`.
- Hydration Safeguard: During SSR, default to `"en"`. On `useEffect` mount, synchronously reconcile with client `localStorage` to avoid React hydration mismatches.

#### B. Clinical Hindi Localization Lexicon Mapping:

```
┌───────────────────────────┬───────────────────────────┬──────────────────────────────────────────┐
│ ENGLISH TERM              │ HINDI CLINICAL EQUIVALENT │ CONTEXTUAL USAGE                         │
├───────────────────────────┼───────────────────────────┼──────────────────────────────────────────┤
│ Take Dose                 │ दवा ले ली (खुराक)         │ Primary confirmation action button       │
│ Snooze                    │ बाद में याद दिलाएं        │ 15-minute reminder delay                 │
│ Skip                      │ छोड़ें                    │ Deliberate dose omission with note       │
│ Pills in Stock            │ बची हुई दवाइयां (गोलियां) │ Real-time inventory badge                │
│ Critical Low Stock        │ दवा समाप्त होने वाली है   │ Stock <= 5 warning toast                 │
│ Drug Interaction Alert    │ दवाओं के आपसी रिएक्शन    │ Severe clinical DDI modal                │
│ Adherence Streak          │ नियमितता का रिकॉर्ड      │ Patient gamification card                │
│ Before Meals / After Meals│ खाने से पहले / खाने के बाद │ Dosage timing instructions               │
└───────────────────────────┴───────────────────────────┴──────────────────────────────────────────┘
```

#### C. Elimination of Mock Data Fallbacks:
- Completely strip `DEMO_SCHEDULE` and `DEMO_LOGS` static mock arrays from `patient/page.jsx` and `notifications/page.jsx`.
- When the API returns an empty list (new user onboarding):
  - Render an accessible, empathetic Zero-State Hero Card featuring an upload prescription action button (`/medicines`), guidance text, and a prompt to connect with their prescribing clinician or caregiver.

---

### 2.5 Android Native Packaging & Hardware Binding

#### A. Operating System Battery Optimization & Alarm Architecture
Android 12 (API 31) through Android 14 (API 34) aggressively suspends background application processes under **Doze Mode** and **App Standby Buckets**. Standard JavaScript `setTimeout` or browser Web Push timers are terminated when the screen is locked.

```
[Android OS Power Subsystem]
             │
             ├─▶ Normal Mode ──▶ standard alarm fired
             │
             └─▶ Doze Mode (Deep Sleep)
                   │
                   ▼
       [Requires Android Exact Alarm]
       - android.permission.SCHEDULE_EXACT_ALARM
       - android.permission.USE_EXACT_ALARM
       - android.permission.WAKE_LOCK
                   │
                   ▼
     [RTC_WAKEUP System Interrupt]
     - Bypasses battery optimization
     - Wakes CPU for 5000ms
     - Triggers TimedNotificationPublisher
     - Plays high-priority alert sound
```

#### B. Permission Requirements Table (`AndroidManifest.xml`)

| Permission Tag | Android API Level | Regulatory / Architectural Justification |
| :--- | :--- | :--- |
| `SCHEDULE_EXACT_ALARM` | API 31+ (Android 12) | Required to schedule time-critical medical reminder alarms down to the exact second. |
| `USE_EXACT_ALARM` | API 33+ (Android 13) | Healthcare category exemption allowing alarm execution without user revocation in settings. |
| `RECEIVE_BOOT_COMPLETED`| All APIs | Re-registers all scheduled medication timers into the Android AlarmManager after device reboot. |
| `WAKE_LOCK` | All APIs | Prevents CPU sleep while playing audio alarm and dispatching local notification banners. |
| `POST_NOTIFICATIONS` | API 33+ (Android 13) | Explicit runtime permission dialog required to display notification popups. |
| `CAMERA` | All APIs | Hardware access for capturing physical prescription photos and barcodes. |

---

## 3. QUALITY ASSURANCE, REGRESSION & VALIDATION FRAMEWORK

### 3.1 Concurrency & Race-Condition Testing Plan

#### Mathematical Simulation Scenario:
- **Test Subject:** 1 Medicine record (`initial_stock = 20`, `quantity_per_dose = 1`).
- **Input Load:** 10 asynchronous tasks spawned simultaneously using `asyncio.gather()`, all pointing to the identical `schedule_id` and `scheduled_date` with action `Taken`.
- **Expected Failure Mode (without locking):** All 10 tasks read `stock = 20`, decrement to `19`, and commit, or subtract repeatedly until `stock = 10`.
- **Validation Criteria (with locking & idempotency):**
  - Task 1 acquires lock, updates stock $20 \rightarrow 19$, inserts `DoseLog`, commits.
  - Tasks 2 through 10 encounter existing log with action `Taken`, short-circuit, and return existing record without mutating stock.
  - **Final Assertion:** `current_stock == 19` (Exactly one decrement) AND `count(DoseLog) == 1`.

---

### 3.2 Vision Transformer Boundary Stress Testing Matrix

| Degradation Category | Input Sample Description | Expected Behavioral Response | Pass / Fail Metric |
| :--- | :--- | :--- | :--- |
| **Zero-Byte Payload** | `b""` empty buffer passed to OCR pipeline. | Immediate return with `status = "EMPTY_INPUT"`, confidence $0.0$. | Zero uncaught exceptions; zero memory leak. |
| **Uniform White / Blank** | $384 \times 384$ white paper crop (pixel value 255). | Empty string decoding, filtered by confidence gate ($< 0.30$). | `status = "UNREADABLE"`; no fake drug names generated. |
| **Extreme Document Skew** | Prescription rotated at $45^\circ$ angle. | Automatic detection by `_deskew_image`, corrected via affine matrix. | Text orientation restored within $\pm 2.0^\circ$ tolerance. |
| **Low-Contrast Pencil** | Faint handwriting on carbon copy paper (mean variance $< 18.0$). | CLAHE contrast enhancement increases variance before line segmentation. | Top-1 drug match found in 253k catalog. |

---

### 3.3 Clinical Safety CDSS Audit Protocols

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLINICAL QUALITY ASSURANCE BOUNDS                              │
├──────────────────────────────┬────────────────────────┬──────────────────────────────────────────┤
│ CLINICAL TEST DOMAIN         │ BOUNDARY CONDITION     │ MANDATED SAFETY ASSERTION                │
├──────────────────────────────┼────────────────────────┼──────────────────────────────────────────┤
│ Lethal DDI Contraindication  │ Sildenafil + Nitrates  │ 100% Recall; Hard Block Alert            │
│ Hemorrhage Risk              │ Warfarin + NSAIDs      │ 100% Recall; Major Toxicity Warning Card │
│ Pediatric Paracetamol Overdose│ Single Dose > 15 mg/kg │ Immediate PEDIATRIC_OVERDOSE_ALERT       │
│ Pediatric Paracetamol Max Day│ Cumulative > 60 mg/kg  │ Immediate PEDIATRIC_OVERDOSE_ALERT       │
│ Unreadable Rx Perception     │ Gibberish / Noise      │ Rejection; ZERO Hallucinatory Dispense   │
└──────────────────────────────┴────────────────────────┴──────────────────────────────────────────┘
```

---

### 3.4 User Acceptance Testing (UAT) & Rollout Verification Checklist

- [ ] **Database Integrity:** Execute Alembic migration creating composite unique constraint `uq_adherence_user_schedule_date`.
- [ ] **ONNX Runtime Readiness:** Confirm `trocr_handwritten_opt.onnx` (88.05 MB) is located in `ai_training/track_1_vision/models/`.
- [ ] **Refill ML Artifact:** Confirm `refill_forecaster_v1.json` is loaded into memory during backend initialization.
- [ ] **Language Toggle:** Toggle English $\leftrightarrow$ Hindi in frontend sidebar; verify zero visual layout shifts or missing translation keys.
- [ ] **Cellular SMS E2E:** Send SMS reminder via Twilio; reply with `1`; confirm `medicines.current_stock` decrements in UI within 3 seconds.
- [ ] **Android Build Sync:** Run `npx cap sync android` and verify release APK builds with exit code 0.

---

## 4. SUPPORTING SPECIALIZED MULTI-AGENT DELEGATION PROMPTS

The following standalone sub-prompts are configured to delegate execution tasks to specialized domain agents:

```text
=== AGENT A: Computer Vision & Edge Model Optimization Specialist ===
Role: Principal Computer Vision Architect & Inference Optimization Specialist.
Domain: Vision Transformers (TrOCR), ONNX Runtime execution graphs, OpenCV image processing.
Task Scope:
1. Optimize the tensor inference pipeline in `backend/app/services/ocr_service.py`.
2. Implement Dynamic Batch Stacking: When the Document Segmenter returns K bounding boxes for lines on a prescription, stack them into an evaluation batch of shape (K, 3, 384, 384) to execute a single parallel ONNX forward pass rather than K sequential passes.
3. Integrate adaptive CLAHE parameterization: Automatically scale the clipLimit between 2.0 and 4.5 based on image background luminance entropy.
4. Bound CPU wall-clock latency to < 220ms total per page.
Output Requirement: Provide comprehensive architectural designs and benchmark verification reports.
```

```text
=== AGENT B: Distributed Concurrency & High-Scale Database Architect ===
Role: Staff Distributed Systems Architect & High-Throughput Database Specialist.
Domain: PostgreSQL ACID concurrency, SQLAlchemy 2.0 Async, Redis distributed locking (Redlock).
Task Scope:
1. Harden `backend/app/services/adherence_service.py` against distributed race conditions across multi-node container clusters.
2. Formulate a Redis-backed distributed lock with 5000ms TTL around key `lock:intake:{user_id}:{schedule_id}:{date}` to intercept duplicate requests before hitting the relational database.
3. Design a dead-letter queue (DLQ) and retry mechanism for Twilio webhook delivery failures.
4. Author an async stress benchmark simulating 50 concurrent patients each firing rapid dual-intake requests.
Output Requirement: Provide exhaustive architectural blueprints and mathematical concurrency proofs.
```

```text
=== AGENT C: Clinical Safety, Pharmacovigilance & CDSS Compliance Officer ===
Role: Lead Medical Informatics Scientist & Pharmacovigilance Regulatory Auditor.
Domain: Drug-Drug Interactions (DDInter 2.0), WHO Defined Daily Dose (DDD), HL7 FHIR US Core / ABDM.
Task Scope:
1. Audit the full 176 active pharmaceutical salt interaction matrix in `backend/app/services/clinical_safety_service.py`.
2. Verify zero-miss recall on 15 critical lethal contraindication pairs.
3. Formalize weight-based dosage formulas for pediatric safety across age brackets (neonates, infants, children) to ensure strict adherence to WHO clinical boundaries.
4. Specify the HL7 FHIR `DetectedIssue` and `MedicationStatement` serialization schemas for clinical export.
Output Requirement: Provide an exhaustive clinical validation audit report with formal medical safety verification matrices.
```
