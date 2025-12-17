import { DocChunk } from './types';

// Import knowledge index and docs
import knowledgeIndex from './knowledge/index.json';

// Import all doc files
import gettingStarted from './knowledge/docs/getting-started.md?raw';
import apiKeys from './knowledge/docs/api-keys.md?raw';
import error503 from './knowledge/docs/error-503.md?raw';
import permissions from './knowledge/docs/permissions.md?raw';
import databaseRelations from './knowledge/docs/database-relations.md?raw';

// Map file paths to imported content
const docContents: Record<string, string> = {
  'docs/getting-started.md': gettingStarted,
  'docs/api-keys.md': apiKeys,
  'docs/error-503.md': error503,
  'docs/permissions.md': permissions,
  'docs/database-relations.md': databaseRelations,
};

// Build knowledge base from index.json + markdown files
export const KNOWLEDGE_BASE: DocChunk[] = knowledgeIndex.documents.map(doc => ({
  id: doc.id,
  title: doc.title,
  productArea: doc.productArea,
  tags: doc.tags,
  content: docContents[doc.file] || '',
}));

// Simple keyword search simulation
// In production, replace with vector DB (Pinecone, Weaviate, etc.)
export const retrieveDocs = (query: string): DocChunk[] => {
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(" ").filter(t => t.length > 3);
  
  const scored = KNOWLEDGE_BASE.map(doc => {
    let score = 0;
    const contentLower = (doc.title + " " + doc.content).toLowerCase();
    
    // Basic scoring
    if (contentLower.includes(lowerQuery)) score += 10;
    terms.forEach(term => {
      if (contentLower.includes(term)) score += 2;
    });

    return { doc, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Top 3
    .map(item => item.doc);
};
