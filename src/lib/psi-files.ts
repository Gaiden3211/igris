import snapshot from './psi-file-status.json';

export interface PsiFileStatus {
  investigation_id: string;
  file_name: string;
  source_url?: string;
  status: string;
  indexedPassages: number;
  extractionStatus: string;
  checkedOn: string;
}
const byFile = new Map((snapshot.records as PsiFileStatus[]).map(row => [row.investigation_id + '|' + row.file_name, row]));
export function psiFileStatus(investigationId: string, fileName: string) {
  const row = byFile.get(investigationId + '|' + fileName);
  return row ? {source_url: row.source_url, access_status: row.status, indexed_passages: row.indexedPassages,
    extraction_status: row.extractionStatus, checked_on: row.checkedOn} : {access_status: 'unverified', indexed_passages: 0};
}
