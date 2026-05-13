// Termux-friendly lightweight term frequency based retrieval, no heavy native addons.

export class RetrievalEngine {
  constructor() {
    this.documents = new Map();
  }

  addDocument(id, text) {
    const tokens = this._tokenize(text);
    this.documents.set(id, { text, tokens });
  }

  search(query, topK = 3) {
    const queryTokens = this._tokenize(query);
    const scores = [];

    for (const [id, doc] of this.documents.entries()) {
      let score = 0;
      for (const qt of queryTokens) {
        if (doc.tokens.includes(qt)) {
          score++; // Simple term overlap 
        }
      }
      if (score > 0) {
        scores.push({ id, score, text: doc.text });
      }
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  _tokenize(text) {
    return text.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  }
}
