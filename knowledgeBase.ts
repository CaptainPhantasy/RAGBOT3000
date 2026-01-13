import matter from 'gray-matter';
import type { DocChunk } from './types';

// --- CONFIGURATION ---
const QDRANT_API_URL = import.meta.env.VITE_QDRANT_API_URL || 'http://localhost:8080';
const USE_VECTOR_SEARCH = import.meta.env.VITE_USE_VECTOR_SEARCH !== 'false';

// --- LOCAL KNOWLEDGE BASE (Fallback) ---
// Auto-discover all markdown files in knowledge/docs/ at build time
const docModules = import.meta.glob('./knowledge/docs/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// Parse frontmatter and build local knowledge base automatically
export const LOCAL_KNOWLEDGE_BASE: DocChunk[] = Object.entries(docModules)
  .map(([path, rawContent]) => {
    try {
      const { data, content } = matter(rawContent);
      const filename = path.split('/').pop()?.replace('.md', '') || 'unknown';
      return {
        id: data.id || `doc_${filename}`,
        title: data.title || filename.replace(/-/g, ' '),
        productArea: data.productArea || 'General',
        tags: Array.isArray(data.tags) ? data.tags : [],
        content: content.trim(),
      };
    } catch (err) {
      console.error(`Failed to parse frontmatter for ${path}:`, err);
      const filename = path.split('/').pop()?.replace('.md', '') || 'unknown';
      return {
        id: `doc_${filename}`,
        title: filename.replace(/-/g, ' '),
        productArea: 'General',
        tags: [],
        content: rawContent.trim(),
      };
    }
  })
  .filter((doc) => doc.content.length > 0);

// For backwards compatibility
export const KNOWLEDGE_BASE = LOCAL_KNOWLEDGE_BASE;

// --- VECTOR SEARCH API ---
interface VectorSearchResult {
  id: string;
  title: string;
  content: string;
  tags: string[];
  productArea: string;
  score: number;
  source_file?: string;
  domain?: string;
  category?: string;
}

interface VectorSearchResponse {
  results: VectorSearchResult[];
  query: string;
  persona_hint?: string;
}

interface SearchOptions {
  domain?: string;
  category?: string;
  limit?: number;
}

/**
 * Query the Qdrant vector database via REST API
 */
async function vectorSearch(
  query: string,
  options: SearchOptions = {}
): Promise<{ docs: DocChunk[]; personaHint?: string }> {
  try {
    const response = await fetch(`${QDRANT_API_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        domain: options.domain,
        category: options.category,
        limit: options.limit || 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vector search failed: ${response.statusText}`);
    }

    const data: VectorSearchResponse = await response.json();

    const docs: DocChunk[] = data.results.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      tags: r.tags,
      productArea: r.productArea,
    }));

    return { docs, personaHint: data.persona_hint };
  } catch (error) {
    console.warn('Vector search unavailable, falling back to local:', error);
    throw error;
  }
}

/**
 * Simple keyword search (fallback)
 */
function keywordSearch(query: string): DocChunk[] {
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(' ').filter((t) => t.length > 3);

  const scored = LOCAL_KNOWLEDGE_BASE.map((doc) => {
    let score = 0;
    const contentLower = (doc.title + ' ' + doc.content).toLowerCase();

    if (contentLower.includes(lowerQuery)) score += 10;
    terms.forEach((term) => {
      if (contentLower.includes(term)) score += 2;
    });

    return { doc, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.doc);
}

/**
 * Main retrieval function - uses vector search with fallback to keyword
 * @param query - Search query
 * @param options - Optional filters (domain, category, limit)
 * @returns Promise with docs and optional persona hint
 */
export async function retrieveDocsAsync(
  query: string,
  options: SearchOptions = {}
): Promise<{ docs: DocChunk[]; personaHint?: string }> {
  if (USE_VECTOR_SEARCH) {
    try {
      return await vectorSearch(query, options);
    } catch {
      // Fall back to keyword search
      return { docs: keywordSearch(query) };
    }
  }
  return { docs: keywordSearch(query) };
}

/**
 * Synchronous retrieval (backwards compatible)
 * Note: This only uses keyword search. Use retrieveDocsAsync for vector search.
 */
export const retrieveDocs = (query: string): DocChunk[] => {
  return keywordSearch(query);
};

/**
 * Check if vector search service is available
 */
export async function checkVectorServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available knowledge domains
 */
export async function getAvailableDomains(): Promise<{
  domains: string[];
  categories: string[];
}> {
  try {
    const response = await fetch(`${QDRANT_API_URL}/domains`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Could not fetch domains:', error);
  }
  return { domains: [], categories: [] };
}

/**
 * Get available personas
 */
export async function getAvailablePersonas(): Promise<
  Array<{ domain: string; persona_file: string; description: string }>
> {
  try {
    const response = await fetch(`${QDRANT_API_URL}/personas`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Could not fetch personas:', error);
  }
  return [];
}
