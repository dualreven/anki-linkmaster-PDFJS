/**
 * pdf-home module export smoke tests (focused on imports only)
 */

describe('pdf-home module exports', () => {
  test('TableUtils module can be imported', async () => {
    const mod = await import('../table-utils.js');
    expect(typeof mod.TableUtils).toBe('function');
  });

  test('TableWrapperCore module can be imported', async () => {
    const mod = await import('../table-wrapper-core.js');
    expect(typeof mod.TableWrapperCore).toBe('function');
  });

  test('TableWrapper module can be imported', async () => {
    const mod = await import('../table-wrapper.js');
    expect(typeof mod.TableWrapper).toBe('function');
  });
});

