// UTF-8 with explicit \n\n
// SMOKE: 最小依赖，验证注册表可创建与最小特性可注册\n
import { DependencyContainer } from '../micro-service/dependency-container.js';\n
import { FeatureRegistry } from '../micro-service/feature-registry.js';\n
\n
describe('SMOKE - FeatureRegistry minimal', () => {\n
  test('should create registry and register a tiny feature', async () => {\n
    const container = new DependencyContainer('smoke');\n
    const registry = new FeatureRegistry({ container });\n
\n
    const tiny = {\n
      name: 'smoke-feature',\n
      version: '0.0.1',\n
      dependencies: [],\n
      async install() { /* no-op */ },\n
      async uninstall() { /* no-op */ }\n
    };\n
\n
    registry.register(tiny);\n
    expect(registry.has('smoke-feature')).toBe(true);\n
  });\n
});\n
\n
