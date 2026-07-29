'use strict';

const { createReplacementProjection } = require('./inputTaxReplacementContract');

const toId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const projectInputTaxReplacementChains = (documents = []) => {
  const byId = new Map(documents.map((document) => [document.id, document]));
  const replacedBy = new Map();

  documents.forEach((document) => {
    const replacesTaxDocumentId = toId(document.snapshot?.replacesTaxDocumentId);
    if (replacesTaxDocumentId) {
      const current = replacedBy.get(replacesTaxDocumentId) || [];
      current.push(document.id);
      replacedBy.set(replacesTaxDocumentId, current);
    }
  });

  const resolveRoot = (document) => {
    const seen = new Set();
    let current = document;
    while (current) {
      if (seen.has(current.id)) return null;
      seen.add(current.id);
      const parentId = toId(current.snapshot?.replacesTaxDocumentId);
      if (!parentId) return current.id;
      current = byId.get(parentId);
    }
    return document.id;
  };

  return new Map(documents.map((document) => {
    const replacesTaxDocumentId = toId(document.snapshot?.replacesTaxDocumentId);
    const successors = replacedBy.get(document.id) || [];
    const status = successors.length > 1
      ? 'CHAIN_CONFLICT'
      : (successors.length === 1
        ? 'REPLACED_SOURCE'
        : (replacesTaxDocumentId ? 'ACTIVE_REPLACEMENT' : 'NONE'));
    return [document.id, createReplacementProjection({
      status,
      replacesTaxDocumentId,
      replacedByTaxDocumentId: successors.length === 1 ? successors[0] : null,
      chainRootTaxDocumentId: resolveRoot(document),
    })];
  }));
};

module.exports = Object.freeze({ projectInputTaxReplacementChains });
