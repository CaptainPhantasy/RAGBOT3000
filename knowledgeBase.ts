import matter from 'gray-matter';
import type { DocChunk } from './types';

// Auto-discover all markdown files in knowledge/docs/ at build time
const docModules = import.meta.glob('./knowledge/docs/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

// Parse frontmatter and build knowledge base automatically
export const KNOWLEDGE_BASE: DocChunk[] = Object.entries(docModules)
  .map(([path, rawContent]) => {
    try {
      const { data, content } = matter(rawContent);

      // Extract filename for fallback ID if not in frontmatter
      const filename = path.split('/').pop()?.replace('.md', '') || 'unknown';

      // Build DocChunk from frontmatter + content
      return {
        id: data.id || `doc_${filename}`,
        title: data.title || filename.replace(/-/g, ' '),
        productArea: data.productArea || 'General',
        tags: Array.isArray(data.tags) ? data.tags : [],
        content: content.trim(),
      };
    } catch (err) {
      console.error(`Failed to parse frontmatter for ${path}:`, err);
      // Fallback: create minimal DocChunk from filename
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
  .filter((doc) => doc.content.length > 0); // Filter out empty docs

// Simple keyword search simulation
// In production, replace with vector DB (Pinecone, Weaviate, etc.)
export const retrieveDocs = (query: string): DocChunk[] => {
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(' ').filter((t) => t.length > 3);

  const scored = KNOWLEDGE_BASE.map((doc) => {
    let score = 0;
    const contentLower = (doc.title + ' ' + doc.content).toLowerCase();

    // Basic scoring
    if (contentLower.includes(lowerQuery)) score += 10;
    terms.forEach((term) => {
      if (contentLower.includes(term)) score += 2;
    });

    return { doc, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3) // Top 3
    .map((item) => item.doc);
};
