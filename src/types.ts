export type Provider = "openai" | "anthropic" | "gemini";
export type LifecycleStatus = "deprecated" | "retired";
export type Confidence = "high" | "medium" | "low";

export interface LifecycleEntry {
  provider: Provider;
  modelId: string;
  status: LifecycleStatus;
  shutdownDate: string;
  replacement: string;
  sourceUrl: string;
  replacementConfidence: Confidence;
  notes: string;
}

export interface ApiLifecycleEntry {
  provider: "openai";
  apiId: "assistants-api" | "videos-api";
  apiName: "Assistants API" | "Videos API";
  status: "deprecated";
  shutdownDate: string;
  replacement: string | null;
  sourceUrl: string;
  sdk: "OpenAI Assistants" | "OpenAI Videos";
  notes: string;
}

export interface LifecycleDatabase {
  version: number;
  checkedAt: string;
  entries: LifecycleEntry[];
  apiDeprecations: ApiLifecycleEntry[];
}

export interface Location {
  path: string;
  line: number;
  column: number;
  byteStart: number;
  byteEnd: number;
}

export type ReferenceSource = "hardcoded" | "environment" | "config";

export interface ModelFinding {
  id: string;
  kind: "model_reference";
  provider: Provider;
  modelId: string;
  status: LifecycleStatus;
  shutdownDate: string;
  replacement: string;
  sourceUrl: string;
  sourceKind: ReferenceSource;
  confidence: Confidence;
  replacementConfidence: Confidence;
  sdk: string | null;
  location: Location;
  message: string;
}

export interface RuntimeCheckFinding {
  id: string;
  kind: "runtime_check";
  provider: Provider;
  expression: string;
  confidence: "low";
  sdk: string;
  location: Location;
  message: string;
}

export interface ApiDeprecationFinding {
  id: string;
  kind: "api_deprecation";
  provider: "openai";
  apiId: "assistants-api" | "videos-api";
  status: "deprecated";
  shutdownDate: string;
  replacement: string | null;
  sourceUrl: string;
  confidence: "high";
  sdk: "OpenAI Assistants" | "OpenAI Videos";
  location: Location;
  message: string;
}

export type Finding = ModelFinding | RuntimeCheckFinding | ApiDeprecationFinding;

export interface ScanReport {
  schemaVersion: 1;
  toolVersion: string;
  databaseVersion: number;
  databaseCheckedAt: string;
  scannedAt: string;
  root: string;
  filesScanned: number;
  limitations: Array<{
    path: string;
    reason: string;
  }>;
  findings: Finding[];
  summary: {
    filesSkipped: number;
    modelReferences: number;
    apiDeprecations: number;
    runtimeChecks: number;
    deprecated: number;
    retired: number;
    safeAutoFixes: number;
  };
}

export interface PlannedEdit {
  path: string;
  byteStart: number;
  byteEnd: number;
  oldText: string;
  newText: string;
  findingId: string;
}

export interface VerificationStep {
  name: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  durationMs: number;
  output: string;
}

export interface MigrationReport {
  schemaVersion: 1;
  createdAt: string;
  root: string;
  disposition: "draft_ready" | "draft_only" | "report_only";
  initialScan: ScanReport;
  finalScan: ScanReport;
  edits: PlannedEdit[];
  patchPath: string | null;
  compatibilityTestPath: string | null;
  prBodyPath: string;
  verification: VerificationStep[];
  unconfirmed: string[];
}

export interface BenchmarkManifest {
  positives: Array<{ path: string; line: number; modelId: string }>;
  negatives: Array<{ path: string; description: string }>;
}

export interface BenchmarkResult {
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  trueNegatives: number;
  recall: number;
  falsePositiveRate: number;
  passed: boolean;
  missing: string[];
  unexpected: string[];
}
