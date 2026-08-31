export type BuiltInAwardCategory = 'academic' | 'research' | 'outstanding' | 'coordination';
export type AwardCategory = BuiltInAwardCategory | `custom:${string}`;
export type AchievementType = 'competition' | 'general';
export type Semester = 'Spring' | 'Summer' | 'Fall';
export type AcademicRankingScope = 'semester' | 'batch' | 'custom';
export type CitationMode = 'automatic' | 'custom';
export type SignatureMode = 'wet' | 'digital';
export type SignatureLayout = 'one' | 'two';
export type CertificateTemplateId = 'modern-vintage' | 'pub-classic';

export type CustomAwardFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';

export interface CustomAwardField {
  key: string;
  label: string;
  type: CustomAwardFieldType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: string[];
}

export interface CustomAwardMapping {
  id: `custom:${string}`;
  label: string;
  aliases: string[];
  description: string;
  enabled: boolean;
  fields: CustomAwardField[];
  citationTemplate: string;
}

export interface CertificateRecord {
  templateId: CertificateTemplateId;
  recipientName: string;
  awardCategory: AwardCategory;
  achievementType: AchievementType;
  academicScope: AcademicRankingScope;
  studySemester: string;
  rankingGroup: string;
  batch: string;
  semester: Semester;
  awardYear: string;
  issueDate: string;
  certificateNumber: string;
  articleTitle: string;
  journalName: string;
  doi: string;
  publicationUrl: string;
  q1Verified: boolean;
  competitionOrEvent: string;
  positionOrAward: string;
  achievementArea: string;
  coordinationPeriod: string;
  citationMode: CitationMode;
  customCitation: string;
  customFields: Record<string, string>;
  customCategoryLabel?: string;
  customCategoryTemplate?: string;
  customCategoryFields?: CustomAwardField[];
  signatureMode: SignatureMode;
  signatureLayout: SignatureLayout;
}

export interface GeneratorSettings {
  universityName: string;
  departmentName: string;
  certificateTitle: string;
  numberPrefix: string;
  signatoryOneLabel: string;
  signatoryTwoLabel: string;
  defaultSignatureMode: SignatureMode;
  defaultSignatureLayout: SignatureLayout;
  defaultTemplateId: CertificateTemplateId;
  customAwardMappings: CustomAwardMapping[];
}

export interface SessionSignatures {
  first?: string;
  second?: string;
}

export interface RegisterEntry extends CertificateRecord {
  citation: string;
  generatedAt: string;
  lastGeneratedAt: string;
  reprintCount: number;
}

export interface BulkRow {
  id: string;
  sourceLine: number;
  record: CertificateRecord;
  errors: string[];
}

export interface RenderOptions {
  settings: GeneratorSettings;
  signatures?: SessionSignatures;
  assetBaseUrl: string;
}
