export type BuiltInAwardCategory = 'academic' | 'research' | 'outstanding';
export type AwardCategory = BuiltInAwardCategory | `custom:${string}`;
export type AchievementType = 'competition' | 'general';
export type Semester = 'Spring' | 'Summer' | 'Fall';
export type SignatureMode = 'wet' | 'digital';
export type SignatureLayout = 'one' | 'two';
export type CertificateTemplateId = 'modern-vintage' | 'pust-classic';

export interface CustomAwardMapping {
  id: `custom:${string}`;
  label: string;
  aliases: string[];
  citationTemplate: string;
}

export interface CertificateRecord {
  templateId: CertificateTemplateId;
  recipientName: string;
  awardCategory: AwardCategory;
  achievementType: AchievementType;
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
  customCitation: string;
  customCategoryLabel?: string;
  customCategoryTemplate?: string;
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
