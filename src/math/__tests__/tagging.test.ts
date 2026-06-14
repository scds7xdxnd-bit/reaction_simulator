import { describe, it, expect } from 'vitest';
import { assignTags } from '../tagging';

describe('assignTags', () => {
  it('assigns R-101 to a lone CSTR', () => {
    // hand-calc: one cstr node, no edges → only node gets R-101
    const tags = assignTags([{ id: 'n1', type: 'cstr' }], []);
    expect(tags['n1']).toBe('R-101');
  });

  it('numbers reactors sequentially in topological order', () => {
    // feed → pfr1 → cstr1 → cstr2
    // topological order: feed (no tag), pfr1 → R-101, cstr1 → R-102, cstr2 → R-103
    const nodes = [
      { id: 'feed',  type: 'feed'  },
      { id: 'pfr1',  type: 'pfr'   },
      { id: 'cstr1', type: 'cstr'  },
      { id: 'cstr2', type: 'cstr'  },
    ];
    const edges = [
      { source: 'feed',  target: 'pfr1'  },
      { source: 'pfr1',  target: 'cstr1' },
      { source: 'cstr1', target: 'cstr2' },
    ];
    const tags = assignTags(nodes, edges);
    expect(tags['pfr1']).toBe('R-101');
    expect(tags['cstr1']).toBe('R-102');
    expect(tags['cstr2']).toBe('R-103');
    expect(tags['feed']).toBeUndefined();
  });

  it('assigns separate class counters: R, E, V, P, K, FV — each starts at 101', () => {
    // chain: cstr → hx → flash → pump → comp → valve
    const nodes = [
      { id: 'c', type: 'cstr'  },
      { id: 'h', type: 'hx'   },
      { id: 'f', type: 'flash' },
      { id: 'p', type: 'pump'  },
      { id: 'k', type: 'comp'  },
      { id: 'v', type: 'valve' },
    ];
    const edges = [
      { source: 'c', target: 'h' },
      { source: 'h', target: 'f' },
      { source: 'f', target: 'p' },
      { source: 'p', target: 'k' },
      { source: 'k', target: 'v' },
    ];
    const tags = assignTags(nodes, edges);
    // hand-calc: each class has exactly one member → all get 101
    expect(tags['c']).toBe('R-101');
    expect(tags['h']).toBe('E-101');
    expect(tags['f']).toBe('V-101');
    expect(tags['p']).toBe('P-101');
    expect(tags['k']).toBe('K-101');
    expect(tags['v']).toBe('FV-101');
  });

  it('utility nodes (mixer, splitter, csplit, purge, feed, product) get no tag', () => {
    const nodes = [
      { id: 'mx', type: 'mixer'    },
      { id: 'sp', type: 'splitter' },
      { id: 'fd', type: 'feed'     },
      { id: 'pr', type: 'product'  },
      { id: 'pu', type: 'purge'    },
      { id: 'cs', type: 'csplit'   },
    ];
    const tags = assignTags(nodes, []);
    // hand-calc: none of these types are in TAG_PREFIX → empty map
    expect(Object.keys(tags)).toHaveLength(0);
  });

  it('handles cyclic graphs gracefully — no infinite loop, both nodes tagged', () => {
    // cycle: n1 → n2 → n1  (recycle loop)
    const nodes = [{ id: 'n1', type: 'cstr' }, { id: 'n2', type: 'pfr' }];
    const edges = [
      { source: 'n1', target: 'n2' },
      { source: 'n2', target: 'n1' },
    ];
    // Should not throw; Kahn's appends cycle members after draining
    const tags = assignTags(nodes, edges);
    const values = Object.values(tags).sort();
    // hand-calc: two R-class nodes → R-101 and R-102 (in some order)
    expect(values).toEqual(['R-101', 'R-102']);
  });

  it('two parallel CSTRs (no edges) get R-101 and R-102 in input order', () => {
    // both nodes have in-degree 0 → queued in array order: a first
    const nodes = [{ id: 'a', type: 'cstr' }, { id: 'b', type: 'cstr' }];
    const tags = assignTags(nodes, []);
    expect(tags['a']).toBe('R-101');
    expect(tags['b']).toBe('R-102');
  });

  it('fixedbed is tagged as R- (reactor class)', () => {
    // hand-calc: fixedbed → R class, first → R-101
    const tags = assignTags([{ id: 'fb', type: 'fixedbed' }], []);
    expect(tags['fb']).toBe('R-101');
  });

  it('batch and semibatch tagged as R-101, R-102 in input order', () => {
    const nodes = [
      { id: 'bt', type: 'batch'    },
      { id: 'sb', type: 'semibatch' },
    ];
    const tags = assignTags(nodes, []);
    expect(tags['bt']).toBe('R-101');
    expect(tags['sb']).toBe('R-102');
  });

  it('mixed flowsheet: reactors tagged R-, HX tagged E-, rest untagged', () => {
    // feed → cstr → hx → mixer → product
    const nodes = [
      { id: 'f',  type: 'feed'    },
      { id: 'r',  type: 'cstr'    },
      { id: 'e',  type: 'hx'      },
      { id: 'mx', type: 'mixer'   },
      { id: 'pr', type: 'product' },
    ];
    const edges = [
      { source: 'f',  target: 'r'  },
      { source: 'r',  target: 'e'  },
      { source: 'e',  target: 'mx' },
      { source: 'mx', target: 'pr' },
    ];
    const tags = assignTags(nodes, edges);
    expect(tags['r']).toBe('R-101');
    expect(tags['e']).toBe('E-101');
    expect(tags['f']).toBeUndefined();
    expect(tags['mx']).toBeUndefined();
    expect(tags['pr']).toBeUndefined();
  });
});
